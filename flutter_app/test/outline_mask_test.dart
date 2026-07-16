import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/flood_fill.dart';

// Reproduces the "colours bleeding across areas" failure at its SOURCE — the
// wall mask. A thin line drawn by AI line art has faint anti-aliased pixels; a
// few slip under the strong (adaptive) threshold, leaving a 1-px pin-gap a fill
// bleeds through. HYSTERESIS seals that gap (the weak gap pixel is promoted
// because it is joined to the strong line) WITHOUT promoting flat shading.

/// Pack a brightness grid (0..255, one value per pixel) into an opaque RGBA
/// buffer buildOutlineMask can consume.
Uint8List rgbaFromBrightness(List<int> br, int w, int h) {
  final out = Uint8List(w * h * 4);
  for (var i = 0; i < w * h; i++) {
    out[i * 4] = br[i];
    out[i * 4 + 1] = br[i];
    out[i * 4 + 2] = br[i];
    out[i * 4 + 3] = 255;
  }
  return out;
}

void main() {
  group('buildOutlineMask hysteresis', () {
    const w = 21, h = 21;
    int idx(int x, int y) => y * w + x;

    // White field with a 1-px-thick vertical dark line at x=10 that has ONE
    // faint anti-aliased pixel (a pin-gap) at y=10.
    List<int> grid({required int gapBr}) {
      final g = List<int>.filled(w * h, 255);
      for (var y = 0; y < h; y++) {
        g[idx(10, y)] = (y == 10) ? gapBr : 0; // 0 = strong ink; gap = faint grey
      }
      return g;
    }

    test('the faint pin-gap pixel is NOT caught by the strong test alone (the bug)',
        () {
      // Replicate just the strong rule the old mask used: a pixel is a wall iff
      // br<100, or (br<150 and br <= localBoxMean-22). The grey gap (br=150)
      // fails both — so without hysteresis the gap stays OPEN and a fill leaks.
      const gapBr = 150;
      final g = grid(gapBr: gapBr);
      // Local 9×9 box mean around the gap: 8 columns of white + 1 mixed column.
      var sum = 0, area = 0;
      for (var yy = 6; yy <= 14; yy++) {
        for (var xx = 6; xx <= 14; xx++) {
          sum += g[idx(xx, yy)];
          area++;
        }
      }
      final mean = sum ~/ area;
      final strongByGlobal = gapBr < 100;
      final strongByLocal = gapBr < 150 && gapBr <= mean - 22;
      expect(strongByGlobal || strongByLocal, isFalse,
          reason: 'strong-only rule leaves the pin-gap open (reproduces the leak)');
    });

    test('hysteresis SEALS the faint pin-gap (joined to the strong line)', () {
      final mask = buildOutlineMask(rgbaFromBrightness(grid(gapBr: 150), w, h), w, h);
      expect(mask[idx(10, 10)], 1,
          reason: 'the faint gap pixel must be promoted to wall and seal the line');
      // The rest of the line is of course a wall too.
      expect(mask[idx(10, 3)], 1);
      expect(mask[idx(10, 17)], 1);
      // The white field on either side stays free (colourable).
      expect(mask[idx(3, 10)], 0);
      expect(mask[idx(17, 10)], 0);
    });

    test('a flat mid-grey field becomes NO walls (shading is not promoted)', () {
      // Every pixel equals its local mean, so neither strong nor weak fires.
      final flat = List<int>.filled(w * h, 128);
      final mask = buildOutlineMask(rgbaFromBrightness(flat, w, h), w, h);
      var walls = 0;
      for (final m in mask) {
        walls += m;
      }
      expect(walls, 0, reason: 'a uniformly shaded region must stay fully colourable');
    });

    test('an isolated weak speck with no strong line is NOT promoted', () {
      // One faint pixel (br=200) in a white field: above adaptiveCeil(190) so
      // classified WEAK, not strong. Hysteresis must leave it free because no
      // strong neighbour ever seeds it.
      final g = List<int>.filled(w * h, 255);
      g[idx(10, 10)] = 200; // lone faint speck above adaptiveCeil — weak, no strong seed
      final mask = buildOutlineMask(rgbaFromBrightness(g, w, h), w, h);
      expect(mask[idx(10, 10)], 0,
          reason: 'a weak speck unconnected to any strong line must stay free');
    });
  });
}
