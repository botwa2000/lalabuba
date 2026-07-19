"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");

const rateLimiter = auth.makeRateLimiter(60, auth.HOUR);

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (auth.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-ID");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const uuid = auth.requireDeviceUuid(req, res);
  if (!uuid) return;

  const { rows: profileRows } = await db.query(
    "SELECT last_community_check_at FROM profiles WHERE device_uuid = $1",
    [uuid]
  );
  if (!profileRows.length) return res.status(200).json({ newReactions: 0, details: [] });

  const lastCheck = profileRows[0].last_community_check_at;
  let newReactions = 0;
  let details = [];

  if (lastCheck) {
    const { rows } = await db.query(
      `SELECT a.id, a.subject, a.image_path,
              COUNT(s.artwork_id)::int AS new_reaction_count
       FROM artworks a
       JOIN stars s ON s.artwork_id = a.id AND s.voted_at > $2
       WHERE a.device_uuid = $1
         AND a.moderation_status = 'approved'
       GROUP BY a.id, a.subject, a.image_path
       ORDER BY new_reaction_count DESC
       LIMIT 5`,
      [uuid, lastCheck.toISOString()]
    );
    newReactions = rows.reduce((sum, r) => sum + r.new_reaction_count, 0);
    details = rows.map(r => ({
      artworkId:    r.id,
      subject:      r.subject,
      imageUrl:     r.image_path,
      newReactions: r.new_reaction_count,
    }));
  }

  // Update the watermark.
  await db.query(
    "UPDATE profiles SET last_community_check_at = NOW() WHERE device_uuid = $1",
    [uuid]
  );

  return res.status(200).json({ newReactions, details });
};
