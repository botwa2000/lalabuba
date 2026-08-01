"use strict";

// Deep health check: tests that image generation actually works and produces
// a usable coloring page. Called by GET /api/health-deep (internal/admin use).
// Distinct from /api/health which is a lightweight readiness check for the
// Docker/Swarm healthcheck and is called on every deploy.

const { buildPrompt, generateImage, checkColoringPageQuality } = require("../lib/image-providers");

// Cache the last successful deep-check result so repeated calls within
// CACHE_TTL_MS don't burn Novita credits on every status poll.
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let _cachedResult = null;
let _cachedAt     = 0;

// Run a real generation test and return a structured result.
async function runHealthCheck(force = false) {
  const now = Date.now();
  if (!force && _cachedResult && (now - _cachedAt) < CACHE_TTL_MS) {
    return { ..._cachedResult, cached: true, cacheAgeMs: now - _cachedAt };
  }

  const subject    = "cat";
  const difficulty = "easy";
  const seed       = 42;
  const width      = 512;   // small size to reduce cost + latency
  const height     = 512;

  const started = Date.now();
  let status = "ok";
  let error  = null;
  let qualityResult = null;
  let providerMs = null;

  try {
    const prompt = buildPrompt(subject, difficulty, "small", "structured");
    const result = await generateImage(prompt, width, height, seed, {
      difficulty,
      hfToken:  process.env.HF_TOKEN,
      hfModel:  process.env.HF_MODEL,
    });
    providerMs = Date.now() - started;
    qualityResult = checkColoringPageQuality(result.buffer, result.contentType);
    if (!qualityResult.ok) {
      status = "degraded";
      error  = `Image generated but quality check failed: ${qualityResult.reason}`;
    }
  } catch (err) {
    status = "error";
    error  = err.message || String(err);
    providerMs = Date.now() - started;
  }

  const result = {
    status,
    error,
    generationMs: providerMs,
    quality: qualityResult,
    providers: {
      pollinations: "free (no key)",
      together:     process.env.TOGETHER_API_KEY ? "configured" : "not configured",
      cloudflare:   process.env.CF_ACCOUNT_ID ? "configured" : "not configured",
      novita:       process.env.NOVITA_API_KEY ? "configured" : "not configured",
    },
    checkedAt: new Date().toISOString(),
  };

  if (status !== "error") {
    _cachedResult = result;
    _cachedAt = now;
  }
  return result;
}

const ALLOWED_ORIGINS = [
  "https://lalabuba.com",
  "https://www.lalabuba.com",
  "https://dev.lalabuba.com",
  "http://localhost:3000",
];

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }

  // Admin key gate: only authorised callers get the deep check to avoid
  // burning image generation credits on probing.
  const adminKey = process.env.GALLERY_ADMIN_KEY;
  const provided = req.headers["x-admin-key"] || (req.body || {})["adminKey"];
  if (adminKey && provided !== adminKey) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const force = (req.url || "").includes("force=1");
  try {
    const result = await runHealthCheck(force);
    const httpStatus = result.status === "ok" ? 200 : result.status === "degraded" ? 207 : 503;
    res.status(httpStatus).json(result);
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
};

// Allow server.js to run the health check on a schedule and log results.
module.exports.runHealthCheck = runHealthCheck;
