import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/canvas/trapped_ball.dart';

// These tests encode the two failure modes behind the recurring "colours not
// clean" reports, so neither can silently regress again:
//   (A) LEAK — a gap in the line art lets a fill escape into the neighbouring
//       region ("colours mixing in the same area"). A plain flood-fill leaks;
//       trapped-ball must NOT.
//   (B) SEALED THIN REGION — a narrow region gets swallowed/closed so it can't be
//       coloured ("areas that can't be tapped"). A single large erosion radius
//       empties it; trapped-ball (down to r=1) must keep it a fillable region.

/// Plain 4-connected flood fill over the free area (outline==0) — the naive
/// behaviour that LEAKS through gaps. Used to demonstrate the failure that
/// trapped-ball fixes.
Set<int> naiveFlood(Uint8List outline, int w, int h, int seed) {
  final seen = <int>{};
  final q = <int>[seed];
  seen.add(seed);
  while (q.isNotEmpty) {
    final i = q.removeLast();
    final x = i % w;
    void tryN(int nb) {
      if (nb >= 0 && nb < w * h && outline[nb] == 0 && seen.add(nb)) q.add(nb);
    }
    if (x > 0) tryN(i - 1);
    if (x < w - 1) tryN(i + 1);
    tryN(i - w);
    tryN(i + w);
  }
  return seen;
}

void main() {
  group('trapped-ball: leak resistance (A)', () {
    // 21×11 with a full border, a vertical divider at x=10, and a 1px GAP in the
    // divider at y=5 connecting the two chambers.
    const w = 21, h = 11;
    Uint8List buildGapped() {
      final m = Uint8List(w * h);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          final border = x == 0 || y == 0 || x == w - 1 || y == h - 1;
          final divider = x == 10 && y != 5; // gap at y==5
          m[y * w + x] = (border || divider) ? 1 : 0;
        }
      }
      return m;
    }

    int idx(int x, int y) => y * w + x;

    test('a plain flood-fill LEAKS through the gap (reproduces the bug)', () {
      final m = buildGapped();
      final filled = naiveFlood(m, w, h, idx(5, 5)); // seed in LEFT chamber
      // The naive fill reaches the RIGHT chamber through the 1px gap — the leak.
      expect(filled.contains(idx(15, 5)), isTrue,
          reason: 'naive flood leaks into the right chamber (the bug)');
    });

    test('trapped-ball keeps the two chambers SEPARATE (fixes the leak)', () {
      final m = buildGapped();
      final label = trappedBallSegment(m, w, h, radii: const [2, 1]);
      final left = label[idx(5, 5)];
      final right = label[idx(15, 5)];
      expect(left >= 0, isTrue);
      expect(right >= 0, isTrue);
      expect(left == right, isFalse,
          reason: 'left and right chambers must get DIFFERENT region ids');
    });

    test('every free pixel still gets a region (no uncolourable holes)', () {
      final m = buildGapped();
      final label = trappedBallSegment(m, w, h, radii: const [2, 1]);
      for (var i = 0; i < w * h; i++) {
        if (m[i] == 0) {
          expect(label[i] >= 0, isTrue, reason: 'free pixel $i must be owned');
        }
      }
    });
  });

  group('trapped-ball: thin regions stay fillable (B)', () {
    // 21×11 with a border and two horizontal walls (y=3, y=7) carving a 3px-wide
    // corridor (rows y=4,5,6) between an upper and lower chamber.
    const w = 21, h = 11;
    Uint8List buildCorridor() {
      final m = Uint8List(w * h);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          final border = x == 0 || y == 0 || x == w - 1 || y == h - 1;
          final wall = (y == 3 || y == 7) && x > 0 && x < w - 1;
          m[y * w + x] = (border || wall) ? 1 : 0;
        }
      }
      return m;
    }

    int idx(int x, int y) => y * w + x;

    test('a single large erosion radius EMPTIES the 3px corridor (the cause)',
        () {
      final m = buildCorridor();
      final dist = Int32List(w * h);
      chebyshevDistance(m, w, h, dist);
      // Deepest pixel in the corridor is only 2 from a wall, so eroding by r>=2
      // (let alone the old close radius ~8) leaves NO core — the corridor would
      // vanish. That is exactly why a single big radius sealed thin regions.
      var maxInCorridor = 0;
      for (var x = 1; x < w - 1; x++) {
        for (final y in [4, 5, 6]) {
          if (dist[idx(x, y)] > maxInCorridor) maxInCorridor = dist[idx(x, y)];
        }
      }
      expect(maxInCorridor, lessThanOrEqualTo(2));
    });

    test('trapped-ball keeps the corridor as ONE fillable region', () {
      final m = buildCorridor();
      final label = trappedBallSegment(m, w, h, radii: const [2, 1]);
      final mid = label[idx(10, 5)];
      expect(mid >= 0, isTrue, reason: 'corridor must be a fillable region');
      // The whole corridor centre row shares that id...
      for (var x = 2; x < w - 2; x++) {
        expect(label[idx(x, 5)], mid,
            reason: 'corridor must be one contiguous region');
      }
      // ...and it is distinct from the upper and lower chambers.
      expect(label[idx(10, 1)] == mid, isFalse);
      expect(label[idx(10, 9)] == mid, isFalse);
    });
  });

  group('ballRadiiFor', () {
    test('descending, ends at 1, scales with size', () {
      final big = ballRadiiFor(1024, 1024);
      expect(big.first, greaterThan(1));
      expect(big.last, 1);
      for (var i = 1; i < big.length; i++) {
        expect(big[i] < big[i - 1], isTrue);
      }
      // tiny images still yield a sane sequence ending at 1
      expect(ballRadiiFor(40, 40).last, 1);
    });
  });
}
