import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';
import 'package:lalabuba/features/canvas/flood_fill.dart';

// Reproduces the "white corners / unfilled areas" bug: the morphological
// closing absorbs genuinely-white interior into the -2 outline class. At concave
// corners and region junctions the absorbed band is WIDER than the closing
// radius and cannot be eroded back, so a fixed-radius bleed left a permanent
// white halo. buildCompositeRgba now floods the whole light band with NO
// distance cap — up to the genuine dark ink core, which still stops one colour
// from crossing into a neighbour.
void main() {
  group('buildCompositeRgba multi-pass bleed', () {
    const w = 20;
    const h = 3;
    const red = 0xFFFF0000;

    late Uint8List orig;
    late Int32List p2r;

    void setPixel(int i, int r, int g, int b) {
      orig[i * 4] = r;
      orig[i * 4 + 1] = g;
      orig[i * 4 + 2] = b;
      orig[i * 4 + 3] = 255;
    }

    setUp(() {
      orig = Uint8List(w * h * 4);
      p2r = Int32List(w * h);
      // Default: dark -2 everywhere (blocks any vertical bleed → isolates row y=1).
      for (var i = 0; i < w * h; i++) {
        p2r[i] = -2;
        setPixel(i, 0, 0, 0);
      }
      // Row y=1: filled region | 8-px white -2 band | dark core | white -2 band.
      const y = 1;
      int idx(int x) => y * w + x;
      // x 0..1  → filled region 0 (white interior)
      for (var x = 0; x <= 1; x++) {
        p2r[idx(x)] = 0;
        setPixel(idx(x), 255, 255, 255);
      }
      // x 2..9  → white band wrongly classed as outline by the closing
      for (var x = 2; x <= 9; x++) {
        setPixel(idx(x), 255, 255, 255); // p2r stays -2
      }
      // x 10    → genuine dark outline core
      setPixel(idx(10), 0, 0, 0); // p2r stays -2, luma 0
      // x 11..19 → white band on the FAR side, no filled neighbour reachable
      for (var x = 11; x <= 19; x++) {
        setPixel(idx(x), 255, 255, 255); // p2r stays -2
      }
    });

    test('fills the entire white band up to the closing radius', () {
      final out = buildCompositeRgba(CompositeParams(
        originalRgba: orig,
        pixelToRegion: p2r,
        regionColors: const {0: red},
        width: w,
        height: h,
      ));

      int r(int x) => out[(1 * w + x) * 4];
      int g(int x) => out[(1 * w + x) * 4 + 1];
      int b(int x) => out[(1 * w + x) * 4 + 2];

      bool isRed(int x) => r(x) > 200 && g(x) < 50 && b(x) < 50;

      // The whole 8-px white band adjacent to fill is now coloured — no white gap.
      for (var x = 0; x <= 9; x++) {
        expect(isRed(x), isTrue, reason: 'pixel x=$x should be filled red');
      }
    });

    test('the dark outline core stops colour crossing into the far side', () {
      final out = buildCompositeRgba(CompositeParams(
        originalRgba: orig,
        pixelToRegion: p2r,
        regionColors: const {0: red},
        width: w,
        height: h,
      ));
      int r(int x) => out[(1 * w + x) * 4];
      int g(int x) => out[(1 * w + x) * 4 + 1];
      int b(int x) => out[(1 * w + x) * 4 + 2];

      // Core stays dark.
      expect(r(10) < 30 && g(10) < 30 && b(10) < 30, isTrue,
          reason: 'dark core must remain a barrier');
      // Far-side band (unreachable without crossing the core) stays white.
      for (var x = 11; x <= 19; x++) {
        expect(r(x) > 250 && g(x) > 250 && b(x) > 250, isTrue,
            reason: 'far-side pixel x=$x must NOT be bled into');
      }
    });
  });

  // Regression guard for the unbounded-bleed fix: a light band 24 px wide (far
  // wider than the old 8-px cap) must now fill ALL the way to the dark core.
  // Under the old maxBleed=8 cap, pixels x=9..32 would have stayed white — the
  // exact white-halo artifact reported on the frog.
  group('buildCompositeRgba fills bands wider than the old cap', () {
    const w = 40;
    const h = 3;
    const red = 0xFFFF0000;

    test('a 24-px white band fills completely (no residual halo)', () {
      final orig = Uint8List(w * h * 4);
      final p2r = Int32List(w * h);
      void setPixel(int i, int r, int g, int b) {
        orig[i * 4] = r;
        orig[i * 4 + 1] = g;
        orig[i * 4 + 2] = b;
        orig[i * 4 + 3] = 255;
      }

      // Dark -2 everywhere (isolates the middle row vertically).
      for (var i = 0; i < w * h; i++) {
        p2r[i] = -2;
        setPixel(i, 0, 0, 0);
      }
      const y = 1;
      int idx(int x) => y * w + x;
      // x 0   → filled region 0.
      p2r[idx(0)] = 0;
      setPixel(idx(0), 255, 255, 255);
      // x 1..32 → 32-px white band wrongly classed as outline by the closing.
      for (var x = 1; x <= 32; x++) {
        setPixel(idx(x), 255, 255, 255); // p2r stays -2
      }
      // x 33   → genuine dark ink core (barrier).
      setPixel(idx(33), 0, 0, 0);
      // x 34..39 → far-side white band, unreachable.
      for (var x = 34; x <= 39; x++) {
        setPixel(idx(x), 255, 255, 255);
      }

      final out = buildCompositeRgba(CompositeParams(
        originalRgba: orig,
        pixelToRegion: p2r,
        regionColors: const {0: red},
        width: w,
        height: h,
      ));
      int r(int x) => out[(1 * w + x) * 4];
      int g(int x) => out[(1 * w + x) * 4 + 1];
      int b(int x) => out[(1 * w + x) * 4 + 2];
      bool isRed(int x) => r(x) > 200 && g(x) < 50 && b(x) < 50;

      // Entire 32-px band up to the core is filled — this is what the 8-px cap
      // could not do.
      for (var x = 0; x <= 32; x++) {
        expect(isRed(x), isTrue, reason: 'wide-band pixel x=$x should be red');
      }
      // The dark core and the far side remain untouched.
      expect(r(33) < 30 && g(33) < 30 && b(33) < 30, isTrue,
          reason: 'core barrier must remain dark');
      for (var x = 34; x <= 39; x++) {
        expect(r(x) > 250 && g(x) > 250 && b(x) > 250, isTrue,
            reason: 'far-side pixel x=$x must stay white');
      }
    });
  });
}
