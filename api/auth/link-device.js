"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/auth");
const commAuth = require("../../lib/community-auth");

const rateLimiter = commAuth.makeRateLimiter(20, commAuth.HOUR);

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const token = auth.bearerToken(req);
  if (!token) return res.status(401).json({ error: "Authorization required.", code: "NO_TOKEN" });
  const payload = auth.verifyAccessToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token.", code: "TOKEN_INVALID" });

  const deviceUuid = commAuth.getDeviceUuid(req);
  if (!deviceUuid) return res.status(400).json({ error: "X-Device-ID header is required.", code: "NO_DEVICE" });

  await commAuth.upsertProfile(deviceUuid);
  await db.query(
    `INSERT INTO account_devices (account_id, device_uuid) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [payload.accountId, deviceUuid]
  );

  return res.status(200).json({ ok: true, deviceUuid, accountId: payload.accountId });
};

function setCors(res) {
  const origins = commAuth.ALLOWED_ORIGINS;
  res.setHeader("Access-Control-Allow-Origin", origins[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-ID");
}
