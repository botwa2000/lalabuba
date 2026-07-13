"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");

const rateLimiter = auth.makeRateLimiter(100, auth.HOUR);

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

  // Verify artwork exists and is approved.
  const { rows: artRows } = await db.query(
    "SELECT id, star_count FROM artworks WHERE id = $1 AND moderation_status = 'approved'",
    [id]
  );
  if (!artRows.length) return res.status(404).json({ error: "Artwork not found." });

  const maxStars = await db.getConfigInt("stars_per_artwork_max", 100);

  // Toggle: try insert; if duplicate, delete instead.
  let starred;
  try {
    await db.query(
      "INSERT INTO stars (artwork_id, voter_uuid) VALUES ($1, $2)",
      [id, uuid]
    );
    starred = true;
  } catch (e) {
    if (e.code === "23505") {
      // Already starred — unstar.
      await db.query(
        "DELETE FROM stars WHERE artwork_id = $1 AND voter_uuid = $2",
        [id, uuid]
      );
      starred = false;
    } else {
      throw e;
    }
  }

  // Update star_count from source of truth (count table) to stay consistent.
  const { rows: countRows } = await db.query(
    "SELECT COUNT(*) AS cnt FROM stars WHERE artwork_id = $1",
    [id]
  );
  const newCount = Math.min(parseInt(countRows[0].cnt), maxStars);
  await db.query("UPDATE artworks SET star_count = $1 WHERE id = $2", [newCount, id]);

  return res.status(200).json({ starred, starCount: newCount });
};
