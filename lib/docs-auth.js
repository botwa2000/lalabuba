"use strict";
// Stateless HMAC-based auth for /docs routes.
// Login = email OTP (no master password, no database).
//
// Required env vars:
//   DOCS_SECRET          — 32+ random bytes base64 (generate: node scripts/generate-docs-token.js --secret)
//   BREVO_API_KEY        — same key used by lib/email.js (already set in prod)
//   TURNSTILE_SECRET_KEY — same key used by /api/generate-image (already set in prod)
// The public Turnstile site key is hardcoded in render-docs-page.js (same key as index.html).
//
// Access is restricted to a fixed list of allowed emails (no user management needed).

const crypto = require("crypto");
const https  = require("https");

// ── Config ─────────────────────────────────────────────────────────────────────
const ALLOWED_EMAILS  = new Set(["alexander.perel@gmail.com"]);
const SESSION_TTL_SEC = 24 * 3600;   // session cookie lives 24 h
const OTP_TTL_SEC     = 15 * 60;     // OTP valid 15 min
const COOKIE_SESSION  = "docs_sess";
const COOKIE_OTP      = "docs_otp";

function secret() {
  const s = process.env.DOCS_SECRET;
  if (!s) throw new Error("[docs-auth] DOCS_SECRET not set");
  return s;
}

function hmac(data) {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

// ── Allowed email gate ─────────────────────────────────────────────────────────
function isAllowedEmail(email) {
  return ALLOWED_EMAILS.has((email || "").trim().toLowerCase());
}

// ── OTP generation (stateless — no DB) ────────────────────────────────────────
// The OTP "state" is stored in a short-lived HttpOnly cookie.
// State value = "EXP.HMAC" where HMAC = HMAC(secret, "dotp:CODE:EXP").
// On verify, we recompute the HMAC for the submitted CODE and compare — no DB needed.

function generateOtp() {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // always 6 digits
  const exp  = Math.floor(Date.now() / 1000) + OTP_TTL_SEC;
  const mac  = hmac(`dotp:${code}:${exp}`);
  return { code, state: `${exp}.${mac}` };
}

function validateOtp(submittedCode, cookieState) {
  if (!submittedCode || !cookieState) return false;
  const dot = cookieState.indexOf(".");
  if (dot < 1) return false;
  const exp = cookieState.slice(0, dot);
  const mac = cookieState.slice(dot + 1);
  if (parseInt(exp, 10) < Math.floor(Date.now() / 1000)) return false;
  const code = String(submittedCode).replace(/\D/g, "");
  if (code.length !== 6) return false;
  const expected = hmac(`dotp:${code}:${exp}`);
  try { return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected)); }
  catch { return false; }
}

function otpCookieHeader(state, isHttps) {
  return [
    `${COOKIE_OTP}=${encodeURIComponent(state)}`,
    "HttpOnly",
    isHttps ? "Secure" : "",
    "SameSite=Strict",
    "Path=/docs",
    `Max-Age=${OTP_TTL_SEC}`,
  ].filter(Boolean).join("; ");
}

function clearOtpCookieHeader() {
  return `${COOKIE_OTP}=; HttpOnly; SameSite=Strict; Path=/docs; Max-Age=0`;
}

// ── Session cookie (24 h, no DB) ───────────────────────────────────────────────
function generateSession() {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  return `${exp}.${hmac(`sess:${exp}`)}`;
}

function validateSession(value) {
  if (!value || typeof value !== "string") return false;
  const dot = value.indexOf(".");
  if (dot < 1) return false;
  const exp = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (parseInt(exp, 10) < Math.floor(Date.now() / 1000)) return false;
  const expected = hmac(`sess:${exp}`);
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); }
  catch { return false; }
}

function sessionCookieHeader(value, isHttps) {
  return [
    `${COOKIE_SESSION}=${value}`,
    "HttpOnly",
    isHttps ? "Secure" : "",
    "SameSite=Strict",
    "Path=/docs",
    `Max-Age=${SESSION_TTL_SEC}`,
  ].filter(Boolean).join("; ");
}

function clearSessionCookieHeader() {
  return `${COOKIE_SESSION}=; HttpOnly; SameSite=Strict; Path=/docs; Max-Age=0`;
}

// ── Cookie parser ──────────────────────────────────────────────────────────────
function parseCookies(req) {
  const result = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    try { result[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim()); }
    catch { /* skip malformed */ }
  }
  return result;
}

function getSessionCookie(req) { return parseCookies(req)[COOKIE_SESSION] || null; }
function getOtpCookie(req)     { return parseCookies(req)[COOKIE_OTP]     || null; }
function isAuthenticated(req)  { return validateSession(getSessionCookie(req)); }

// ── Turnstile verification ─────────────────────────────────────────────────────
async function verifyTurnstile(token, ip) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    // Dev: skip verification if key not configured
    console.warn("[docs-auth] TURNSTILE_SECRET_KEY not set — skipping Turnstile check");
    return true;
  }
  if (!token) return false;
  const body = JSON.stringify({ secret: secretKey, response: token, remoteip: ip });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "challenges.cloudflare.com",
      path:     "/turnstile/v0/siteverify",
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", c => { data += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(data).success === true); }
        catch { resolve(false); }
      });
    });
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
    req.write(body);
    req.end();
  });
}

// ── Rate limiter (in-memory, per IP) ─────────────────────────────────────────
// Two buckets: email-send (3/hour) and OTP-verify (5/15-min)
const _sendFails   = new Map(); // ip → [ts, ...]
const _verifyFails = new Map();

function _pruneMap(map, windowMs, ip) {
  const now  = Date.now();
  const list = (map.get(ip) || []).filter(t => now - t < windowMs);
  if (list.length) map.set(ip, list); else map.delete(ip);
  return list;
}

const SEND_WINDOW_MS   = 60 * 60 * 1000; // 1 hour
const SEND_MAX         = 3;               // max 3 OTP emails per hour per IP
const VERIFY_WINDOW_MS = 15 * 60 * 1000; // 15 min
const VERIFY_MAX       = 5;              // max 5 wrong codes per 15 min per IP

function isSendLimited(ip)       { return _pruneMap(_sendFails, SEND_WINDOW_MS, ip).length >= SEND_MAX; }
function recordSend(ip)          { const l = _pruneMap(_sendFails, SEND_WINDOW_MS, ip); l.push(Date.now()); _sendFails.set(ip, l); }
function isVerifyLimited(ip)     { return _pruneMap(_verifyFails, VERIFY_WINDOW_MS, ip).length >= VERIFY_MAX; }
function recordVerifyFail(ip)    { const l = _pruneMap(_verifyFails, VERIFY_WINDOW_MS, ip); l.push(Date.now()); _verifyFails.set(ip, l); }
function clearVerifyFails(ip)    { _verifyFails.delete(ip); }

// ── Temporary share tokens ─────────────────────────────────────────────────────
function generateShareToken(hours = 24) {
  const exp = Math.floor(Date.now() / 1000) + Math.round(hours * 3600);
  const sig = hmac(`share:${exp}`);
  return { exp, sig, token: `${exp}.${sig}` };
}

function validateShareToken(token) {
  if (!token || typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (parseInt(exp, 10) < Math.floor(Date.now() / 1000)) return false;
  const expected = hmac(`share:${exp}`);
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); }
  catch { return false; }
}

// ── Misc helpers ───────────────────────────────────────────────────────────────
function clientIp(req) {
  return (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
}

module.exports = {
  isAllowedEmail,
  generateOtp, validateOtp,
  otpCookieHeader, clearOtpCookieHeader,
  getOtpCookie,
  generateSession, validateSession,
  sessionCookieHeader, clearSessionCookieHeader,
  getSessionCookie, isAuthenticated,
  verifyTurnstile,
  isSendLimited, recordSend,
  isVerifyLimited, recordVerifyFail, clearVerifyFails,
  generateShareToken, validateShareToken,
  clientIp,
};
