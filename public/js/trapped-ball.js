// trapped-ball.js — multi-radius TRAPPED-BALL segmentation for line-art region
// detection. Pure, DOM-free; the web twin of flutter_app/lib/features/canvas/
// trapped_ball.dart (kept in parity). Unit-tested in Node via
// scripts/test-trapped-ball.mjs.
//
// This replaces the single fixed-radius morphological *close* the web detector
// used before (precomputeRegions' dilate-N/erode-N). That approach has a
// structural flaw behind the recurring "colours not clean" reports: ONE radius
// cannot be both large enough to seal big gaps in the line art (or the fill
// leaks into the neighbour → "colours mixing") AND small enough to keep thin
// regions open (or they get sealed shut → "can't colour this area"). Re-tuning
// that single radius only ever traded one symptom for the other.
//
// Trapped-ball (standard in anime/manga colourisation, e.g. hepesu/LineFiller
// and the 2024 ACM paper "Fast Leak-Resistant Segmentation for Anime Line Art")
// rolls balls of DECREASING radius: a LARGE ball fills big areas but is trapped
// — it can't pass a gap narrower than its diameter, so big regions never leak;
// progressively SMALLER balls then fill the narrow regions the big ball could
// not enter. Because each region uses the largest ball that still fits, big gaps
// are sealed AND thin regions stay fillable — both symptoms fixed at once.
//
// Implementation: a "ball of radius r" erosion is a Chebyshev (square) distance
// threshold `dist > r`. Per radius we distance-transform the still-unfilled free
// area, take its eroded cores (dist > r), label each core's connected component,
// then grow those cores back out by up to r layers (multi-source BFS, first-come)
// — restoring region size but stopping at the severed necks/gaps.
//
// Input : outlineMask (Uint8Array, 1 = wall/line, 0 = free), width, height.
// Output: Int32Array labels — -2 = wall/line (unassigned), 0.. = region ids.

export function trappedBallSegment(outlineMask, width, height, radii) {
  const w = width, h = height, n = w * h;
  const label = new Int32Array(n);
  for (let i = 0; i < n; i++) label[i] = outlineMask[i] === 1 ? -2 : -1; // -2 wall, -1 free
  const work = new Uint8Array(n); // 1 = free AND still unassigned
  for (let i = 0; i < n; i++) work[i] = label[i] === -1 ? 1 : 0;

  const rads = radii || ballRadiiFor(w, h);
  const dist = new Int32Array(n);
  const q = new Int32Array(n);
  const layer = new Int32Array(n);
  let nextId = 0;

  // Cores are labelled 8-CONNECTED. In a diagonal corridor whose width is
  // close to the ball size, the eroded core is a diagonal staircase whose
  // pixels touch only at corners; 4-connectivity cut every stair step into its
  // own region, so one visually-enclosed stripe became a stack of separately
  // fillable bands (taps stopped mid-area with no line there — 2026-10-09
  // train cow-catcher report). Diagonal joining is safe here: every core pixel
  // is > r (>= 1) away from any wall, so a diagonal step between two core
  // pixels can never cross a line.
  function labelCore(s, r) {
    let head = 0, tail = 0;
    q[tail++] = s;
    label[s] = nextId;
    while (head < tail) {
      const i = q[head++];
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const nb = ny * w + nx;
          if (work[nb] === 1 && label[nb] === -1 && dist[nb] > r) { label[nb] = nextId; q[tail++] = nb; }
        }
      }
    }
    nextId++;
  }

  // Grow every labelled core back into the still-unfilled free area by up to r
  // layers. Multi-source BFS seeded from all labelled pixels touching an
  // unassigned free pixel; first label to arrive wins, so two cores split at a
  // gap meet at a midline boundary rather than re-merging.
  function boundedGrow(r) {
    let head = 0, tail = 0;
    for (let i = 0; i < n; i++) {
      if (label[i] < 0) continue;
      const x = i % w;
      let adj = false;
      if (x > 0 && label[i - 1] === -1 && work[i - 1] === 1) adj = true;
      else if (x < w - 1 && label[i + 1] === -1 && work[i + 1] === 1) adj = true;
      else if (i - w >= 0 && label[i - w] === -1 && work[i - w] === 1) adj = true;
      else if (i + w < n && label[i + w] === -1 && work[i + w] === 1) adj = true;
      if (adj) { q[tail++] = i; layer[i] = 0; }
    }
    while (head < tail) {
      const i = q[head++];
      const d = layer[i];
      if (d >= r) continue;
      const id = label[i];
      const x = i % w;
      if (x > 0)      { const nb = i - 1; if (label[nb] === -1 && work[nb] === 1) { label[nb] = id; layer[nb] = d + 1; q[tail++] = nb; } }
      if (x < w - 1)  { const nb = i + 1; if (label[nb] === -1 && work[nb] === 1) { label[nb] = id; layer[nb] = d + 1; q[tail++] = nb; } }
      if (i - w >= 0) { const nb = i - w; if (label[nb] === -1 && work[nb] === 1) { label[nb] = id; layer[nb] = d + 1; q[tail++] = nb; } }
      if (i + w < n)  { const nb = i + w; if (label[nb] === -1 && work[nb] === 1) { label[nb] = id; layer[nb] = d + 1; q[tail++] = nb; } }
    }
  }

  for (const r of rads) {
    if (r <= 0) continue;
    chebyshevDistance(work, w, h, dist);
    for (let s = 0; s < n; s++) {
      if (work[s] === 1 && label[s] === -1 && dist[s] > r) labelCore(s, r);
    }
    boundedGrow(r);
    for (let i = 0; i < n; i++) if (label[i] >= 0) work[i] = 0;
  }

  // Absorb leftover thin rim pixels (<=2px strips the smallest ball couldn't
  // seed) into the NEAREST EXISTING region via an unlimited multi-source BFS —
  // instead of spawning a brand-new region per strip. Spawning rim regions
  // over-segments the background into slivers, making "which region is the
  // background" ambiguous downstream. A genuine thin region >=3px wide already
  // got its own core at r=1, so it is preserved here.
  {
    let head = 0, tail = 0;
    for (let i = 0; i < n; i++) if (label[i] >= 0) q[tail++] = i;
    while (head < tail) {
      const i = q[head++];
      const id = label[i];
      const x = i % w;
      if (x > 0)      { const nb = i - 1; if (label[nb] === -1) { label[nb] = id; q[tail++] = nb; } }
      if (x < w - 1)  { const nb = i + 1; if (label[nb] === -1) { label[nb] = id; q[tail++] = nb; } }
      if (i - w >= 0) { const nb = i - w; if (label[nb] === -1) { label[nb] = id; q[tail++] = nb; } }
      if (i + w < n)  { const nb = i + w; if (label[nb] === -1) { label[nb] = id; q[tail++] = nb; } }
    }
  }

  // Fallback: if no region was ever seeded (e.g. an all-thin image), flood-fill
  // remaining free pixels into fresh regions so nothing is left unassigned.
  for (let s = 0; s < n; s++) {
    if (label[s] !== -1) continue;
    let head = 0, tail = 0;
    q[tail++] = s;
    label[s] = nextId;
    while (head < tail) {
      const i = q[head++];
      const x = i % w;
      if (x > 0)      { const nb = i - 1; if (label[nb] === -1) { label[nb] = nextId; q[tail++] = nb; } }
      if (x < w - 1)  { const nb = i + 1; if (label[nb] === -1) { label[nb] = nextId; q[tail++] = nb; } }
      if (i - w >= 0) { const nb = i - w; if (label[nb] === -1) { label[nb] = nextId; q[tail++] = nb; } }
      if (i + w < n)  { const nb = i + w; if (label[nb] === -1) { label[nb] = nextId; q[tail++] = nb; } }
    }
    nextId++;
  }

  mergeCorridorSplits(label, outlineMask, w, h, dist);
  return label;
}

// Re-join regions that trapped-ball split where a white corridor merely
// NARROWS between two continuous lines (no line ends there). A ball of radius
// r cannot pass a neck narrower than 2r+1, so every narrowing of a stripe, rail
// or spoke became a separate region — taps then stopped mid-area at an
// invisible edge (2026-10-09 train report: 600 of 639 touching pairs in that
// image were such splits). Rule: two touching regions (no wall between them)
// are merged when their shared border is at least half as wide as the
// smaller region's widest point — nothing visually separates them then. A real leak
// through a broken line is a narrow opening relative to the regions it joins,
// so it stays split. The background (outer white space) is never merged, so an
// open outline can't flood into it.
// A corridor may pinch to about half its widest width between continuous
// lines and still read as one area; a leak through a broken line is a much
// narrower opening. Measured on the 2026-10-09 train image: 633 of 639
// touching pairs had border/width >= 0.5, all of them corridor splits.
const CORRIDOR_MERGE_RATIO = 0.5;

export function mergeCorridorSplits(label, outlineMask, w, h, distBuf) {
  const n = w * h;
  const free = new Uint8Array(n);
  for (let i = 0; i < n; i++) free[i] = outlineMask[i] === 1 ? 0 : 1;
  const dist = distBuf && distBuf.length === n ? distBuf : new Int32Array(n);
  chebyshevDistance(free, w, h, dist);

  let maxId = -1;
  for (let i = 0; i < n; i++) if (label[i] > maxId) maxId = label[i];
  if (maxId < 1) return;
  const maxD = new Int32Array(maxId + 1);
  for (let i = 0; i < n; i++) { const s = label[i]; if (s >= 0 && dist[i] > maxD[s]) maxD[s] = dist[i]; }

  let bg = -1;
  outer: for (let dy = 1; dy <= 4 && dy < h; dy++) for (let dx = 1; dx <= 4 && dx < w; dx++) {
    const id = label[dy * w + dx]; if (id >= 0) { bg = id; break outer; }
  }

  // Contact = number of distinct pixels of the lower-id region that touch the
  // other region (4-neighbour) — one side only, so a diagonal border is not
  // double-counted.
  const contact = new Map();
  for (let i = 0; i < n; i++) {
    const a = label[i];
    if (a < 0) continue;
    const x = i % w;
    let b1 = -1, b2 = -1, b3 = -1; // distinct higher-id neighbours of this pixel
    for (let k = 0; k < 4; k++) {
      const nb = k === 0 ? (x > 0 ? i - 1 : -1) : k === 1 ? (x < w - 1 ? i + 1 : -1) : k === 2 ? i - w : i + w;
      if (nb < 0 || nb >= n) continue;
      const b = label[nb];
      if (b <= a || b === b1 || b === b2 || b === b3) continue;
      if (b1 < 0) b1 = b; else if (b2 < 0) b2 = b; else b3 = b;
      const key = a * (maxId + 1) + b;
      contact.set(key, (contact.get(key) || 0) + 1);
    }
  }

  const parent = new Int32Array(maxId + 1);
  for (let i = 0; i <= maxId; i++) parent[i] = i;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  let merged = false;
  for (const [key, c] of contact) {
    const a = Math.floor(key / (maxId + 1)), b = key % (maxId + 1);
    if (a === bg || b === bg) continue;
    const diam = 2 * Math.min(maxD[a], maxD[b]);
    if (c >= CORRIDOR_MERGE_RATIO * diam) { const ra = find(a), rb = find(b); if (ra !== rb) { parent[ra] = rb; merged = true; } }
  }
  if (!merged) return;
  for (let i = 0; i < n; i++) if (label[i] >= 0) label[i] = find(label[i]);
}

// Descending ball radii for an image of size w×h. The largest seals the biggest
// expected gaps (scaled to image size); the run down to 1 keeps thin regions
// fillable. Clamped so tiny test images still get a sane sequence.
export function ballRadiiFor(w, h) {
  const short = w < h ? w : h;
  let maxR = (short / 200) | 0; // ~0.5% of the short side
  if (maxR < 2) maxR = 2;
  if (maxR > 7) maxR = 7;
  const rads = [];
  let r = maxR;
  while (r > 1) { rads.push(r); r = ((r * 2) / 3) | 0; }
  rads.push(1);
  const seen = new Set();
  return rads.filter((e) => { if (seen.has(e)) return false; seen.add(e); return true; });
}

// In-place Chebyshev (8-connected, unit-cost) distance transform of `src`:
// dist[i] = steps from pixel i to the nearest src==0 pixel (0 where src==0).
// Two-pass; O(w*h). Eroding `src` by a square ball of radius r is then `dist>r`.
export function chebyshevDistance(src, w, h, dist) {
  const n = w * h;
  const INF = 1 << 29;
  for (let i = 0; i < n; i++) dist[i] = src[i] === 0 ? 0 : INF;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      let m = dist[i];
      if (x > 0 && dist[i - 1] + 1 < m) m = dist[i - 1] + 1;
      if (y > 0 && dist[i - w] + 1 < m) m = dist[i - w] + 1;
      if (x > 0 && y > 0 && dist[i - w - 1] + 1 < m) m = dist[i - w - 1] + 1;
      if (x < w - 1 && y > 0 && dist[i - w + 1] + 1 < m) m = dist[i - w + 1] + 1;
      dist[i] = m;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let m = dist[i];
      if (x < w - 1 && dist[i + 1] + 1 < m) m = dist[i + 1] + 1;
      if (y < h - 1 && dist[i + w] + 1 < m) m = dist[i + w] + 1;
      if (x < w - 1 && y < h - 1 && dist[i + w + 1] + 1 < m) m = dist[i + w + 1] + 1;
      if (x > 0 && y < h - 1 && dist[i + w - 1] + 1 < m) m = dist[i + w - 1] + 1;
      dist[i] = m;
    }
  }
}
