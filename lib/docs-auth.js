"use strict";
// Stateless HMAC-based auth for /docs routes.
// Login = email OTP (no master password, no database) — see lib/otp-auth.js.
//
// Required env vars:
//   DOCS_SECRET          — 32+ random bytes base64 (generate: node scripts/generate-docs-token.js --secret)
//   BREVO_API_KEY        — same key used by lib/email.js (already set in prod)
//   TURNSTILE_SECRET_KEY — same key used by /api/generate-image (already set in prod)
// The public Turnstile site key is hardcoded in render-docs-page.js (same key as index.html).
//
// Access is restricted to a fixed list of allowed emails (no user management needed).

const crypto = require("crypto");
const { createOtpAuth } = require("./otp-auth");

function secret() {
  const s = process.env.DOCS_SECRET;
  if (!s) throw new Error("[docs-auth] DOCS_SECRET not set");
  return s;
}

// Cookie names (docs_sess / docs_otp), path, HMAC inputs and rate-limit buckets
// are unchanged from the pre-factory version, so live sessions keep working.
const auth = createOtpAuth({
  scope: "docs",
  cookiePath: "/docs",
  sessionTtlSec: 24 * 3600,
  otpTtlSec: 15 * 60,
  allowedEmails: ["alexander.perel@gmail.com"],
  secret,
});

// ── Temporary share tokens ─────────────────────────────────────────────────────
function generateShareToken(hours = 24) {
  const exp = Math.floor(Date.now() / 1000) + Math.round(hours * 3600);
  const sig = auth.hmac(`share:${exp}`);
  return { exp, sig, token: `${exp}.${sig}` };
}

function validateShareToken(token) {
  if (!token || typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (parseInt(exp, 10) < Math.floor(Date.now() / 1000)) return false;
  const expected = auth.hmac(`share:${exp}`);
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); }
  catch { return false; }
}

module.exports = { ...auth, generateShareToken, validateShareToken };
