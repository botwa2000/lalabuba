"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");

const rateLimiter = auth.makeRateLimiter(20, auth.HOUR);

module.exports = async (req, res, artworkId) => {
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

  const id = parseInt(artworkId);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid artwork id." });

  // Verify artwork exists.
  const { rows: artRows } = await db.query(
    "SELECT id FROM artworks WHERE id = $1",
    [id]
  );
  if (!artRows.length) return res.status(404).json({ error: "Artwork not found." });

  // Record report (UNIQUE constraint prevents double-reporting).
  try {
    await db.query(
      "INSERT INTO reports (artwork_id, reporter_uuid) VALUES ($1, $2)",
      [id, uuid]
    );
  } catch (e) {
    if (e.code === "23505") {
      // Already reported by this device — idempotent.
      return res.status(200).json({ ok: true });
    }
    throw e;
  }

  // Update report_count and auto-hide if threshold reached.
  const threshold = await db.getConfigInt("report_auto_hide_threshold", 3);
  await db.query(
    `UPDATE artworks
     SET report_count = report_count + 1,
         moderation_status = CASE WHEN report_count + 1 >= $2 THEN 'pending' ELSE moderation_status END
     WHERE id = $1`,
    [id, threshold]
  );

  return res.status(200).json({ ok: true });
};
