"use strict";
// Stateless email-OTP login, shared by /docs (lib/docs-auth.js) and /admin
// (lib/admin-auth.js). No database: the pending OTP lives in a short-lived
// HttpOnly cookie as "EXP.TAG.HMAC(code, exp, tag)", the session as
// "EXP.TAG.HMAC(exp, tag)". TAG is an opaque HMAC of the signed-in email —
// never the address itself — and is re-checked against the CURRENT allowlist on
// every request, so removing an address revokes its sessions immediately.
// Each scope gets its own cookie names, path, HMAC key and rate-limit buckets,
// so a /docs session can never open /admin.
//
// The allowlist is never in the repo (it is public): it is read from an env var
// (a Swarm secret in prod) as a comma/space-separated list. Unset → nobody may
// log in. Unknown addresses get the same page, cookie and timing as allowed
// ones (see beginLogin), so the list cannot be probed from outside.
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
 * @param {() => string} o.allowedEmails  raw allowlist (comma/space separated), read per call
 * @param {() => string} o.secret     HMAC key for this scope
 * @param {string}  [o.macPrefix]     prefix of the HMAC inputs
 * @param {boolean} [o.anonymousSessions]  allow email-less sessions (docs share links)
 */
function createOtpAuth(o) {
  const cookieSession = `${o.scope}_sess`;
  const cookieOtp = `${o.scope}_otp`;
  const pre = o.macPrefix || "";
  const ANON = "-";

  const hmac = (data) => crypto.createHmac("sha256", o.secret()).update(pre + data).digest("base64url");
  const safeEq = (a, b) => {
    const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  const nowSec = () => Math.floor(Date.now() / 1000);
  const norm = (e) => String(e || "").trim().toLowerCase();

  let warned = false;
  function allowedList() {
    const list = String(o.allowedEmails() || "").split(/[\s,;]+/).map(norm).filter((e) => e.includes("@"));
    if (!list.length && !warned) {
      warned = true;
      console.error(`SECURITY: [${o.scope}-auth] no allowlist configured — every login is refused`);
    }
    return list;
  }
  const emailTag = (email) => hmac(`id:${norm(email)}`).slice(0, 22);
  const isAllowedEmail = (email) => {
    const e = norm(email);
    return !!e && allowedList().includes(e);
  };
  // A tag is valid only while its address is still on the allowlist.
  const isAllowedTag = (tag) => allowedList().some((e) => safeEq(emailTag(e), tag));

  function split3(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    if (!/^\d+$/.test(parts[0]) || parseInt(parts[0], 10) < nowSec()) return null;
    return parts;
  }

  // The OTP state is bound to the email it was requested for. For an address
  // that is not allowed we still issue a well-formed state (so the response is
  // indistinguishable), but its tag can never pass isAllowedTag.
  function generateOtp(email) {
    const code = String(crypto.randomInt(100000, 1000000));
    const exp = nowSec() + o.otpTtlSec;
    const tag = emailTag(email);
    return { code, state: `${exp}.${tag}.${hmac(`dotp:${code}:${exp}:${tag}`)}` };
  }

  /** @returns {string|null} the email tag to open a session for, or null */
  function validateOtp(submittedCode, cookieState) {
    const parts = split3(cookieState);
    if (!parts || !submittedCode) return null;
    const [exp, tag, mac] = parts;
    const code = String(submittedCode).replace(/\D/g, "");
    if (code.length !== 6) return null;
    if (!safeEq(mac, hmac(`dotp:${code}:${exp}:${tag}`))) return null;
    return isAllowedTag(tag) ? tag : null;
  }

  function cookie(name, value, maxAge, isHttps) {
    return [`${name}=${value}`, "HttpOnly", isHttps ? "Secure" : "", "SameSite=Strict",
      `Path=${o.cookiePath}`, `Max-Age=${maxAge}`].filter(Boolean).join("; ");
  }

  const otpCookieHeader = (state, isHttps) => cookie(cookieOtp, encodeURIComponent(state), o.otpTtlSec, isHttps);
  const clearOtpCookieHeader = () => cookie(cookieOtp, "", 0, false);

  /** @param {string|null} tag  from validateOtp; null = anonymous (scopes that allow it) */
  function generateSession(tag) {
    const t = tag || ANON;
    if (t === ANON && !o.anonymousSessions) throw new Error(`[${o.scope}-auth] anonymous session not allowed`);
    const exp = nowSec() + o.sessionTtlSec;
    return `${exp}.${t}.${hmac(`sess:${exp}:${t}`)}`;
  }

  function validateSession(value) {
    const parts = split3(value);
    if (!parts) return false;
    const [exp, tag, mac] = parts;
    if (!safeEq(mac, hmac(`sess:${exp}:${tag}`))) return false;
    if (tag === ANON) return !!o.anonymousSessions;
    return isAllowedTag(tag);
  }

  // Login step 1, identical in every observable way for allowed and unknown
  // addresses: same cookie, same page, and the mail is sent in the background
  // so response time doesn't reveal the allowlist either.
  // `send(email, code)` is only called for an allowed address.
  function beginLogin(email, send) {
    const { code, state } = generateOtp(email);
    if (isAllowedEmail(email)) {
      Promise.resolve().then(() => send(norm(email), code))
        .catch((err) => console.error(`[${o.scope}-auth] OTP email send failed:`, err.message));
    }
    return state;
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
    hmac, isAllowedEmail, beginLogin,
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
