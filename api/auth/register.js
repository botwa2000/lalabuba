"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/auth");
const commAuth = require("../../lib/community-auth");

const rateLimiter = commAuth.makeRateLimiter(10, commAuth.HOUR);

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const { email, password, deviceUuid } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address.", code: "BAD_EMAIL" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters.", code: "BAD_PASSWORD" });
  }

  const normalEmail = email.trim().toLowerCase();

  // Check for existing account.
  const { rows: existing } = await db.query(
    "SELECT id FROM accounts WHERE email = $1",
    [normalEmail]
  );
  if (existing.length) {
    return res.status(409).json({ error: "That email is already registered.", code: "EMAIL_TAKEN" });
  }

  const passwordHash = await auth.hashPassword(password);
  const { rows } = await db.query(
    `INSERT INTO accounts (email, password_hash, last_login_at)
     VALUES ($1, $2, NOW())
     RETURNING id, email`,
    [normalEmail, passwordHash]
  );
  const account = rows[0];

  // Link device UUID if provided.
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

  return res.status(201).json({
    ok:           true,
    accountId:    account.id,
    email:        account.email,
    accessToken,
    refreshToken,
    expiresIn:    auth.ACCESS_TTL_SEC,
  });
};

function setCors(res) {
  const origins = commAuth.ALLOWED_ORIGINS;
  res.setHeader("Access-Control-Allow-Origin", origins[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-ID");
}
