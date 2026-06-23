import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';

/// Reproduces the reported gap: colouring WITHOUT numbers (free-colour mode, now
/// the default) gave the child no logical finish and no reward, because the old
/// isComplete required regionColorMap to be matched by EXACT assigned colours and
/// returned false whenever numbers were off. These tests pin the new behaviour:
/// free mode completes at ~90% of the meaningful areas coloured with ANY colour
/// (by a tap-fill OR by enough freehand coverage), while guided colour-by-number
/// stays strict.
void main() {
  // 10 meaningful (would-be-numbered) areas, each assigned red in guided mode.
  Map<int, Color> targets([int n = 10]) =>
      {for (var i = 0; i < n; i++) i: const Color(0xFFFF0000)};

  group('guided (colour-by-number) completion is strict', () {
    test('not complete until EVERY area has its EXACT assigned colour', () {
      final s = CanvasState(
        regionColorMap: targets(),
        regionColors: {
          for (var i = 0; i < 9; i++) i: const Color(0xFFFF0000),
          9: const Color(0xFF00FF00), // wrong colour on the last area
        },
      );
      expect(s.isComplete, isFalse);
    });

    test('complete when all ten match exactly', () {
      final s = CanvasState(
        regionColorMap: targets(),
        regionColors: {for (var i = 0; i < 10; i++) i: const Color(0xFFFF0000)},
      );
      expect(s.isComplete, isTrue);
    });

    test('the OLD bug: free-colour page never finished (now fixed)', () {
      // Same fills, but in free mode any colour counts → it WOULD finish.
      final fills = {for (var i = 0; i < 10; i++) i: const Color(0xFF123456)};
      expect(CanvasState(regionColorMap: targets(), regionColors: fills)
              .isComplete,
          isFalse,
          reason: 'guided mode rejects non-assigned colours');
      expect(CanvasState(
                  regionColorMap: targets(),
                  regionColors: fills,
                  isFreeMode: true)
              .isComplete,
          isTrue,
          reason: 'free mode accepts any colour');
    });
  });

  group('free-colour completion is forgiving (~90%, self-scaling)', () {
    test('any colour counts, and 9/10 (90%) is enough to finish', () {
      final s = CanvasState(
        regionColorMap: targets(),
        isFreeMode: true,
        regionColors: {
          for (var i = 0; i < 9; i++) i: const Color(0xFF0000FF), // wrong-by-CBN
        },
      );
      expect(s.colouredTargetCount, 9);
      expect(s.isComplete, isTrue,
          reason: 'a single missed sliver must not block the reward');
    });

    test('8/10 (80%) is NOT yet complete', () {
      final s = CanvasState(
        regionColorMap: targets(),
        isFreeMode: true,
        regionColors: {for (var i = 0; i < 8; i++) i: const Color(0xFF0000FF)},
      );
      expect(s.isComplete, isFalse);
    });

    test('freehand coverage counts toward completion (uneven pencil colouring)',
        () {
      // 5 areas tap-filled, 4 more reached the coverage threshold via strokes,
      // 1 left untouched → 9/10 → complete. Models a child who pencils unevenly.
      final s = CanvasState(
        regionColorMap: targets(),
        isFreeMode: true,
        regionColors: {for (var i = 0; i < 5; i++) i: const Color(0xFF0000FF)},
        coveredRegions: {5, 6, 7, 8},
      );
      expect(s.colouredTargetCount, 9);
      expect(s.isComplete, isTrue);
    });

    test('Easy (few areas) effectively needs all of them', () {
      // 6 areas → ceil(0.9*6)=6 → all required, which is achievable when big.
      final six = targets(6);
      final five = CanvasState(
        regionColorMap: six,
        isFreeMode: true,
        regionColors: {for (var i = 0; i < 5; i++) i: const Color(0xFF0000FF)},
      );
      expect(five.isComplete, isFalse);
      final all = CanvasState(
        regionColorMap: six,
        isFreeMode: true,
        regionColors: {for (var i = 0; i < 6; i++) i: const Color(0xFF0000FF)},
      );
      expect(all.isComplete, isTrue);
    });
  });

  group('manual "I\'m finished" gating', () {
    test('untouched page has no meaningful progress', () {
      expect(
          const CanvasState(isFreeMode: true).hasMeaningfulProgress, isFalse);
      expect(
          CanvasState(regionColorMap: targets(), isFreeMode: true)
              .hasMeaningfulProgress,
          isFalse);
    });

    test('one fill OR one covered area is enough to enable the button', () {
      expect(
          CanvasState(
                  regionColorMap: targets(),
                  isFreeMode: true,
                  regionColors: {0: const Color(0xFF0000FF)})
              .hasMeaningfulProgress,
          isTrue);
      expect(
          CanvasState(
                  regionColorMap: targets(),
                  isFreeMode: true,
                  coveredRegions: {3})
              .hasMeaningfulProgress,
          isTrue);
    });
  });

  test('no regions at all never auto-completes', () {
    expect(const CanvasState(isFreeMode: true).isComplete, isFalse);
  });
}
