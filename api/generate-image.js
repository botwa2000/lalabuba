const fs   = require("fs");
const path = require("path");
const { clientIp } = require("../lib/client-ip");
const rateLimit = require("../lib/rate-limit");
const authStats = require("../lib/auth-stats");
const usage = require("../lib/usage");
const { verifyAppCheckToken } = require("../lib/app-check");
const { getSecurityConfig } = require("../lib/security-config");
const { sanitizeSubject, isAdminBlockedSubject } = require("../lib/content-safety");
const moderation = require("../lib/moderation");
const db = require("../lib/db");
const { buildPrompt, generateImage } = require("../lib/image-providers");
const { translateToEnglish } = require("../lib/translate");

const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "huggingface";

// Shared coloring images stored locally; expire after 7 days.
const COLORING_DIR  = path.join(__dirname, "../data/images/c");
const SHARE_TTL_MS  = 7 * 24 * 60 * 60 * 1000;

async function loadAdminBlockedSubjects() {
  try {
    const list = JSON.parse((await db.getConfig("blocked_subjects", "[]")) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function ensureColoringDir() {
  if (!fs.existsSync(COLORING_DIR)) fs.mkdirSync(COLORING_DIR, { recursive: true });
}

// Delete local images older than SHARE_TTL_MS. Fire-and-forget — never awaited.
function cleanupOldLocalImages() {
  try {
    if (!fs.existsSync(COLORING_DIR)) return;
    const cutoff = Date.now() - SHARE_TTL_MS;
    for (const file of fs.readdirSync(COLORING_DIR)) {
      const fp = path.join(COLORING_DIR, file);
      try {
        if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
      } catch { /* ignore per-file errors */ }
    }
  } catch (err) {
    console.error("Local image cleanup error (non-fatal):", err.message);
  }
}

// ─── Turnstile verification ───────────────────────────────────────────────────
// Fails CLOSED: if a secret is configured but verification can't succeed (no
// token, rejected token, or Cloudflare unreachable after one retry) the request
// is blocked. The previous "unreachable → allow" behaviour let anyone bypass the
// bot check by making the siteverify call fail. Only an explicitly-unset secret
// (local dev) skips the check.
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Dev-only escape hatch. In production a missing secret must NOT silently
    // turn off bot protection — fail closed and log loudly.
    if (process.env.APP_ENV === "prod" || process.env.NODE_ENV === "production") {
      console.error("SECURITY: TURNSTILE_SECRET_KEY unset in production — blocking web request");
      return false;
    }
    return true;
  }
  if (!token) {
    console.warn(`[turnstile] fail reason=no-token ip=${ip}`);
    return false;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      if (data.success !== true) {
        console.warn(`[turnstile] fail reason=${(data["error-codes"] || []).join(",") || "rejected"} ip=${ip}`);
      }
      return data.success === true;
    } catch {
      if (attempt === 1) {
        console.warn(`[turnstile] fail reason=unreachable ip=${ip}`);
        return false; // unreachable after a retry → fail closed
      }
    }
  }
  return false;
}

// ─── Request authentication ───────────────────────────────────────────────────
// Every generation must carry a PROOF, never an absence:
//   web    (has Origin)  → Cloudflare Turnstile token
//   native (no Origin)   → Firebase App Check token (Play Integrity / App Attest)
// A native request with no App Check token is an "unattested" legacy app build:
// allowed + counted while security_config.appCheck.enforce is false (monitor),
// rejected once it is true. A present-but-invalid token is always rejected.
// Returns { ok } or { ok:false, status, error }.
async function authenticate(req, body, ip, sec) {
  if (req.headers.origin) {
    const ok = await verifyTurnstile(body.turnstileToken, ip);
    authStats.record(ok ? "web_turnstile_ok" : "web_turnstile_fail");
    return ok ? { ok: true } : { ok: false, status: 403, error: "Bot check failed — please try again." };
  }

  const token = req.headers["x-firebase-appcheck"];
  const enforce = sec.appCheck.enforce === true;
  if (!token) {
    authStats.record(enforce ? "native_unattested_blocked" : "native_unattested_allowed");
    return enforce
      ? { ok: false, status: 403, error: "Please update Lalabuba to the latest version to keep drawing." }
      : { ok: true };
  }

  const result = await verifyAppCheckToken(String(token), sec.appCheck);
  if (result.ok) {
    authStats.record("native_attested");
    return { ok: true, appId: result.appId };
  }
  if (result.reason === "unavailable") {
    // Google's keys could not be loaded at all — not the caller's fault.
    authStats.record("native_attest_unavailable");
    return enforce
      ? { ok: false, status: 503, error: "Security check is temporarily unavailable — please try again in a moment." }
      : { ok: true };
  }
  authStats.record("native_attest_invalid");
  console.warn(`[app-check] rejected token reason=${result.reason} ip=${ip}`);
  return { ok: false, status: 403, error: "Request blocked — please update the app and try again." };
}

const UNSAFE_MESSAGE = "Please choose a fun topic for kids — animals, vehicles, fantasy creatures, food…";
const UNAVAILABLE_MESSAGE = "Our safety helper is taking a nap — please try again in a moment! 🎨";
const STRUCK_OUT_MESSAGE = "Let's take a little break — please try again later with a fun topic for kids!";

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
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-ID, X-Platform, X-App-Version");
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const ip  = clientIp(req);
  const sec = await getSecurityConfig();
  const perIp = await rateLimit.consume("generate:ip", ip, sec.generate.perIpLimit, sec.generate.perIpWindowMs);
  if (perIp.limited) {
    authStats.record("rate_limited");
    usage.recordGeneration(req, { outcome: "rate_limited" });
    res.status(429).json({ error: "Too many requests — please wait a while before trying again." });
    return;
  }

  // Filled in as the request progresses so every exit records one generation_log row.
  const log = { outcome: "fail" };
  const t0 = Date.now();
  try {
    const body = req.body || {};
    console.log(`[generate] ${ip} origin=${req.headers.origin || '(native)'} appcheck=${req.headers['x-firebase-appcheck'] ? 'yes' : 'no'} subject=${JSON.stringify(body.subject)} diff=${body.difficulty}`);

    const auth = await authenticate(req, body, ip, sec);
    log.appCheckAppId = auth.appId;
    if (!auth.ok) {
      usage.recordGeneration(req, { ...log, outcome: "blocked" });
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const subject    = sanitizeSubject(body.subject);
    const difficulty = ["easy", "medium", "hard", "extreme"].includes(body.difficulty) ? body.difficulty : "medium";
    const size       = ["small", "medium", "large", "xxl"].includes(body.size) ? body.size : "medium";
    const artStyle   = body.artStyle === "artistic" ? "artistic" : "structured";
    const width      = [512, 768, 1024].includes(body.width)  ? body.width  : 1024;
    const height     = [512, 768, 1024].includes(body.height) ? body.height : 1024;
    const seedRaw    = Number(body.seed);
    const seed       = (Number.isFinite(seedRaw) && seedRaw > 0) ? Math.floor(seedRaw) : Math.floor(Math.random() * 2_000_000_000);

    if (!subject) {
      res.status(400).json({ error: "Please provide a subject to draw." });
      return;
    }
    log.subjectRaw = subject;
    log.difficulty = difficulty;

    // Refuses, records the refusal and counts it towards the repeat-attempt limit.
    const refuse = (stage, verdict, outcome = "unsafe") => {
      moderation.logBlock(req, { stage, verdict, subject, subjectEn: log.subjectEn });
      moderation.addStrike(req, ip, sec.moderation).catch((e) => console.error("[moderation] strike failed:", e.message));
      usage.recordGeneration(req, { ...log, outcome, latencyMs: Date.now() - t0 });
      console.warn(`[moderation] blocked stage=${stage} category=${verdict.category} model=${verdict.model || "-"}`);
      res.status(400).json({ error: UNSAFE_MESSAGE });
    };

    if (await moderation.isStruckOut(req, ip, sec.moderation)) {
      usage.recordGeneration(req, { ...log, outcome: "rate_limited" });
      res.status(429).json({ error: STRUCK_OUT_MESSAGE });
      return;
    }

    // Subjects an admin blocked after reviewing in-app content reports
    // (api/admin/content-reports.js). Config is cached in-process for 60s.
    const adminBlocked = await loadAdminBlockedSubjects();
    if (isAdminBlockedSubject(subject, adminBlocked)) {
      refuse("prompt", { category: "admin" });
      return;
    }

    // Layer 1: the child's ORIGINAL words. This must run before translation, which
    // can shorten a request (2026-11-03: "remove the shirt from the women revealing
    // nothing underneath" reached the image model as "women revealing nothing
    // underneath").
    const promptVerdict = await moderation.checkPrompt(subject);
    if (!promptVerdict.allow) {
      refuse("prompt", promptVerdict);
      return;
    }

    // Global daily spend cap across every caller (hard UTC-day window). Counted
    // only for requests that passed auth + validation, i.e. real generations.
    const budget = await rateLimit.consume("generate:budget", "global", sec.generate.dailyBudget, 86_400_000, { fixed: true });
    if (budget.limited) {
      authStats.record("budget_exhausted");
      usage.recordGeneration(req, { ...log, outcome: "budget" });
      console.error(`[generate] daily budget exhausted (${sec.generate.dailyBudget}) — refusing generation`);
      res.status(503).json({ error: "Lalabuba is very busy today — please try again tomorrow! 🎨" });
      return;
    }

    const englishSubject = await translateToEnglish(subject);
    log.subjectEn = englishSubject;
    // Layer 2: the exact English the image model will see, with a second opinion
    // from an independent vendor's classifier.
    if (isAdminBlockedSubject(englishSubject, adminBlocked)) {
      refuse("translated", { category: "admin" });
      return;
    }
    const translatedVerdict = await moderation.checkTranslated(englishSubject);
    if (!translatedVerdict.allow) {
      refuse("translated", translatedVerdict);
      return;
    }

    const prompt = buildPrompt(englishSubject, difficulty, size, artStyle);
    const generated = await generateImage(prompt, width, height, seed, {
      provider: IMAGE_PROVIDER,
      hfToken: HF_TOKEN,
      hfModel: HF_MODEL,
      difficulty,
    });

    // Layer 3: the finished picture. Nothing is stored or returned before this
    // passes, and a blocked picture is discarded here, never written anywhere.
    const imageVerdict = await moderation.checkImage(generated.buffer);
    if (!imageVerdict.allow) {
      refuse("image", imageVerdict, "unsafe_image");
      return;
    }

    // Save generated image locally for sharing; clean up expired files asynchronously.
    let imageUrl = null;
    try {
      ensureColoringDir();
      const ext      = generated.contentType === "image/jpeg" ? "jpg" : "png";
      const rand     = Math.random().toString(36).slice(2, 8);
      const filename = `${seed}-${rand}.${ext}`;
      fs.writeFileSync(path.join(COLORING_DIR, filename), generated.buffer);
      imageUrl = `/img/c/${filename}`;
      cleanupOldLocalImages(); // fire-and-forget
    } catch (fileErr) {
      console.error("Local image save failed (non-fatal):", fileErr.message);
    }

    const exposedHeaders = ["X-Image-Seed"];
    res.setHeader("Content-Type", generated.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Image-Seed", String(seed));
    if (imageUrl) {
      res.setHeader("X-Image-Url", imageUrl);
      exposedHeaders.push("X-Image-Url");
    }
    res.setHeader("Access-Control-Expose-Headers", exposedHeaders.join(", "));
    res.status(200).send(generated.buffer);
    require("./health-deep").noteGeneration(true);
    usage.recordGeneration(req, { ...log, outcome: "ok", provider: generated.provider, latencyMs: Date.now() - t0, imagePath: imageUrl });
  } catch (error) {
    // No verdict means no picture. This is a safety outage, not a provider failure,
    // so it does not count against provider health.
    if (error instanceof moderation.ModerationUnavailableError) {
      authStats.record("moderation_unavailable");
      usage.recordGeneration(req, { ...log, outcome: "moderation_unavailable", latencyMs: Date.now() - t0 });
      console.error("[moderation] FAIL CLOSED:", error.message);
      res.status(503).json({ error: UNAVAILABLE_MESSAGE });
      return;
    }
    require("./health-deep").noteGeneration(false);
    usage.recordGeneration(req, { ...log, outcome: "fail", latencyMs: Date.now() - t0 });
    // Log the real error server-side; never echo provider URLs, status bodies,
    // or stack details (which may contain keys/internal hosts) to the client.
    console.error("generate-image error:", error && error.message ? error.message : error);
    res.status(500).json({
      error: "The drawing service is busy right now — please try again in a moment! 🎨",
    });
  }
};

// Exposed for scripts/test-request-security.js only.
module.exports._authenticate = authenticate;
