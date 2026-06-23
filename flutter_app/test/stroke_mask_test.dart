import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/stroke_mask.dart';

/// Masked "stay-in-the-lines" freehand decision (parity with the web twin
/// completion-core.freehandKeepsPaint). The safety guard mirrors the segmentation
/// work: never trap the child — a stroke begun on a line disables the clamp.
void main() {
  group('freehandKeepsPaint', () {
    test('never paints on a black line, in either mode', () {
      expect(
          freehandKeepsPaint(
              onLine: true, region: 5, startRegion: 5, assist: false),
          isFalse);
      expect(
          freehandKeepsPaint(
              onLine: true, region: 5, startRegion: 5, assist: true),
          isFalse);
    });

    test('free mode (no assist): any non-line area is paintable', () {
      expect(
          freehandKeepsPaint(
              onLine: false, region: 9, startRegion: 5, assist: false),
          isTrue);
    });

    test('assist clamps paint to the shape the stroke began in', () {
      expect(
          freehandKeepsPaint(
              onLine: false, region: 5, startRegion: 5, assist: true),
          isTrue,
          reason: 'same shape stays');
      expect(
          freehandKeepsPaint(
              onLine: false, region: 6, startRegion: 5, assist: true),
          isFalse,
          reason: 'crossed into a neighbour → wiped');
    });

    test('began on a line (startRegion<0) → clamp disabled (never trapped)', () {
      expect(
          freehandKeepsPaint(
              onLine: false, region: 6, startRegion: -1, assist: true),
          isTrue);
    });
  });

  group('maskAssistFor', () {
    test('on for the gentle levels, off for the rest', () {
      expect(maskAssistFor('easy'), isTrue);
      expect(maskAssistFor('medium'), isTrue);
      expect(maskAssistFor('hard'), isFalse);
      expect(maskAssistFor('extreme'), isFalse);
      expect(maskAssistFor(null), isFalse);
    });
  });
}
