// Permanent regression corpus for the region-detection pipeline
// (buildOutlineMask → bridgeLineGaps → trappedBallSegment → ... in
// flood_fill.dart / line_bridge.dart / trapped_ball.dart).
//
// WHY THIS FILE EXISTS (read before deleting or "simplifying" it):
// Coloring/tap/numbering has broken and been re-fixed dozens of times over
// the life of this project (see git log --grep="tap\|number\|region\|color"
// -i — well over 100 matching commits). Each fix closed the exact reported
// shape (a synthetic fixture mimicking ONE bug) but never accumulated into a
// standing corpus, so a NEW real image from a NEW provider/art-style kept
// finding a NEW hole in the same subsystem. Textbook example: the sunburst
// fixture (2026-09-19, thin rays) proved detection was NOT hanging in
// general and "ruled out" a hang as the explanation for an on-device bug —
// one day later a REAL image from the nscale/HuggingFace fallback tier (this
// tiger, drawn with thick solid stripe fills instead of thin outlines) hit a
// genuine infinite loop in a completely different function
// (_draw4ConnectedLine in line_bridge.dart — a steep-line Bresenham bug with
// no axis swap) that the sunburst shape could never have triggered.
//
// THE RULE THIS FILE ENFORCES: every time a REAL generated image is found
// that breaks coloring/numbering, the fix's PR must add that exact image
// (converted to raw RGBA8888, see below) to test/fixtures/regression_corpus/
// — not just a synthetic mimic. This is what actually stops the cycle: the
// corpus only grows, so a fix can never silently regress for a shape this
// project has already been burned by, and CI (flutter-ci.yml, runs on every
// push) gates on it automatically.
//
// Fixture naming: <short-description>_<YYYY-MM-DD>_<W>x<H>.rgba — raw
// RGBA8888 pixels, no header. To capture a new one from a PNG:
//   node -e "require('sharp')('the.png').ensureAlpha().raw().toBuffer()
//     .then(({data}) => require('fs').writeFileSync('out.rgba', data))"
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

// Every real image in the corpus must clear this bar. Generous vs. the
// in-app 60s isolate timeout (canvas_controller.dart) — this is a CI
// regression trip-wire, not a tuned performance budget, so it flags anything
// that's headed toward the on-device timeout long before it gets there.
const _timeBudget = Duration(seconds: 15);

void main() {
  final dir = Directory('test/fixtures/regression_corpus');
  final fixtures = dir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.rgba'))
      .toList()
    ..sort((a, b) => a.path.compareTo(b.path));

  test('regression corpus directory is not empty', () {
    expect(fixtures, isNotEmpty,
        reason: 'test/fixtures/regression_corpus/ should never be emptied — '
            'each entry is a real image that once broke coloring/numbering.');
  });

  for (final file in fixtures) {
    final name = file.uri.pathSegments.last;
    final match = RegExp(r'_(\d+)x(\d+)\.rgba$').firstMatch(name);
    test('region detection on corpus fixture: $name', () {
      expect(match, isNotNull,
          reason: 'fixture filename must end in _<width>x<height>.rgba '
              '(got "$name")');
      final w = int.parse(match!.group(1)!);
      final h = int.parse(match.group(2)!);

      final rgba = Uint8List.fromList(file.readAsBytesSync());
      expect(rgba.length, w * h * 4,
          reason: 'fixture byte length must match its filename dimensions');

      final params = RegionDetectParams(
        rgbaBytes: rgba,
        width: w,
        height: h,
        minArea: (w * h * 0.0008).round(), // typical medium-difficulty scale
        maxNumbered: 48,
        paletteArgb: _palette.map((c) => c.toARGB32()).toList(),
      );

      final sw = Stopwatch()..start();
      final result = detectRegions(params);
      sw.stop();

      // 1. Must not be anywhere near the on-device 60s isolate timeout — a
      //    trip here means a NEW pathological case has been found and must
      //    be fixed (algorithmically) before merge, not just noted.
      expect(sw.elapsed, lessThan(_timeBudget),
          reason: 'detectRegions took ${sw.elapsedMilliseconds}ms on $name — '
              'approaching the 60s on-device isolate timeout '
              '(canvas_controller.dart). If this trips, the drawing this '
              'fixture came from would render as completely uncolourable '
              'on a real device: image shows, but no numbers, no fills, '
              'the numbers toggle has nothing to toggle.');

      // 2. Must produce a genuinely colourable page, not just "didn't hang".
      expect(result.regions.length, greaterThan(0),
          reason: '$name produced zero regions — a real generated image '
              'must always yield at least one fillable area.');
      expect(result.regionColorMap.length, greaterThan(0),
          reason: '$name produced regions but numbered none of them — same '
              'user-visible symptom (nothing tappable) via a different '
              'code path (e.g. everything merged into the background).');

      // 3. Every pixel must be owned by the watershed step — an unowned (-2)
      //    band is the classic "white seam / uncolourable gap" symptom.
      var unowned = 0;
      for (final v in result.pixelToRegion) {
        if (v == -2) unowned++;
      }
      expect(unowned, 0,
          reason: '$name left $unowned pixels unowned by the watershed step');
    }, timeout: Timeout(_timeBudget + const Duration(seconds: 30)));
  }
}
