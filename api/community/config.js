"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");

const rateLimiter = auth.makeRateLimiter(120, auth.HOUR);

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

  const cfg = await db.getAllConfig();

  res.status(200).json({
    communityEnabled:         cfg.community_enabled           === "true",
    sharingEnabled:           cfg.sharing_enabled             === "true",
    leaderboardEnabled:       cfg.leaderboard_enabled         === "true",
    familyEnabled:            cfg.family_enabled              === "true",
    maxSharesPerWeek:         parseInt(cfg.max_shares_per_week)    || 5,
    maxArtworksPerDevice:     parseInt(cfg.max_artworks_per_device) || 50,
    artworkTtlDays:           parseInt(cfg.artwork_ttl_days)       || 30,
    leaderboardSize:          parseInt(cfg.leaderboard_size)       || 10,
    galleryPageSize:          parseInt(cfg.gallery_page_size)      || 20,
    reportAutoHideThreshold:  parseInt(cfg.report_auto_hide_threshold) || 3,
    maxFamilyMembers:         parseInt(cfg.max_family_members)     || 6,
  });
};
