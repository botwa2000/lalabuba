"use strict";

const { URL } = require("url");

// ─── Art-mode prompt builders ──────────────────────────────────────────────
// "structured" (Classic) — uniform lines, sealed regions, color-by-number.
// "artistic" (Sketch)    — expressive pen-and-ink, varied weights, texture OK.

function buildPrompt(subject, difficulty = "medium", size = "medium", artStyle = "structured") {
  if (artStyle === "artistic") return buildArtisticPrompt(subject, difficulty, size);
  return buildStructuredPrompt(subject, difficulty, size);
}

function buildStructuredPrompt(subject, difficulty, size) {
  const base = [
    // Closure — every shape must be fully sealed so fills can't leak.
    "every outline is a fully closed loop",
    "all lines connect with no gaps or breaks",
    "every shape completely enclosed by unbroken black outlines",
    "no open line ends",
    // Line quality — crisp hard edges so BFS fill stays inside boundaries.
    "crisp sharp hard-edged outlines",
    "no antialiasing on lines",
    "no blurry edges",
    "clean uniform line weight",
    // Monochrome — must be pure uncolored line art.
    "black and white line art only",
    "pure black ink outlines on pure white paper",
    "monochrome",
    "completely uncolored",
    "leave every region blank white to be colored in later",
    "flat white interior",
    "pure solid white fills",
    "white background",
    "no color",
    "no colored fills",
    "no gradients",
    "no shading",
    "no shadows",
    "no stippling",
    "no dots",
    "no dashed lines",
    "no crosshatching",
    "no texture",
    "no realism",
    "no text",
    "no watermark",
  ];

  const sizeHints = {
    small: ["single centered subject", "sparse simple layout"],
    large: ["wide scene filling the full canvas", "include background elements"],
    xxl:   ["panoramic wide scene filling the entire canvas", "rich background detail throughout"],
  };
  const extra = sizeHints[size] || [];

  if (difficulty === "easy") {
    return [
      `coloring book page of ${subject}`,
      "toddler coloring book style",
      "only 3 to 4 very large simple bold shapes",
      "extremely thick black outlines",
      ...base,
      "absolutely no interior lines or details whatsoever",
      "maximum simplicity",
      "clean toddler coloring page",
      ...extra,
    ].join(", ");
  }

  if (difficulty === "hard") {
    return [
      `detailed coloring book page of ${subject}`,
      "children's detailed coloring book style",
      "bold continuous black outlines",
      ...base,
      "15 to 30 clearly enclosed regions",
      "decorative interior lines that form fully closed sub-regions",
      "no hatching or crosshatching",
      "professional detailed coloring book illustration",
      ...extra,
    ].join(", ");
  }

  if (difficulty === "extreme") {
    return [
      `ultra-detailed adult coloring book page of ${subject}`,
      "intricate mandala-inspired style with complex ornamental cell borders",
      "bold continuous black outline-only lines",
      ...base,
      "every interior line forms a fully closed loop",
      "no filled black areas anywhere in the image",
      "all interiors remain white with only black boundary lines",
      "dozens of tiny white-filled enclosed cells covering every region",
      "dense geometric and floral border patterns creating many fillable white areas",
      "maximum intricacy throughout the entire image",
      "expert adult coloring book for skilled colorers",
      ...extra,
    ].join(", ");
  }

  // medium (default)
  return [
    `coloring book page of ${subject}`,
    "simple cartoon illustration style",
    "thick bold continuous black outlines",
    ...base,
    "6 to 10 clearly enclosed regions",
    "absolutely no interior texture or detail lines",
    "clean professional coloring book illustration",
    ...extra,
  ].join(", ");
}

function buildArtisticPrompt(subject, difficulty, size) {
  // Artistic / Sketch mode: expressive pen-and-ink feel.
  // Lines may vary in weight; crosshatching and texture are allowed.
  // Still monochrome — no color fills. Intended for freehand brush/pencil coloring.
  const base = [
    "black and white illustration",
    "pen and ink drawing style",
    "monochrome",
    "no color",
    "no watermark",
    "no text",
    "white background",
  ];

  const sizeHints = {
    small: ["single centered subject"],
    large: ["wide scene with detailed background"],
    xxl:   ["panoramic detailed scene"],
  };
  const extra = sizeHints[size] || [];

  if (difficulty === "easy") {
    return [
      `simple pen sketch of ${subject}`,
      "bold expressive outlines",
      "minimal detail",
      "clean hand-drawn illustration",
      ...base,
      ...extra,
    ].join(", ");
  }

  if (difficulty === "hard") {
    return [
      `detailed pen and ink illustration of ${subject}`,
      "varied line weights from fine to bold",
      "expressive crosshatching for texture and depth",
      "artistic hand-drawn style",
      ...base,
      ...extra,
    ].join(", ");
  }

  if (difficulty === "extreme") {
    return [
      `highly detailed fine art pen illustration of ${subject}`,
      "intricate stippling and crosshatching throughout",
      "master-level pen-and-ink technique",
      "rich texture variation",
      "complex layered line work",
      ...base,
      ...extra,
    ].join(", ");
  }

  // medium (default)
  return [
    `artistic pen and ink drawing of ${subject}`,
    "hand-drawn expressive style",
    "medium detail with varied line weights",
    "some crosshatching and texture for depth",
    ...base,
    ...extra,
  ].join(", ");
}

// ─── Image validation ─────────────────────────────────────────────────────────
// Check magic bytes so we never pass HTML/JSON bytes back to the client as an image.
// Returns true only if the buffer looks like a real image.
function isValidImageBuffer(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // GIF: 47 49 46 38 ("GIF8")
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  // WebP: RIFF....WEBP (bytes 0–3 = "RIFF", bytes 8–11 = "WEBP")
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
  return false;
}

// ─── Quota / busy sentinel ────────────────────────────────────────────────────
// Generators throw new Error('__QUOTA__') when their free tier is exhausted or
// the service is temporarily rate-limited. generateImage() catches this and
// silently moves to the next tier.

function isQuotaOrBusy(err) {
  if (err.message === "__QUOTA__") return true;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("429") || msg.includes("busy") || msg.includes("quota") ||
         msg.includes("limit") || msg.includes("exceeded") || msg.includes("credit") ||
         msg.includes("payment") || msg.includes("billing") || msg.includes("depleted");
}

// ─── Outbound-fetch safety ───────────────────────────────────────────────────
// Every provider call gets a hard timeout (so a hung upstream can't tie up the
// request) and image bytes are size-capped (so a huge/hostile response can't
// blow up memory). Reads Content-Length when present, and trims an oversized
// body defensively.
const FETCH_TIMEOUT_MS = 45_000;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB — far above any real coloring page

// AbortSignal.timeout() in Node.js 20 / undici does NOT reliably cancel an
// ongoing response.arrayBuffer() when headers arrive before the timer fires.
// This helper creates an AbortController whose timer stays active across BOTH
// the initial fetch() AND any subsequent body reads (arrayBuffer, json, text)
// on the same connection, so a slow/hanging body is reliably killed.
function abortAfter(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  ctrl.cancel = () => clearTimeout(timer);
  return ctrl;
}

// Pollinations is the FREE tier-1 and the path that "just worked" before the
// Hetzner migration — it needs no token. Measured from the server: a cache HIT
// returns in ~1-2s; a cache MISS (every novel subject) completes in ~45s via
// Pollinations' free generation queue (HTTP 200, not a hard 429). It is NOT
// dead — it is just slow on a cold miss.
//
// A previous attempt to fight "takes forever" capped this timeout to 12s (then
// 6s). That backfired: a 45s cold gen was aborted at the cap and the waterfall
// fell through to PAID Novita — turning a free-but-slow result into a paid one,
// which is NOT what we want (no provider is on a paid plan here). Restored to
// 50s so free cold gens COMPLETE on Pollinations instead of being kicked to
// Novita. The client abort (generate.js) is set above this so the free result
// isn't clipped. Tune via env if Pollinations' queue latency changes.
const POLLINATIONS_TIMEOUT_MS = (() => {
  const v = Number(process.env.POLLINATIONS_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 50_000;
})();

async function readImageBytes(res) {
  const len = Number(res.headers.get("content-length"));
  if (Number.isFinite(len) && len > MAX_IMAGE_BYTES) {
    throw new Error(`upstream image too large (${len} bytes)`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error(`upstream image too large (${buf.length} bytes)`);
  return buf;
}

// Only fetch image URLs an upstream hands back if they are https and on an
// expected host — prevents an upstream (or a swapped/compromised response) from
// steering a server-side fetch at internal/metadata endpoints (SSRF).
function assertSafeImageUrl(raw, allowedHostSuffixes) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("upstream returned a malformed image URL"); }
  if (u.protocol !== "https:") throw new Error(`refusing non-https image URL (${u.protocol})`);
  const host = u.hostname.toLowerCase();
  if (!allowedHostSuffixes.some((s) => host === s || host.endsWith("." + s))) {
    throw new Error(`refusing image URL on unexpected host (${host})`);
  }
  return u.toString();
}

// ─── Tier 1: Pollinations (free, no key) ─────────────────────────────────────

// Pollinations caches by seed globally across all users and prompts.
// XOR the base seed with a prompt hash so every distinct prompt gets
// its own cache bucket, while the same (seed + prompt) always returns
// the same image (daily-challenge consistency is preserved).
function derivePollinationsSeed(seed, prompt) {
  let h = 2166136261; // FNV-1a 32-bit offset basis
  const len = Math.min(prompt.length, 256);
  for (let i = 0; i < len; i++) {
    h ^= prompt.charCodeAt(i);
    h = Math.imul(h, 16777619);
    h >>>= 0; // keep unsigned 32-bit
  }
  return ((seed ^ h) >>> 0) % 2_000_000_000;
}

function buildPollinationsUrl(prompt, width, height, seed) {
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  url.searchParams.set("width",   String(width));
  url.searchParams.set("height",  String(height));
  url.searchParams.set("nologo",  "true");
  url.searchParams.set("model",   "flux");
  url.searchParams.set("enhance", "false");
  url.searchParams.set("safe",    "true");
  url.searchParams.set("seed",    String(derivePollinationsSeed(seed, prompt)));
  url.searchParams.set("referrer","lalabuba");
  return url.toString();
}

async function generateWithPollinations(prompt, width, height, seed) {
  // Wrap everything — fetch, headers check, body read — in one try/catch.
  // Any failure at any stage (network error, non-2xx, Cloudflare challenge, timeout,
  // partial body, bad magic bytes) is treated as "unavailable; try next provider."
  const ctrl = abortAfter(POLLINATIONS_TIMEOUT_MS);
  try {
    const upstream = await fetch(buildPollinationsUrl(prompt, width, height, seed), {
      headers: { Accept: "image/*", "User-Agent": "lalabuba/1.0" },
      signal: ctrl.signal,
    });

    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) throw new Error(`non-image content-type: ${contentType}`);

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (!isValidImageBuffer(buffer)) throw new Error("magic bytes invalid");

    return { contentType, buffer };
  } catch (err) {
    console.warn("Pollinations unavailable:", err.message);
    throw new Error("__QUOTA__");
  } finally {
    ctrl.cancel();
  }
}

// ─── Tier 2: Together AI (free tier ~10 000 imgs/month) ───────────────────────

async function generateWithTogetherAI(prompt, width, height, seed, apiKey) {
  const ctrl = abortAfter(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell-Free",
        prompt, width, height, steps: 4, seed, n: 1,
        response_format: "b64_json",
      }),
    });
    if (!res.ok) {
      console.warn(`Together AI ${res.status} — skipping tier`);
      throw new Error("__QUOTA__");
    }
    const json = await res.json();
    let b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("Together AI returned no image data");
    const comma = b64.indexOf(",");
    if (comma !== -1) b64 = b64.slice(comma + 1);
    const buf = Buffer.from(b64, "base64");
    if (!isValidImageBuffer(buf)) throw new Error("__QUOTA__");
    return { contentType: "image/png", buffer: buf };
  } finally {
    ctrl.cancel();
  }
}

// ─── Tier 3: Cloudflare Workers AI (~35–40 free imgs/day, cheap overage) ──────

async function generateWithCloudflare(prompt, width, height, seed, accountId, apiToken) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const ctrl = abortAfter(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, num_steps: 8, width, height, seed }),
    });
    if (!res.ok) {
      console.warn(`Cloudflare AI ${res.status} — skipping tier`);
      throw new Error("__QUOTA__");
    }
    const cfBuf = await readImageBytes(res);
    if (!isValidImageBuffer(cfBuf)) throw new Error("__QUOTA__");
    return {
      contentType: res.headers.get("content-type") || "image/png",
      buffer: cfBuf,
    };
  } finally {
    ctrl.cancel();
  }
}

// ─── Tier 4: Novita.ai (paid, ~$0.001–$0.003 per image) ──────────────────────

// Daily spend backstop for the only PAID tier. Free tiers (Pollinations,
// Together, Cloudflare) are tried first, so Novita is reached only when those
// are exhausted — but we still cap how many paid images a single warm instance
// will buy per day so a sustained outage of the free tiers can't run up an
// unbounded bill. Best-effort (per-instance; not shared across cold starts),
// override with NOVITA_DAILY_CAP. Set to 0 to disable the paid tier entirely.
const NOVITA_DAILY_CAP = (() => {
  const v = Number(process.env.NOVITA_DAILY_CAP);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 300;
})();
let _novitaDay = "";
let _novitaCount = 0;

function novitaCapReached() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _novitaDay) { _novitaDay = today; _novitaCount = 0; }
  return _novitaCount >= NOVITA_DAILY_CAP;
}

async function generateWithNovita(prompt, width, height, seed, apiKey) {
  if (novitaCapReached()) {
    console.warn(`Novita daily cap (${NOVITA_DAILY_CAP}) reached — refusing paid generation`);
    throw new Error("__QUOTA__");
  }
  _novitaCount++;

  // Step 1: request generation — returns a signed image URL
  let imageUrl;
  const ctrl1 = abortAfter(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.novita.ai/v3beta/flux-1-schnell", {
      method: "POST",
      signal: ctrl1.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, width, height, steps: 4, seed, image_num: 1 }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`Novita.ai ${res.status} — skipping tier: ${detail.slice(0, 80)}`);
      throw new Error("__QUOTA__");
    }
    const json = await res.json();
    imageUrl = json.images?.[0]?.image_url;
    if (!imageUrl) throw new Error("Novita.ai returned no image URL");
  } finally {
    ctrl1.cancel();
  }

  // Step 2: fetch the actual image bytes — validate the URL host first (SSRF
  // guard) and cap + time-bound the download.
  // Novita serves generated images from several CDNs and migrated to Cloudflare
  // R2 (…r2.cloudflarestorage.com). The allowlist must include it or every Novita
  // result is rejected by the SSRF guard — which, with the free tiers degraded
  // (Pollinations 429, Together 402, Cloudflare 401), made EVERY cold generation
  // fail ("drawing takes forever" → error). Still https + host-restricted.
  const safeUrl = assertSafeImageUrl(imageUrl, [
    "novita.ai", "novitai.com", "amazonaws.com", "r2.cloudflarestorage.com",
  ]);
  const ctrl2 = abortAfter(FETCH_TIMEOUT_MS);
  try {
    const imgRes = await fetch(safeUrl, { signal: ctrl2.signal });
    if (!imgRes.ok) throw new Error(`Novita.ai image fetch failed (${imgRes.status})`);
    const buffer = await readImageBytes(imgRes);
    // Novita CDN returns octet-stream; detect type from magic bytes
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50; // PNG magic
    return { contentType: isPng ? "image/png" : "image/jpeg", buffer };
  } finally {
    ctrl2.cancel();
  }
}

// ─── Legacy: HuggingFace ──────────────────────────────────────────────────────

async function generateWithHuggingFace(prompt, width, height, seed, hfToken, hfModel) {
  if (!hfToken) {
    throw new Error(
      "No HF_TOKEN set. Add your free Hugging Face token to the .env file. " +
      "Get one free at https://huggingface.co/settings/tokens"
    );
  }

  const ctrl = abortAfter(FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(`https://router.huggingface.co/hf-inference/models/${encodeURIComponent(hfModel)}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width,
          height,
          guidance_scale: 3.5,
          num_inference_steps: 8,
          seed,
        },
      }),
    });

    if (!upstream.ok) {
      const details = await upstream.text();
      throw new Error(`Hugging Face failed (${upstream.status}): ${details.slice(0, 300)}`);
    }

    return {
      contentType: upstream.headers.get("content-type") || "image/jpeg",
      buffer: await readImageBytes(upstream),
    };
  } finally {
    ctrl.cancel();
  }
}

// ─── Main entry point — waterfall across all tiers ───────────────────────────

/**
 * Generate an image, trying providers in order until one succeeds.
 * Tier 1 → Pollinations (free, no key)
 * Tier 2 → Together AI  (free ~10k/month, needs TOGETHER_API_KEY)
 * Tier 3 → Cloudflare   (free ~35/day, needs CF_ACCOUNT_ID + CF_API_TOKEN)
 * Tier 4 → Novita.ai    (paid ~$0.001–$0.003/img, needs NOVITA_API_KEY)
 * Fallback → HuggingFace (legacy, needs HF_TOKEN)
 */
async function generateImage(prompt, width = 1024, height = 1024, seed, opts = {}) {
  const { hfToken, hfModel = "black-forest-labs/FLUX.1-schnell", difficulty = "medium" } = opts;

  const togetherKey = process.env.TOGETHER_API_KEY;
  const cfAccountId = process.env.CF_ACCOUNT_ID;
  const cfToken     = process.env.CF_API_TOKEN;
  const novitaKey   = process.env.NOVITA_API_KEY;

  // Hard/Extreme prompts are too complex and verbose to hit the Pollinations cache
  // (which keys on prompt+seed globally). A cache miss takes ~45-50s on Pollinations'
  // free queue, which combined with the subsequent Novita call blows the 75s client
  // timeout. Skip Pollinations for these difficulties and go straight to the paid tier
  // so the total round-trip stays under ~60s.
  const skipPollinations = difficulty === "hard" || difficulty === "extreme";

  // Tier 1: Pollinations (free, no key) — easy/medium only
  if (!skipPollinations) {
    try {
      return await generateWithPollinations(prompt, width, height, seed);
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn("Pollinations busy — trying Together AI");
    }
  } else {
    console.log(`[providers] Skipping Pollinations for difficulty=${difficulty} — going to paid tier`);
  }

  // Tier 2: Together AI
  if (togetherKey) {
    try {
      return await generateWithTogetherAI(prompt, width, height, seed, togetherKey);
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn("Together AI quota — trying Cloudflare");
    }
  }

  // Tier 3: Cloudflare Workers AI
  if (cfAccountId && cfToken) {
    try {
      return await generateWithCloudflare(prompt, width, height, seed, cfAccountId, cfToken);
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn("Cloudflare quota — trying Novita.ai");
    }
  }

  // Tier 4: Novita.ai (paid) — capped per day; falls through if the cap is hit.
  if (novitaKey) {
    try {
      return await generateWithNovita(prompt, width, height, seed, novitaKey);
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn("Novita unavailable/capped — trying HuggingFace");
    }
  }

  // Legacy fallback: HuggingFace
  if (hfToken) {
    return await generateWithHuggingFace(prompt, width, height, seed, hfToken, hfModel);
  }

  throw new Error("The drawing service is busy right now — please try again in a moment! 🎨");
}

module.exports = { buildPrompt, generateImage };
