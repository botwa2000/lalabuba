const { sanitizeSubject, isSafeSubject } = require("../lib/content-safety");
const { buildPrompt, generateImage } = require("../lib/image-providers");
const { translateToEnglish } = require("../lib/translate");

// Vercel Blob — optional; only active when BLOB_READ_WRITE_TOKEN is set.
let blobPut = null, blobList = null, blobDel = null;
try {
  const vb = require("@vercel/blob");
  blobPut = vb.put; blobList = vb.list; blobDel = vb.del;
} catch { /* not installed — sharing degrades to seed-based fallback */ }

const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "huggingface";

// Shared images expire after this many days (blobs are deleted, links show expiry message).
const SHARE_TTL_DAYS = 7;
const SHARE_TTL_MS   = SHARE_TTL_DAYS * 24 * 60 * 60 * 1000;

// Delete blobs uploaded more than SHARE_TTL_DAYS ago. Fire-and-forget — never awaited.
async function cleanupOldBlobs() {
  if (!blobList || !blobDel || !process.env.BLOB_READ_WRITE_TOKEN) return;
  const cutoff = Date.now() - SHARE_TTL_MS;
  try {
    let cursor;
    do {
      const page = await blobList({ prefix: "coloring/", cursor, limit: 100 });
      const expired = page.blobs.filter(b => new Date(b.uploadedAt).getTime() < cutoff);
      if (expired.length) await blobDel(expired.map(b => b.url));
      cursor = page.cursor;
      if (!page.hasMore) break;
    } while (cursor);
  } catch (err) {
    console.error("Blob cleanup error (non-fatal):", err.message);
  }
}

// ─── Rate limiting (per serverless instance) ─────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_MAX    = 15;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    if (rateLimitMap.size > 5000) {
      for (const [k, v] of rateLimitMap) if (now > v.resetAt) rateLimitMap.delete(k);
    }
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
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
  if (!token) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      if (attempt === 1) return false; // unreachable after a retry → fail closed
    }
  }
  return false;
}

const ALLOWED_ORIGINS = [
  "https://lalabuba.com",
  "https://www.lalabuba.com",
  "https://dev.lalabuba.com",
  "http://localhost:3000",
  "capacitor://localhost",
  "ionic://localhost",
  "https://localhost",   // Capacitor 4+ Android WebView origin
];

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // Client IP for rate limiting. Behind Cloudflare, `cf-connecting-ip` is set by
  // Cloudflare and CANNOT be forged by the client (Cloudflare overwrites it).
  // The old `x-real-ip`/`x-forwarded-for` headers are client-controllable on this
  // Hetzner/Swarm stack (no trusted proxy overwrites them), so a caller could
  // rotate them per request to dodge the per-IP limit — they are no longer trusted.
  const ip = (req.headers['cf-connecting-ip']
    || req.socket?.remoteAddress
    || 'unknown').toString().trim();
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many requests — please wait a while before trying again." });
    return;
  }

  try {
    const body = req.body || {};
    const clientOrigin = req.headers.origin || '(native)';
    const clientIp    = req.headers['cf-connecting-ip'] || req.socket?.remoteAddress || 'unknown';
    console.log(`[generate] ${clientIp} origin=${clientOrigin} subject=${JSON.stringify(body.subject)} diff=${body.difficulty}`);

    // Native vs. web classification.
    //
    // A native request is one with no web Origin (Flutter's Dio sends none) or
    // an explicit native WebView origin. Crucially, X-Device-ID is NO LONGER a
    // bypass — a browser script could set that header at will to skip the bot
    // check, so the Turnstile gate now applies to every request carrying a web
    // Origin regardless of any custom headers.
    const NATIVE_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'https://localhost'];
    const isNative = !origin || NATIVE_ORIGINS.includes(origin);

    if (isNative) {
      // Optional app-key gate for native callers. When APP_API_KEY is set in the
      // environment, native requests must present a matching X-App-Key header
      // (the Flutter build injects it via --dart-define). This closes the
      // "curl with no Origin skips every check" hole. If APP_API_KEY is unset
      // the gate is inactive, preserving the current behaviour.
      const appKey = process.env.APP_API_KEY;
      if (appKey && req.headers['x-app-key'] !== appKey) {
        res.status(403).json({ error: "Request blocked — please update the app and try again." });
        return;
      }
    } else {
      const ok = await verifyTurnstile(body.turnstileToken, ip);
      if (!ok) {
        res.status(403).json({ error: "Bot check failed — please try again." });
        return;
      }
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

    if (!isSafeSubject(subject)) {
      res.status(400).json({ error: "Please choose a fun topic for kids — animals, vehicles, fantasy creatures, food…" });
      return;
    }

    const englishSubject = await translateToEnglish(subject);
    // Re-run the kid-safety check on the TRANSLATED English too. The first check
    // runs on the raw subject, but a banned concept written in a language/spelling
    // the blocklist doesn't cover could pass and only become obvious once
    // translated to English — this closes that bypass before it reaches the model.
    if (!isSafeSubject(englishSubject)) {
      res.status(400).json({ error: "Please choose a fun topic for kids — animals, vehicles, fantasy creatures, food…" });
      return;
    }
    const prompt = buildPrompt(englishSubject, difficulty, size, artStyle);
    const generated = await generateImage(prompt, width, height, seed, {
      provider: IMAGE_PROVIDER,
      hfToken: HF_TOKEN,
      hfModel: HF_MODEL,
    });

    // Upload to Vercel Blob for instant sharing; clean up expired blobs asynchronously.
    let imageUrl = null;
    if (blobPut && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        // addRandomSuffix:true → unguessable URL. With false, blobs lived at the
        // predictable path coloring/<seed> and could be enumerated/guessed to pull
        // other children's pages. The real URL is returned via X-Image-Url (used
        // by sharing), so randomizing the path doesn't break anything.
        const blob = await blobPut(`coloring/${seed}`, generated.buffer, {
          access: "public",
          contentType: generated.contentType,
          addRandomSuffix: true,
        });
        imageUrl = blob.url;
        cleanupOldBlobs(); // fire-and-forget
      } catch (blobErr) {
        console.error("Blob upload failed (non-fatal):", blobErr.message);
      }
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
  } catch (error) {
    // Log the real error server-side; never echo provider URLs, status bodies,
    // or stack details (which may contain keys/internal hosts) to the client.
    console.error("generate-image error:", error && error.message ? error.message : error);
    res.status(500).json({
      error: "The drawing service is busy right now — please try again in a moment! 🎨",
    });
  }
};
