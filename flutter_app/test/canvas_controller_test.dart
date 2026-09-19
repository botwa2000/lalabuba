import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lalabuba/features/canvas/canvas_controller.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  group('CanvasNotifier free mode (reversible — mirrors web)', () {
    test('setFreeMode enters free mode and hides numbers', () {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final n = c.read(canvasProvider.notifier);

      expect(c.read(canvasProvider).isFreeMode, false);
      expect(c.read(canvasProvider).showNumbers, true);

      n.setFreeMode();
      expect(c.read(canvasProvider).isFreeMode, true);
      expect(c.read(canvasProvider).showNumbers, false);
    });

    test('exitFreeMode returns to guided coloring with numbers on', () {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final n = c.read(canvasProvider.notifier);

      n.setFreeMode();
      n.exitFreeMode();
      expect(c.read(canvasProvider).isFreeMode, false);
      expect(c.read(canvasProvider).showNumbers, true);
    });

    test('toggleNumbers flips the flag without changing free mode', () {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final n = c.read(canvasProvider.notifier);

      final before = c.read(canvasProvider).showNumbers;
      n.toggleNumbers();
      expect(c.read(canvasProvider).showNumbers, !before);
      expect(c.read(canvasProvider).isFreeMode, false);
    });
  });

  group('fitImageRect (letterbox fit)', () {
    test('square image in square viewport fills it', () {
      final r = fitImageRect(100, 100, 200, 200);
      expect(r, const Rect.fromLTWH(0, 0, 200, 200));
    });

    test('wide image is letterboxed vertically (centered)', () {
      final r = fitImageRect(200, 100, 200, 200); // aspect 2:1 in 1:1 viewport
      expect(r.width, 200);
      expect(r.height, 100);
      expect(r.top, 50); // centered: (200-100)/2
    });

    test('tall image is letterboxed horizontally (centered)', () {
      final r = fitImageRect(100, 200, 200, 200);
      expect(r.height, 200);
      expect(r.width, 100);
      expect(r.left, 50);
    });

    test('degenerate sizes return full viewport', () {
      expect(fitImageRect(0, 0, 200, 200), const Rect.fromLTWH(0, 0, 200, 200));
    });
  });

  group('floodFillAt (background-pocket fill) undo — bug found 2026-09-19', () {
    // A background-pocket fill (tapping a large enclosed area, e.g. the ring
    // between a medallion-style border and the canvas edge) went through
    // floodFillAt(), which mutated pixels directly WITHOUT ever pushing to the
    // undo stack — unlike fillRegion(), which does. Result: the fill was
    // visible on screen but Undo stayed permanently disabled right after it,
    // discovered live on-device (see reference-flutter-testing.md session log).
    CanvasState buildOpenCanvasState({required Color activeColor}) {
      const w = 4, h = 4;
      final orig = Uint8List(w * h * 4);
      for (var i = 0; i < w * h; i++) {
        orig[i * 4] = 255;
        orig[i * 4 + 1] = 255;
        orig[i * 4 + 2] = 255;
        orig[i * 4 + 3] = 255;
      }
      final pixelToRegion = Int32List(w * h); // all pixel -> region 0 (background)
      final wallMask = Uint8List(w * h); // all 0 = fully open pocket
      final detection = RegionDetectionResult(
        pixelToRegion: pixelToRegion,
        regions: const [Region(id: 0, centroid: Offset(1.5, 1.5), pixelCount: 16)],
        width: w,
        height: h,
        backgroundRegionId: 0,
        wallMask: wallMask,
      );
      return CanvasState(
        baseImage: null, // isReady/hasImage not exercised by floodFillAt itself
        originalRgba: orig,
        compositeRgba: Uint8List.fromList(orig),
        detection: detection,
        activeColor: activeColor,
      );
    }

    test('a background-pocket fill is undoable (composite pixels restored)', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final n = c.read(canvasProvider.notifier);

      n.state = buildOpenCanvasState(activeColor: Colors.blue);
      expect(c.read(canvasProvider).undoStack, isEmpty);

      await n.floodFillAt(const Offset(1, 1), const Size(4, 4));

      final afterFill = c.read(canvasProvider);
      // The whole 4x4 open pocket got flooded blue.
      final blueArgb = Colors.blue.toARGB32();
      expect(afterFill.compositeRgba![0], (blueArgb >> 16) & 0xFF);
      expect(afterFill.compositeRgba![1], (blueArgb >> 8) & 0xFF);
      expect(afterFill.compositeRgba![2], blueArgb & 0xFF);
      // The bug: this stayed empty before the fix, so Rückgängig never enabled.
      expect(afterFill.undoStack, hasLength(1));
      expect(afterFill.undoStack.single.op, CanvasOp.pixelFill);

      await n.undo();
      // undo() fires the pixel restore via unawaited() (mirrors the existing
      // fill-undo pattern's unawaited _applyRegionComposite) — pump the event
      // queue so that in-flight work lands before asserting on it.
      await pumpEventQueue();

      final afterUndo = c.read(canvasProvider);
      expect(afterUndo.undoStack, isEmpty);
      // Pixels restored to the original white.
      expect(afterUndo.compositeRgba![0], 255);
      expect(afterUndo.compositeRgba![1], 255);
      expect(afterUndo.compositeRgba![2], 255);
      expect(afterUndo.compositeRgba![3], 255);
    });

    test('re-tapping an already-filled pocket with the same colour is a no-op (no undo spam)', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      final n = c.read(canvasProvider.notifier);

      n.state = buildOpenCanvasState(activeColor: Colors.blue);
      await n.floodFillAt(const Offset(1, 1), const Size(4, 4));
      expect(c.read(canvasProvider).undoStack, hasLength(1));

      await n.floodFillAt(const Offset(1, 1), const Size(4, 4));
      expect(c.read(canvasProvider).undoStack, hasLength(1));
    });
  });
}
