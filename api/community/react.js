"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");

const rateLimiter = auth.makeRateLimiter(100, auth.HOUR);

// Whitelisted column names — safe for SQL interpolation (no user input reaches here).
const REACTION_COL = {
  fire:      'fire_count',
  heart:     'heart_count',
  laugh:     'laugh_count',
  celebrate: 'celebrate_count',
};
const VALID_REACTIONS = new Set(Object.keys(REACTION_COL));

module.exports = async (req, res, artworkId) => {
  const origin = req.headers.origin;
  if (auth.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-ID");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const uuid = auth.requireDeviceUuid(req, res);
  if (!uuid) return;

  const id = parseInt(artworkId);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid artwork id." });

  const body     = req.body || {};
  const reaction = (body.reaction || "").toLowerCase();
  if (!VALID_REACTIONS.has(reaction)) {
    return res.status(400).json({ error: "reaction must be fire, heart, laugh, or celebrate." });
  }

  const { rows: artRows } = await db.query(
    "SELECT id FROM artworks WHERE id = $1 AND moderation_status = 'approved'",
    [id]
  );
  if (!artRows.length) return res.status(404).json({ error: "Artwork not found." });

  // Get this user's existing reaction (if any).
  const { rows: existing } = await db.query(
    "SELECT reaction_type FROM stars WHERE artwork_id = $1 AND voter_uuid = $2",
    [id, uuid]
  );
  const currentReaction = existing[0]?.reaction_type || null;
  const isSame          = currentReaction === reaction;
  const col             = REACTION_COL[reaction];

  if (currentReaction) {
    // Decrement the old emoji count and total star_count.
    const oldCol = REACTION_COL[currentReaction];
    if (oldCol) {
      await db.query(
        `UPDATE artworks SET ${oldCol} = GREATEST(0, ${oldCol} - 1), star_count = GREATEST(0, star_count - 1) WHERE id = $1`,
        [id]
      );
    }
  }

  if (isSame) {
    // Toggle off — remove reaction entirely.
    await db.query("DELETE FROM stars WHERE artwork_id = $1 AND voter_uuid = $2", [id, uuid]);
  } else {
    // Set or change reaction.
    await db.query(
      `INSERT INTO stars (artwork_id, voter_uuid, reaction_type, voted_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (artwork_id, voter_uuid)
       DO UPDATE SET reaction_type = $3, voted_at = NOW()`,
      [id, uuid, reaction]
    );
    await db.query(
      `UPDATE artworks SET ${col} = ${col} + 1, star_count = star_count + 1 WHERE id = $1`,
      [id]
    );
  }

  // Return updated counts.
  const { rows: counts } = await db.query(
    "SELECT fire_count, heart_count, laugh_count, celebrate_count, star_count FROM artworks WHERE id = $1",
    [id]
  );
  const c = counts[0] || {};
  return res.status(200).json({
    reacted:       !isSame,
    reaction:      isSame ? null : reaction,
    fireCount:     c.fire_count     || 0,
    heartCount:    c.heart_count    || 0,
    laughCount:    c.laugh_count    || 0,
    celebrateCount:c.celebrate_count|| 0,
    totalCount:    c.star_count     || 0,
  });
};
