"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");

const rateLimiter = auth.makeRateLimiter(60, auth.HOUR);

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (auth.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-ID");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const ip   = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  const uuid = auth.requireDeviceUuid(req, res);
  if (!uuid) return;

  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  await auth.upsertProfile(uuid);

  const body = req.body || {};
  const totalCompleted  = parseInt(body.totalCompleted);
  const currentStreak   = parseInt(body.currentStreak);
  const longestStreak   = parseInt(body.longestStreak);
  const lastActiveDate  = typeof body.lastActiveDate === "string"
    ? body.lastActiveDate.slice(0, 10) // accept 'YYYY-MM-DD' only
    : null;

  // Validate: all must be non-negative integers.
  if ([totalCompleted, currentStreak, longestStreak].some(v => !Number.isFinite(v) || v < 0)) {
    return res.status(400).json({ error: "Invalid progress values." });
  }

  await db.query(
    `UPDATE profiles
     SET total_completed = GREATEST(total_completed, $2),
         current_streak  = $3,
         longest_streak  = GREATEST(longest_streak, $4),
         last_active_date = COALESCE($5::date, last_active_date),
         updated_at      = NOW()
     WHERE device_uuid = $1`,
    [uuid, totalCompleted, currentStreak, longestStreak, lastActiveDate]
  );

  return res.status(200).json({ ok: true });
};
