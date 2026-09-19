// Diagnostic (not a pass/fail regression test): investigates whether the
// region-detection algorithm can genuinely time out / behave pathologically
// on a complex many-thin-ray image, mirroring what a real "sun" drawing
// looked like on-device (2026-09-19 session: every tap on a rendered sun
// image did nothing, and release-build logcat gave no visibility into why).
// Runs detectRegions() DIRECTLY on a synthetic 1024x1024 17-ray sunburst
// fixture (test/fixtures/sunburst.rgba, raw RGBA8888, no network involved)
// and reports timing + region stats, so the question can be answered without
// depending on the (currently exhausted) live image-generation providers.
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';
import 'package:lalabuba/features/canvas/flood_fill.dart';

void main() {
  test('detectRegions on a complex 17-ray sunburst: timing + region stats', () {
    final bytes = File('test/fixtures/sunburst.rgba').readAsBytesSync();
    final rgba = Uint8List.fromList(bytes);
    const w = 1024, h = 1024;
    expect(rgba.length, w * h * 4, reason: 'fixture must be raw RGBA8888 at 1024x1024');

    // A real palette — the earlier version of this diagnostic passed an empty
    // one and got "numbered: 0", which just reflects detectRegions() gating
    // the whole regionColorMap block behind `palette.isNotEmpty` (flood_fill.dart
    // line ~339) — not a bug. Use a realistic 12-colour palette like production.
    const palette = [
      Colors.red, Colors.orange, Colors.yellow, Colors.lightGreen,
      Colors.green, Colors.teal, Colors.cyan, Colors.blue,
      Colors.indigo, Colors.purple, Colors.pink, Colors.brown,
    ];
    final params = RegionDetectParams(
      rgbaBytes: rgba,
      width: w,
      height: h,
      minArea: (w * h * 0.0008).round(), // matches typical medium-difficulty minArea scale
      maxNumbered: 48,
      paletteArgb: palette.map((c) => c.toARGB32()).toList(),
    );

    final sw = Stopwatch()..start();
    final result = detectRegions(params);
    sw.stop();

    final regionCount = result.regions.length;
    final numberedCount = result.regionColorMap.length;
    var freePixels = 0, wallPixels = 0;
    for (final v in result.pixelToRegion) {
      if (v == -2) {
        wallPixels++;
      } else {
        freePixels++;
      }
    }

    // ignore: avoid_print
    print('=== sunburst detection diagnostic ===');
    // ignore: avoid_print
    print('elapsed: ${sw.elapsedMilliseconds}ms');
    // ignore: avoid_print
    print('regions found: $regionCount, numbered: $numberedCount');
    // ignore: avoid_print
    print('free(fillable) px: $freePixels, wall(-2) px: $wallPixels, total: ${w * h}');
    // ignore: avoid_print
    print('backgroundRegionId: ${result.backgroundRegionId}');

    // The actual assertions this diagnostic cares about:
    expect(sw.elapsedMilliseconds, lessThan(60000),
        reason: 'If this trips, detectRegions really CAN exceed the 60s '
            'isolate timeout on a complex image — that would fully explain '
            'the on-device "sun" symptom (catch-block silently clears '
            'isProcessing but leaves detection null, so every tap resolves '
            'to null region and nothing ever fills).');
    expect(regionCount, greaterThan(0),
        reason: 'If 0, detection produced no usable regions at all on a '
            'complex image — same symptom, different cause (a real '
            'algorithmic dead end rather than a timeout).');
    expect(freePixels, greaterThan(0),
        reason: 'Every fillable pixel should get SOME region id, even if '
            'small ones get merged/promoted.');
  });
}
