"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/auth");
const commAuth = require("../../lib/community-auth");

const rateLimiter = commAuth.makeRateLimiter(60, commAuth.HOUR);

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const { refreshToken } = req.body || {};
  if (!refreshToken || typeof refreshToken !== "string") {
    return res.status(400).json({ error: "refreshToken is required.", code: "MISSING_TOKEN" });
  }

  const tokenHash = auth.hashToken(refreshToken);
  const { rows } = await db.query(
    `SELECT account_id, device_uuid, expires_at FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  const stored = rows[0];

  if (!stored || new Date(stored.expires_at) < new Date()) {
    // Clean up expired token if found.
    if (stored) await db.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [tokenHash]);
    return res.status(401).json({ error: "Invalid or expired refresh token.", code: "TOKEN_EXPIRED" });
  }

  const { rows: accountRows } = await db.query(
    "SELECT id, email FROM accounts WHERE id = $1",
    [stored.account_id]
  );
  if (!accountRows.length) {
    return res.status(401).json({ error: "Account not found.", code: "ACCOUNT_NOT_FOUND" });
  }
  const account = accountRows[0];

  // Rotate: delete old token, issue new pair.
  await db.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [tokenHash]);

  const newAccessToken  = auth.generateAccessToken(account.id, account.email);
  const newRefreshToken = auth.generateRefreshToken();
  await db.query(
    `INSERT INTO refresh_tokens (token_hash, account_id, device_uuid, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [auth.hashToken(newRefreshToken), account.id, stored.device_uuid, auth.refreshExpiresAt()]
  );

  return res.status(200).json({
    ok:           true,
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn:    auth.ACCESS_TTL_SEC,
  });
};

function setCors(res) {
  const origins = commAuth.ALLOWED_ORIGINS;
  res.setHeader("Access-Control-Allow-Origin", origins[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
