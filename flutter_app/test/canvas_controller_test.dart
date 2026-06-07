import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lalabuba/features/canvas/canvas_controller.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';

void main() {
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
}
