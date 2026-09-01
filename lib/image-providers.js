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

// Pollinations uses model=flux (FLUX.1-schnell) — the free tier that reliably
// generates true coloring-page line art: pure black outlines on white, fully
// sealed regions, no shading or photorealism. FLUX follows long keyword-style
// prompts well; SDXL/Sana produce 3D renders that the segmentation can't fill.
// negative_prompt is NOT passed — FLUX.1-schnell ignores it; the positive prompt
// keyword list is sufficient for clean coloring-page output.

const COLORING_NEGATIVE_PROMPT =
  "shading, shadows, gradients, colors, colorful, photorealistic, realistic, dark, grey, " +
  "sketch, crosshatch, watercolor, painting, 3d render, texture, noise, dirty, grungy, " +
  "pencil marks, ink wash, tonal values, halftone";

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

// ─── Coloring-book post-processor ─────────────────────────────────────────────
// Converts ANY image (PNG or JPEG) to clean black-outlines-on-white line art via
// Sobel edge detection. Called on every generated image — guarantees coloring-
// book style output regardless of what the model produces.
// PNG path: pure Node.js (zlib). JPEG path: sharp (production dep).

// Lazy-load sharp so the server still starts if the binary is missing.
let _sharpModule = null;
function _tryGetSharp() {
  if (_sharpModule !== null) return _sharpModule;
  try { _sharpModule = require("sharp"); } catch { _sharpModule = undefined; }
  return _sharpModule;
}

function _crc32Table() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
}
const _CRC32T = _crc32Table();

function _crc32(buf, start, end) {
  let crc = 0xFFFFFFFF;
  for (let i = start; i < end; i++) crc = _CRC32T[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _pngChunk(type, data) {
  const tb = Buffer.from(type, "ascii");
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length);
  const cb = Buffer.alloc(4);
  const crcData = Buffer.concat([tb, data]);
  cb.writeUInt32BE(_crc32(crcData, 0, crcData.length));
  return Buffer.concat([lb, tb, data, cb]);
}

function _encodePngGray(pixels, w, h) {
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[(w + 1) * y] = 0; // filter=None
    pixels.copy(raw, (w + 1) * y + 1, y * w, y * w + w);
  }
  const comp = zlib.deflateSync(raw, { level: 6 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; // 8-bit grayscale
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([sig, _pngChunk("IHDR", ihdr), _pngChunk("IDAT", comp), _pngChunk("IEND", Buffer.alloc(0))]);
}

// Core edge-detection algorithm — takes raw grayscale pixels, returns coloring-book PNG.
function _edgeArtFromGray(gray, w, h) {
  if (!gray || gray.length < w * h) return null;

  // Gaussian 5×5 blur — larger kernel suppresses fine texture noise in photorealistic images
  // kernel σ≈1.4, weights summing to 273
  const K5 = [1,4,7,4,1, 4,16,26,16,4, 7,26,41,26,7, 4,16,26,16,4, 1,4,7,4,1];
  const blurred = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let ky = -2; ky <= 2; ky++) for (let kx = -2; kx <= 2; kx++) {
        const ny = Math.max(0, Math.min(h - 1, y + ky));
        const nx = Math.max(0, Math.min(w - 1, x + kx));
        sum += gray[ny * w + nx] * K5[(ky + 2) * 5 + (kx + 2)];
      }
      blurred[y * w + x] = Math.round(sum / 273);
    }
  }

  // Sobel edge magnitude
  const SX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const SY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const magnitudes = new Float32Array(w * h);
  let maxMag = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) {
        const v = blurred[(y + ky) * w + (x + kx)];
        const idx = (ky + 1) * 3 + (kx + 1);
        gx += v * SX[idx]; gy += v * SY[idx];
      }
      const m = Math.sqrt(gx * gx + gy * gy);
      magnitudes[y * w + x] = m;
      if (m > maxMag) maxMag = m;
    }
  }

  // Adaptive threshold: 30% of peak gradient — only major structural edges survive
  const THRESH = maxMag * 0.30;
  const edge = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (magnitudes[i] >= THRESH) edge[i] = 1;

  // Dilate by 1 pixel for bold, kid-friendly line weight
  const output = Buffer.alloc(w * h, 255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (edge[y * w + x]) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) output[ny * w + nx] = 0;
        }
      }
    }
  }

  try { return _encodePngGray(output, w, h); } catch { return null; }
}

// Decode PNG header and IDAT chunks → raw grayscale pixels. Returns {gray, w, h} or null.
function _decodePngToGray(buf) {
  if (!buf || buf.length < 8 ||
      buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) return null;

  let off = 8, w = 0, h = 0, colorType = -1, bitDepth = 0;
  const idats = [];
  while (off + 12 <= buf.length) {
    const len  = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    off += 12 + len;
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === "IDAT") idats.push(data);
    else if (type === "IEND") break;
  }
  if (!w || !h || bitDepth !== 8 || colorType === 3 || w * h > 2048 * 2048) return null;

  const bpp = [1, 0, 3, 0, 2, 0, 4][colorType];
  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idats)); } catch { return null; }

  const stride = 1 + bpp * w;
  if (raw.length < stride * h) return null;

  function paeth(a, b, c) {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return (pa <= pb && pa <= pc) ? a : (pb <= pc) ? b : c;
  }

  const gray  = new Uint8Array(w * h);
  const prevR = new Uint8Array(bpp * w);
  const curR  = new Uint8Array(bpp * w);
  for (let y = 0; y < h; y++) {
    const filt = raw[y * stride];
    for (let i = 0; i < bpp * w; i++) {
      const x = raw[y * stride + 1 + i];
      const a = i >= bpp ? curR[i - bpp] : 0;
      const b = prevR[i];
      const c = i >= bpp ? prevR[i - bpp] : 0;
      switch (filt) {
        case 0: curR[i] = x; break;
        case 1: curR[i] = (x + a) & 0xFF; break;
        case 2: curR[i] = (x + b) & 0xFF; break;
        case 3: curR[i] = (x + ((a + b) >> 1)) & 0xFF; break;
        case 4: curR[i] = (x + paeth(a, b, c)) & 0xFF; break;
        default: curR[i] = x;
      }
    }
    for (let x = 0; x < w; x++) {
      const base = x * bpp;
      gray[y * w + x] = (colorType === 0 || colorType === 4) ? curR[base]
        : Math.round(0.299 * curR[base] + 0.587 * curR[base + 1] + 0.114 * curR[base + 2]);
    }
    prevR.set(curR);
  }
  return { gray, w, h };
}

// async — handles PNG (pure-JS) and JPEG/WebP (via sharp). Returns PNG Buffer or null.
async function convertToLineArt(buf) {
  if (!buf) return null;

  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;

  if (isPng) {
    try {
      const parsed = _decodePngToGray(buf);
      if (!parsed) return null;
      return _edgeArtFromGray(parsed.gray, parsed.w, parsed.h);
    } catch { return null; }
  }

  // Non-PNG (JPEG, WebP) — decode via sharp, then apply same algorithm
  const sharp = _tryGetSharp();
  if (!sharp) {
    console.warn("[post-process] sharp not available — cannot convert non-PNG image");
    return null;
  }
  try {
    const { data, info } = await sharp(buf).grayscale().raw().toBuffer({ resolveWithObject: true });
    return _edgeArtFromGray(data, info.width, info.height);
  } catch (e) {
    console.warn("[post-process] sharp decode failed:", e.message);
    return null;
  }
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
const POLLINATIONS_TIMEOUT_MS = () => (Number.isFinite(_envPoll) && _envPoll > 0) ? _envPoll : (dc().providers?.pollinationsTimeoutMs ?? 75_000); // flux-dev needs ~60s

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
  url.searchParams.set("model",    "flux-dev"); // FLUX.1-dev: 28 steps, much better coloring-book prompt following than schnell
  url.searchParams.set("negative", COLORING_NEGATIVE_PROMPT); // flux-dev respects negative prompts
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

  // skipFreeTiers removed: Pollinations is now tried for ALL difficulties.
  // When Novita (paid) is capped/down, Pollinations prevents a 500 — cold miss
  // ≈ 50s but still within the 80s client budget before Novita + HF fallbacks.
  const skipToFreeTiers = dc().difficulties?.[difficulty]?.skipFreeTiers ?? false;

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

  // Tier 1: Pollinations (free, no key)
  if (!skipToFreeTiers) {
    try {
      const result = await generateWithPollinations(prompt, width, height, seed);
      // Always post-process — guarantees coloring-book style regardless of model output
      const lineArt = await convertToLineArt(result.buffer);
      if (lineArt) {
        console.log("[providers] Pollinations → post-processed to coloring-book line art");
        return { buffer: lineArt, contentType: "image/png" };
      }
      // Post-processing failed (e.g. unusual format) — fall back to quality check
      if (qualityCheck(result, "Pollinations")) return result;
      console.warn("[providers] Pollinations: quality failed and post-processing unavailable — trying next tier");
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
      const lineArt = await convertToLineArt(result.buffer);
      if (lineArt) {
        console.log("[providers] Together AI → post-processed to coloring-book line art");
        return { buffer: lineArt, contentType: "image/png" };
      }
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
      const lineArt = await convertToLineArt(result.buffer);
      if (lineArt) {
        console.log("[providers] Cloudflare → post-processed to coloring-book line art");
        return { buffer: lineArt, contentType: "image/png" };
      }
      if (qualityCheck(result, "Cloudflare")) return result;
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn("Cloudflare quota — trying Novita.ai");
    }
  }

  // Tier 4: Novita.ai (paid) — always post-process; send as-is only if everything fails.
  if (novitaKey) {
    try {
      const result = await generateWithNovita(prompt, width, height, seed, novitaKey);
      const lineArt = await convertToLineArt(result.buffer);
      if (lineArt) {
        console.log("[providers] Novita → post-processed to coloring-book line art");
        return { buffer: lineArt, contentType: "image/png" };
      }
      const qc = checkColoringPageQuality(result.buffer, result.contentType);
      if (qc.ok) { console.log(`[quality] Novita OK — ${qc.reason}`); return result; }
      console.warn(`[quality] Novita (last resort) dark image — ${qc.reason} — sending anyway`);
      return result;
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn(`Novita unavailable/capped (${err.name}: ${err.message.slice(0, 60)}) — trying HuggingFace`);
    }
  }

  // Legacy fallback: HuggingFace
  if (hfToken) {
    try {
      return await generateWithHuggingFace(prompt, width, height, seed, hfToken, hfModel);
    } catch (err) {
      console.warn("HuggingFace failed:", err.message);
      // fall through to friendly error
    }
  }

  throw new Error("The drawing service is busy right now — please try again in a moment! 🎨");
}

module.exports = { buildPrompt, generateImage, checkColoringPageQuality, COLORING_NEGATIVE_PROMPT };
