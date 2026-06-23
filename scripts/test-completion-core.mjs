// Pure unit tests for the web free-colour completion core (parity with the
// Flutter free_completion_test.dart). Run: node scripts/test-completion-core.mjs
import {
  numberedCapFor, pickMeaningfulTargets, freeComplete, isCovered, COVER_THRESHOLD,
} from '../public/js/completion-core.js';

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; } else { fail++; console.error('  ✗ ' + name); }
}
function eq(name, a, b) { ok(name + ` (got ${JSON.stringify(a)})`, JSON.stringify(a) === JSON.stringify(b)); }

// ── difficulty cap scales the meaningful-area count ──
eq('easy cap', numberedCapFor('easy'), 10);
eq('medium cap (default)', numberedCapFor('medium'), 18);
eq('hard cap', numberedCapFor('hard'), 30);
eq('extreme cap', numberedCapFor('extreme'), 48);
eq('unknown → medium', numberedCapFor('???'), 18);

// ── meaningful targets = largest K regions, background + line(0) excluded ──
{
  // id 7 is the background (biggest); id 0 is the line/barrier; rest are areas.
  const entries = [[0, 9999], [7, 5000], [1, 400], [2, 300], [3, 200], [4, 100], [5, 50]];
  const t = pickMeaningfulTargets(entries, 3, 7);
  eq('top-3 by size, excl bg(7)+line(0)', t, [1, 2, 3]);
  const all = pickMeaningfulTargets(entries, 99, 7);
  eq('cap larger than count keeps all real areas, sorted desc', all, [1, 2, 3, 4, 5]);
}

// ── forgiving, self-scaling ~90% completion ──
ok('10 areas: 9/10 (90%) completes', freeComplete(10, 9));
ok('10 areas: 8/10 (80%) does NOT', !freeComplete(10, 8));
ok('Easy 6 areas: ceil(0.9*6)=6 → needs all', !freeComplete(6, 5) && freeComplete(6, 6));
ok('1 area needs that 1', !freeComplete(1, 0) && freeComplete(1, 1));
ok('no areas never completes', !freeComplete(0, 0));

// ── coverage threshold (uneven pencil colouring still counts) ──
eq('threshold is forgiving 0.45', COVER_THRESHOLD, 0.45);
ok('45% covered counts', isCovered(45, 100));
ok('44% covered does not', !isCovered(44, 100));
ok('empty region never covered', !isCovered(0, 0));

if (fail) { console.error(`\nFAILED ${fail} (passed ${pass})`); process.exit(1); }
console.log(`completion-core: all ${pass} checks passed`);
