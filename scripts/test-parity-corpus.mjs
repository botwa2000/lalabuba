// Cross-engine parity check: does the web JS coloring engine produce
// functionally-equivalent output to the Flutter/Dart engine on the SAME real
// corpus image? Catches exactly the kind of drift this project already
// shipped twice with the identical line-bridge Bresenham bug (2026-09-20) —
// two independent hand-ports of one algorithm, only one of which got fixed
// unless someone explicitly checked the other.
//
// NOT wired into automatic CI yet (flutter-ci.yml and node-ci.yml are
// separate GitHub Actions workflows with no artifact hand-off between them —
// doing that properly is a follow-up, not squeezed in here). Run manually,
// in order:
//
//   cd flutter_app && flutter test test/parity_corpus_test.dart
//   cd .. && node scripts/test-parity-corpus.mjs
//
// Tolerance is intentionally loose (see comparison below): the two engines
// have real, currently-unreconciled differences beyond raw segmentation (see
// docs/MODULE_ARCHITECTURE.md) — this guards against GROSS divergence (one
// engine finding ~0 regions while the other finds dozens, i.e. today's bug
// class), not byte-identical output.
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { detectRegionsWeb } from '../public/js/region-worker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const corpusDir = join(__dirname, '..', 'flutter_app', 'test', 'fixtures', 'regression_corpus');
const dartOutDir = join(__dirname, '..', 'flutter_app', 'test', '.parity-output');

if (!existsSync(dartOutDir)) {
  console.error(
    `Missing ${dartOutDir} — run the Dart side first:\n` +
    `  cd flutter_app && flutter test test/parity_corpus_test.dart`
  );
  process.exit(1);
}

const fixtures = readdirSync(corpusDir).filter((f) => f.endsWith('.rgba'));
let failures = 0;

for (const name of fixtures) {
  const m = name.match(/_(\d+)x(\d+)\.rgba$/);
  if (!m) { console.log(`SKIP ${name} — no _WxH.rgba suffix`); continue; }
  const w = Number(m[1]), h = Number(m[2]);

  const dartPath = join(dartOutDir, `${name}.dart.json`);
  if (!existsSync(dartPath)) {
    console.log(`FAIL ${name} — no Dart summary at ${dartPath} (did the Dart test run?)`);
    failures++;
    continue;
  }
  const dart = JSON.parse(readFileSync(dartPath, 'utf8'));

  const buf = readFileSync(join(corpusDir, name));
  const { regionIds, backgroundRegionId } = detectRegionsWeb(
    new Uint8ClampedArray(buf), w, h, { regionFilter: { absoluteFloor: 30, promoteFloor: 50, rescueFloor: 5 } },
  );
  const jsRegionCount = regionIds.filter((id) => id !== backgroundRegionId).length;

  // Both must find a genuinely colourable page — this is the invariant that
  // actually matters: neither engine silently produces zero/near-zero
  // regions while the other finds a normal amount.
  const dartCount = dart.regionCount;
  const bothZero = dartCount === 0 && jsRegionCount === 0;
  const bothNonZero = dartCount > 0 && jsRegionCount > 0;
  // Loose order-of-magnitude band: catches "one engine basically failed"
  // without requiring the two independently-evolved pipelines (different
  // trapped-ball radii formulas, JS's extra thin-wall merge, etc. — see
  // docs/MODULE_ARCHITECTURE.md) to produce identical counts.
  const ratio = jsRegionCount > 0 && dartCount > 0
    ? Math.max(jsRegionCount, dartCount) / Math.min(jsRegionCount, dartCount)
    : Infinity;
  const ok = bothZero || (bothNonZero && ratio <= 5);

  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${name} — dart=${dartCount} js=${jsRegionCount}` +
    (bothNonZero ? ` ratio=${ratio.toFixed(1)}x` : '')
  );
  if (!ok) failures++;
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
