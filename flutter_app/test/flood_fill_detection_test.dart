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

  // Proves the "tons of areas can't be tapped / no separators" fix: two large
  // facets divided by a FAINT GREY line (luma ~130, below the old br<100 wall
  // threshold) must become TWO separate, tappable regions. Before adaptive
  // thresholding the grey line wasn't a wall, so the two facets merged into one
  // region and the child couldn't colour them apart.
  test('a faint grey interior line splits two facets into separate regions', () {
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
    // Black frame (x30..170, y30..170) enclosing the subject so neither facet is
    // the outer background.
    for (var y = 30; y <= 170; y++) {
      for (var x = 30; x <= 170; x++) {
        final onBorder = x < 34 || x > 166 || y < 34 || y > 166;
        if (onBorder) set(x, y, 0);
      }
    }
    // A faint GREY vertical divider (luma 130) down the middle, 4px wide. Well
    // above the global br<100 wall threshold — only the adaptive local test can
    // see it as a line.
    for (var y = 34; y <= 166; y++) {
      for (var x = 98; x <= 101; x++) {
        set(x, y, 130);
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
    final leftId = regionAt(65, 100);
    final rightId = regionAt(135, 100);

    expect(leftId, greaterThanOrEqualTo(0));
    expect(rightId, greaterThanOrEqualTo(0));
    expect(leftId, isNot(bgId));
    expect(rightId, isNot(bgId));
    expect(leftId, isNot(rightId),
        reason: 'the grey divider must separate the two facets into '
            'distinct, independently colourable regions');
  });

  // Guard for the failure mode a naive "raise the global threshold" fix would
  // cause: a single UNIFORMLY mid-grey region (luma 130 throughout) must stay
  // ONE fillable region — not collapse to all-outline and become uncolourable.
  // The adaptive test must not fire inside a flat shaded area (every pixel ≈ its
  // local mean).
  test('a uniformly grey-shaded region stays one fillable region', () {
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
    // Black ring (x40..160) with a uniformly grey (luma 130) interior.
    for (var y = 40; y <= 160; y++) {
      for (var x = 40; x <= 160; x++) {
        final onBorder = x < 44 || x > 156 || y < 44 || y > 156;
        set(x, y, onBorder ? 0 : 130);
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
    final centre = result.pixelToRegion[100 * w + 100];
    final nearEdge = result.pixelToRegion[100 * w + 50];

    expect(centre, greaterThanOrEqualTo(0),
        reason: 'a flat grey fill must remain tappable, not become outline');
    expect(centre, isNot(bgId));
    expect(nearEdge, equals(centre),
        reason: 'the whole grey interior must stay a single region');
  });
}
