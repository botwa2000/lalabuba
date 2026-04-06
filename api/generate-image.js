const { sanitizeSubject, isSafeSubject } = require("../lib/content-safety");
const { buildPrompt, generateImage } = require("../lib/image-providers");

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
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;          // not configured — skip (dev mode)
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return true; // if Cloudflare is unreachable, don't block users
  }
}

const ALLOWED_ORIGINS = [
  "https://lalabuba.com",
  "http://localhost:3000",
  "capacitor://localhost",
  "ionic://localhost",
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

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many requests — please wait a while before trying again." });
    return;
  }

  try {
    const body = req.body || {};

    // Turnstile verification — skip for native app origins
    const isNative = origin === 'capacitor://localhost' || origin === 'ionic://localhost';
    if (!isNative) {
      const ok = await verifyTurnstile(body.turnstileToken, ip);
      if (!ok) {
        res.status(403).json({ error: "Bot check failed — please try again." });
        return;
      }
    }
    const subject    = sanitizeSubject(body.subject);
    const difficulty = ["easy", "medium", "hard", "extreme"].includes(body.difficulty) ? body.difficulty : "medium";
    const size       = ["small", "medium", "large", "xxl"].includes(body.size) ? body.size : "medium";
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

    const prompt = buildPrompt(subject, difficulty, size);
    const generated = await generateImage(prompt, width, height, seed, {
      provider: IMAGE_PROVIDER,
      hfToken: HF_TOKEN,
      hfModel: HF_MODEL,
    });

    // Upload to Vercel Blob for instant sharing; clean up expired blobs asynchronously.
    let imageUrl = null;
    if (blobPut && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await blobPut(`coloring/${seed}`, generated.buffer, {
          access: "public",
          contentType: generated.contentType,
          addRandomSuffix: false,
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
    res.status(500).json({ error: error.message || "Image generation failed." });
  }
};
