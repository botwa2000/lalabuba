// Unit tests for public/js/trapped-ball.js — the web twin of the Flutter
// trapped-ball segmenter. Encodes the two failure modes behind the recurring
// "colours not clean" reports so neither can silently regress:
//   (A) LEAK — a gap in the line art lets a fill escape into the neighbour.
//   (B) SEALED THIN REGION — a narrow region gets closed so it can't be filled.
// Mirrors flutter_app/test/trapped_ball_test.dart. Run: node scripts/test-trapped-ball.mjs
import { trappedBallSegment, ballRadiiFor, chebyshevDistance } from '../public/js/trapped-ball.js';

let failures = 0;
function check(name, cond, reason) {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${reason ? ' — ' + reason : ''}`); failures++; }
}

// Plain 4-connected flood fill over the free area (outline==0) — the naive
// behaviour that LEAKS through gaps.
function naiveFlood(outline, w, h, seed) {
  const seen = new Set([seed]);
  const q = [seed];
  while (q.length) {
    const i = q.pop();
    const x = i % w;
    const tryN = (nb) => { if (nb >= 0 && nb < w * h && outline[nb] === 0 && !seen.has(nb)) { seen.add(nb); q.push(nb); } };
    if (x > 0) tryN(i - 1);
    if (x < w - 1) tryN(i + 1);
    tryN(i - w);
    tryN(i + w);
  }
  return seen;
}

const W = 21, H = 11;
const idx = (x, y) => y * W + x;

// ── (A) leak resistance ──────────────────────────────────────────────────────
console.log('test: trapped-ball leak resistance (A)');
{
  // border + vertical divider at x=10 with a 1px gap at y=5 connecting chambers.
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      const divider = x === 10 && y !== 5;
      m[y * W + x] = (border || divider) ? 1 : 0;
    }
  const filled = naiveFlood(m, W, H, idx(5, 5));
  check('a plain flood-fill LEAKS through the gap (reproduces the bug)',
    filled.has(idx(15, 5)), 'naive flood should reach the right chamber');

  const label = trappedBallSegment(m, W, H, [2, 1]);
  const left = label[idx(5, 5)], right = label[idx(15, 5)];
  check('left chamber owned', left >= 0);
  check('right chamber owned', right >= 0);
  check('trapped-ball keeps the two chambers SEPARATE', left !== right,
    `left=${left} right=${right}`);

  let allOwned = true;
  for (let i = 0; i < W * H; i++) if (m[i] === 0 && !(label[i] >= 0)) allOwned = false;
  check('every free pixel still gets a region', allOwned);
}

// ── (B) thin regions stay fillable ────────────────────────────────────────────
console.log('test: trapped-ball thin regions stay fillable (B)');
{
  // border + two horizontal walls (y=3,y=7) carving a 3px corridor (y=4,5,6).
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      const wall = (y === 3 || y === 7) && x > 0 && x < W - 1;
      m[y * W + x] = (border || wall) ? 1 : 0;
    }
  const dist = new Int32Array(W * H);
  chebyshevDistance(m, W, H, dist);
  let maxInCorridor = 0;
  for (let x = 1; x < W - 1; x++) for (const y of [4, 5, 6])
    if (dist[idx(x, y)] > maxInCorridor) maxInCorridor = dist[idx(x, y)];
  check('a single large erosion radius EMPTIES the 3px corridor (the cause)',
    maxInCorridor <= 2, `maxInCorridor=${maxInCorridor}`);

  const label = trappedBallSegment(m, W, H, [2, 1]);
  const mid = label[idx(10, 5)];
  check('corridor is a fillable region', mid >= 0);
  let oneRegion = true;
  for (let x = 2; x < W - 2; x++) if (label[idx(x, 5)] !== mid) oneRegion = false;
  check('corridor is one contiguous region', oneRegion);
  check('corridor distinct from upper chamber', label[idx(10, 1)] !== mid);
  check('corridor distinct from lower chamber', label[idx(10, 9)] !== mid);
}

// ── ballRadiiFor ───────────────────────────────────────────────────────────────
console.log('test: ballRadiiFor descending, ends at 1, scales with size');
{
  const big = ballRadiiFor(1024, 1024);
  check('first radius > 1', big[0] > 1);
  check('last radius == 1', big[big.length - 1] === 1);
  let desc = true;
  for (let i = 1; i < big.length; i++) if (!(big[i] < big[i - 1])) desc = false;
  check('strictly descending', desc, JSON.stringify(big));
  check('tiny image still ends at 1', ballRadiiFor(40, 40).pop() === 1);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
