// fill-core.js — pure, DOM-free flat fill for the colour-by-number canvas.
// Extracted from canvas.js so the pixel logic is unit-tested in Node against
// synthetic fixtures (scripts/test-fill-core.mjs).
//
// WATERSHED MODEL: precomputeRegions() assigns EVERY non-line pixel to a region
// (the outline band is flooded to its nearest region) and keeps the thin line
// pixels OUT of regionPixels. So a fill is simply: paint all of the region's
// pixels a single solid colour. Adjacent regions meet exactly at the (untouched)
// black line — no white seam — and there is no band to "bleed" into, which is why
// the old morphological-bleed + enclosed-gap-reclaim heuristics (and their whole
// class of seam / fake-divider / uncolourable-pocket bugs) are gone.

// Watershed: mutate `label` so every outline-band pixel (value -1) takes the id
// of its NEAREST region (multi-source BFS from all label>0 pixels). After this
// the label map tiles the whole image — no unowned band — so adjacent fills meet
// at the line and every tap resolves to a region. Pure + unit-tested.
export function watershedAssign(label, width, height) {
  const n = width * height;
  const q = new Int32Array(n);
  let h = 0, t = 0;
  for (let i = 0; i < n; i++) if (label[i] > 0) q[t++] = i;
  while (h < t) {
    const i = q[h++];
    const id = label[i];
    const x = i % width;
    if (x > 0          && label[i - 1]     === -1) { label[i - 1]     = id; q[t++] = i - 1; }
    if (x < width - 1  && label[i + 1]     === -1) { label[i + 1]     = id; q[t++] = i + 1; }
    if (i - width >= 0 && label[i - width] === -1) { label[i - width] = id; q[t++] = i - width; }
    if (i + width < n  && label[i + width] === -1) { label[i + width] = id; q[t++] = i + width; }
  }
}

// Build the regionId → pixel-index[] map from a finished (watershedded) label
// array, EXCLUDING line pixels so a fill never paints over the line art.
export function buildRegionPixels(label, lineMask, regionIds, width, height) {
  const rp = new Map();
  for (const id of regionIds) rp.set(id, []);
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const id = label[i];
    if (id > 0 && !lineMask[i]) { const arr = rp.get(id); if (arr) arr.push(i); }
  }
  return rp;
}

// Mutates `paint` in place; returns { undoEntries } as a flat
// [idx, prevR, prevG, prevB, prevA, ...] array for the caller to pack for undo.
export function fillRegionCore(opts) {
  const { paint, regionPixels, regionId, fillColor } = opts;

  const undoEntries = [];
  const pixels = regionPixels.get(regionId);
  if (!pixels) return { undoEntries };

  const { r, g, b } = fillColor;
  for (const idx of pixels) {
    const o = idx * 4;
    undoEntries.push(idx, paint[o], paint[o + 1], paint[o + 2], paint[o + 3]);
    paint[o] = r; paint[o + 1] = g; paint[o + 2] = b; paint[o + 3] = 255;
  }
  return { undoEntries };
}
