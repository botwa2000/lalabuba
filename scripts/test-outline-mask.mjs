// Unit tests for public/js/outline-mask.js — the web twin of Flutter's
// buildOutlineMask. Reproduces the "colours bleeding across areas" failure at
// its source (the wall mask) and proves hysteresis seals the faint pin-gap
// without promoting flat shading. Mirrors test/outline_mask_test.dart.
// Run: node scripts/test-outline-mask.mjs
import { buildOutlineMask } from '../public/js/outline-mask.js';

let failures = 0;
function check(name, cond, reason) {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${reason ? ' — ' + reason : ''}`); failures++; }
}

const W = 21, H = 21;
const idx = (x, y) => y * W + x;
function rgbaFromBrightness(br) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    out[i * 4] = br[i]; out[i * 4 + 1] = br[i]; out[i * 4 + 2] = br[i]; out[i * 4 + 3] = 255;
  }
  return out;
}

// White field with a 1-px vertical dark line at x=10 with ONE faint gap at y=10.
function gridWithGap(gapBr) {
  const g = new Array(W * H).fill(255);
  for (let y = 0; y < H; y++) g[idx(10, y)] = (y === 10) ? gapBr : 0;
  return g;
}

console.log('test: strong-only rule leaves the faint pin-gap open (reproduces the bug)');
{
  const gapBr = 150;
  const g = gridWithGap(gapBr);
  let sum = 0, area = 0;
  for (let yy = 6; yy <= 14; yy++) for (let xx = 6; xx <= 14; xx++) { sum += g[idx(xx, yy)]; area++; }
  const mean = (sum / area) | 0;
  const strong = gapBr < 100 || (gapBr < 150 && gapBr <= mean - 22);
  check('pin-gap is NOT a strong wall (would leak without hysteresis)', !strong, `mean=${mean}`);
}

console.log('test: hysteresis seals the faint pin-gap');
{
  const mask = buildOutlineMask(rgbaFromBrightness(gridWithGap(150)), W, H);
  check('gap pixel promoted to wall', mask[idx(10, 10)] === 1);
  check('rest of the line is wall', mask[idx(10, 3)] === 1 && mask[idx(10, 17)] === 1);
  check('white field stays free', mask[idx(3, 10)] === 0 && mask[idx(17, 10)] === 0);
}

console.log('test: a flat mid-grey field becomes NO walls');
{
  const flat = new Array(W * H).fill(128);
  const mask = buildOutlineMask(rgbaFromBrightness(flat), W, H);
  let walls = 0; for (const m of mask) walls += m;
  check('uniformly shaded region stays fully colourable', walls === 0, `walls=${walls}`);
}

console.log('test: an isolated weak speck with no strong line is NOT promoted');
{
  const g = new Array(W * H).fill(255);
  g[idx(10, 10)] = 150;
  const mask = buildOutlineMask(rgbaFromBrightness(g), W, H);
  check('lone weak speck stays free', mask[idx(10, 10)] === 0);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
