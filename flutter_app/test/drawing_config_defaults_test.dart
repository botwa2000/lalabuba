// Asserts DrawingConfig.defaults (the hard-coded fallback used only when
// /api/drawing-config can't be reached at startup) still matches the server's
// canonical DEFAULTS in lib/drawing-config.js — the documented single source
// of truth for the whole drawing model.
//
// test/fixtures/drawing_config_defaults_snapshot.json is GENERATED from that
// server file by scripts/generate-config-snapshot.mjs (run it after any
// change to lib/drawing-config.js DEFAULTS). This test never hand-encodes
// the server's values — it only compares against the generated snapshot, so
// there is exactly one place a human edits numbers (the server file) and one
// place this test regenerates from (the snapshot).
//
// WHY THIS EXISTS: this exact audit (2026-09-20) found REAL, LIVE drift that
// nothing had caught — generation.clientTimeoutMs was 150000 server-side but
// 120000 in this file's old defaults. A network hiccup at app startup would
// have silently given users a 30-second-shorter generation timeout than the
// server assumes, right when the waterfall needs its full budget most.
//
// NOTE on `skipFreeTiers`: the server DROPPED this field entirely (see
// lib/drawing-config.js's own comment: skipping free tiers on hard/extreme
// caused 500s when Novita hit its daily cap — "better a slower draw than a
// 500 error"). It is therefore NOT in the snapshot and NOT compared here.
// DrawingConfig.defaults still models the field (for DifficultyConfig's
// shape) but must default it to `false` for every difficulty to match the
// server's actual current behaviour — this test asserts that too.
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/core/drawing_config.dart';

void main() {
  final snapshot = jsonDecode(
    File('test/fixtures/drawing_config_defaults_snapshot.json').readAsStringSync(),
  ) as Map<String, dynamic>;
  final d = DrawingConfig.defaults;

  group('DrawingConfig.defaults matches the server snapshot', () {
    test('difficulties (minArea/maxRegions/colorCount/resolution)', () {
      final serverDiffs = snapshot['difficulties'] as Map<String, dynamic>;
      for (final key in serverDiffs.keys) {
        final server = serverDiffs[key] as Map<String, dynamic>;
        final local = d.difficulties[key];
        expect(local, isNotNull, reason: 'DrawingConfig.defaults is missing difficulty "$key"');
        expect(local!.minArea, server['minArea'], reason: '$key.minArea drifted');
        expect(local.maxRegions, server['maxRegions'], reason: '$key.maxRegions drifted');
        expect(local.colorCount, server['colorCount'], reason: '$key.colorCount drifted');
        expect(local.resolution, server['resolution'], reason: '$key.resolution drifted');
      }
    });

    test('difficulties: skipFreeTiers defaults to false everywhere (server dropped the field)', () {
      for (final entry in d.difficulties.entries) {
        expect(entry.value.skipFreeTiers, isFalse,
            reason: '${entry.key}.skipFreeTiers must default to false — the server '
                'removed per-difficulty skipFreeTiers because skipping free tiers on '
                'hard/extreme caused 500s when Novita hit its daily cap. A stale '
                '`true` fallback here would reintroduce that failure mode the moment '
                'this app falls back to local defaults (network hiccup at startup).');
      }
    });

    test('detection.outlineMask', () {
      final s = snapshot['detection']['outlineMask'] as Map<String, dynamic>;
      final l = d.detection.outlineMask;
      expect(l.globalDark, s['globalDark']);
      expect(l.localMargin, s['localMargin']);
      expect(l.adaptiveCeil, s['adaptiveCeil']);
      expect(l.weakMargin, s['weakMargin']);
      expect(l.weakCeil, s['weakCeil']);
    });

    test('detection.lineBridge', () {
      final s = snapshot['detection']['lineBridge'] as Map<String, dynamic>;
      final l = d.detection.lineBridge;
      expect(l.maxGapMin, s['maxGapMin']);
      expect(l.maxGapMax, s['maxGapMax']);
      expect(l.faceCos, s['faceCos']);
      expect(l.tangentSteps, s['tangentSteps']);
    });

    test('detection.trappedBall', () {
      final s = snapshot['detection']['trappedBall'] as Map<String, dynamic>;
      final l = d.detection.trappedBall;
      expect(l.maxRMin, s['maxRMin']);
      expect(l.maxRMax, s['maxRMax']);
      expect(l.decayNumerator, s['decayNumerator']);
      expect(l.decayDenominator, s['decayDenominator']);
      expect(l.finalPassRadius, s['finalPassRadius']);
    });

    test('detection.regionFilter', () {
      final s = snapshot['detection']['regionFilter'] as Map<String, dynamic>;
      final l = d.detection.regionFilter;
      expect(l.absoluteFloor, s['absoluteFloor']);
      expect(l.promoteFloor, s['promoteFloor']);
      expect(l.rescueFloor, s['rescueFloor']);
    });

    test('detection: bfsDarkThreshold / bfsFloodCapRatio / workerTimeoutMs / snapRadius', () {
      final s = snapshot['detection'] as Map<String, dynamic>;
      expect(d.detection.bfsDarkThreshold, s['bfsDarkThreshold']);
      expect(d.detection.bfsFloodCapRatio, s['bfsFloodCapRatio']);
      expect(d.detection.workerTimeoutMs, s['workerTimeoutMs']);
      expect(d.detection.snapRadius.web, s['snapRadius']['web']);
      expect(d.detection.snapRadius.flutter, s['snapRadius']['flutter']);
    });

    test('completion', () {
      final s = snapshot['completion'] as Map<String, dynamic>;
      expect(d.completion.freeCoverageRatio, s['freeCoverageRatio']);
      expect(d.completion.freehandCoverThreshold, s['freehandCoverThreshold']);
      expect(d.completion.tinyRegionAutoRatio, s['tinyRegionAutoRatio']);
    });

    test('canvas', () {
      final s = snapshot['canvas'] as Map<String, dynamic>;
      expect(d.canvas.maxDisplayEdgePx, s['maxDisplayEdgePx']);
      expect(d.canvas.undoStackMax, s['undoStackMax']);
    });

    test('generation', () {
      final s = snapshot['generation'] as Map<String, dynamic>;
      expect(d.generation.clientTimeoutMs, s['clientTimeoutMs'],
          reason: 'clientTimeoutMs drift found live 2026-09-20: server=150000, '
              'stale local fallback was 120000 — see file header.');
      expect(d.generation.seedRange, s['seedRange']);
      expect(d.generation.maxImageBytes, s['maxImageBytes']);
    });
  });
}
