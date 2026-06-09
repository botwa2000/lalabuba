import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';
import 'package:lalabuba/features/canvas/flood_fill.dart';

// Reproduces the "white corners / unfilled areas" bug: the morphological
// closing absorbs up to ~8 px of genuinely-white interior into the -2 outline
// class. The old single-pixel bleed only recoloured the innermost ring and left
// the rest white. buildCompositeRgba must now flood the whole light band (up to
// the closing radius) while the dark outline core stops one colour from
// crossing into a neighbour.
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
      bool isWhite(int x) => r(x) > 250 && g(x) > 250 && b(x) > 250;

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
}
