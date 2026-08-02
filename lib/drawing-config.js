"use strict";
// Single source of truth for the entire drawing model.
// Server requires() this directly (zero latency). Clients fetch /api/drawing-config.
// DB key "drawing_config" stores a JSON object whose fields OVERRIDE these defaults.
// Change any default here → redeploy. Change any value at runtime → POST /api/admin/drawing-config.

const DEFAULTS = {

  // ── 1. DIFFICULTY TIERS ───────────────────────────────────────────────────────
  // minArea:      minimum pixel count for a segmented region to be kept (not discarded as noise).
  //               Smaller = more regions survive = busier image. Geometric midpoint of prior web/Flutter values.
  // maxRegions:   cap on how many numbered regions are shown. Excess regions become free-colour only.
  // colorCount:   default palette slots displayed for this difficulty.
  // resolution:   generation width = height in pixels. Both platforms use this.
  // skipFreeTiers: true → bypass Pollinations/Together/Cloudflare, go straight to Novita.
  //               Hard/Extreme skip free tiers because free cold-misses each burn 45-50s and
  //               the 80s client budget runs out before Novita even starts.
  difficulties: {
    easy:    { minArea: 2000, maxRegions: 10, colorCount:  6, resolution: 1024, skipFreeTiers: true },
    medium:  { minArea:  800, maxRegions: 18, colorCount:  8, resolution: 1024, skipFreeTiers: true },
    hard:    { minArea:  300, maxRegions: 30, colorCount: 12, resolution: 1024, skipFreeTiers: true  },
    extreme: { minArea:   80, maxRegions: 48, colorCount: 99, resolution: 1024, skipFreeTiers: true  },
  },

  // ── 2. SIZE OPTIONS ───────────────────────────────────────────────────────────
  // w/h: pixel dimensions sent to the generation API (must be 512, 768, or 1024).
  // promptHint: appended to the base prompt so the model knows scene extent. null = no hint.
  // Note: large and xxl share dimensions — they differ only in promptHint (more background detail).
  sizes: {
    small:  { w:  512, h:  512, promptHint: "single centered subject, sparse simple layout" },
    medium: { w:  768, h:  768, promptHint: null },
    large:  { w: 1024, h: 1024, promptHint: "wide scene filling the full canvas, include background elements" },
    xxl:    { w: 1024, h: 1024, promptHint: "panoramic wide scene filling the entire canvas, rich background detail throughout" },
  },
  defaultSize: "xxl",    // web default (user-selectable)
  mobileSize:  "large",  // Flutter default — 1024×1024 (was hardcoded 768×768)

  // ── 3. REGION DETECTION ───────────────────────────────────────────────────────
  detection: {

    // Outline mask — adaptive hysteresis thresholds for pixel classification.
    // All brightness values are 0 (black) to 255 (white).
    // globalDark:   brightness < this = definite black line (always a wall).
    // localMargin:  strong-line zone: adaptive_mean - localMargin. Catches anti-aliased edges.
    // adaptiveCeil: cap on the strong-line classifier (web=150, Flutter=190 → 165).
    //               Pixels brighter than this are never a strong line regardless of local mean.
    // weakMargin:   weak-candidate zone: adaptive_mean - weakMargin.
    // weakCeil:     near-white free threshold (web=205, Flutter=220 → 212).
    //               Pixels brighter than this are definitively free (colorable), not walls.
    outlineMask: {
      globalDark:   100,
      localMargin:   22,
      adaptiveCeil: 165,
      weakMargin:     8,
      weakCeil:     212,
    },

    // Line gap bridging — connects broken outline segments so regions are fully enclosed.
    // maxGap = clamp(imageShortEdge / 100, maxGapMin, maxGapMax) pixels.
    // faceCos: line-end endpoints must face each other within cos(60°) = 0.5 to be bridged.
    //          Prevents bridging parallel lines that run next to each other.
    // tangentSteps: how many steps along the tangent to probe before bridging.
    // maxGapMax: web=16px, Flutter=24px → 20px. Flutter allowed longer bridges to stitch
    //            JPEG-compressed seams; 20px is a principled midpoint.
    lineBridge: {
      maxGapMin:    4,
      maxGapMax:   20,
      faceCos:    0.5,
      tangentSteps: 4,
    },

    // Trapped-ball segmentation — ball radii series for region seeding.
    // maxR = clamp(imageShortEdge / 200, maxRMin, maxRMax).
    // At 1024px: maxR = clamp(5, 2, 7) = 5 → series 5→3→2→1.
    // decayNumerator/Denominator: next radius = floor(r * 2/3).
    trappedBall: {
      maxRMin:          2,
      maxRMax:          7,
      decayNumerator:   2,
      decayDenominator: 3,
      finalPassRadius:  1,
    },

    // Region validity filters applied after segmentation.
    // absoluteFloor: discard any region with fewer pixels than this. Web had 30 hardcoded;
    //                now explicit and tunable. Prevents stray 1-pixel dots from becoming tap targets.
    // promoteFloor:  background-adjacent specks above this size are promoted to real regions
    //                rather than merged into the background. Flutter had 50; now applied to both.
    // rescueFloor:   if ZERO valid regions survive (e.g., extreme intricate image where every
    //                trapped-ball seed is tiny), rescue the largest regions down to rescueFloor px
    //                so the image stays colorable rather than going blank.
    regionFilter: {
      absoluteFloor: 30,
      promoteFloor:  50,
      rescueFloor:    5,
    },

    // BFS fallback flood fill (pre-worker, before region segmentation completes).
    // bfsDarkThreshold: brightness < this = outline pixel = BFS wall. Web used 80 in the
    //                   fallback path vs 100 in the mask — kept at 80 for conservatism.
    // bfsFloodCapRatio: BFS may not flood more than this fraction of image pixels.
    //                   Prevents BFS from consuming the entire white background.
    bfsDarkThreshold: 80,
    bfsFloodCapRatio: 0.65,

    // workerTimeoutMs: how long the Web Worker / Flutter Isolate is allowed to run before
    //                  being killed and the canvas shown without region data.
    workerTimeoutMs: 90000,

    // snapRadius: tap-to-region lookup snaps to the nearest region within this pixel radius
    //             when the exact tap point lands on a line pixel.
    //             Platform-specific because canvas coordinate systems differ:
    //             web uses canvas-pixel space; Flutter uses logical px through fitImageRect.
    snapRadius: { web: 16, flutter: 12 },
  },

  // ── 4. COLOR ASSIGNMENT ───────────────────────────────────────────────────────
  // useGraphColoring:  Welsh-Powell adjacency-aware coloring so neighbouring regions
  //                    never share the same palette color. Web had this; Flutter did not → add to both.
  // useSemanticOrder:  reorder the palette so the subject's most characteristic color appears
  //                    first (e.g., green for frogs). Web had this; Flutter did not → add to both.
  // defaultColorCount: how many palette slots to show if the user hasn't changed the setting.
  // colorCountOptions: the selectable color count values shown in the UI.
  colorAssignment: {
    useGraphColoring:  true,
    useSemanticOrder:  true,
    defaultColorCount: 12,
    colorCountOptions: [6, 12, 18, 24, 99],
  },

  // ── 5. PALETTE PACKS ──────────────────────────────────────────────────────────
  // unlock: number of completed pictures required to unlock this pack (0 = always available).
  palettePacks: {
    classic: { unlock:  0 },
    pastel:  { unlock:  0 },
    nature:  { unlock:  0 },
    neon:    { unlock:  5 },
    candy:   { unlock: 15 },
    galaxy:  { unlock: 30 },
  },

  // ── 6. COMPLETION ─────────────────────────────────────────────────────────────
  // freeCoverageRatio:      free-colour mode: picture is done when ≥ this fraction of
  //                         the meaningful target regions are colored. 0.90 = 90%.
  // freehandCoverThreshold: a freehand (pencil/paint) region counts as colored once this
  //                         fraction of its interior pixels are painted. Low = forgiving
  //                         because children colour unevenly and leave white gaps.
  // tinyRegionAutoRatio:    a region smaller than this fraction of total image pixels is
  //                         auto-completed (treated as done without user interaction).
  //                         0.0005 = 0.05% of pixels ≈ a 23×23px dot at 1024×1024.
  //                         Flutter had this; web did not → now applied to both.
  completion: {
    freeCoverageRatio:      0.90,
    freehandCoverThreshold: 0.45,
    tinyRegionAutoRatio:    0.0005,
  },

  // ── 7. CANVAS ─────────────────────────────────────────────────────────────────
  // maxDisplayEdgePx: downscale source images whose longest edge exceeds this.
  // undoStackMax:     maximum undo history depth.
  canvas: {
    maxDisplayEdgePx: 2048,
    undoStackMax:       20,
  },

  // ── 8. GENERATION ─────────────────────────────────────────────────────────────
  // clientTimeoutMs: hard abort on the /api/generate-image fetch (web=75000, Flutter=90000 → 80000).
  // seedRange:       random seed is drawn from [0, seedRange).
  // maxImageBytes:   server-side cap on upstream image response size.
  generation: {
    clientTimeoutMs: 80000,
    seedRange:       2_000_000_000,
    maxImageBytes:   25 * 1024 * 1024,
  },

  // ── 9. PROVIDERS ──────────────────────────────────────────────────────────────
  // pollinationsTimeoutMs: per-request timeout for Pollinations (free tier 1).
  //                        Override with POLLINATIONS_TIMEOUT_MS env var.
  // fetchTimeoutMs:        per-request timeout for all other providers.
  //                        Override with FETCH_TIMEOUT_MS env var.
  // novitaDailyCap:        max paid Novita images per calendar day per server instance.
  //                        Override with NOVITA_DAILY_CAP env var.
  // rateLimitMax:          max /api/generate-image requests per IP per rateLimitWindowMs.
  // models/steps/guidance: provider-specific generation parameters.
  providers: {
    pollinationsTimeoutMs: 50_000,
    fetchTimeoutMs:        45_000,
    novitaDailyCap:        300,
    rateLimitMax:          15,
    rateLimitWindowMs:     3_600_000,
    models: {
      pollinations: "flux",
      together:     "black-forest-labs/FLUX.1-schnell-Free",
      cloudflare:   "@cf/black-forest-labs/flux-1-schnell",
      novita:       "flux-1-schnell",
      huggingface:  "black-forest-labs/FLUX.1-schnell",
    },
    steps: {
      together:    4,
      cloudflare:  8,
      novita:      4,
      huggingface: 8,
    },
    guidance: {
      huggingface: 3.5,
    },
  },
};

// ── Runtime config: DEFAULTS deep-merged with DB overrides ────────────────────

let _cache   = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 60_000;

function deepMerge(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return target;
  const out = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      target[key] !== null
    ) {
      out[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

// Asynchronously loads DB overrides and merges them with DEFAULTS.
// Caches the result for CACHE_TTL_MS. Falls back to DEFAULTS if DB is unavailable.
async function getDrawingConfig() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;
  try {
    const db = require("./db");
    const raw = await db.getConfig("drawing_config", "{}");
    const overrides = JSON.parse(raw || "{}");
    _cache   = deepMerge(DEFAULTS, overrides);
    _cacheAt = Date.now();
  } catch {
    _cache   = DEFAULTS;
    _cacheAt = Date.now();
  }
  return _cache;
}

// Synchronous read — returns last-loaded cache (or DEFAULTS before first async load).
// Safe to call from non-async contexts in image-providers.js.
function getDrawingConfigSync() {
  return _cache || DEFAULTS;
}

// Bust the cache (called by admin endpoint after a write).
function invalidateDrawingConfigCache() {
  _cacheAt = 0;
}

module.exports = { DEFAULTS, getDrawingConfig, getDrawingConfigSync, invalidateDrawingConfigCache, deepMerge };
