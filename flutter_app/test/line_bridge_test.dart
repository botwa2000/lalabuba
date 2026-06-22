import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/line_bridge.dart';
import 'package:lalabuba/features/canvas/trapped_ball.dart';

// Stage-2 endpoint bridging must do BOTH:
//   (A) seal a genuine collinear line BREAK so a fill no longer leaks across it;
//   (B) NOT join parallel groove tips (that would re-create the "can't colour"
//       over-seal). The facing test is what separates the two cases.

/// 4-connected flood over the free area — leaks through any unsealed gap.
Set<int> flood(Uint8List mask, int w, int h, int seed) {
  final seen = <int>{seed};
  final q = <int>[seed];
  while (q.isNotEmpty) {
    final i = q.removeLast();
    final x = i % w;
    void t(int nb) {
      if (nb >= 0 && nb < w * h && mask[nb] == 0 && seen.add(nb)) q.add(nb);
    }
    if (x > 0) t(i - 1);
    if (x < w - 1) t(i + 1);
    t(i - w);
    t(i + w);
  }
  return seen;
}

void main() {
  const w = 31, h = 31;
  int idx(int x, int y) => y * w + x;

  group('bridgeLineGaps (A) seals a collinear break', () {
    // Full border + vertical divider at x=15 with a 3-px break at y=14,15,16.
    Uint8List build() {
      final m = Uint8List(w * h);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          final border = x == 0 || y == 0 || x == w - 1 || y == h - 1;
          final divider = x == 15 && !(y >= 14 && y <= 16);
          m[idx(x, y)] = (border || divider) ? 1 : 0;
        }
      }
      return m;
    }

    test('before bridging the chambers are connected through the break', () {
      final m = build();
      final reached = flood(m, w, h, idx(7, 15)); // seed LEFT
      expect(reached.contains(idx(23, 15)), isTrue,
          reason: 'the 3px break lets the flood reach the RIGHT chamber');
    });

    test('after bridging the break is sealed and chambers are separate', () {
      final m = build();
      bridgeLineGaps(m, w, h, maxGap: 8);
      final reached = flood(m, w, h, idx(7, 15));
      expect(reached.contains(idx(23, 15)), isFalse,
          reason: 'the facing tips must be joined, sealing the break');
      // And the gap centre is now a wall.
      expect(m[idx(15, 15)], 1);
    });
  });

  group('bridgeLineGaps (B) does NOT join parallel groove tips', () {
    // Two horizontal groove lines (y=12 and y=16), each x=6..24, with their
    // left tips at (6,12)/(6,16) and right tips at (24,12)/(24,16) — 4px apart,
    // tangents horizontal. They must NOT be bridged vertically.
    Uint8List build() {
      final m = Uint8List(w * h);
      for (var x = 6; x <= 24; x++) {
        m[idx(x, 12)] = 1;
        m[idx(x, 16)] = 1;
      }
      return m;
    }

    test('the channel between the two grooves stays open (no over-seal)', () {
      final m = build();
      bridgeLineGaps(m, w, h, maxGap: 8);
      // No vertical wall was drawn between the parallel tips.
      expect(m[idx(6, 14)], 0, reason: 'left tips must not be joined');
      expect(m[idx(24, 14)], 0, reason: 'right tips must not be joined');
      // The groove channel (row y=14 between them) remains one connected strip.
      final reached = flood(m, w, h, idx(7, 14));
      expect(reached.contains(idx(23, 14)), isTrue,
          reason: 'the groove must stay a single fillable channel');
    });
  });

  group('zhangSuenThin', () {
    test('thins a thick bar to a 1-px skeleton', () {
      // A 5-px-tall horizontal bar → a single-row skeleton.
      final m = Uint8List(w * h);
      for (var y = 10; y <= 14; y++) {
        for (var x = 5; x <= 25; x++) {
          m[idx(x, y)] = 1;
        }
      }
      final skel = zhangSuenThin(m, w, h);
      // Each column in the bar's span keeps at most one skeleton pixel.
      for (var x = 8; x <= 22; x++) {
        var col = 0;
        for (var y = 10; y <= 14; y++) {
          col += skel[idx(x, y)];
        }
        expect(col, lessThanOrEqualTo(1), reason: 'column $x not thinned to 1px');
      }
    });
  });

  group('full pipeline: bridged break does not leak under trapped-ball', () {
    test('trapped-ball labels the two chambers separately after bridging', () {
      final m = Uint8List(w * h);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          final border = x == 0 || y == 0 || x == w - 1 || y == h - 1;
          final divider = x == 15 && !(y >= 14 && y <= 16);
          m[idx(x, y)] = (border || divider) ? 1 : 0;
        }
      }
      bridgeLineGaps(m, w, h, maxGap: 8);
      final label = trappedBallSegment(m, w, h, radii: const [1]);
      expect(label[idx(7, 15)] >= 0, isTrue);
      expect(label[idx(23, 15)] >= 0, isTrue);
      expect(label[idx(7, 15)] == label[idx(23, 15)], isFalse,
          reason: 'even radius-1 balls keep the chambers apart once bridged');
    });
  });
}
