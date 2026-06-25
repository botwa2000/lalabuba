import { state } from './state.js';
import { DIFFICULTY } from './data.js';
import { t } from './i18n.js';
import {
  previewCanvas, drawCanvas, context, drawCtx,
  previewStage, showNumbersInput, printButton, downloadButton, pencilBtn, clearPencilBtn,
} from './dom.js';
import { resetZoom } from './zoom.js';
import { bounce, sparkleBurst, sparkleAt, playComplete } from './fx.js';
// Versioned query: dodges a Cloudflare negative-cache of the bare path that can
// occur when /js/fill-core.js is requested before its first deploy. Bump with
// the asset version. (.js is served no-store, so the query only affects the CDN
// cache key, never freshness.)
import { fillRegionCore, watershedAssign, buildRegionPixels } from './fill-core.js?v=214';
import { buildOutlineMask } from './outline-mask.js?v=214';
import { bridgeLineGaps }   from './line-bridge.js?v=214';
import { trappedBallSegment } from './trapped-ball.js?v=214';

// ─── Off-thread segmentation worker ─────────────────────────────────────────
// precomputeRegions() can block the main thread for 200ms–10s on complex images
// (hard/extreme mandala-style line art). All segmentation runs here instead so
// the image appears immediately and coloring enables once the worker finishes.

let _worker = null;
let _segGeneration = 0;   // incremented on each new render; stale results discarded

function _getWorker() {
  if (_worker) return _worker;
  try {
    // ES module workers: supported on Chrome 80+, Firefox 114+, Safari 15+,
    // iOS 15+, Android Chromium (Capacitor target).
    _worker = new Worker(new URL('./region-worker.js?v=214', import.meta.url), { type: 'module' });
  } catch { _worker = null; }
  return _worker;
}

// Post image pixels to the worker; resolve with the raw result message data.
// Caller passes `gen` so it can detect whether a newer render superseded this one.
function _postToWorker(imageDataBuffer, width, height, gen) {
  return new Promise((resolve, reject) => {
    const worker = _getWorker();
    if (!worker) { reject(new Error('no-worker')); return; }

    const onMsg = ({ data }) => {
      if (data.gen !== gen) return; // stale — a newer render already started
      cleanup();
      resolve(data);
    };
    const onErr = (e) => {
      cleanup();
      _worker = null; // force recreation on next attempt
      reject(e);
    };
    const cleanup = () => {
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
    };

    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);

    // Slice (copy) the pixel buffer so state.baseImageData.data.buffer is not
    // detached — the main thread still needs it for drawing/coloring.
    const pixelsCopy = imageDataBuffer.slice(0);
    worker.postMessage({ pixels: pixelsCopy, width, height, gen }, [pixelsCopy]);
  });
}

// Apply the worker result to state (all typed arrays were transferred zero-copy).
function _applyWorkerResult(result) {
  const { regionMap, lineMask, backgroundRegionId, regionIds, regionPixelBuffers } = result;
  state.regionMap = new Int32Array(regionMap);
  state.lineMask  = new Uint8Array(lineMask);
  state.backgroundRegionId = backgroundRegionId;
  const rp = new Map();
  regionIds.forEach((id, i) => rp.set(id, new Int32Array(regionPixelBuffers[i])));
  state.regionPixels = rp;
}

// Module-level palette context, set by setPaletteContext() from ui.js
let _palette = [];
let _colorCount = 12;

export function setPaletteContext(palette, colorCount) {
  _palette = palette;
  _colorCount = colorCount;
}

export function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

// One pass of 4-neighbour dilation to lightly sharpen anti-aliased outlines on
// the displayed image. Heavy gap-sealing for segmentation happens separately inside
// precomputeRegions() on a private copy that never touches the canvas.
export function closeOutlineGaps(imageData) {
  const { data, width, height } = imageData;
  const dark = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    dark[i] = (data[o] + data[o + 1] + data[o + 2]) / 3 < 100 ? 1 : 0;
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (dark[i]) continue;
      if (dark[(y - 1) * width + x] || dark[(y + 1) * width + x] ||
          dark[y * width + (x - 1)] || dark[y * width + (x + 1)]) {
        const o = i * 4;
        data[o] = 0; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 255;
      }
    }
  }
}

export function buildWalkableMask(data, width, height) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const brightness = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
    mask[i] = brightness > 235 ? 1 : 0;
  }
  return mask;
}

export function findRegions(mask, width, height, minRegionSize = 900, maxRegions = 12) {
  const visited = new Uint8Array(mask.length);
  const regions = [];
  const queueX = new Int32Array(mask.length);
  const queueY = new Int32Array(mask.length);

  for (let startY = 1; startY < height - 1; startY += 1) {
    for (let startX = 1; startX < width - 1; startX += 1) {
      const startIndex = startY * width + startX;
      if (visited[startIndex] || !mask[startIndex]) {
        continue;
      }

      let head = 0;
      let tail = 0;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let touchesEdge = false;

      visited[startIndex] = 1;
      queueX[tail] = startX;
      queueY[tail] = startY;
      tail += 1;

      while (head < tail) {
        const x = queueX[head];
        const y = queueY[head];
        head += 1;

        area += 1;
        sumX += x;
        sumY += y;

        if (x < 10 || y < 10 || x > width - 11 || y > height - 11) {
          touchesEdge = true;
        }

        const neighbors = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];

        for (const [nextX, nextY] of neighbors) {
          const nextIndex = nextY * width + nextX;
          if (visited[nextIndex] || !mask[nextIndex]) {
            continue;
          }

          visited[nextIndex] = 1;
          queueX[tail] = nextX;
          queueY[tail] = nextY;
          tail += 1;
        }
      }

      if (!touchesEdge && area >= minRegionSize) {
        regions.push({
          area,
          x: Math.round(sumX / area),
          y: Math.round(sumY / area),
        });
      }
    }
  }

  return regions
    .sort((left, right) => right.area - left.area)
    .slice(0, maxRegions);
}

// Returns the index in palette of the color nearest to (r, g, b).
export function nearestPaletteIndex(r, g, b, palette) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const c = hexToRgb(palette[i].color);
    const d = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

export function overlayNumbers() {
  const palette = _palette;
  const colorCount = _colorCount;
  // Both baseImageData AND regionMap must be ready (regionMap arrives from the
  // worker asynchronously). Returning early here prevents overlayNumbers from
  // caching a broken empty regionColorMap before the worker result is applied.
  if (!state.baseImageData || !state.regionMap) return;
  // The region set (centroids + areas) is derived from the BASE image, so it is
  // identical on every redraw — recomputing buildWalkableMask + findRegions (a
  // full connected-component pass over ~1M pixels) on every single fill was the
  // dominant cause of coloring jank. Cache it per image; it's invalidated in
  // drawBaseImage when a new image (or difficulty/colorCount change) loads.
  let regions = state.numberRegions;
  if (!regions) {
    const mask = buildWalkableMask(state.baseImageData.data, previewCanvas.width, previewCanvas.height);
    const diff = DIFFICULTY[document.getElementById('difficulty-select').value] || DIFFICULTY.medium;
    // Scale minArea proportionally to image pixel count so region density is
    // consistent across canvas sizes (same difficulty = same relative region count).
    const scaledMinArea = Math.round(diff.minArea * (previewCanvas.width * previewCanvas.height) / (1024 * 1024));
    regions = findRegions(mask, previewCanvas.width, previewCanvas.height, scaledMinArea, colorCount);
    state.numberRegions = regions;
  }
  const src = state.baseImageData.data;
  const w = previewCanvas.width;

  // Build regionColorMap once per image load; reuse on subsequent redraws.
  // Colors can repeat across regions (like a real color-by-number book).
  if (!state.regionColorMap) {
    state.regionColorMap = new Map();

    regions.forEach((region, index) => {
      let paletteIndex = index % palette.length;

      // Snap centroid to nearest positive region (same logic as badge drawing)
      // so regionColorMap stays in sync with visible badges.
      let mapId = state.regionMap?.[region.y * w + region.x];
      if (!(mapId > 0) && state.regionMap) {
        const snapR = 20;
        snap: for (let dy = -snapR; dy <= snapR; dy++) {
          for (let dx = -snapR; dx <= snapR; dx++) {
            const nx = region.x + dx, ny = region.y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= previewCanvas.height) continue;
            const id = state.regionMap[ny * w + nx];
            if (id > 0) { mapId = id; break snap; }
          }
        }
      }

      const pixels = mapId > 0 ? state.regionPixels?.get(mapId) : null;
      if (pixels && pixels.length > 0) {
        let sumR = 0, sumG = 0, sumB = 0;
        const step = Math.max(1, Math.floor(pixels.length / 200));
        let count = 0;
        for (let pi = 0; pi < pixels.length; pi += step) {
          const o = pixels[pi] * 4;
          sumR += src[o]; sumG += src[o+1]; sumB += src[o+2];
          count++;
        }
        const avgBr = (sumR + sumG + sumB) / (count * 3);
        if (avgBr < 240) {
          paletteIndex = nearestPaletteIndex(sumR/count, sumG/count, sumB/count, palette);
        }
      }
      if (mapId > 0) state.regionColorMap.set(mapId, paletteIndex);
    });

    // ── Graph coloring: ensure no two adjacent regions share a color ─────────
    // Build adjacency by scanning barrier pixels (rm[i] === -1) and collecting
    // all distinct positive-region neighbours touching that barrier pixel.
    if (state.regionMap) {
      const rm = state.regionMap;
      const H  = previewCanvas.height;
      const adj = new Map();
      for (const [id] of state.regionColorMap) adj.set(id, new Set());

      for (let i = 0; i < rm.length; i++) {
        if (rm[i] >= 0) continue; // only barrier pixels
        const x = i % w, y = (i / w) | 0;
        const ids = [];
        if (x > 0     && rm[i - 1] > 0) ids.push(rm[i - 1]);
        if (x < w - 1 && rm[i + 1] > 0) ids.push(rm[i + 1]);
        if (y > 0     && rm[i - w] > 0) ids.push(rm[i - w]);
        if (y < H - 1 && rm[i + w] > 0) ids.push(rm[i + w]);
        for (let a = 0; a < ids.length - 1; a++) {
          for (let b = a + 1; b < ids.length; b++) {
            if (ids[a] !== ids[b]) {
              if (adj.has(ids[a])) adj.get(ids[a]).add(ids[b]);
              if (adj.has(ids[b])) adj.get(ids[b]).add(ids[a]);
            }
          }
        }
      }

      // Welsh-Powell: process most-connected regions first.
      const order = [...state.regionColorMap.keys()]
        .sort((a, b) => (adj.get(b)?.size || 0) - (adj.get(a)?.size || 0));

      const final = new Map();
      for (const id of order) {
        const neighborColors = new Set();
        for (const nid of (adj.get(id) || [])) {
          if (final.has(nid)) neighborColors.add(final.get(nid));
        }
        const preferred = state.regionColorMap.get(id) ?? 0;
        if (!neighborColors.has(preferred)) {
          final.set(id, preferred);
        } else {
          let assigned = preferred;
          for (let c = 0; c < palette.length; c++) {
            if (!neighborColors.has(c)) { assigned = c; break; }
          }
          final.set(id, assigned);
        }
      }
      state.regionColorMap = final;
    }
  }

  context.textAlign = "center";
  context.textBaseline = "middle";

  const drawnMapIds = new Set(); // prevent drawing the same region badge twice

  regions.forEach((region) => {
    // If centroid lands on an outline/background pixel, snap to nearest region pixel.
    let mapId = state.regionMap?.[region.y * w + region.x];
    if (!(mapId > 0) && state.regionMap) {
      const snapR = 20;
      outer: for (let dy = -snapR; dy <= snapR; dy++) {
        for (let dx = -snapR; dx <= snapR; dx++) {
          const nx = region.x + dx, ny = region.y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= previewCanvas.height) continue;
          const id = state.regionMap[ny * w + nx];
          if (id > 0) { mapId = id; break outer; }
        }
      }
    }
    // Hide badge once the region has been filled, or if already drawn for this mapId.
    if (mapId > 0 && state.completedRegions.has(mapId)) return;
    if (mapId > 0 && drawnMapIds.has(mapId)) return;
    if (mapId > 0) drawnMapIds.add(mapId);
    const paletteIndex = (mapId > 0 ? state.regionColorMap.get(mapId) : null) ?? 0;
    const badgeColor = palette[paletteIndex]?.color ?? "#222";
    const radius = Math.max(14, Math.min(26, Math.sqrt(region.area) * 0.08));

    context.fillStyle = "rgba(255,255,255,0.92)";
    context.beginPath();
    context.arc(region.x, region.y, radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = badgeColor;
    context.lineWidth = 2.5;
    context.stroke();

    context.fillStyle = "#111";
    context.font = `bold ${Math.round(radius)}px Georgia`;
    context.fillText(String(paletteIndex + 1), region.x, region.y + 1);
  });
}

export function redrawCanvas() {
  if (!state.paintedImageData) {
    return;
  }

  context.putImageData(state.paintedImageData, 0, 0);

  if (showNumbersInput.checked) {
    overlayNumbers();
  }
}

// ─── Completion animation ────────────────────────────────────────────────────
// Plays a short "comes to life" beat the instant the last region is filled: the
// colored picture reveals itself over the line art in a few quick waves, then the
// canvas gives a happy bounce with sparkles + a chime. Returns a Promise that
// resolves once the beat is done, so main.js can then slide in the celebration
// card. PURE PRESENTATION — it reads state.paintedImageData/regionPixels and
// repaints the visible canvas; it never mutates fill state, so an undo afterwards
// is unaffected. Degrades to an instant finish when data or motion is unavailable.
function burstCompletionSparkles() {
  try {
    const regions = state.numberRegions;
    const rect = previewCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (!regions || !regions.length) { sparkleAt(previewCanvas, 14); return; }
    const sx = rect.width / previewCanvas.width;
    const sy = rect.height / previewCanvas.height;
    regions.slice(0, 6).forEach((r) =>
      sparkleBurst(rect.left + r.x * sx, rect.top + r.y * sy, 6));
  } catch { /* ignore */ }
}

export function animateCompletion() {
  return new Promise((resolve) => {
    const painted = state.paintedImageData;
    const base = state.baseImageData;
    let reduce = false;
    try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }

    const finish = () => {
      try { context.putImageData(painted, 0, 0); } catch { /* ignore */ }
      if (showNumbersInput.checked) { try { overlayNumbers(); } catch { /* ignore */ } }
      // Chime leads the bounce a beat so the sound feels like it *causes* the pop.
      try { playComplete(); } catch { /* ignore */ }
      bounce(previewCanvas);
      burstCompletionSparkles();
      setTimeout(resolve, reduce ? 0 : 480);
    };

    if (!painted || !base || !state.regionPixels || reduce) { finish(); return; }
    const ids = [...state.regionPixels.keys()];
    if (!ids.length) { finish(); return; }

    const W = base.width, H = base.height;
    const cx = W / 2, cy = H / 2;
    const maxD = Math.hypot(cx, cy) || 1;
    const pd = painted.data, bd = base.data;

    // Build the reveal list: ONLY the regions the child actually coloured (their
    // pixels differ from the line art). This skips the white background + any
    // un-filled gaps, so the bloom is all colour and costs nothing on empty areas.
    // Order them center-outward so the colour blooms from the middle rather than
    // popping in arbitrary map order (the old raw look). Centroid + painted-test
    // share one sampled pass (≤48 pts/region) so it's cheap even on big art.
    const items = [];
    for (const id of ids) {
      const px = state.regionPixels.get(id);
      if (!px || !px.length) continue;
      let sx = 0, sy = 0, c = 0, isPainted = false;
      const stride = Math.max(1, Math.floor(px.length / 48));
      for (let j = 0; j < px.length; j += stride) {
        const p = px[j]; sx += p % W; sy += (p / W) | 0; c++;
        const o = p * 4;
        if (!isPainted && (pd[o] !== bd[o] || pd[o + 1] !== bd[o + 1] || pd[o + 2] !== bd[o + 2])) isPainted = true;
      }
      if (!isPainted) continue; // background / un-filled → nothing to reveal
      const mx = c ? sx / c : cx, my = c ? sy / c : cy;
      items.push({ px, d: Math.hypot(mx - cx, my - cy) / maxD, done: false, t0: 0 });
    }
    if (!items.length) { finish(); return; }
    items.sort((a, b) => a.d - b.d);

    // Each region fades from line-art to colour over FADE_MS; their start times are
    // staggered across REVEAL_MS with an ease so the wave-front accelerates then
    // eases out — a soft sweep instead of fixed-step pops.
    const N = items.length;
    const REVEAL_MS = 600, FADE_MS = 240;
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    items.forEach((r, i) => { r.t0 = easeInOut(N === 1 ? 0 : i / (N - 1)) * REVEAL_MS; });

    const work = new ImageData(new Uint8ClampedArray(base.data), W, H);
    const wd = work.data; // pd (painted) + bd (base) already bound above
    try { context.putImageData(work, 0, 0); } catch { /* ignore */ }

    let startTs = 0;
    const frame = (ts) => {
      if (!startTs) startTs = ts;
      const el = ts - startTs;
      let allDone = true;
      for (let i = 0; i < N; i++) {
        const r = items[i];
        if (r.done) continue;
        const a = (el - r.t0) / FADE_MS;
        if (a <= 0) { allDone = false; continue; }      // not started yet
        const px = r.px;
        if (a >= 1) {                                    // fully revealed — copy once
          for (let j = 0; j < px.length; j++) {
            const o = px[j] * 4;
            wd[o] = pd[o]; wd[o + 1] = pd[o + 1]; wd[o + 2] = pd[o + 2]; wd[o + 3] = pd[o + 3];
          }
          r.done = true;
        } else {                                         // mid-fade — smoothstep blend
          allDone = false;
          const ea = a * a * (3 - 2 * a), inv = 1 - ea;
          for (let j = 0; j < px.length; j++) {
            const o = px[j] * 4;
            wd[o]     = bd[o]     * inv + pd[o]     * ea;
            wd[o + 1] = bd[o + 1] * inv + pd[o + 1] * ea;
            wd[o + 2] = bd[o + 2] * inv + pd[o + 2] * ea;
            wd[o + 3] = 255;
          }
        }
      }
      try { context.putImageData(work, 0, 0); } catch { /* ignore */ }
      if (allDone && el >= REVEAL_MS) { finish(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

// ─── Synchronous fallback segmentation ────────────────────────────────────────
// Used when the Web Worker is unavailable (rare: certain security policies, very
// old WebViews). Identical algorithm to region-worker.js; runs on the main thread.
export function precomputeRegions() {
  const { width, height } = previewCanvas;
  const n = width * height;
  const src = state.baseImageData.data;

  let outlineMask = buildOutlineMask(src, width, height);
  const lineMask  = Uint8Array.from(outlineMask);
  bridgeLineGaps(outlineMask, width, height);

  for (let x = 0; x < width;  x++) { outlineMask[x] = 1; outlineMask[(height-1)*width+x] = 1; }
  for (let y = 0; y < height; y++) { outlineMask[y*width] = 1; outlineMask[y*width+width-1] = 1; }

  const seg = trappedBallSegment(outlineMask, width, height);

  const label = new Int32Array(n);
  const segBuf = new Map();
  for (let i = 0; i < n; i++) {
    const s = seg[i];
    if (s >= 0) {
      label[i] = s + 1;
      let arr = segBuf.get(s + 1);
      if (!arr) { arr = []; segBuf.set(s + 1, arr); }
      arr.push(i);
    } else {
      label[i] = -1;
    }
  }
  state.regionPixels = new Map();
  for (const [id, buf] of segBuf) {
    if (buf.length >= 30) state.regionPixels.set(id, buf);
    else for (const p of buf) label[p] = -1;
  }

  state.backgroundRegionId = 0;
  outer:
  for (let dy = 1; dy <= 4; dy++) {
    for (let dx = 1; dx <= 4; dx++) {
      const id = label[dy * width + dx];
      if (id > 0) { state.backgroundRegionId = id; break outer; }
    }
  }
  if (!state.backgroundRegionId) {
    let maxSize = 0;
    for (const [id, pixels] of state.regionPixels) {
      if (pixels.length > maxSize) { maxSize = pixels.length; state.backgroundRegionId = id; }
    }
  }

  watershedAssign(label, width, height);
  state.regionPixels = buildRegionPixels(label, lineMask, [...state.regionPixels.keys()], width, height);
  state.lineMask = lineMask;
  state.regionMap = label;
}

// Paint every pixel in regionId with fillColor, then redraw. Delegates the pure
// pixel work to fillRegionCore (fill-core.js) — DOM-free and unit-tested. Under
// the watershed model every pixel of a region is already owned (the band is
// assigned to the nearest region and line pixels are excluded), so the fill is a
// flat solid paint of the region's pixels — no bleed, no gap-reclaim heuristics.
// Returns { success: true, record } where record encodes every touched pixel's
// previous RGBA so it can be undone.
export function fillRegion(regionId, fillColor) {
  if (!state.regionPixels?.get(regionId)) return { success: false };

  const { undoEntries } = fillRegionCore({
    paint: state.paintedImageData.data,
    regionPixels: state.regionPixels,
    regionId,
    fillColor,
  });

  redrawCanvas();
  return { success: true, record: packUndoRecord(undoEntries) };
}

// Pack [idx, r, g, b, a, idx, r, g, b, a, ...] into compact Uint8Array
// idx stored as 3 bytes LE (max 1024*1024 = 1048576 < 16M)
function packUndoRecord(entries) {
  const count = entries.length / 5;
  const buf = new Uint8Array(count * 7); // 3 bytes idx + 4 bytes RGBA
  for (let i = 0, b = 0; i < entries.length; i += 5, b += 7) {
    const idx = entries[i];
    buf[b]   = idx & 0xff;
    buf[b+1] = (idx >> 8) & 0xff;
    buf[b+2] = (idx >> 16) & 0xff;
    buf[b+3] = entries[i+1]; // prevR
    buf[b+4] = entries[i+2]; // prevG
    buf[b+5] = entries[i+3]; // prevB
    buf[b+6] = entries[i+4]; // prevA
  }
  return buf;
}

// Undo the last fill (or batch fill) by restoring pixel colors from packed records.
export function undoLastFill() {
  const entry = state.undoStack.pop();
  if (!entry) return false;
  const paint = state.paintedImageData.data;

  function applyRecord({ record, regionId, completedBefore }) {
    for (let b = 0; b < record.length; b += 7) {
      const idx = record[b] | (record[b+1] << 8) | (record[b+2] << 16);
      const o = idx * 4;
      paint[o]   = record[b+3];
      paint[o+1] = record[b+4];
      paint[o+2] = record[b+5];
      paint[o+3] = record[b+6];
    }
    if (!completedBefore) state.completedRegions.delete(regionId);
  }

  if (entry.batch) {
    for (const r of entry.batch) applyRecord(r);
  } else {
    applyRecord(entry);
  }
  state.celebrationShown = false;
  redrawCanvas();
  return true;
}

// Return the region id at (canvasX, canvasY), snapping up to 8 px if on a line.
export function findRegionAt(canvasX, canvasY) {
  const { width, height } = previewCanvas;
  if (!state.regionMap) return 0;
  const direct = state.regionMap[canvasY * width + canvasX];
  if (direct > 0) return direct;
  for (let r = 1; r <= 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) < r && Math.abs(dy) < r) continue;
        const x = canvasX + dx, y = canvasY + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const id = state.regionMap[y * width + x];
        if (id > 0) return id;
      }
    }
  }
  return 0;
}

export function imageFromBase64(imageBase64) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode generated image."));
    image.src = `data:image/png;base64,${imageBase64}`;
  });
}

export async function imageFromUrl(url) {
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Image request failed (${response.status}).`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to decode generated image."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Fetches a cross-origin image and returns it as a data URL so it can be
// stored in currentImage and reused on re-renders without re-fetching.
export async function fetchToDataUrl(url) {
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Pollinations returned ${response.status}.`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Pollinations returned non-image content (${contentType}).`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image data."));
    reader.readAsDataURL(blob);
  });
}

export function drawBaseImage(image) {
  // Cap the canvas so the 3-byte packed undo pixel index (max 16.77M px) can
  // never overflow on an unexpectedly large source. Generation is ≤1024², but a
  // shared/external image could be bigger; 2048² = 4.2M px is safely under the
  // ceiling and keeps full quality for our pages. Aspect ratio preserved.
  const MAX_EDGE = 2048;
  const srcW = image.naturalWidth  || image.width  || 1024;
  const srcH = image.naturalHeight || image.height || 1024;
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  previewCanvas.width  = Math.max(1, Math.round(srcW * scale));
  previewCanvas.height = Math.max(1, Math.round(srcH * scale));
  previewCanvas.hidden = false;
  previewStage.classList.remove("empty");

  // Reset draw canvas to match new image dimensions and clear pencil strokes.
  drawCanvas.width  = previewCanvas.width;
  drawCanvas.height = previewCanvas.height;
  drawCanvas.hidden = false;
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

  // Exit pencil/paint mode on new image.
  state.pencilMode = false;
  state.colorMode = 'tap';
  pencilBtn.classList.remove('active');
  drawCanvas.classList.remove('pencil-active');
  previewCanvas.style.pointerEvents = '';
  document.getElementById('mode-tap-btn')?.classList.add('active');
  document.getElementById('mode-paint-btn')?.classList.remove('active');

  pencilBtn.disabled = false;
  clearPencilBtn.disabled = false;
  const modeTapBtn = document.getElementById('mode-tap-btn');
  const modePaintBtn = document.getElementById('mode-paint-btn');
  if (modeTapBtn) modeTapBtn.disabled = false;
  if (modePaintBtn) modePaintBtn.disabled = false;

  context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  context.drawImage(image, 0, 0, previewCanvas.width, previewCanvas.height);
  // getImageData can throw a SecurityError on some iOS WKWebView builds.
  // Wrap so the image stays visible even if pixel manipulation fails.
  try {
    const raw = context.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
    closeOutlineGaps(raw);
    closeOutlineGaps(raw);
    context.putImageData(raw, 0, 0);
  } catch { /* leave drawImage result as-is */ }
  try {
    state.baseImageData = context.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
    state.paintedImageData = context.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
  } catch {
    state.baseImageData = null;
    state.paintedImageData = null;
  }
  state.regionMap = null;
  state.regionPixels = null;
  state.regionColorMap = null;
  state.numberRegions = null; // cached badge regions — recompute for the new image
  state.numberTargets = null; // cached free-mode completion targets — recompute too
  state.hasFreehand = false;  // fresh draw layer for the new image
  state.backgroundRegionId = 0;
  state.eraseMode = false;
  state.completedRegions = new Set();
  state.celebrationShown = false;
  state.completionRecorded = false; // new image → this coloring may be recorded once
  state.coloringStartTime = null;
  state.undoStack = [];
  state.isSegmenting = false; // worker path sets this; reset on new image
  // Segmentation is now triggered asynchronously from renderGeneratedImage() after
  // drawBaseImage() returns, so the image appears immediately with no main-thread hang.
}

export async function renderGeneratedImage(imageBase64) {
  resetZoom(); // B3: reset pan/zoom state on each new image
  // Show zoom controls after first image loads
  const zoomControls = document.getElementById('zoom-controls');
  if (zoomControls) zoomControls.hidden = false;
  let image;
  if (imageBase64.startsWith("data:")) {
    image = await new Promise((resolve, reject) => {
      const dataImage = new Image();
      dataImage.onload = () => resolve(dataImage);
      dataImage.onerror = () => reject(new Error("Failed to decode generated image."));
      dataImage.src = imageBase64;
    });
  } else if (imageBase64.startsWith("blob:")) {
    // Load blob URLs directly — re-fetching blob: URLs with CORS mode fails on Android WebView
    image = await new Promise((resolve, reject) => {
      const blobImage = new Image();
      blobImage.onload = () => resolve(blobImage);
      blobImage.onerror = () => reject(new Error("Failed to decode generated image."));
      blobImage.src = imageBase64;
    });
  } else if (imageBase64.startsWith("http")) {
    image = await imageFromUrl(imageBase64);
  } else {
    image = await imageFromBase64(imageBase64);
  }
  state.currentImage = imageBase64;
  drawBaseImage(image);  // synchronous: draws image + resets all segmentation state
  redrawCanvas();        // show image immediately (no numbers yet — regionMap is null)

  printButton.disabled = false;
  downloadButton.disabled = false;
  const shareButton = document.getElementById('share-button');
  if (shareButton) shareButton.disabled = false;
  const shareArtworkBtn = document.getElementById('share-artwork-btn');
  if (shareArtworkBtn) shareArtworkBtn.disabled = false;
  // Reset free mode on new generation, then enable canvas controls
  state.isFreeMode = false;
  const canvasNums = document.getElementById('canvas-numbers-btn');
  if (canvasNums) {
    canvasNums.disabled = false;
    const numsOn = showNumbersInput.checked;
    canvasNums.classList.toggle('action-btn--on', numsOn);
    canvasNums.textContent = numsOn ? t('numbersBtn') : t('numbersBtnOff');
  }
  const goFree = document.getElementById('go-free-btn');
  if (goFree) { goFree.disabled = false; goFree.classList.remove('action-btn--active'); goFree.textContent = t('goFreeBtn'); }

  // ── Async segmentation ─────────────────────────────────────────────────────
  // Start segmentation in the background worker AFTER the image is shown so the
  // user never waits on the main thread. Increment the generation counter so stale
  // results from a superseded render (e.g. difficulty change mid-flight) are
  // discarded and never overwrite the current image's segmentation state.
  if (!state.baseImageData) return;
  _segGeneration++;
  const gen = _segGeneration;
  state.isSegmenting = true;

  const { width, height } = previewCanvas;
  const pixelBuffer = state.baseImageData.data.buffer;

  _postToWorker(pixelBuffer, width, height, gen)
    .then(result => {
      if (gen !== _segGeneration) return; // superseded — discard
      _applyWorkerResult(result);
    })
    .catch(() => {
      // Fallback: synchronous segmentation (blocks briefly but works everywhere)
      if (gen !== _segGeneration) return;
      try { precomputeRegions(); } catch { /* ignore */ }
    })
    .finally(() => {
      if (gen !== _segGeneration) return;
      state.isSegmenting = false;
      redrawCanvas(); // now regionMap is set → overlayNumbers() shows badges
    });
}
