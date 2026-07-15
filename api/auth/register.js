"use strict";
// Registration now creates the account and triggers OTP email verification.
// Tokens are NOT issued until /api/auth/verify-email succeeds.
const db       = require("../../lib/db");
const auth     = require("../../lib/auth");
const email    = require("../../lib/email");
const commAuth = require("../../lib/community-auth");

const rateLimiter    = commAuth.makeRateLimiter(10, commAuth.HOUR);
const emailRateLimiter = commAuth.makeRateLimiter(3, commAuth.HOUR);

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const { email: rawEmail, password, deviceUuid, lang } = req.body || {};

  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return res.status(400).json({ error: "Invalid email address.", code: "BAD_EMAIL" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters.", code: "BAD_PASSWORD" });
  }

  const normalEmail = rawEmail.trim().toLowerCase();
  const safeLang    = /^[a-z]{2,3}$/.test(lang || "") ? lang : "en";

  const { rows: existing } = await db.query("SELECT id, email_verified_at FROM accounts WHERE email = $1", [normalEmail]);
  if (existing.length && existing[0].email_verified_at) {
    return res.status(409).json({ error: "That email is already registered.", code: "EMAIL_TAKEN" });
  }

  const passwordHash = await auth.hashPassword(password);
  let account;

  if (existing.length) {
    // Account exists but unverified — update password and resend OTP
    await db.query(
      "UPDATE accounts SET password_hash = $1, email_verification_attempted_at = NOW() WHERE id = $2",
      [passwordHash, existing[0].id]
    );
    account = { id: existing[0].id, email: normalEmail };
  } else {
    const { rows } = await db.query(
      `INSERT INTO accounts (email, password_hash, email_verification_attempted_at)
       VALUES ($1, $2, NOW()) RETURNING id, email`,
      [normalEmail, passwordHash]
    );
    account = rows[0];
  }

  // Link device UUID if provided (before verification, so device is paired).
  if (deviceUuid && /^[0-9a-f-]{36}$/i.test(deviceUuid)) {
    await commAuth.upsertProfile(deviceUuid);
    await db.query(
      "INSERT INTO account_devices (account_id, device_uuid) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [account.id, deviceUuid]
    );
  }

  // Send OTP (respect rate limit per email)
  if (!emailRateLimiter(normalEmail)) {
    await db.query(
      "UPDATE email_otp_codes SET used_at = NOW() WHERE email = $1 AND used_at IS NULL AND expires_at > NOW()",
      [normalEmail]
    );
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.query(
      "INSERT INTO email_otp_codes (email, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')",
      [normalEmail, code]
    );
    email.sendOtp(normalEmail, code, safeLang).catch(err =>
      console.error("[register] OTP send failed:", err.message)
    );
  }

  // Return 201 with verification pending — NO tokens yet
  return res.status(201).json({
    ok:                 true,
    accountId:          account.id,
    email:              account.email,
    verificationPending: true,
  });
};

function setCors(res) {
  const origins = commAuth.ALLOWED_ORIGINS;
  res.setHeader("Access-Control-Allow-Origin", origins[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-ID");
}
