"use strict";
// Stateless email-OTP login, shared by /docs (lib/docs-auth.js) and /admin
// (lib/admin-auth.js). No database: the pending OTP lives in a short-lived
// HttpOnly cookie as "EXP.HMAC(code, exp)", the session as "EXP.HMAC(exp)".
// Each scope gets its own cookie names, path, HMAC key and rate-limit buckets,
// so a /docs session can never open /admin.
//
// Mail goes out via Brevo (lib/email.js, BREVO_API_KEY). Turnstile guards the
// send step; sends and wrong codes are rate-limited per IP (lib/rate-limit.js).

const crypto = require("crypto");
const https = require("https");
const rateLimit = require("./rate-limit");
const { clientIp } = require("./client-ip");

const SEND_WINDOW_MS = 60 * 60 * 1000;
const SEND_MAX = 3;                       // OTP emails per hour per IP
const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_MAX = 5;                     // wrong codes per 15 min per IP

/**
 * @param {object} o
 * @param {string}   o.scope          short id: cookie prefix + rate-limit bucket prefix
 * @param {string}   o.cookiePath     Path attribute of both cookies
 * @param {number}   o.sessionTtlSec
 * @param {number}   o.otpTtlSec
 * @param {string[]} o.allowedEmails
 * @param {() => string} o.secret     HMAC key for this scope
 * @param {string}  [o.macPrefix]     prefix of the HMAC inputs (docs keeps its legacy "" so live sessions survive)
 */
function createOtpAuth(o) {
  const allowed = new Set(o.allowedEmails.map((e) => e.trim().toLowerCase()));
  const cookieSession = `${o.scope}_sess`;
  const cookieOtp = `${o.scope}_otp`;
  const pre = o.macPrefix || "";

  const hmac = (data) => crypto.createHmac("sha256", o.secret()).update(pre + data).digest("base64url");
  const safeEq = (a, b) => {
    const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  const nowSec = () => Math.floor(Date.now() / 1000);

  function isAllowedEmail(email) {
    return allowed.has((email || "").trim().toLowerCase());
  }

  function generateOtp() {
    const code = String(crypto.randomInt(100000, 1000000));
    const exp = nowSec() + o.otpTtlSec;
    return { code, state: `${exp}.${hmac(`dotp:${code}:${exp}`)}` };
  }

  function validateOtp(submittedCode, cookieState) {
    if (!submittedCode || !cookieState) return false;
    const dot = cookieState.indexOf(".");
    if (dot < 1) return false;
    const exp = cookieState.slice(0, dot);
    if (parseInt(exp, 10) < nowSec()) return false;
    const code = String(submittedCode).replace(/\D/g, "");
    if (code.length !== 6) return false;
    return safeEq(cookieState.slice(dot + 1), hmac(`dotp:${code}:${exp}`));
  }

  function cookie(name, value, maxAge, isHttps) {
    return [`${name}=${value}`, "HttpOnly", isHttps ? "Secure" : "", "SameSite=Strict",
      `Path=${o.cookiePath}`, `Max-Age=${maxAge}`].filter(Boolean).join("; ");
  }

  const otpCookieHeader = (state, isHttps) => cookie(cookieOtp, encodeURIComponent(state), o.otpTtlSec, isHttps);
  const clearOtpCookieHeader = () => cookie(cookieOtp, "", 0, false);

  function generateSession() {
    const exp = nowSec() + o.sessionTtlSec;
    return `${exp}.${hmac(`sess:${exp}`)}`;
  }

  function validateSession(value) {
    if (!value || typeof value !== "string") return false;
    const dot = value.indexOf(".");
    if (dot < 1) return false;
    const exp = value.slice(0, dot);
    if (parseInt(exp, 10) < nowSec()) return false;
    try { return safeEq(value.slice(dot + 1), hmac(`sess:${exp}`)); } catch { return false; }
  }

  const sessionCookieHeader = (value, isHttps) => cookie(cookieSession, value, o.sessionTtlSec, isHttps);
  const clearSessionCookieHeader = () => cookie(cookieSession, "", 0, false);

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

  const getSessionCookie = (req) => parseCookies(req)[cookieSession] || null;
  const getOtpCookie = (req) => parseCookies(req)[cookieOtp] || null;
  const isAuthenticated = (req) => validateSession(getSessionCookie(req));

  const isSendLimited = async (ip) => (await rateLimit.peek(`${o.scope}:otp-send`, ip, SEND_WINDOW_MS)) >= SEND_MAX;
  const recordSend = (ip) => rateLimit.add(`${o.scope}:otp-send`, ip, SEND_WINDOW_MS);
  const isVerifyLimited = async (ip) => (await rateLimit.peek(`${o.scope}:otp-verify-fail`, ip, VERIFY_WINDOW_MS)) >= VERIFY_MAX;
  const recordVerifyFail = (ip) => rateLimit.add(`${o.scope}:otp-verify-fail`, ip, VERIFY_WINDOW_MS);
  const clearVerifyFails = (ip) => rateLimit.reset(`${o.scope}:otp-verify-fail`, ip);

  return {
    hmac, isAllowedEmail,
    generateOtp, validateOtp, otpCookieHeader, clearOtpCookieHeader, getOtpCookie,
    generateSession, validateSession, sessionCookieHeader, clearSessionCookieHeader,
    getSessionCookie, isAuthenticated,
    isSendLimited, recordSend, isVerifyLimited, recordVerifyFail, clearVerifyFails,
    verifyTurnstile, clientIp,
  };
}

// Cloudflare Turnstile siteverify. Fails closed in production when the secret is
// missing; only local dev (no APP_ENV=prod / NODE_ENV=production) skips it.
async function verifyTurnstile(token, ip) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    if (process.env.APP_ENV === "prod" || process.env.NODE_ENV === "production") {
      console.error("SECURITY: TURNSTILE_SECRET_KEY unset in production — refusing OTP login");
      return false;
    }
    console.warn("[otp-auth] TURNSTILE_SECRET_KEY not set — skipping Turnstile check (dev)");
    return true;
  }
  if (!token) return false;
  const body = JSON.stringify({ secret: secretKey, response: token, remoteip: ip });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "challenges.cloudflare.com",
      path: "/turnstile/v0/siteverify",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(data).success === true); } catch { resolve(false); }
      });
    });
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
    req.write(body);
    req.end();
  });
}

module.exports = { createOtpAuth, verifyTurnstile };
