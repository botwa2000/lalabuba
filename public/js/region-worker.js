// region-worker.js — ES-module Web Worker: all per-image segmentation off the main thread.
//
// WHY: precomputeRegions() blocks the main thread for 200ms–10s depending on image
// complexity (Zhang-Suen thinning inside bridgeLineGaps is the bottleneck for dense
// hard/extreme line art). Moving it here frees the UI thread so the image appears
// instantly and coloring enables ~100-500ms later without any hang.
//
// PROTOCOL:
//   IN  → { pixels: ArrayBuffer (RGBA Uint8Clamped), width, height, gen }
//   OUT → { regionMap: ArrayBuffer (Int32), lineMask: ArrayBuffer (Uint8),
//            backgroundRegionId, regionIds, regionPixelBuffers, gen }
//   All ArrayBuffers are transferred (zero-copy).

import { buildOutlineMask }    from './outline-mask.js?v=214';
import { bridgeLineGaps }      from './line-bridge.js?v=214';
import { trappedBallSegment }  from './trapped-ball.js?v=214';
import { watershedAssign, buildRegionPixels } from './fill-core.js?v=214';

self.onmessage = ({ data }) => {
  const { pixels, width, height, gen } = data;
  const n = width * height;
  const src = new Uint8ClampedArray(pixels);   // pixels is a transferred ArrayBuffer

  // 1. Adaptive hysteresis outline mask: seals anti-aliased pin-gaps in line art
  let outlineMask = buildOutlineMask(src, width, height);

  // 2. Snapshot thin line pixels BEFORE bridge/frame modifications; these stay as
  //    visible ink and are EXCLUDED from the painted pixel sets.
  const lineMask = Uint8Array.from(outlineMask);

  // 3. Bridge genuine line breaks (invisible walls only — no visible ink added).
  //    The facing test keeps parallel groove-tips apart so this never over-seals.
  bridgeLineGaps(outlineMask, width, height);

  // 4. Virtual sealed frame: the outermost pixel row/col becomes a barrier so any
  //    region open at the image edge (sky, lake, ground) becomes enclosed + fillable.
  for (let x = 0; x < width;  x++) { outlineMask[x] = 1; outlineMask[(height-1)*width+x] = 1; }
  for (let y = 0; y < height; y++) { outlineMask[y*width] = 1; outlineMask[y*width+width-1] = 1; }

  // 5. Trapped-ball segmentation: decreasing ball radii seal big gaps without
  //    crushing thin regions — large regions use a large ball, narrow corridors get
  //    smaller ones. Each region is the largest ball that still fits inside it.
  const seg = trappedBallSegment(outlineMask, width, height);

  // 6. Convert to web convention (>0 = region, -1 = wall/band); demote tiny blobs
  //    (<30 px) to band so stray slivers never become tap targets.
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
  const validIds = new Set();
  for (const [id, buf] of segBuf) {
    if (buf.length >= 30) validIds.add(id);
  }
  // Dense/Extreme images can produce zero regions above 30px (every pixel is a
  // line dot so all trapped-ball seeds are tiny). Rescue the largest regions
  // down to 5px so the image stays colorable rather than going completely dark.
  if (validIds.size === 0 && segBuf.size > 0) {
    const sorted = [...segBuf.entries()].sort((a, b) => b[1].length - a[1].length);
    const floor = Math.max(1, Math.min(5, sorted[0][1].length));
    for (const [id, buf] of sorted) {
      if (buf.length >= floor) validIds.add(id);
    }
  }
  for (const [id, buf] of segBuf) {
    if (!validIds.has(id)) for (const p of buf) label[p] = -1;
  }

  // 7. Background region: nearest to the top-left inner corner (outer white space).
  //    Falls back to the largest region if the corner is dark.
  let backgroundRegionId = 0;
  outerLoop:
  for (let dy = 1; dy <= 4; dy++) {
    for (let dx = 1; dx <= 4; dx++) {
      const id = label[dy * width + dx];
      if (id > 0) { backgroundRegionId = id; break outerLoop; }
    }
  }
  if (!backgroundRegionId) {
    let maxSz = 0;
    for (const [id, buf] of segBuf) {
      if (validIds.has(id) && buf.length > maxSz) { maxSz = buf.length; backgroundRegionId = id; }
    }
  }

  // 8. Thin-wall merge: collapse regions that are separated only by thin internal
  //    lines (striation marks, detail lines ≤ 10 px wide) into one region so that
  //    each visually-enclosed area gets exactly one number badge and one fill tap
  //    covers it completely. Thick boundary outlines (> 10 px) are never bridged.
  //    Runs on the pre-watershed label where wall pixels are still -1.
  {
    // Centroid for each valid region from its trapped-ball pixel set.
    const centroids = new Map();
    for (const [id, pixels] of segBuf) {
      if (!validIds.has(id) || pixels.length === 0) continue;
      let sx = 0, sy = 0;
      for (const pi of pixels) { sx += pi % width; sy += (pi / width) | 0; }
      centroids.set(id, { x: Math.round(sx / pixels.length), y: Math.round(sy / pixels.length) });
    }

    // Find all wall-adjacent valid region pairs (valid regions on both sides of a -1 pixel).
    const adjPairs = new Set();
    for (let i = 0; i < n; i++) {
      if (label[i] !== -1) continue;
      const x = i % width, y = (i / width) | 0;
      const nbrs = [];
      if (x > 0        && label[i - 1]     > 0 && validIds.has(label[i - 1]))     nbrs.push(label[i - 1]);
      if (x < width-1  && label[i + 1]     > 0 && validIds.has(label[i + 1]))     nbrs.push(label[i + 1]);
      if (y > 0        && label[i - width]  > 0 && validIds.has(label[i - width])) nbrs.push(label[i - width]);
      if (y < height-1 && label[i + width]  > 0 && validIds.has(label[i + width])) nbrs.push(label[i + width]);
      for (let a = 0; a < nbrs.length - 1; a++) {
        for (let b = a + 1; b < nbrs.length; b++) {
          if (nbrs[a] === nbrs[b]) continue;
          const lo = Math.min(nbrs[a], nbrs[b]), hi = Math.max(nbrs[a], nbrs[b]);
          adjPairs.add(`${lo}:${hi}`);
        }
      }
    }

    // Union-Find.
    const ufP = new Map();
    for (const id of validIds) ufP.set(id, id);
    const ufFind = (x) => {
      while (ufP.get(x) !== x) {
        const pp = ufP.get(ufP.get(x));
        if (pp !== undefined) ufP.set(x, pp);
        x = ufP.get(x);
      }
      return x;
    };
    const ufUnion = (a, b) => { a = ufFind(a); b = ufFind(b); if (a !== b) ufP.set(a, b); };

    // For each adjacent pair walk a Bresenham line between centroids; count wall
    // pixels crossed. ≤ THIN_WALL_PX → thin internal line → merge into one region.
    const THIN_WALL_PX = 10;
    for (const pair of adjPairs) {
      const ci = pair.indexOf(':');
      const a = Number(pair.slice(0, ci)), b = Number(pair.slice(ci + 1));
      // Never merge the background region into a foreground region.
      if (a === backgroundRegionId || b === backgroundRegionId) continue;
      const cA = centroids.get(a), cB = centroids.get(b);
      if (!cA || !cB) continue;
      const dx = cB.x - cA.x, dy = cB.y - cA.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      if (steps === 0) { ufUnion(a, b); continue; }
      let wallPx = 0;
      for (let t = 0; t <= steps; t++) {
        const px = Math.round(cA.x + dx * t / steps);
        const py = Math.round(cA.y + dy * t / steps);
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        if (label[py * width + px] === -1) wallPx++;
      }
      if (wallPx <= THIN_WALL_PX) ufUnion(a, b);
    }

    // Apply merges if any happened.
    let hasMerge = false;
    for (const id of validIds) if (ufFind(id) !== id) { hasMerge = true; break; }
    if (hasMerge) {
      for (let i = 0; i < n; i++) {
        const id = label[i];
        if (id > 0 && validIds.has(id)) label[i] = ufFind(id);
      }
      const newV = new Set();
      for (const id of validIds) newV.add(ufFind(id));
      validIds.clear();
      for (const id of newV) validIds.add(id);
      backgroundRegionId = ufFind(backgroundRegionId) || backgroundRegionId;
    }
  }

  // 9. Watershed: flood every band pixel from its nearest region so the label map
  //    tiles the full image — adjacent fills meet exactly at the black line, no seam.
  watershedAssign(label, width, height);

  // 10. Final per-region pixel sets, excluding line pixels so fills never paint
  //    over the black line art.
  const regionPixels = buildRegionPixels(label, lineMask, [...validIds], width, height);

  // 11. Pack into transferable typed arrays (zero-copy transfer back to main thread)
  const regionIds = [...regionPixels.keys()];
  const regionPixelBuffers = regionIds.map(id => new Int32Array(regionPixels.get(id)).buffer);

  self.postMessage(
    { regionMap: label.buffer, lineMask: lineMask.buffer, backgroundRegionId, regionIds, regionPixelBuffers, gen },
    [label.buffer, lineMask.buffer, ...regionPixelBuffers],
  );
};
