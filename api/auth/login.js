"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/auth");
const commAuth = require("../../lib/community-auth");

// Stricter rate limit on login to resist brute-force
const rateLimiter = commAuth.makeRateLimiter(20, commAuth.HOUR);

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const { email, password, deviceUuid } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required.", code: "MISSING_FIELDS" });
  }

  const normalEmail = email.trim().toLowerCase();
  const { rows } = await db.query(
    "SELECT id, email, password_hash, email_verified_at FROM accounts WHERE email = $1",
    [normalEmail]
  );
  const account = rows[0];

  // Always run bcrypt to prevent timing attacks on account enumeration.
  const dummyHash = "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const valid = account
    ? await auth.checkPassword(password, account.password_hash)
    : await auth.checkPassword("x", dummyHash).then(() => false);

  if (!valid || !account) {
    return res.status(401).json({ error: "Wrong email or password.", code: "BAD_CREDENTIALS" });
  }

  // Block login if email not yet verified (accounts without password_hash = OTP-only accounts — pass through).
  if (account.password_hash && !account.email_verified_at) {
    return res.status(403).json({
      error: "Please verify your email first. Check your inbox for the 6-digit code.",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  // Update last login + optionally link device.
  await db.query("UPDATE accounts SET last_login_at = NOW() WHERE id = $1", [account.id]);
  if (deviceUuid && /^[0-9a-f-]{36}$/.test(deviceUuid)) {
    await commAuth.upsertProfile(deviceUuid);
    await db.query(
      `INSERT INTO account_devices (account_id, device_uuid) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
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

  // Fetch profile info for the response.
  const profiles = deviceUuid
    ? (await db.query(
        "SELECT nickname, avatar_index FROM profiles WHERE device_uuid = $1",
        [deviceUuid]
      )).rows
    : [];
  const profile = profiles[0] || null;

  return res.status(200).json({
    ok:           true,
    accountId:    account.id,
    email:        account.email,
    accessToken,
    refreshToken,
    expiresIn:    auth.ACCESS_TTL_SEC,
    profile:      profile ? { nickname: profile.nickname, avatarIndex: profile.avatar_index } : null,
  });
};

function setCors(res) {
  const origins = commAuth.ALLOWED_ORIGINS;
  res.setHeader("Access-Control-Allow-Origin", origins[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-ID");
}
