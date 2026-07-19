"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");

const rateLimiter = auth.makeRateLimiter(60, auth.HOUR);

module.exports = async (req, res, artworkId) => {
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

  const id = parseInt(artworkId);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid artwork id." });

  const q        = req.query || {};
  const page     = Math.max(0, parseInt(q.page) || 0);
  const pageSize = 12;

  const { rows } = await db.query(
    `SELECT a.id, a.image_path, a.shared_at,
            a.fire_count, a.heart_count, a.laugh_count, a.celebrate_count, a.star_count,
            p.nickname, p.avatar_index
     FROM artworks a
     JOIN profiles p ON p.device_uuid = a.device_uuid
     WHERE a.parent_artwork_id = $1
       AND a.moderation_status = 'approved'
       AND a.expires_at > NOW()
     ORDER BY a.shared_at DESC
     LIMIT $2 OFFSET $3`,
    [id, pageSize + 1, page * pageSize]
  );

  // Also return the original artwork's recolor_count for the "N people colored this" label.
  const { rows: orig } = await db.query(
    "SELECT recolor_count FROM artworks WHERE id = $1",
    [id]
  );

  const hasMore = rows.length > pageSize;
  const items   = rows.slice(0, pageSize).map(r => ({
    id:             r.id,
    imageUrl:       r.image_path,
    sharedAt:       r.shared_at,
    fireCount:      r.fire_count      || 0,
    heartCount:     r.heart_count     || 0,
    laughCount:     r.laugh_count     || 0,
    celebrateCount: r.celebrate_count || 0,
    totalCount:     r.star_count      || 0,
    nickname:       r.nickname        || "Colorist",
    avatarIndex:    r.avatar_index,
  }));

  return res.status(200).json({
    variations:   items,
    recolorCount: orig[0]?.recolor_count || 0,
    nextPage:     hasMore ? page + 1 : null,
  });
};
