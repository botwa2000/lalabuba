import { state } from './state.js';
import { DIFFICULTY } from './data.js';
import {
  previewCanvas, drawCanvas, context, drawCtx,
  previewStage, showNumbersInput, printButton, downloadButton, pencilBtn, clearPencilBtn,
} from './dom.js';

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
  if (!state.baseImageData) return;
  // Always use base image data so numbers are stable regardless of user fills.
  const mask = buildWalkableMask(state.baseImageData.data, previewCanvas.width, previewCanvas.height);
  const diff = DIFFICULTY[document.getElementById('difficulty-select').value] || DIFFICULTY.medium;
  // Scale minArea proportionally to image pixel count so region density is
  // consistent across canvas sizes (same difficulty = same relative region count).
  const scaledMinArea = Math.round(diff.minArea * (previewCanvas.width * previewCanvas.height) / (1024 * 1024));
  const regions = findRegions(mask, previewCanvas.width, previewCanvas.height, scaledMinArea, colorCount);
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

// ─── Pre-segmentation ────────────────────────────────────────────────────────
// Runs once per image load. Builds a per-pixel region map so a click looks up
// and paints pre-identified pixels — fill can never leak across regions.
//
// Strategy:
//   outlineMask (br < 100) — CCA barrier; dark + anti-aliased edge pixels.
//   Virtual frame          — 1-px sealed border added to the label array so
//                            areas open at the image edge (lake, sky, ground)
//                            become enclosed regions instead of merging with
//                            the outer background via border-seeding.
//   Background detection   — largest CCA region (always the outer white space).

export function precomputeRegions() {
  const { width, height } = previewCanvas;
  const n = width * height;
  const src = state.baseImageData.data;
  const difficulty = document.getElementById('difficulty-select')?.value || 'medium';
  const isHardPlus = difficulty === 'hard' || difficulty === 'extreme';

  // Barrier threshold: higher for hard/extreme to also catch anti-aliased gray
  // edges that bridge what should be separate regions in intricate patterns.
  const BARRIER_BR = isHardPlus ? 130 : 100;

  // Build outline mask: used as the CCA barrier.
  let outlineMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const br = (src[o] + src[o + 1] + src[o + 2]) / 3;
    outlineMask[i] = br < BARRIER_BR ? 1 : 0;
  }

  // Morphological close (dilate N then erode N) on outlineMask.
  // This bridges genuine gaps in outlines (shoreline junctions, thin breaks)
  // WITHOUT permanently thickening the barrier, so thin regions like ripple
  // rings or narrow foreground areas are not consumed.
  // Extreme/hard use a larger radius to seal the finer gaps in intricate patterns.
  const CLOSE_R = difficulty === 'extreme' ? 10 : isHardPlus ? 8 : 6;
  for (let pass = 0; pass < CLOSE_R; pass++) {
    const next = new Uint8Array(outlineMask);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (!outlineMask[i] && (outlineMask[i-1]||outlineMask[i+1]||outlineMask[i-width]||outlineMask[i+width]))
          next[i] = 1;
      }
    }
    outlineMask = next;
  }
  for (let pass = 0; pass < CLOSE_R; pass++) {
    const next = new Uint8Array(outlineMask);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (outlineMask[i] && (!outlineMask[i-1]||!outlineMask[i+1]||!outlineMask[i-width]||!outlineMask[i+width]))
          next[i] = 0;
      }
    }
    outlineMask = next;
  }

  // Build label array: -1 for all outline pixels.
  const label = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (outlineMask[i]) label[i] = -1;
  }

  // Virtual sealed frame: mark the outermost pixel row/col as barriers.
  // This closes any region that is "open" at the image boundary (e.g. a
  // lake with no bottom outline, a sky open at the top) so the CCA treats
  // it as an enclosed fillable region rather than outer background.
  for (let x = 0; x < width;  x++) { label[x] = -1; label[(height-1)*width+x] = -1; }
  for (let y = 0; y < height; y++) { label[y*width] = -1; label[y*width+width-1] = -1; }

  // Connected-component labelling for all unvisited (non-barrier) pixels.
  state.regionPixels = new Map();
  let nextId = 1;
  const queue = new Int32Array(n);
  let head = 0, tail = 0;

  for (let start = 0; start < n; start++) {
    if (label[start] !== 0) continue;

    label[start] = nextId;
    head = 0; tail = 0;
    queue[tail++] = start;
    const buf = [];

    while (head < tail) {
      const i = queue[head++];
      buf.push(i);
      const x = i % width, y = (i / width) | 0;
      if (x > 0         && label[i-1]     === 0) { label[i-1]=nextId;     queue[tail++]=i-1; }
      if (x < width - 1 && label[i+1]     === 0) { label[i+1]=nextId;     queue[tail++]=i+1; }
      if (y > 0         && label[i-width] === 0) { label[i-width]=nextId; queue[tail++]=i-width; }
      if (y < height - 1&& label[i+width] === 0) { label[i+width]=nextId; queue[tail++]=i+width; }
    }

    if (buf.length >= 30) {
      state.regionPixels.set(nextId, buf);
      nextId++;
    } else {
      for (const p of buf) label[p] = -1;  // tiny specks → treat as outline
    }
  }

  // Background = the region at the top-left inner corner (1,1) — almost
  // always the outer white space surrounding the drawing.  Fall back to the
  // largest region if the corner is dark (drawing fills the corner).
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

  state.regionMap = label;
}

// Paint every pixel in regionId with fillColor, then redraw.
// After filling the region, bleed 2 pixels outward into the anti-aliased
// edge zone (pixels that are gray but not truly black) so there is no white
// fringe between the fill colour and the black outline.
// Returns { success: true, record } where record is a Uint8Array encoding
// every touched pixel's previous RGBA so it can be undone.
export function fillRegion(regionId, fillColor) {
  const pixels = state.regionPixels.get(regionId);
  if (!pixels) return { success: false };

  const paint = state.paintedImageData.data;
  const base  = state.baseImageData.data;   // brightness source — unaffected by fills
  const { r, g, b } = fillColor;
  const { width, height } = previewCanvas;
  const n = width * height;

  // Track which pixels have been painted in this call to avoid double-work.
  const painted = new Uint8Array(n);
  // Record touched pixels for undo: [idx_lo, idx_hi, prevR, prevG, prevB, prevA, ...]
  // idx stored as two Uint16 bytes (little-endian) — max pixel index 1024*1024 = 1M < 2^20, fits in 3 bytes
  // Simpler: store as Float32 index + 4 bytes RGBA in a growing array, then compact.
  const undoEntries = []; // each entry: [pixelIndex, prevR, prevG, prevB, prevA]

  function paintPixel(idx) {
    if (painted[idx]) return;
    const o = idx * 4;
    undoEntries.push(idx, paint[o], paint[o+1], paint[o+2], paint[o+3]);
    paint[o] = r; paint[o+1] = g; paint[o+2] = b; paint[o+3] = 255;
    painted[idx] = 1;
  }

  for (const idx of pixels) paintPixel(idx);

  // 2-pass dilation into adjacent non-black pixels.
  const MIN_BR = 50;
  let frontier = pixels;
  for (let pass = 0; pass < 2; pass++) {
    const next = [];
    for (const idx of frontier) {
      const x = idx % width, y = (idx / width) | 0;
      const tryBleed = (ni) => {
        if (painted[ni]) return;
        const o = ni*4; const br=(base[o]+base[o+1]+base[o+2])/3;
        if (br > MIN_BR) { paintPixel(ni); next.push(ni); }
      };
      if (x > 0)          tryBleed(idx - 1);
      if (x < width - 1)  tryBleed(idx + 1);
      if (y > 0)          tryBleed(idx - width);
      if (y < height - 1) tryBleed(idx + width);
    }
    frontier = next;
  }

  // Orphan fill: flood through bright label=-1 pockets that are enclosed within
  // this region. These are tiny connected components (< 30 px) that were merged into
  // the barrier map during precomputeRegions and appear as white specks inside a
  // filled area. Stops at true black pixels (br <= MIN_BR) and at pixels that belong
  // to a different positive-label region, so the flood cannot cross outlines into the
  // outer background or adjacent colourable regions.
  if (state.regionMap) {
    const absorbable = (ni) => {
      const lbl = state.regionMap[ni];
      if (lbl < 1) return true;
      const rpx = state.regionPixels?.get(lbl);
      return rpx && rpx.length < 500 && !state.regionColorMap?.has(lbl);
    };
    const tryOrphan = (ni) => {
      if (painted[ni] || !absorbable(ni)) return null;
      const o = ni*4;
      if ((base[o]+base[o+1]+base[o+2])/3 > MIN_BR) { paintPixel(ni); return ni; }
      return null;
    };
    const orphanQ = [];
    for (const list of [pixels, frontier]) for (const idx of list) {
      const x = idx % width, y = (idx / width) | 0;
      if (x > 0)          { const ni=tryOrphan(idx-1);     if(ni!=null) orphanQ.push(ni); }
      if (x < width - 1)  { const ni=tryOrphan(idx+1);     if(ni!=null) orphanQ.push(ni); }
      if (y > 0)          { const ni=tryOrphan(idx-width);  if(ni!=null) orphanQ.push(ni); }
      if (y < height - 1) { const ni=tryOrphan(idx+width);  if(ni!=null) orphanQ.push(ni); }
    }
    let qi = 0;
    while (qi < orphanQ.length) {
      const idx = orphanQ[qi++];
      const x = idx % width, y = (idx / width) | 0;
      if (x > 0)          { const ni=tryOrphan(idx-1);     if(ni!=null) orphanQ.push(ni); }
      if (x < width - 1)  { const ni=tryOrphan(idx+1);     if(ni!=null) orphanQ.push(ni); }
      if (y > 0)          { const ni=tryOrphan(idx-width);  if(ni!=null) orphanQ.push(ni); }
      if (y < height - 1) { const ni=tryOrphan(idx+width);  if(ni!=null) orphanQ.push(ni); }
    }
  }

  redrawCanvas();
  // Pack undo record: [pixelIndex(4B LE), r, g, b, a] per touched pixel
  const record = new Uint8Array(undoEntries.length);
  for (let i = 0; i < undoEntries.length; i++) record[i] = undoEntries[i] & 0xff;
  // Store pixel indices as 4-byte groups (entries are [idx, r, g, b, a] groups of 5)
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
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image data."));
    reader.readAsDataURL(blob);
  });
}

export function drawBaseImage(image) {
  previewCanvas.width  = image.naturalWidth  || image.width  || 1024;
  previewCanvas.height = image.naturalHeight || image.height || 1024;
  previewCanvas.hidden = false;
  previewStage.classList.remove("empty");

  // Reset draw canvas to match new image dimensions and clear pencil strokes.
  drawCanvas.width  = previewCanvas.width;
  drawCanvas.height = previewCanvas.height;
  drawCanvas.hidden = false;
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

  // Exit pencil mode on new image.
  state.pencilMode = false;
  pencilBtn.classList.remove('active');
  drawCanvas.classList.remove('pencil-active');
  previewCanvas.style.pointerEvents = '';

  pencilBtn.disabled = false;
  clearPencilBtn.disabled = false;

  context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  context.drawImage(image, 0, 0, previewCanvas.width, previewCanvas.height);
  const raw = context.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
  closeOutlineGaps(raw);
  closeOutlineGaps(raw);
  context.putImageData(raw, 0, 0);
  state.baseImageData = context.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
  state.paintedImageData = context.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
  state.regionMap = null;
  state.regionPixels = null;
  state.regionColorMap = null;
  state.backgroundRegionId = 0;
  state.eraseMode = false;
  state.completedRegions = new Set();
  state.celebrationShown = false;
  state.coloringStartTime = null;
  precomputeRegions();
}

export async function renderGeneratedImage(imageBase64) {
  const image = imageBase64.startsWith("data:")
    ? await new Promise((resolve, reject) => {
        const dataImage = new Image();
        dataImage.onload = () => resolve(dataImage);
        dataImage.onerror = () => reject(new Error("Failed to decode generated image."));
        dataImage.src = imageBase64;
      })
    : imageBase64.startsWith("http") || imageBase64.startsWith("blob:")
      ? await imageFromUrl(imageBase64)
      : await imageFromBase64(imageBase64);
  state.currentImage = imageBase64;
  drawBaseImage(image);
  redrawCanvas();

  printButton.disabled = false;
  downloadButton.disabled = false;
  const shareButton = document.getElementById('share-button');
  if (shareButton) shareButton.disabled = false;
  const shareArtworkBtn = document.getElementById('share-artwork-btn');
  if (shareArtworkBtn) shareArtworkBtn.disabled = false;
}
