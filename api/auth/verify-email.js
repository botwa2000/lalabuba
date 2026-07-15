"use strict";
const db       = require("../../lib/db");
const auth     = require("../../lib/auth");
const commAuth = require("../../lib/community-auth");

const MAX_ATTEMPTS = 5;

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const { email: rawEmail, code, deviceUuid } = req.body || {};
  if (!rawEmail || !code) {
    return res.status(400).json({ error: "Email and code are required.", code: "MISSING_FIELDS" });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Code must be 6 digits.", code: "BAD_CODE" });
  }

  const normalEmail = rawEmail.trim().toLowerCase();

  // Find latest non-expired, non-used OTP for this email
  const { rows: otpRows } = await db.query(
    `SELECT id, code, attempts FROM email_otp_codes
     WHERE email = $1 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [normalEmail]
  );

  if (!otpRows.length) {
    return res.status(400).json({ error: "No valid code found. Please request a new one.", code: "NO_CODE" });
  }

  const otp = otpRows[0];

  // Increment attempt counter first
  const { rows: updated } = await db.query(
    "UPDATE email_otp_codes SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts",
    [otp.id]
  );
  const attempts = updated[0]?.attempts || otp.attempts + 1;

  if (attempts >= MAX_ATTEMPTS) {
    await db.query("UPDATE email_otp_codes SET used_at = NOW() WHERE id = $1", [otp.id]);
    return res.status(429).json({ error: "Too many incorrect attempts. Please request a new code.", code: "MAX_ATTEMPTS" });
  }

  if (otp.code !== code) {
    return res.status(400).json({
      error: "Incorrect code.",
      code: "WRONG_CODE",
      attemptsLeft: MAX_ATTEMPTS - attempts,
    });
  }

  // Correct code — mark used
  await db.query("UPDATE email_otp_codes SET used_at = NOW() WHERE id = $1", [otp.id]);

  // Ensure account exists (upsert on email, mark verified)
  const { rows: existing } = await db.query("SELECT id, email FROM accounts WHERE email = $1", [normalEmail]);
  let account;
  if (existing.length) {
    await db.query(
      "UPDATE accounts SET email_verified_at = NOW(), last_login_at = NOW() WHERE id = $1",
      [existing[0].id]
    );
    account = existing[0];
  } else {
    const { rows } = await db.query(
      `INSERT INTO accounts (email, password_hash, email_verified_at, last_login_at)
       VALUES ($1, '', NOW(), NOW()) RETURNING id, email`,
      [normalEmail]
    );
    account = rows[0];
  }

  // Link device if provided
  if (deviceUuid && /^[0-9a-f-]{36}$/i.test(deviceUuid)) {
    await commAuth.upsertProfile(deviceUuid);
    await db.query(
      "INSERT INTO account_devices (account_id, device_uuid) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [account.id, deviceUuid]
    );
  }

  const accessToken  = auth.generateAccessToken(account.id, account.email);
  const refreshToken = auth.generateRefreshToken();
  await db.query(
    `INSERT INTO refresh_tokens (token_hash, account_id, device_uuid, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [auth.hashToken(refreshToken), account.id, deviceUuid || null, auth.refreshExpiresAt()]
  );

  return res.status(200).json({
    ok:           true,
    accountId:    account.id,
    email:        account.email,
    accessToken,
    refreshToken,
    expiresIn:    auth.ACCESS_TTL_SEC,
  });
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", commAuth.ALLOWED_ORIGINS[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
