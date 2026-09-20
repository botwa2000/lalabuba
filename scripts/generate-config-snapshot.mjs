// Generates flutter_app/test/fixtures/drawing_config_defaults_snapshot.json
// from lib/drawing-config.js's DEFAULTS — the ONE source of truth for the
// drawing model (see that file's own header comment).
//
// WHY: Flutter's DrawingConfig.defaults (flutter_app/lib/core/drawing_config.dart)
// is a hand-written fallback used only when /api/drawing-config can't be
// reached at startup. It has already drifted from the server DEFAULTS in
// real, live ways found by this exact audit (2026-09-20) — e.g.
// generation.clientTimeoutMs is 150000 server-side but 120000 in the Dart
// fallback. This script + drawing_config_defaults_test.dart turn "someone
// remembers to keep them in sync" into a CI-enforced check.
//
// Run: node scripts/generate-config-snapshot.mjs
// Re-run whenever lib/drawing-config.js DEFAULTS changes, then run
// `flutter test test/drawing_config_defaults_test.dart` — if it fails,
// DrawingConfig.defaults needs a matching update, not the snapshot.
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { DEFAULTS } = require('../lib/drawing-config.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'flutter_app', 'test', 'fixtures', 'drawing_config_defaults_snapshot.json');

// Only the subset DrawingConfig.defaults actually models (difficulties minus
// skipFreeTiers, which the server no longer has — see drift note in
// drawing_config_defaults_test.dart; detection; completion; canvas; generation).
const snapshot = {
  difficulties: DEFAULTS.difficulties,
  detection: DEFAULTS.detection,
  completion: DEFAULTS.completion,
  canvas: DEFAULTS.canvas,
  generation: DEFAULTS.generation,
};

writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
