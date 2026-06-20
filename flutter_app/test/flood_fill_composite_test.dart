import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';
import 'package:lalabuba/features/canvas/flood_fill.dart';

// Covers buildCompositeRgba under the WATERSHED model:
//   • every pixel belongs to a region (no unowned outline band), so adjacent
//     fills meet with NO white seam — the structural fix for "colours not clean";
//   • fills are flat (one solid colour per region), so source shading can't show
//     through as blotchy/partial colouring;
//   • the thin line art is overlaid on top from lineMask, so dividers stay crisp
//     over the colour without being left as gaps.
void main() {
  const red = 0xFFFF0000;
  const blue = 0xFF0000FF;

  Uint8List solid(int w, int h, int v) {
    final b = Uint8List(w * h * 4);
    for (var i = 0; i < w * h; i++) {
      b[i * 4] = v;
      b[i * 4 + 1] = v;
      b[i * 4 + 2] = v;
      b[i * 4 + 3] = 255;
    }
    return b;
  }

  group('flat fills', () {
    test('a grey-shaded region renders as one solid colour', () {
      const w = 12, h = 1;
      final orig = Uint8List(w * h * 4);
      final p2r = Int32List(w * h);
      // One region (id 0) across the row, each pixel a DIFFERENT grey (luma
      // 120→230) to simulate source shading inside the region.
      for (var x = 0; x < w; x++) {
        final v = 120 + x * 10;
        orig[x * 4] = v;
        orig[x * 4 + 1] = v;
        orig[x * 4 + 2] = v;
        orig[x * 4 + 3] = 255;
        p2r[x] = 0;
      }
      final out = buildCompositeRgba(CompositeParams(
        originalRgba: orig,
        pixelToRegion: p2r,
        regionColors: const {0: red},
        width: w,
        height: h,
      ));
      for (var x = 0; x < w; x++) {
        expect(out[x * 4], 255, reason: 'pixel x=$x R must be solid 255');
        expect(out[x * 4 + 1], 0, reason: 'pixel x=$x G must be 0');
        expect(out[x * 4 + 2], 0, reason: 'pixel x=$x B must be 0');
      }
    });

    test('an uncoloured region keeps the original pixels', () {
      const w = 4, h = 1;
      final orig = solid(w, h, 200);
      final p2r = Int32List(w * h); // all region 0, but 0 is NOT in regionColors
      final out = buildCompositeRgba(CompositeParams(
        originalRgba: orig,
        pixelToRegion: p2r,
        regionColors: const {}, // nothing filled
        width: w,
        height: h,
      ));
      for (var x = 0; x < w; x++) {
        expect(out[x * 4], 200, reason: 'unfilled pixel must keep original');
      }
    });
  });

  group('no seam between adjacent fills', () {
    // Two regions tile the whole row with a one-pixel black line between them
    // (the watershed step has already assigned every pixel, so there is no -2).
    // The fills must be solid up to the divider with NO white pixel anywhere,
    // and the divider pixel must read dark from the line overlay.
    test('adjacent red/blue fills meet at the overlaid line, no white gap', () {
      const w = 11, h = 1;
      final orig = solid(w, h, 255);
      final p2r = Int32List(w * h);
      final lineMask = Uint8List(w * h);
      const div = 5;
      for (var x = 0; x < w; x++) {
        p2r[x] = x < div ? 0 : 1; // left region 0, right region 1 (div ∈ region 1)
      }
      // The divider pixel is a black line drawn in the source.
      orig[div * 4] = 0;
      orig[div * 4 + 1] = 0;
      orig[div * 4 + 2] = 0;
      lineMask[div] = 1;

      final out = buildCompositeRgba(CompositeParams(
        originalRgba: orig,
        pixelToRegion: p2r,
        regionColors: const {0: red, 1: blue},
        width: w,
        height: h,
        lineMask: lineMask,
      ));

      bool isWhite(int x) =>
          out[x * 4] > 250 && out[x * 4 + 1] > 250 && out[x * 4 + 2] > 250;
      // No white anywhere — every pixel is owned and painted.
      for (var x = 0; x < w; x++) {
        expect(isWhite(x), isFalse, reason: 'pixel x=$x must not be white');
      }
      // Left of divider = solid red, right = solid blue.
      for (var x = 0; x < div; x++) {
        expect(out[x * 4] == 255 && out[x * 4 + 2] == 0, isTrue,
            reason: 'pixel x=$x must be solid red');
      }
      for (var x = div + 1; x < w; x++) {
        expect(out[x * 4 + 2] == 255 && out[x * 4] == 0, isTrue,
            reason: 'pixel x=$x must be solid blue');
      }
      // The divider reads dark (line overlay won over the fill).
      expect(out[div * 4] < 60 && out[div * 4 + 1] < 60 && out[div * 4 + 2] < 60,
          isTrue,
          reason: 'the overlaid line pixel must stay a dark divider');
    });
  });

  group('line overlay keeps fills flat', () {
    // A non-line dark source pixel (interior shading, lineMask 0) must NOT darken
    // the flat fill — only true line pixels (lineMask 1) get the overlay.
    test('interior shading does not show through; only line pixels darken', () {
      const w = 3, h = 1;
      final orig = solid(w, h, 255);
      // x0: a dark pixel that is NOT a line (shading). x1: white. x2: dark line.
      orig[0] = 30; orig[1] = 30; orig[2] = 30;
      orig[2 * 4] = 0; orig[2 * 4 + 1] = 0; orig[2 * 4 + 2] = 0;
      final p2r = Int32List(w * h); // all region 0
      final lineMask = Uint8List(w * h)..[2] = 1; // only x2 is a line

      final out = buildCompositeRgba(CompositeParams(
        originalRgba: orig,
        pixelToRegion: p2r,
        regionColors: const {0: red},
        width: w,
        height: h,
        lineMask: lineMask,
      ));

      // x0 (shading, not a line) → solid red, shading ignored.
      expect(out[0] == 255 && out[2] == 0, isTrue,
          reason: 'non-line shading must be covered by the flat fill');
      // x1 → solid red.
      expect(out[1 * 4] == 255 && out[1 * 4 + 2] == 0, isTrue);
      // x2 (line) → dark overlay.
      expect(out[2 * 4] < 60, isTrue, reason: 'line pixel must darken');
    });
  });
}
