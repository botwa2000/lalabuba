// outline-mask.js — build the WALL/outline mask from an RGBA image for the
// colour-by-number segmenter. Pure, DOM-free; the web twin of Flutter's
// buildOutlineMask (flood_fill.dart). Unit-tested via scripts/test-outline-mask.mjs.
//
// A pixel is a wall if it is globally dark OR locally darker than its
// surroundings (an interior line). A single global threshold misses the faint
// grey interior lines AI line art draws; a raised global threshold instead
// turns flat mid-grey SHADING into all-wall. The local (adaptive) test catches
// the visible lines, but a line's faint ANTI-ALIASED pixels still slip through
// in spots, leaving 1-px pin-gaps a fill bleeds through (the "colours bleeding
// across areas" reports — e.g. red leaking between a whale's throat grooves /
// tail flukes, where the gap is as wide as the thin groove so trapped-ball
// can't seal it without eating the groove).
//
// HYSTERESIS fixes that at the source: classify each pixel strong (2) / weak (1)
// / free (0), then promote a weak pixel to wall ONLY if it is 8-connected to a
// strong line. The faint gap pixels inside a thin line are weakly dark AND
// adjacent to the strong line, so they seal; an isolated weak speck in a shaded
// region has no strong line to join, so flat shading stays colourable.
//
// Input : src = RGBA Uint8ClampedArray (w*h*4), width, height.
// Output: Uint8Array, 1 = wall/line, 0 = free.
export function buildOutlineMask(src, w, h) {
  const n = w * h;
  const bright = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    bright[i] = ((src[o] + src[o + 1] + src[o + 2]) / 3) | 0;
  }
  // Summed-area table for O(1) box-mean queries. Padded (w+1)×(h+1).
  const sw = w + 1;
  const sat = new Float64Array(sw * (h + 1)); // 255*1024*1024 fits exactly in f64
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += bright[y * w + x];
      sat[(y + 1) * sw + (x + 1)] = sat[y * sw + (x + 1)] + rowSum;
    }
  }
  const radRaw = ((w < h ? w : h) / 64) | 0;
  const radius = radRaw < 4 ? 4 : (radRaw > 24 ? 24 : radRaw);
  const localMargin = 22;   // strong: this much darker than local mean → definite line
  const adaptiveCeil = 150; // strong local test ignores pixels at/above this
  const weakMargin = 8;     // weak: even this little darker than local mean is a candidate
  const weakCeil = 205;     // weak test ignores near-white pixels

  // Classify: 2 = strong wall, 1 = weak candidate, 0 = free.
  const cls = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = y - radius < 0 ? 0 : y - radius;
    const y1 = y + radius >= h ? h - 1 : y + radius;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const br = bright[i];
      if (br < 100) { cls[i] = 2; continue; }       // globally dark → definite line
      if (br >= weakCeil) { cls[i] = 0; continue; } // near-white → never a line
      const x0 = x - radius < 0 ? 0 : x - radius;
      const x1 = x + radius >= w ? w - 1 : x + radius;
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = sat[(y1 + 1) * sw + (x1 + 1)] -
          sat[y0 * sw + (x1 + 1)] -
          sat[(y1 + 1) * sw + x0] +
          sat[y0 * sw + x0];
      const mean = (sum / area) | 0;
      if (br < adaptiveCeil && br <= mean - localMargin) cls[i] = 2; // strong
      else if (br <= mean - weakMargin) cls[i] = 1;                  // weak
      else cls[i] = 0;
    }
  }

  // Hysteresis flood: strong pixels are walls + BFS seeds; weak pixels promote
  // when reached through 8-connectivity.
  const outlineMask = new Uint8Array(n);
  const q = new Int32Array(n);
  let head = 0, tail = 0;
  for (let i = 0; i < n; i++) {
    if (cls[i] === 2) { outlineMask[i] = 1; q[tail++] = i; }
  }
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
        if (cls[nb] === 1 && outlineMask[nb] === 0) {
          outlineMask[nb] = 1;
          q[tail++] = nb;
        }
      }
    }
  }
  return outlineMask;
}
