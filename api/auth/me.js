"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/auth");
const commAuth = require("../../lib/community-auth");

const rateLimiter = commAuth.makeRateLimiter(120, commAuth.HOUR);

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const token = auth.bearerToken(req);
  if (!token) return res.status(401).json({ error: "Authorization required.", code: "NO_TOKEN" });

  const payload = auth.verifyAccessToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token.", code: "TOKEN_INVALID" });

  const { rows: accountRows } = await db.query(
    "SELECT id, email, display_name, created_at, last_login_at FROM accounts WHERE id = $1",
    [payload.accountId]
  );
  if (!accountRows.length) return res.status(404).json({ error: "Account not found." });
  const account = accountRows[0];

  // Linked device UUIDs for this account.
  const { rows: deviceRows } = await db.query(
    `SELECT ad.device_uuid, ad.linked_at, p.nickname, p.avatar_index, p.total_completed,
            p.current_streak, p.sharing_enabled
     FROM account_devices ad
     LEFT JOIN profiles p ON p.device_uuid = ad.device_uuid
     WHERE ad.account_id = $1
     ORDER BY ad.linked_at ASC`,
    [account.id]
  );

  return res.status(200).json({
    ok:          true,
    accountId:   account.id,
    email:       account.email,
    displayName: account.display_name,
    createdAt:   account.created_at,
    lastLoginAt: account.last_login_at,
    devices:     deviceRows.map(d => ({
      deviceUuid:     d.device_uuid,
      linkedAt:       d.linked_at,
      nickname:       d.nickname,
      avatarIndex:    d.avatar_index,
      totalCompleted: d.total_completed,
      currentStreak:  d.current_streak,
      sharingEnabled: d.sharing_enabled,
    })),
  });
};

function setCors(res) {
  const origins = commAuth.ALLOWED_ORIGINS;
  res.setHeader("Access-Control-Allow-Origin", origins[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
