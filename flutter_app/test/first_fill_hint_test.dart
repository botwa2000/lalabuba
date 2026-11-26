// Growth plan L12: the canvas opens on the largest area's colour with a
// "Tap here!" marker there, and a sparkle on the first colour.
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lalabuba/features/canvas/canvas_controller.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';
import 'package:lalabuba/features/canvas/first_fill_hint.dart';

const red = Color(0xFFE53935);
const blue = Color(0xFF1E88E5);
const green = Color(0xFF43A047);
const defaultRed = Color(0xFFFF4757); // CanvasState's default: in no palette

// Regions sorted by area, largest first (as detectRegions returns them):
// 0 = background, 1 = big but NOT numbered (over the numbered cap would never
// be this big, but it pins the guided rule), 2 = largest numbered, 3 = numbered.
RegionDetectionResult detection() => RegionDetectionResult(
      pixelToRegion: Int32List(100 * 100),
      width: 100,
      height: 100,
      backgroundRegionId: 0,
      regions: const [
        Region(id: 0, centroid: Offset(2, 2), pixelCount: 5000),
        Region(id: 1, centroid: Offset(20, 20), pixelCount: 3000),
        Region(id: 2, centroid: Offset(60, 70), pixelCount: 1200),
        Region(id: 3, centroid: Offset(80, 30), pixelCount: 400),
      ],
      regionPaletteIndex: const {2: 1, 3: 2},
    );

void main() {
  GoogleFonts.config.allowRuntimeFetching = false;

  const colorMap = {1: red, 2: blue, 3: green};

  group('firstFillHintRegion', () {
    test('guided: the largest NUMBERED area, never the background', () {
      final r = firstFillHintRegion(
          detection: detection(), regionColorMap: colorMap, regionColors: const {}, guided: true);
      expect(r?.id, 2);
    });

    test('guided: an area already coloured is skipped', () {
      final r = firstFillHintRegion(
          detection: detection(), regionColorMap: colorMap, regionColors: const {2: blue}, guided: true);
      expect(r?.id, 3);
    });

    test('free colour: the largest meaningful area, numbered or not', () {
      final r = firstFillHintRegion(
          detection: detection(), regionColorMap: colorMap, regionColors: const {}, guided: false);
      expect(r?.id, 1);
    });

    test('nothing left (or no detection yet) → no hint', () {
      expect(
          firstFillHintRegion(
              detection: detection(),
              regionColorMap: colorMap,
              regionColors: const {1: red, 2: blue, 3: green},
              guided: false),
          isNull);
      expect(
          firstFillHintRegion(detection: null, regionColorMap: colorMap, regionColors: const {}, guided: true),
          isNull);
    });

    test('CanvasState.firstFillHint follows showNumbers / free mode', () {
      final s = CanvasState(detection: detection(), regionColorMap: colorMap);
      expect(s.firstFillHint?.id, 2);
      expect(s.copyWith(isFreeMode: true).firstFillHint?.id, 1);
      expect(s.copyWith(showNumbers: false).firstFillHint?.id, 1);
    });
  });

  group('openingColour', () {
    test('guided: the colour of the hinted area (the old default red matched nothing)', () {
      final c = CanvasNotifier.openingColour(
          detection: detection(), regionColorMap: colorMap, guided: true,
          palette: const [red, blue, green], current: defaultRed);
      expect(c, blue);
    });

    test('free: default red is not a palette colour → first palette colour', () {
      final c = CanvasNotifier.openingColour(
          detection: detection(), regionColorMap: colorMap, guided: false,
          palette: const [red, blue, green], current: defaultRed);
      expect(c, red);
    });

    test('free: a palette colour already chosen is kept', () {
      final c = CanvasNotifier.openingColour(
          detection: detection(), regionColorMap: colorMap, guided: false,
          palette: const [red, blue, green], current: green);
      expect(c, green);
    });
  });

  group('TapHereHint renders', () {
    Future<void> pumpHint(WidgetTester t, Offset center, {Size area = const Size(400, 400)}) =>
        t.pumpWidget(MaterialApp(
          home: Center(
            child: SizedBox(
              width: area.width,
              height: area.height,
              child: Stack(children: [
                Positioned.fill(child: TapHereHint(center: center, area: area, label: 'Tap here!')),
              ]),
            ),
          ),
        ));

    testWidgets('label + ring centred on the target, never takes a tap', (t) async {
      await pumpHint(t, const Offset(200, 250));
      await t.pump(const Duration(milliseconds: 100));
      expect(find.text('Tap here!'), findsOneWidget);
      final box = t.getRect(find.byType(SizedBox).first);
      final ring = t.getRect(find.byKey(const ValueKey('tap-here-ring')));
      expect(ring.center.dx - box.left, closeTo(200, 0.5));
      expect(ring.center.dy - box.top, closeTo(250, 0.5));
      final label = t.getRect(find.byKey(const ValueKey('tap-here-label')));
      expect(label.bottom, lessThan(ring.top + 1), reason: 'label above the ring');
      expect(
          find.ancestor(of: find.byKey(const ValueKey('tap-here-ring')), matching: find.byType(IgnorePointer)),
          findsWidgets);
    });

    testWidgets('near the top-left corner the label stays inside the picture', (t) async {
      await pumpHint(t, const Offset(20, 30));
      await t.pump(const Duration(milliseconds: 100));
      final box = t.getRect(find.byType(SizedBox).first);
      final ring = t.getRect(find.byKey(const ValueKey('tap-here-ring')));
      final label = t.getRect(find.byKey(const ValueKey('tap-here-label')));
      expect(label.top, greaterThan(ring.bottom - 1), reason: 'label under the ring near the top');
      expect(label.left, greaterThanOrEqualTo(box.left - 0.5));
    });

    testWidgets('near the right edge a long label stays inside', (t) async {
      const area = Size(300, 300);
      await t.pumpWidget(MaterialApp(
        home: Center(
          child: SizedBox(
            width: area.width,
            height: area.height,
            child: const Stack(children: [
              Positioned.fill(
                  child: TapHereHint(center: Offset(290, 200), area: area, label: 'Dotknij tutaj! Dotknij!')),
            ]),
          ),
        ),
      ));
      await t.pump(const Duration(milliseconds: 100));
      final box = t.getRect(find.byType(SizedBox).first);
      final label = t.getRect(find.byKey(const ValueKey('tap-here-label')));
      expect(label.right, lessThanOrEqualTo(box.right + 0.5));
    });
  });

  testWidgets('FirstFillSparkle plays once, shows sparkles, then calls onDone', (t) async {
    var done = 0;
    await t.pumpWidget(MaterialApp(
      home: Stack(children: [
        Positioned.fill(child: FirstFillSparkle(center: const Offset(100, 100), onDone: () => done++)),
      ]),
    ));
    await t.pump(const Duration(milliseconds: 200));
    expect(find.text('✨'), findsWidgets);
    await t.pump(const Duration(milliseconds: 900));
    expect(done, 1);
  });
}
