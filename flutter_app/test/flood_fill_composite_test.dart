import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';
import 'package:lalabuba/features/canvas/flood_fill.dart';

// Covers the seam-bleed behaviour of buildCompositeRgba. The morphological
// closing absorbs a thin ring of genuinely-white interior into the -2 outline
// class; the bleed refills that ring so no white halo shows along a fill edge.
// The bleed is DISTANCE-BOUNDED (maxBleed px): it closes the seam but must never
// paint across an open white area, otherwise two regions separated by a faint or
// broken grey line flood toward each other and meet at an arbitrary midline with
// no black divider (the "border is a random line in the middle of white" bug).
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

  // Regression guard for the "random midline in open white" bug. Two filled
  // regions sit at opposite ends of a WIDE light band with NO dark divider
  // between them. An unbounded flood would have each colour race to the middle
  // and meet at an arbitrary midline (a coloured boundary with no black line).
  // The bounded bleed must instead leave the open centre untouched: each colour
  // reaches only ~maxBleed (12) px past its own edge.
  group('buildCompositeRgba bounded bleed leaves open white uncoloured', () {
    const w = 40;
    const h = 3;
    const red = 0xFFFF0000;
    const blue = 0xFF0000FF;

    test('neither colour crosses the open centre of a 38-px white band', () {
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
      // x 0  → filled region 0 (red). x 39 → filled region 1 (blue).
      p2r[idx(0)] = 0;
      setPixel(idx(0), 255, 255, 255);
      p2r[idx(39)] = 1;
      setPixel(idx(39), 255, 255, 255);
      // x 1..38 → one continuous open white band, NO dark divider anywhere.
      for (var x = 1; x <= 38; x++) {
        setPixel(idx(x), 255, 255, 255); // p2r stays -2
      }

      final out = buildCompositeRgba(CompositeParams(
        originalRgba: orig,
        pixelToRegion: p2r,
        regionColors: const {0: red, 1: blue},
        width: w,
        height: h,
      ));
      int r(int x) => out[(1 * w + x) * 4];
      int g(int x) => out[(1 * w + x) * 4 + 1];
      int b(int x) => out[(1 * w + x) * 4 + 2];
      bool isRed(int x) => r(x) > 200 && g(x) < 50 && b(x) < 50;
      bool isBlue(int x) => b(x) > 200 && r(x) < 50 && g(x) < 50;
      bool isWhite(int x) => r(x) > 250 && g(x) > 250 && b(x) > 250;

      // Red reaches at most 12 px from its edge (x1..12), blue at most 12 px
      // from its edge (x27..38).
      expect(isRed(12), isTrue, reason: 'red should fill its seam up to x=12');
      expect(isBlue(27), isTrue, reason: 'blue should fill its seam up to x=27');
      // The open centre (x13..26) stays white — no arbitrary midline.
      for (var x = 13; x <= 26; x++) {
        expect(isWhite(x), isTrue,
            reason: 'open-white pixel x=$x must NOT be coloured');
      }
    });
  });
}
