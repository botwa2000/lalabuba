"use strict";
// POST /api/t — first-party usage events from the website beacon
// (public/js/t.js, sent as text/plain via navigator.sendBeacon so no CORS
// preflight) and the mobile apps (Flutter UsageService). Validation and the
// privacy rules live in lib/usage.js. Always answers 204 for accepted batches —
// clients never retry on a 2xx and never show errors to the child.

const rateLimit = require("../lib/rate-limit");
const { clientIp } = require("../lib/client-ip");
const usage = require("../lib/usage");

// Generous: a busy web visit sends one batch per page plus one on hide; apps
// flush every 30 s while open. This only stops floods.
const LIMIT = 300;
const WINDOW_MS = 10 * 60_000;

module.exports = async function trackHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const rl = await rateLimit.consume("track:ip", clientIp(req), LIMIT, WINDOW_MS);
  if (rl.limited) return res.status(429).json({ error: "Too many requests." });
  try {
    await usage.recordEvents(req, req.body || {});
  } catch (err) {
    console.error("[track]", err.message);
  }
  res.statusCode = 204;
  res.end();
};
