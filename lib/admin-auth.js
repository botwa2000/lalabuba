"use strict";
// Auth for the confidential /admin pages (/admin/stats) and their JSON APIs.
// Email OTP via Brevo (lib/otp-auth.js) — same flow as /docs, separate cookies
// (admin_sess / admin_otp, Path=/ so /api/admin/* sees them), separate HMAC key
// and rate-limit buckets. Scripts keep using X-Admin-Key (GALLERY_ADMIN_KEY).

const crypto = require("crypto");
const { createOtpAuth } = require("./otp-auth");

// Admin key is derived from DOCS_SECRET under a fixed label: an independent HMAC
// key without another Swarm secret, and a /docs cookie can never validate here.
function secret() {
  const s = process.env.DOCS_SECRET;
  if (!s) throw new Error("[admin-auth] DOCS_SECRET not set");
  return crypto.createHmac("sha256", s).update("lalabuba-admin-session-v1").digest("base64");
}

const auth = createOtpAuth({
  scope: "admin",
  cookiePath: "/",
  sessionTtlSec: 12 * 3600,
  otpTtlSec: 10 * 60,
  allowedEmails: ["alexander.perel@gmail.com"],
  secret,
  macPrefix: "admin:",
});

// Constant-time X-Admin-Key check (scripts / curl).
function hasAdminKey(req) {
  const expected = process.env.GALLERY_ADMIN_KEY;
  const got = req.headers["x-admin-key"];
  if (!expected || typeof got !== "string") return false;
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

const isAdminRequest = (req) => hasAdminKey(req) || auth.isAuthenticated(req);

module.exports = { ...auth, hasAdminKey, isAdminRequest };
