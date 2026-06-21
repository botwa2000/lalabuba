// Unit tests for public/js/fill-core.js — the pure WATERSHED colour-by-number
// engine. Builds synthetic label/line fixtures (no browser) and asserts the
// watershed tiling, line exclusion, flat fill, no-seam and undo behaviours.
// Run: node scripts/test-fill-core.mjs
import { fillRegionCore, watershedAssign, buildRegionPixels } from '../public/js/fill-core.js';

let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  ok   ${name}`); }
  else { console.log(`  FAIL ${name}`); failures++; }
}

// Build a scene from an ASCII grid, each char expanded to scale×scale pixels.
//   '#'  → line pixel: label -1, lineMask 1 (a real outline — never painted)
//   ' '  → band/gap:   label -1, lineMask 0 (watershed assigns it to a region)
//   A..Z → region interior: label = charCode-64 (A=1,B=2,…)
function buildScene(rows, scale = 10) {
  const cols = rows[0].length;
  const W = cols * scale, H = rows.length * scale, n = W * H;
  const label = new Int32Array(n);
  const lineMask = new Uint8Array(n);
  const paint = new Uint8ClampedArray(n * 4).fill(255); // all white, opaque
  const ids = new Set();
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = rows[r][c];
      let lbl = -1, line = 0;
      if (ch === '#') { line = 1; }
      else if (ch === ' ') { /* band */ }
      else { lbl = ch.charCodeAt(0) - 64; ids.add(lbl); }
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const idx = (r * scale + dy) * W + (c * scale + dx);
          label[idx] = lbl; lineMask[idx] = line;
        }
      }
    }
  }
  return { W, H, n, label, lineMask, paint, ids, scale, cols };
}

const RED = { r: 200, g: 30, b: 30 };
const BLUE = { r: 30, g: 30, b: 200 };
const cellIdx = (s, r, c) =>
  ((r * s.scale + (s.scale >> 1)) * s.W) + (c * s.scale + (s.scale >> 1));
const isColor = (p, i, col) =>
  p[i * 4] === col.r && p[i * 4 + 1] === col.g && p[i * 4 + 2] === col.b;
const isWhite = (p, i) =>
  p[i * 4] === 255 && p[i * 4 + 1] === 255 && p[i * 4 + 2] === 255;
function cellAll(s, r, c, pred) {
  for (let dy = 0; dy < s.scale; dy++)
    for (let dx = 0; dx < s.scale; dx++)
      if (!pred((r * s.scale + dy) * s.W + (c * s.scale + dx))) return false;
  return true;
}

// 1. Watershed tiles the band: no -1 remains, and a band between two regions
//    splits — its left edge to A, its right edge to B (no unowned midline).
console.log('test: watershed assigns every band pixel to its nearest region');
{
  const s = buildScene(['A B']); // A | band | B
  watershedAssign(s.label, s.W, s.H);
  let anyMinusOne = false;
  for (let i = 0; i < s.n; i++) if (s.label[i] === -1) { anyMinusOne = true; break; }
  check('no -1 left after watershed', !anyMinusOne);
  check('band left edge → region A(1)', s.label[cellIdx(s, 0, 1) - (s.scale >> 1)] === 1 || s.label[(0 * s.scale + (s.scale >> 1)) * s.W + (1 * s.scale)] === 1);
  check('band right edge → region B(2)', s.label[(0 * s.scale + (s.scale >> 1)) * s.W + (2 * s.scale - 1)] === 2);
}

// 2. buildRegionPixels excludes line pixels; the band IS included.
console.log('test: region pixels include the band, exclude the line');
{
  const s = buildScene(['A#B']); // A | line | B
  watershedAssign(s.label, s.W, s.H);
  const rp = buildRegionPixels(s.label, s.lineMask, [...s.ids], s.W, s.H);
  const aPixels = rp.get(1);
  // none of region A's pixels may be a line pixel
  check('region A excludes all line pixels', aPixels.every((i) => s.lineMask[i] === 0));
  // the line column was assigned a region in label, but is NOT in any region's set
  let lineInAnySet = false;
  for (const arr of rp.values()) for (const i of arr) if (s.lineMask[i]) { lineInAnySet = true; break; }
  check('no line pixel appears in any region set', !lineInAnySet);
}

// 3. No seam: fill A red and B blue across a line. Every non-line pixel must be
//    coloured (A red / B blue), the line stays white in the paint layer, and
//    there is NO white gap anywhere off the line.
console.log('test: adjacent fills meet at the line with no white seam');
{
  const s = buildScene(['A#B', 'A#B']);
  watershedAssign(s.label, s.W, s.H);
  const rp = buildRegionPixels(s.label, s.lineMask, [...s.ids], s.W, s.H);
  fillRegionCore({ paint: s.paint, regionPixels: rp, regionId: 1, fillColor: RED });
  fillRegionCore({ paint: s.paint, regionPixels: rp, regionId: 2, fillColor: BLUE });
  let whiteOffLine = 0, coloured = 0;
  for (let i = 0; i < s.n; i++) {
    if (s.lineMask[i]) {
      if (!isWhite(s.paint, i)) { whiteOffLine = -999; } // line must stay unpainted
    } else if (isWhite(s.paint, i)) {
      whiteOffLine++;
    } else { coloured++; }
  }
  check('no white seam off the line', whiteOffLine === 0);
  check('line pixels left unpainted (line art preserved)', whiteOffLine !== -999);
  check('left region is red', cellAll(s, 0, 0, (i) => isColor(s.paint, i, RED)));
  check('right region is blue', cellAll(s, 0, 2, (i) => isColor(s.paint, i, BLUE)));
}

// 4. Uncolourable-band fix: a small interior fully ringed by a thick band is
//    still reachable — its band is owned by the inner region after watershed.
console.log('test: a thick band around a shape does not make it uncolourable');
{
  const s = buildScene([
    'AAAAA',
    'A   A',
    'A B A',
    'A   A',
    'AAAAA',
  ]); // outer A ring, a band ring, inner B
  watershedAssign(s.label, s.W, s.H);
  const rp = buildRegionPixels(s.label, s.lineMask, [...s.ids], s.W, s.H);
  check('inner region B has pixels (reachable)', (rp.get(2) || []).length > 0);
  fillRegionCore({ paint: s.paint, regionPixels: rp, regionId: 2, fillColor: BLUE });
  check('inner B centre is filled', cellAll(s, 2, 2, (i) => isColor(s.paint, i, BLUE)));
}

// 5. Undo fidelity: the returned undo entries restore the exact prior pixels.
console.log('test: undo entries restore prior pixels');
{
  const s = buildScene(['AAA', 'AAA']);
  watershedAssign(s.label, s.W, s.H);
  const rp = buildRegionPixels(s.label, s.lineMask, [...s.ids], s.W, s.H);
  const before = Uint8ClampedArray.from(s.paint);
  const { undoEntries } = fillRegionCore({ paint: s.paint, regionPixels: rp, regionId: 1, fillColor: RED });
  check('something was painted', undoEntries.length > 0);
  for (let k = undoEntries.length - 5; k >= 0; k -= 5) {
    const idx = undoEntries[k], o = idx * 4;
    s.paint[o] = undoEntries[k + 1]; s.paint[o + 1] = undoEntries[k + 2];
    s.paint[o + 2] = undoEntries[k + 3]; s.paint[o + 3] = undoEntries[k + 4];
  }
  let restored = true;
  for (let i = 0; i < s.paint.length; i++) if (s.paint[i] !== before[i]) { restored = false; break; }
  check('paint layer fully restored after undo', restored);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
