import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';
import 'package:lalabuba/features/canvas/flood_fill.dart';

// Proves the white-spot fix: a small (< minArea) region enclosed by its own
// dark ring is MERGED into the region that surrounds it, instead of being
// discarded to outline (-2) where it would render as an uncolourable white
// speck. Layout (a "donut"): outer background → big inner region R → a tiny
// speck inside R. The speck must end up with R's id (not -2, not background).
void main() {
  test('sub-minArea speck merges into its enclosing (non-background) region', () {
    const w = 200, h = 200;
    final rgba = Uint8List(w * h * 4);

    void set(int x, int y, int v) {
      final i = (y * w + x) * 4;
      rgba[i] = v;
      rgba[i + 1] = v;
      rgba[i + 2] = v;
      rgba[i + 3] = 255;
    }

    // All white to start.
    for (var i = 0; i < w * h; i++) {
      rgba[i * 4] = 255;
      rgba[i * 4 + 1] = 255;
      rgba[i * 4 + 2] = 255;
      rgba[i * 4 + 3] = 255;
    }
    // R's boundary: a black rectangular ring (x40..160, y40..160), ~4px thick.
    // Inside it (x44..156) is the large white region R; outside is background.
    for (var y = 40; y <= 160; y++) {
      for (var x = 40; x <= 160; x++) {
        final onBorder = x < 44 || x > 156 || y < 44 || y > 156;
        if (onBorder) set(x, y, 0);
      }
    }
    // A speck near R's centre: 28×28 black square with a 24×24 white hole.
    // 24px survives the 8-px closing (~576px) but is far below minArea → merge.
    for (var y = 86; y <= 113; y++) {
      for (var x = 86; x <= 113; x++) {
        set(x, y, 0);
      }
    }
    for (var y = 88; y <= 111; y++) {
      for (var x = 88; x <= 111; x++) {
        set(x, y, 255);
      }
    }

    final result = detectRegions(RegionDetectParams(
      rgbaBytes: rgba,
      width: w,
      height: h,
      minArea: 2000,
      paletteArgb: const [0xFFFF0000, 0xFF00FF00, 0xFF0000FF],
    ));

    int regionAt(int x, int y) => result.pixelToRegion[y * w + x];

    final bgId = result.backgroundRegionId;
    final rId = regionAt(60, 100); // inside R, between its border and the speck
    final speckCore = regionAt(100, 100); // centre of the white hole

    expect(rId, greaterThanOrEqualTo(0));
    expect(rId, isNot(bgId), reason: 'R must be a distinct, non-background region');
    expect(speckCore, isNot(-2),
        reason: 'speck core must NOT be left as an uncolourable white hole');
    expect(speckCore, equals(rId),
        reason: 'speck must merge into the region (R) that encloses it');
  });

  // Proves the "can't colour the non-numbered spaces" fix: a small shape (below
  // minArea) that sits directly ON the background must become its OWN free-fill
  // region — NOT dissolved into the uncolourable background, and NOT given a
  // number. Layout: white background → a 32×32 white shape ringed in black.
  test('sub-minArea shape on the background is promoted to its own free-fill region',
      () {
    const w = 200, h = 200;
    final rgba = Uint8List(w * h * 4);
    void set(int x, int y, int v) {
      final i = (y * w + x) * 4;
      rgba[i] = v;
      rgba[i + 1] = v;
      rgba[i + 2] = v;
      rgba[i + 3] = 255;
    }
    for (var i = 0; i < w * h; i++) {
      rgba[i * 4] = 255;
      rgba[i * 4 + 1] = 255;
      rgba[i * 4 + 2] = 255;
      rgba[i * 4 + 3] = 255;
    }
    // A black ring (x80..120, y80..120) with a 32×32 white interior (x84..116).
    // ~1024px: above the 50-px promote floor but below minArea (2000) → promote.
    for (var y = 80; y <= 120; y++) {
      for (var x = 80; x <= 120; x++) {
        final onBorder = x < 84 || x > 116 || y < 84 || y > 116;
        if (onBorder) set(x, y, 0);
      }
    }

    final result = detectRegions(RegionDetectParams(
      rgbaBytes: rgba,
      width: w,
      height: h,
      minArea: 2000,
      paletteArgb: const [0xFFFF0000, 0xFF00FF00, 0xFF0000FF],
    ));

    final bgId = result.backgroundRegionId;
    final shapeId = result.pixelToRegion[100 * w + 100]; // centre of the shape

    expect(shapeId, greaterThanOrEqualTo(0),
        reason: 'promoted shape must be a real, tappable region');
    expect(shapeId, isNot(-2),
        reason: 'promoted shape must NOT be left as uncolourable outline');
    expect(shapeId, isNot(bgId),
        reason: 'promoted shape must be independent of the background');
    expect(result.regionPaletteIndex.containsKey(shapeId), isFalse,
        reason: 'promoted shape is free-fill — it must carry NO number');
  });
}
