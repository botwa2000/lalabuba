"use strict";

const { URL }  = require("url");
const zlib     = require("zlib");
const { getDrawingConfigSync } = require("./drawing-config");
const dc = () => getDrawingConfigSync();

// ─── Art-mode prompt builders ──────────────────────────────────────────────
// "structured" (Classic) — uniform lines, sealed regions, color-by-number.
// "artistic" (Sketch)    — expressive pen-and-ink, varied weights, texture OK.

function buildPrompt(subject, difficulty = "medium", size = "medium", artStyle = "structured") {
  if (artStyle === "artistic") return buildArtisticPrompt(subject, difficulty, size);
  return buildStructuredPrompt(subject, difficulty, size);
}

// Pollinations now uses model=turbo (SDXL Turbo), which follows style prompts much
// better than FLUX.1-schnell for illustration/coloring-page output. SDXL-based models
// respond well to art-style keywords and the full prompt, so no 40-token limit applies.
// Keeping style tokens first is still good practice (higher attention weight).
// The negative_prompt is passed for providers that support it (Pollinations turbo, SDXL).

const COLORING_NEGATIVE_PROMPT =
  "shading, shadows, gradients, colors, colorful, photorealistic, realistic, dark, grey, " +
  "sketch, crosshatch, watercolor, painting, 3d render, texture, noise, dirty, grungy, " +
  "pencil marks, ink wash, tonal values, halftone";

function buildStructuredPrompt(subject, difficulty, size) {
  const sizeHint = {
    small: ", single centered subject",
    large: ", wide scene filling the full canvas",
    xxl:   ", panoramic scene filling the entire canvas",
  }[size] || "";

  if (difficulty === "easy") {
    return (
      "toddler coloring book page, white background, pure black outlines only, " +
      "no shading no shadows no color, " +
      `featuring ${subject}, ` +
      "only 3 large simple shapes, extremely thick outlines, " +
      "flat empty white interiors, line art, completely uncolored" +
      sizeHint
    );
  }

  if (difficulty === "hard") {
    return (
      "detailed children's coloring book page, white background, " +
      "pure black ink outlines only, no shading no shadows no color fills, " +
      `featuring ${subject}, ` +
      "15 to 25 enclosed regions, bold continuous outlines, " +
      "flat white interiors, line art illustration, completely uncolored" +
      sizeHint
    );
  }

  if (difficulty === "extreme") {
    return (
      "adult coloring book page mandala style, white background, " +
      "pure black ink outlines only, no shading no shadows no dark fills, " +
      `featuring ${subject}, ` +
      "intricate enclosed cells, dozens of tiny white-filled regions, " +
      "dense ornamental line art, completely uncolored flat white fills" +
      sizeHint
    );
  }

  // medium (default)
  return (
    "children's coloring book page, white background, pure black outlines only, " +
    "no shading no shadows no color, " +
    `featuring ${subject}, ` +
    "6 to 10 enclosed regions, bold clean outlines, " +
    "flat white interiors, simple line art, completely uncolored" +
    sizeHint
  );
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

// ─── PNG pixel brightness analysis ───────────────────────────────────────────
// Returns fraction of "white-ish" pixels in [0, 1], or NaN on parse error.
// A proper coloring page (mostly white, black outlines) is typically ≥ 0.60 (60%+).
// Photorealistic or shaded images are typically < 0.45.
// Only handles 8-bit PNG (the format Pollinations/Novita return). No extra deps —
// uses the built-in zlib module to decompress IDAT chunks.
function pngBrightness(buf) {
  // Validate PNG signature
  if (buf.length < 8 ||
      buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) {
    return NaN;
  }

  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = -1;
  const idatList = [];

  while (off + 12 <= buf.length) {
    const len  = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    off += 12 + len; // 4(len) + 4(type) + data + 4(CRC)

    if (type === "IHDR") {
      if (len < 13) return NaN;
      width     = data.readUInt32BE(0);
      height    = data.readUInt32BE(4);
      bitDepth  = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatList.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  // Only handle 8-bit non-indexed colour types: 0=gray, 2=RGB, 4=gray+A, 6=RGBA
  if (!width || !height || colorType === -1) return NaN;
  if (bitDepth !== 8 || colorType === 3) return NaN;
  // Skip huge images to avoid memory pressure
  if (width * height > 2048 * 2048) return NaN;

  const bpp = [1, 0, 3, 0, 2, 0, 4][colorType]; // bytes per pixel

  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idatList)); } catch { return NaN; }

  const stride = 1 + bpp * width; // 1 filter byte + pixel bytes per row
  if (raw.length < stride * height) return NaN;

  // Paeth predictor (PNG spec)
  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return (pa <= pb && pa <= pc) ? a : (pb <= pc) ? b : c;
  }

  const BRIGHT = 220; // pixel value ≥220/255 on all channels → "white-ish"
  let brightPixels = 0;

  const prevRow = Buffer.alloc(bpp * width, 0); // row above (zeros for row 0)
  const curRow  = Buffer.alloc(bpp * width, 0);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride];

    for (let i = 0; i < bpp * width; i++) {
      const x = raw[y * stride + 1 + i]; // raw/filtered byte
      const a = (i >= bpp)    ? curRow[i - bpp]  : 0; // left (already reconstructed)
      const b = prevRow[i];                              // above
      const c = (i >= bpp)    ? prevRow[i - bpp] : 0; // above-left
      switch (filter) {
        case 0: curRow[i] = x; break;
        case 1: curRow[i] = (x + a) & 0xFF; break;          // Sub
        case 2: curRow[i] = (x + b) & 0xFF; break;          // Up
        case 3: curRow[i] = (x + ((a + b) >> 1)) & 0xFF; break; // Average
        case 4: curRow[i] = (x + paeth(a, b, c)) & 0xFF; break; // Paeth
        default: curRow[i] = x;
      }
    }

    // Count white-ish pixels in this row
    for (let x = 0; x < width; x++) {
      const base = x * bpp;
      // grayscale (types 0,4) → single channel; RGB/RGBA → min of R,G,B
      const luma = (colorType === 0 || colorType === 4)
        ? curRow[base]
        : Math.min(curRow[base], curRow[base + 1], curRow[base + 2]);
      if (luma >= BRIGHT) brightPixels++;
    }

    curRow.copy(prevRow);
  }

  return brightPixels / (width * height);
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

// ─── Coloring-page quality check ─────────────────────────────────────────────
// A proper coloring page is mostly white (blank fill areas) with black outlines.
//
// Quality signals:
//  PNG  → pixel brightness analysis (fraction of pixels ≥ 220/255 on all channels).
//         Coloring pages ≥ 60% white; dark/photorealistic images < 50%.
//         Falls back to file-size check (> 200 KB → likely dark) if parse fails.
//  JPEG → file-size proxy (provider-observed thresholds):
//         Good coloring page at 1024×1024:  15–70 KB
//         Dark/shaded/engraving image:      80 KB+ (dog 121 KB, cat 94 KB confirmed bad)
//         Threshold: 80 KB — catches confirmed bad images; allows clean sparse pages.
//
// Returns { ok, reason, kb } — never throws.
function checkColoringPageQuality(buffer, contentType) {
  if (!buffer) return { ok: false, reason: "empty buffer" };
  const kb = Math.round(buffer.length / 1024);
  const isPng  = contentType.includes("png")  || (buffer[0] === 0x89 && buffer[1] === 0x50);
  const isJpeg = contentType.includes("jpeg") || contentType.includes("jpg") ||
                 (buffer[0] === 0xFF && buffer[1] === 0xD8);

  if (isPng) {
    const brightness = pngBrightness(buffer);
    if (!isNaN(brightness)) {
      const MIN_WHITE = 0.60;
      if (brightness < MIN_WHITE) {
        return {
          ok: false,
          reason: `PNG too dark (${Math.round(brightness * 100)}% white < ${MIN_WHITE * 100}% — likely shaded/photorealistic)`,
          kb,
        };
      }
      return { ok: true, reason: `PNG brightness OK (${Math.round(brightness * 100)}% white, ${kb} KB)`, kb };
    }
    // Parse failed — fall back to size
    const PNG_KB = 200;
    if (kb > PNG_KB) return { ok: false, reason: `PNG too large (${kb} KB > ${PNG_KB} KB — likely dark/shaded)`, kb };
    return { ok: true, reason: `PNG size OK fallback (${kb} KB)`, kb };
  }

  if (isJpeg) {
    // Calibrated from production: dark dithered/photorealistic images arrive at 80-200 KB;
    // good coloring pages at 1024×1024 arrive at 15-70 KB.
    const JPEG_KB = 80;
    if (kb > JPEG_KB) {
      return { ok: false, reason: `JPEG too large (${kb} KB > ${JPEG_KB} KB — likely dark/shaded)`, kb };
    }
    return { ok: true, reason: `JPEG size OK (${kb} KB)`, kb };
  }

  return { ok: true, reason: `unknown format — size check skipped (${kb} KB)`, kb };
}

// ─── Quota / busy sentinel ────────────────────────────────────────────────────
// Generators throw new Error('__QUOTA__') when their free tier is exhausted or
// the service is temporarily rate-limited. generateImage() catches this and
// silently moves to the next tier.

function isQuotaOrBusy(err) {
  if (err.message === "__QUOTA__") return true;
  // AbortError = provider timed out → treat as busy so the waterfall continues
  // instead of propagating the error and breaking the entire generation chain.
  if (err.name === "AbortError") return true;
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
// These read from config at call time so runtime DB overrides take effect without restart.
// Env-var overrides are preserved for ops emergencies (same semantics as before).
const _envFetch = Number(process.env.FETCH_TIMEOUT_MS);
const FETCH_TIMEOUT_MS = () => (Number.isFinite(_envFetch) && _envFetch > 0) ? _envFetch : (dc().providers?.fetchTimeoutMs ?? 45_000);
const MAX_IMAGE_BYTES = () => dc().providers?.maxImageBytes ?? (25 * 1024 * 1024);

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
// isn't clipped. Tune via env or DB (providers.pollinationsTimeoutMs) if queue latency changes.
const _envPoll = Number(process.env.POLLINATIONS_TIMEOUT_MS);
const POLLINATIONS_TIMEOUT_MS = () => (Number.isFinite(_envPoll) && _envPoll > 0) ? _envPoll : (dc().providers?.pollinationsTimeoutMs ?? 50_000);

async function readImageBytes(res) {
  const maxBytes = MAX_IMAGE_BYTES();
  const len = Number(res.headers.get("content-length"));
  if (Number.isFinite(len) && len > maxBytes) {
    throw new Error(`upstream image too large (${len} bytes)`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error(`upstream image too large (${buf.length} bytes)`);
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
  // Include model name in cache key so switching models busts stale cache.
  // sana→turbo: Sana was generating 3D renders instead of coloring-page line art.
  const cacheKey = `turbo:${prompt}`;
  let h = 2166136261; // FNV-1a 32-bit offset basis
  const len = Math.min(cacheKey.length, 256);
  for (let i = 0; i < len; i++) {
    h ^= cacheKey.charCodeAt(i);
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
  url.searchParams.set("model",   "turbo"); // SDXL Turbo — follows coloring-page style prompts reliably
  url.searchParams.set("enhance", "false");
  url.searchParams.set("safe",    "true");
  url.searchParams.set("seed",    String(derivePollinationsSeed(seed, prompt)));
  url.searchParams.set("referrer","lalabuba");
  // negative_prompt is supported by Pollinations for some models — helps prevent
  // shading/shadows/color bleedthrough on subjects like vehicles, dark animals, etc.
  url.searchParams.set("negative_prompt", COLORING_NEGATIVE_PROMPT);
  return url.toString();
}

async function generateWithPollinations(prompt, width, height, seed) {
  // Wrap everything — fetch, headers check, body read — in one try/catch.
  // Any failure at any stage (network error, non-2xx, Cloudflare challenge, timeout,
  // partial body, bad magic bytes) is treated as "unavailable; try next provider."
  const ctrl = abortAfter(POLLINATIONS_TIMEOUT_MS());
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
  const ctrl = abortAfter(FETCH_TIMEOUT_MS());
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
  const ctrl = abortAfter(FETCH_TIMEOUT_MS());
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
const _envNovitaCap = Number(process.env.NOVITA_DAILY_CAP);
let _novitaDay = "";
let _novitaCount = 0;

function _novitaDailyCap() {
  if (Number.isFinite(_envNovitaCap) && _envNovitaCap >= 0) return _envNovitaCap;
  return dc().providers?.novitaDailyCap ?? 300;
}

function novitaCapReached() {
  const cap = _novitaDailyCap();
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _novitaDay) { _novitaDay = today; _novitaCount = 0; }
  return _novitaCount >= cap;
}

async function generateWithNovita(prompt, width, height, seed, apiKey) {
  if (novitaCapReached()) {
    console.warn(`Novita daily cap (${_novitaDailyCap()}) reached — refusing paid generation`);
    throw new Error("__QUOTA__");
  }
  _novitaCount++;

  // Step 1: request generation — returns a signed image URL
  let imageUrl;
  const ctrl1 = abortAfter(FETCH_TIMEOUT_MS());
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
    if (!imageUrl) {
      console.warn("Novita.ai returned no image URL; response:", JSON.stringify(json).slice(0, 120));
      throw new Error("__QUOTA__");
    }
  } finally {
    ctrl1.cancel();
  }

  // Step 2: fetch the actual image bytes — validate the URL host first (SSRF
  // guard) and cap + time-bound the download.
  // Novita has migrated CDNs before (→ Cloudflare R2 r2.cloudflarestorage.com).
  // If they migrate again: add the new host suffix here. If the SSRF check fails,
  // we throw __QUOTA__ so the waterfall continues rather than crashing generation.
  let safeUrl;
  try {
    safeUrl = assertSafeImageUrl(imageUrl, [
      "novita.ai", "novitai.com", "novitaai.com", "amazonaws.com",
      "r2.cloudflarestorage.com", "r2.dev", "cloudfront.net",
    ]);
  } catch (ssrfErr) {
    console.warn(`Novita.ai CDN host blocked by SSRF guard: ${ssrfErr.message} — skipping tier`);
    throw new Error("__QUOTA__");
  }
  const ctrl2 = abortAfter(FETCH_TIMEOUT_MS());
  try {
    const imgRes = await fetch(safeUrl, { signal: ctrl2.signal });
    if (!imgRes.ok) {
      console.warn(`Novita.ai CDN fetch failed (${imgRes.status}) — skipping tier`);
      throw new Error("__QUOTA__");
    }
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

  const ctrl = abortAfter(FETCH_TIMEOUT_MS());
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
 * Tier 1 → Pollinations (free, no key) — easy/medium only
 * Tier 2 → Together AI  (free ~10k/month, needs TOGETHER_API_KEY)
 * Tier 3 → Cloudflare   (free ~35/day, needs CF_ACCOUNT_ID + CF_API_TOKEN)
 * Tier 4 → Novita.ai    (paid ~$0.001–$0.003/img, needs NOVITA_API_KEY)
 * Fallback → HuggingFace (legacy, needs HF_TOKEN)
 *
 * After each provider succeeds we run a coloring-page quality check. If the
 * image looks too dark/shaded (large PNG = lots of dark pixels) we reject it
 * and fall through to the next provider, logging a warning for monitoring.
 */
async function generateImage(prompt, width = 1024, height = 1024, seed, opts = {}) {
  const { hfToken, hfModel = "black-forest-labs/FLUX.1-schnell", difficulty = "medium" } = opts;

  const togetherKey = process.env.TOGETHER_API_KEY;
  const cfAccountId = process.env.CF_ACCOUNT_ID;
  const cfToken     = process.env.CF_API_TOKEN;
  const novitaKey   = process.env.NOVITA_API_KEY;

  // Hard/Extreme: skip ALL free tiers and go straight to the paid tier (Novita).
  // Pollinations misses take ~50-60s; Together AI credits are dead (402); Cloudflare
  // token is dead (401). If both dead free tiers happen to hang instead of returning
  // a fast HTTP error, each burns the full 45s FETCH_TIMEOUT before falling through —
  // 45s + 45s alone can blow the 80s client budget before Novita even starts.
  const skipToFreeTiers = dc().difficulties?.[difficulty]?.skipFreeTiers
    ?? (difficulty === "hard" || difficulty === "extreme");

  // ── Quality gate ── run after each successful provider call ────────────────
  // If the image fails the coloring-page check, we log and continue the waterfall.
  // This is the "dark image" protection: FLUX.1-schnell sometimes produces heavily
  // shaded realistic images for subjects like vehicles/dark animals even with
  // coloring-page prompts. Reject those before they reach the client.
  function qualityCheck(result, providerName) {
    const qc = checkColoringPageQuality(result.buffer, result.contentType);
    if (!qc.ok) {
      console.warn(`[quality] ${providerName} rejected — ${qc.reason} — falling to next tier`);
      return false;
    }
    console.log(`[quality] ${providerName} OK — ${qc.reason}`);
    return true;
  }

  // Tier 1: Pollinations (free, no key) — easy/medium only
  if (!skipToFreeTiers) {
    try {
      const result = await generateWithPollinations(prompt, width, height, seed);
      if (qualityCheck(result, "Pollinations")) return result;
      // Dark image from Pollinations — fall through
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn("Pollinations busy — trying Together AI");
    }
  } else {
    console.log(`[providers] difficulty=${difficulty} — skipping free tiers, going straight to Novita`);
  }

  // Tier 2: Together AI — easy/medium only
  if (togetherKey && !skipToFreeTiers) {
    try {
      const result = await generateWithTogetherAI(prompt, width, height, seed, togetherKey);
      if (qualityCheck(result, "Together AI")) return result;
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn("Together AI quota — trying Cloudflare");
    }
  }

  // Tier 3: Cloudflare Workers AI — easy/medium only
  if (cfAccountId && cfToken && !skipToFreeTiers) {
    try {
      const result = await generateWithCloudflare(prompt, width, height, seed, cfAccountId, cfToken);
      if (qualityCheck(result, "Cloudflare")) return result;
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn("Cloudflare quota — trying Novita.ai");
    }
  }

  // Tier 4: Novita.ai (paid) — capped per day.
  // If Novita also produces a dark image, we log and pass it through anyway —
  // it's the last paid resort and we don't want to permanently block generation.
  if (novitaKey) {
    try {
      const result = await generateWithNovita(prompt, width, height, seed, novitaKey);
      const qc = checkColoringPageQuality(result.buffer, result.contentType);
      if (!qc.ok) {
        console.warn(`[quality] Novita (last resort) produced dark image — ${qc.reason} — sending anyway`);
      } else {
        console.log(`[quality] Novita OK — ${qc.reason}`);
      }
      return result;
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

module.exports = { buildPrompt, generateImage, checkColoringPageQuality, COLORING_NEGATIVE_PROMPT };
