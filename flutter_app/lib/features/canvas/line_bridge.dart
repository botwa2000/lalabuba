import 'dart:math' as math;
import 'dart:typed_data';

/// Stage-2 of the line-art precision stack: bridge genuine line BREAKS.
///
/// Hysteresis (buildOutlineMask) seals faint anti-aliased pin-gaps, but where an
/// artist actually leaves a real break in a boundary line — a tip that stops
/// short of the line it should meet — a fill still leaks across it (the residual
/// rear-belly bleed on the test whale). Trapped-ball can't help: the gap there
/// is as wide as the thin region beside it.
///
/// We close those breaks by finding the line TIPS and joining only tips that
/// FACE EACH OTHER across a short gap. The facing test is the safety guard: two
/// parallel groove lines have nearby tips, but their tangents are parallel (not
/// facing), so they are NOT bridged — which is what stops this from re-creating
/// the "can't colour" over-seal. Bridges are written to the segmentation mask
/// ONLY (not the visible line snapshot), so the two regions separate cleanly
/// while no fake ink is drawn across the gap.
///
/// [mask] is the wall mask (1 = wall, 0 = free); modified in place.
void bridgeLineGaps(
  Uint8List mask,
  int w,
  int h, {
  int? maxGap,
  double faceCos = 0.5, // cos 60° — how closely tips must face to bridge
  int tangentSteps = 4, // pixels walked back along a tip to estimate its heading
}) {
  final short = w < h ? w : h;
  final gap = maxGap ?? (short ~/ 100).clamp(4, 24);
  if (gap < 2) return;

  final skel = zhangSuenThin(mask, w, h);

  // Endpoints = skeleton pixels with exactly one skeleton neighbour (8-conn).
  final tips = <int>[];
  for (var i = 0; i < w * h; i++) {
    if (skel[i] == 0) continue;
    if (_skelNeighbourCount(skel, i, w, h) == 1) tips.add(i);
  }
  if (tips.length < 2) return;

  // Outgoing heading of each tip: from a point [tangentSteps] back along the
  // skeleton toward the tip (the direction the line "wants to continue").
  final dirX = List<double>.filled(tips.length, 0);
  final dirY = List<double>.filled(tips.length, 0);
  for (var t = 0; t < tips.length; t++) {
    final back = _walkBack(skel, tips[t], w, h, tangentSteps);
    final ex = tips[t] % w, ey = tips[t] ~/ w;
    final bx = back % w, by = back ~/ w;
    var vx = (ex - bx).toDouble(), vy = (ey - by).toDouble();
    final len = math.sqrt(vx * vx + vy * vy);
    if (len > 0) { vx /= len; vy /= len; }
    dirX[t] = vx;
    dirY[t] = vy;
  }

  // Greedy nearest-facing pairing: each tip bridges to its closest still-free
  // facing partner within [gap]. One bridge per tip keeps it conservative.
  final used = List<bool>.filled(tips.length, false);
  final gap2 = gap * gap;
  for (var a = 0; a < tips.length; a++) {
    if (used[a]) continue;
    final ax = tips[a] % w, ay = tips[a] ~/ w;
    var best = -1;
    var bestD2 = (gap2 + 1).toDouble();
    for (var b = 0; b < tips.length; b++) {
      if (b == a || used[b]) continue;
      final bx = tips[b] % w, by = tips[b] ~/ w;
      final dx = (bx - ax).toDouble(), dy = (by - ay).toDouble();
      final d2 = (dx * dx + dy * dy);
      if (d2 < 1 || d2 > gap2 || d2 >= bestD2) continue;
      final glen = math.sqrt(d2);
      final gx = dx / glen, gy = dy / glen;
      // a's heading must point toward b, and b's heading back toward a.
      if (dirX[a] * gx + dirY[a] * gy < faceCos) continue;
      if (dirX[b] * -gx + dirY[b] * -gy < faceCos) continue;
      best = b;
      bestD2 = d2;
    }
    if (best >= 0) {
      _draw4ConnectedLine(mask, ax, ay, tips[best] % w, tips[best] ~/ w, w, h);
      used[a] = true;
      used[best] = true;
    }
  }
}

int _skelNeighbourCount(Uint8List skel, int i, int w, int h) {
  final x = i % w, y = i ~/ w;
  var c = 0;
  for (var dy = -1; dy <= 1; dy++) {
    final ny = y + dy;
    if (ny < 0 || ny >= h) continue;
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) continue;
      final nx = x + dx;
      if (nx < 0 || nx >= w) continue;
      if (skel[ny * w + nx] == 1) c++;
    }
  }
  return c;
}

// Walk up to [steps] pixels back along a skeleton starting at an endpoint,
// following the single thread (stop at a branch). Returns the reached pixel.
int _walkBack(Uint8List skel, int endpoint, int w, int h, int steps) {
  var prev = -1;
  var cur = endpoint;
  for (var s = 0; s < steps; s++) {
    final x = cur % w, y = cur ~/ w;
    var next = -1;
    var count = 0;
    for (var dy = -1; dy <= 1; dy++) {
      final ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      for (var dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) continue;
        final nx = x + dx;
        if (nx < 0 || nx >= w) continue;
        final ni = ny * w + nx;
        if (skel[ni] == 1 && ni != prev) { next = ni; count++; }
      }
    }
    if (next < 0 || count > 1) break; // dead end or branch
    prev = cur;
    cur = next;
  }
  return cur;
}

// Draw a 4-connected line (so it is a watertight barrier for the 4-connected
// region grower) from (x0,y0) to (x1,y1), setting mask pixels to wall.
void _draw4ConnectedLine(Uint8List mask, int x0, int y0, int x1, int y1, int w, int h) {
  var x = x0, y = y0;
  final dx = (x1 - x0).abs(), dy = (y1 - y0).abs();
  final sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  var err = dx - dy;
  while (true) {
    if (x >= 0 && x < w && y >= 0 && y < h) mask[y * w + x] = 1;
    if (x == x1 && y == y1) break;
    final e2 = 2 * err;
    // Step ONE axis per iteration so consecutive pixels stay 4-connected.
    if (e2 - dy > dx - e2) {
      err -= dy;
      x += sx;
    } else {
      err += dx;
      y += sy;
    }
  }
}

/// Zhang-Suen thinning: reduce a binary mask (1 = ink) to a 1-px skeleton.
/// Returns a new array; [src] is not modified.
Uint8List zhangSuenThin(Uint8List src, int w, int h) {
  final img = Uint8List.fromList(src);
  final toClear = <int>[];
  var changed = true;
  while (changed) {
    changed = false;
    for (var step = 0; step < 2; step++) {
      toClear.clear();
      for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          final i = y * w + x;
          if (img[i] == 0) continue;
          final p2 = img[i - w];
          final p3 = img[i - w + 1];
          final p4 = img[i + 1];
          final p5 = img[i + w + 1];
          final p6 = img[i + w];
          final p7 = img[i + w - 1];
          final p8 = img[i - 1];
          final p9 = img[i - w - 1];
          final b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          // A = number of 0→1 transitions in the ordered sequence p2..p9,p2.
          var a = 0;
          if (p2 == 0 && p3 == 1) a++;
          if (p3 == 0 && p4 == 1) a++;
          if (p4 == 0 && p5 == 1) a++;
          if (p5 == 0 && p6 == 1) a++;
          if (p6 == 0 && p7 == 1) a++;
          if (p7 == 0 && p8 == 1) a++;
          if (p8 == 0 && p9 == 1) a++;
          if (p9 == 0 && p2 == 1) a++;
          if (a != 1) continue;
          if (step == 0) {
            if (p2 * p4 * p6 != 0) continue;
            if (p4 * p6 * p8 != 0) continue;
          } else {
            if (p2 * p4 * p8 != 0) continue;
            if (p2 * p6 * p8 != 0) continue;
          }
          toClear.add(i);
        }
      }
      if (toClear.isNotEmpty) {
        changed = true;
        for (final i in toClear) {
          img[i] = 0;
        }
      }
    }
  }
  return img;
}
