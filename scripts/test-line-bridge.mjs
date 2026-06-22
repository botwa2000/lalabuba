// Unit tests for public/js/line-bridge.js — web twin of line_bridge.dart.
// (A) seals a genuine collinear break; (B) does NOT join parallel groove tips
// (the over-seal safety case). Mirrors test/line_bridge_test.dart.
// Run: node scripts/test-line-bridge.mjs
import { bridgeLineGaps, zhangSuenThin } from '../public/js/line-bridge.js';

let failures = 0;
function check(name, cond, reason) {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${reason ? ' — ' + reason : ''}`); failures++; }
}

const W = 31, H = 31;
const idx = (x, y) => y * W + x;
function flood(mask, seed) {
  const seen = new Set([seed]);
  const q = [seed];
  while (q.length) {
    const i = q.pop();
    const x = i % W;
    const t = (nb) => { if (nb >= 0 && nb < W * H && mask[nb] === 0 && !seen.has(nb)) { seen.add(nb); q.push(nb); } };
    if (x > 0) t(i - 1);
    if (x < W - 1) t(i + 1);
    t(i - W); t(i + W);
  }
  return seen;
}

console.log('test: (A) seals a collinear break');
{
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
    const divider = x === 15 && !(y >= 14 && y <= 16);
    m[idx(x, y)] = (border || divider) ? 1 : 0;
  }
  check('before: break connects the chambers', flood(m, idx(7, 15)).has(idx(23, 15)));
  bridgeLineGaps(m, W, H, { maxGap: 8 });
  check('after: chambers separated', !flood(m, idx(7, 15)).has(idx(23, 15)));
  check('gap centre is now a wall', m[idx(15, 15)] === 1);
}

console.log('test: (B) does NOT join parallel groove tips');
{
  const m = new Uint8Array(W * H);
  for (let x = 6; x <= 24; x++) { m[idx(x, 12)] = 1; m[idx(x, 16)] = 1; }
  bridgeLineGaps(m, W, H, { maxGap: 8 });
  check('left tips not joined', m[idx(6, 14)] === 0);
  check('right tips not joined', m[idx(24, 14)] === 0);
  check('groove channel stays open', flood(m, idx(7, 14)).has(idx(23, 14)));
}

console.log('test: zhangSuenThin thins a thick bar to 1px');
{
  const m = new Uint8Array(W * H);
  for (let y = 10; y <= 14; y++) for (let x = 5; x <= 25; x++) m[idx(x, y)] = 1;
  const skel = zhangSuenThin(m, W, H);
  let ok = true;
  for (let x = 8; x <= 22; x++) {
    let col = 0;
    for (let y = 10; y <= 14; y++) col += skel[idx(x, y)];
    if (col > 1) ok = false;
  }
  check('each column thinned to <=1px', ok);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
