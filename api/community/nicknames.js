"use strict";
const { getAllNicknames } = require("../../lib/nicknames");
const { AVATARS }         = require("../../lib/avatar");
const auth                = require("../../lib/community-auth");

const rateLimiter = auth.makeRateLimiter(60, auth.HOUR);

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

  // Cache-friendly — this list never changes at runtime.
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({ nicknames: getAllNicknames(), avatars: AVATARS });
};
