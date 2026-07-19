"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");

const rateLimiter = auth.makeRateLimiter(120, auth.HOUR);

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (auth.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const enabled = await db.getConfigBool("weekly_theme_enabled", false);
  if (!enabled) return res.status(200).json({ active: false });

  const { rows } = await db.query(
    `SELECT theme_word, theme_emoji, starts_at, ends_at
     FROM weekly_themes
     WHERE starts_at <= NOW() AND ends_at > NOW()
     ORDER BY starts_at DESC
     LIMIT 1`
  );

  if (!rows.length) return res.status(200).json({ active: false });

  const t = rows[0];
  return res.status(200).json({
    active:     true,
    themeWord:  t.theme_word,
    themeEmoji: t.theme_emoji,
    startsAt:   t.starts_at,
    endsAt:     t.ends_at,
  });
};
