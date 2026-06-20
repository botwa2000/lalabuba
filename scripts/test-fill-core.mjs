// Unit tests for public/js/fill-core.js — the pure colour-by-number fill engine.
// Builds synthetic line-art images (no browser, no generation) and asserts the
// sliver/beak/divider/leak behaviours hold exactly. Run: node scripts/test-fill-core.mjs
import { fillRegionCore } from '../public/js/fill-core.js';

let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  ok   ${name}`); }
  else { console.log(`  FAIL ${name}`); failures++; }
}

// Build a scene from an ASCII grid, each char expanded to scale×scale pixels.
//   '#'   → outline: label -1, base brightness 0 (a dark wall)
//   ' '   → bright gap: label -1, base brightness 255 (a swallowed light feature)
//   A..Z  → region: label = charCode-64 (A=1,B=2,…,G=7), base brightness 255
// paint starts all white. Returns the args fillRegionCore needs + geometry.
function buildScene(rows, scale = 10) {
  const cols = rows[0].length;
  const W = cols * scale, H = rows.length * scale;
  const base = new Uint8ClampedArray(W * H * 4);
  const paint = new Uint8ClampedArray(W * H * 4);
  const regionMap = new Int32Array(W * H);
  const labelOf = (ch) => (ch === '#' || ch === ' ') ? -1 : ch.charCodeAt(0) - 64;

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = rows[r][c];
      const lbl = labelOf(ch);
      const br = ch === '#' ? 0 : 255;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const idx = (r * scale + dy) * W + (c * scale + dx);
          const o = idx * 4;
          regionMap[idx] = lbl;
          base[o] = br; base[o + 1] = br; base[o + 2] = br; base[o + 3] = 255;
          paint[o] = 255; paint[o + 1] = 255; paint[o + 2] = 255; paint[o + 3] = 255;
        }
      }
    }
  }
  const regionPixels = new Map();
  for (let i = 0; i < W * H; i++) {
    const l = regionMap[i];
    if (l >= 1) { (regionPixels.get(l) ?? regionPixels.set(l, []).get(l)).push(i); }
  }
  return { width: W, height: H, base, paint, regionMap, regionPixels, scale, cols };
}

const FILL = { r: 200, g: 30, b: 30 };
const cellIdx = (s, r, c) =>
  ((r * s.scale + (s.scale >> 1)) * s.width) + (c * s.scale + (s.scale >> 1));
const isColor = (p, i, col) =>
  p[i * 4] === col.r && p[i * 4 + 1] === col.g && p[i * 4 + 2] === col.b;
const isWhite = (p, i) =>
  p[i * 4] === 255 && p[i * 4 + 1] === 255 && p[i * 4 + 2] === 255;

// Every pixel of a given ASCII cell satisfies pred.
function cellAll(s, r, c, pred) {
  for (let dy = 0; dy < s.scale; dy++) {
    for (let dx = 0; dx < s.scale; dx++) {
      const idx = (r * s.scale + dy) * s.width + (c * s.scale + dx);
      if (!pred(idx)) return false;
    }
  }
  return true;
}

function run(name, rows, regionId, asserts) {
  console.log(name);
  const s = buildScene(rows);
  fillRegionCore({
    paint: s.paint, base: s.base, regionMap: s.regionMap,
    regionPixels: s.regionPixels, regionColorMap: null,
    width: s.width, height: s.height, regionId, fillColor: FILL, minBr: 50,
  });
  asserts(s);
}

// 1. Basic + beak: a region with an enclosed bright pocket. The whole region AND
//    the pocket must be coloured (no white speck left inside).
run('test: basic fill + enclosed beak pocket', [
  'AAAAAAA',
  'AAAAAAA',
  'AAA AAA',
  'AAAAAAA',
  'AAAAAAA',
], 1, (s) => {
  check('all region cells coloured', cellAll(s, 1, 1, (i) => isColor(s.paint, i, FILL)));
  check('enclosed pocket coloured (beak)', cellAll(s, 2, 3, (i) => isColor(s.paint, i, FILL)));
});

// 2. Divider: two regions separated by a bright broken-outline gap. Filling A must
//    NOT paint the gap or B (no fake border drawn across the open gap).
run('test: ambiguous divider gap is left unpainted', [
  'AAA BBB',
  'AAA BBB',
  'AAA BBB',
  'AAA BBB',
], 1, (s) => {
  check('region A coloured', cellAll(s, 0, 0, (i) => isColor(s.paint, i, FILL)));
  // A bounded 2 px seam-bleed may touch the gap's immediate edge (desirable —
  // it closes the halo), but the gap must NOT be flooded: its centre, the actual
  // divider line, stays white. That is what prevents a fake midline.
  check('divider gap centre stays white', isWhite(s.paint, cellIdx(s, 0, 3)));
  check('region B stays white', cellAll(s, 0, 5, (i) => isWhite(s.paint, i)));
});

// 3. Fringe: bright anti-aliased band between the fill and the black outline must
//    be coloured (no white halo); the black outline itself stays black.
run('test: anti-aliased fringe is closed, outline preserved', [
  'AA..##',
  'AA..##',
  'AA..##',
], 1, (s) => {
  check('region coloured', cellAll(s, 0, 0, (i) => isColor(s.paint, i, FILL)));
  check('fringe col1 coloured', cellAll(s, 0, 2, (i) => isColor(s.paint, i, FILL)));
  check('fringe col2 coloured', cellAll(s, 0, 3, (i) => isColor(s.paint, i, FILL)));
  check('outline stays unpainted (white in paint layer)', cellAll(s, 0, 4, (i) => isWhite(s.paint, i)));
});

// 4. Leak: a region almost sealed by dark outline with ONE bright break to a large
//    background region. Filling A must not leak through the break into background.
run('test: no leak into background through a bright break', [
  'GGGGG',
  'G###G',
  'G#A G',
  'G###G',
  'GGGGG',
], 1, (s) => {
  check('region A coloured', cellAll(s, 2, 2, (i) => isColor(s.paint, i, FILL)));
  // The break may take a 2 px bleed at the A edge, but must not flood through:
  // its centre stays white and the background beyond is fully untouched.
  check('break centre stays white (not flooded through)', isWhite(s.paint, cellIdx(s, 2, 3)));
  check('background corner stays white', cellAll(s, 0, 0, (i) => isWhite(s.paint, i)));
  check('background right edge stays white', cellAll(s, 2, 4, (i) => isWhite(s.paint, i)));
});

// 5. Undo fidelity: the returned undo entries restore the exact prior pixels.
console.log('test: undo entries restore prior pixels');
{
  const s = buildScene(['AAAAAAA', 'AAAAAAA', 'AAA AAA', 'AAAAAAA', 'AAAAAAA']);
  const before = Uint8ClampedArray.from(s.paint);
  const { undoEntries } = fillRegionCore({
    paint: s.paint, base: s.base, regionMap: s.regionMap,
    regionPixels: s.regionPixels, regionColorMap: null,
    width: s.width, height: s.height, regionId: 1, fillColor: FILL, minBr: 50,
  });
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
