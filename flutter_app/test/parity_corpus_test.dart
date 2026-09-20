// Writes one region-detection summary JSON per corpus fixture, for the
// cross-engine parity check against the web JS twin (see
// scripts/test-parity-corpus.mjs, which reads these + runs the JS engine
// itself, then diffs). Run this FIRST, then run the Node script:
//
//   flutter test test/parity_corpus_test.dart
//   node scripts/test-parity-corpus.mjs
//
// Uses detection.regionFilter.absoluteFloor (30, matching the web engine's
// DETECTION_DEFAULTS) as minArea — NOT a difficulty-scaled minArea — because
// this checks core segmentation-algorithm parity, not difficulty/numbering-UI
// behaviour (those two platforms have independently-evolved, NOT-YET-unified
// systems for difficulty-scaled numbering density; see
// docs/MODULE_ARCHITECTURE.md for that separate, still-open finding).
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';
import 'package:lalabuba/features/canvas/flood_fill.dart';

const _palette = [
  Colors.red, Colors.orange, Colors.yellow, Colors.lightGreen,
  Colors.green, Colors.teal, Colors.cyan, Colors.blue,
  Colors.indigo, Colors.purple, Colors.pink, Colors.brown,
];

void main() {
  final dir = Directory('test/fixtures/regression_corpus');
  final outDir = Directory('test/.parity-output')..createSync(recursive: true);
  final fixtures = dir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.rgba'))
      .toList();

  for (final file in fixtures) {
    final name = file.uri.pathSegments.last;
    final match = RegExp(r'_(\d+)x(\d+)\.rgba$').firstMatch(name);
    test('write parity summary: $name', () {
      expect(match, isNotNull);
      final w = int.parse(match!.group(1)!);
      final h = int.parse(match.group(2)!);
      final rgba = Uint8List.fromList(file.readAsBytesSync());
      expect(rgba.length, w * h * 4);

      final params = RegionDetectParams(
        rgbaBytes: rgba,
        width: w,
        height: h,
        minArea: 30, // matches web DETECTION_DEFAULTS.regionFilter.absoluteFloor
        maxNumbered: 999999, // uncapped — comparing detection, not a numbering UI cap
        paletteArgb: _palette.map((c) => c.toARGB32()).toList(),
      );
      final result = detectRegions(params);

      final pixelCounts = result.regions
          .where((r) => r.id != result.backgroundRegionId)
          .map((r) => r.pixelCount)
          .toList()
        ..sort();

      final summary = {
        'regionCount': result.regions.length - 1, // excl. background
        'pixelCounts': pixelCounts,
      };
      File('${outDir.path}/$name.dart.json').writeAsStringSync(jsonEncode(summary));
    });
  }
}
