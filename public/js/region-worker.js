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

  // 8. Watershed: flood every band pixel from its nearest region so the label map
  //    tiles the full image — adjacent fills meet exactly at the black line, no seam.
  watershedAssign(label, width, height);

  // 9. Final per-region pixel sets, excluding line pixels so fills never paint
  //    over the black line art.
  const regionPixels = buildRegionPixels(label, lineMask, [...validIds], width, height);

  // 10. Pack into transferable typed arrays (zero-copy transfer back to main thread)
  const regionIds = [...regionPixels.keys()];
  const regionPixelBuffers = regionIds.map(id => new Int32Array(regionPixels.get(id)).buffer);

  self.postMessage(
    { regionMap: label.buffer, lineMask: lineMask.buffer, backgroundRegionId, regionIds, regionPixelBuffers, gen },
    [label.buffer, lineMask.buffer, ...regionPixelBuffers],
  );
};
