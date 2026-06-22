import 'dart:typed_data';

/// Multi-radius **trapped-ball segmentation** for line-art region detection.
///
/// This replaces the single fixed-radius morphological *close* the detector used
/// before. That approach had a structural flaw the recurring "colours not clean"
/// bugs came from: ONE radius cannot be both large enough to seal big gaps in the
/// line art (or the fill leaks into the neighbour → "colours mixing") AND small
/// enough to keep thin regions open (or they get sealed shut → "can't colour this
/// area"). Re-tuning that single radius only ever traded one symptom for the other.
///
/// Trapped-ball (the standard technique in anime/manga colourisation, e.g.
/// hepesu/LineFiller and the 2024 ACM paper "Fast Leak-Resistant Segmentation for
/// Anime Line Art") rolls balls of DECREASING radius:
///   • a LARGE ball fills big areas but is physically *trapped* — it cannot pass
///     through a gap narrower than its diameter, so big regions never leak;
///   • progressively SMALLER balls then fill the narrow regions the big ball
///     could not enter;
///   • a final plain flood-fill (radius 0) mops up whatever is left.
/// Because each region uses the largest ball that still fits, big gaps are sealed
/// AND thin regions stay fillable — both symptoms are fixed at once instead of
/// being traded.
///
/// Implementation: a "ball of radius r" erosion is a Chebyshev (square) distance
/// threshold `dist > r` — cheap and good enough for trapping (the exact disk shape
/// barely matters). Per radius we: distance-transform the still-unfilled free
/// area, take its eroded *cores* (dist > r), label each core's connected component,
/// then grow those cores back out by up to r layers (multi-source BFS, first-come)
/// — restoring region size but stopping at the severed necks/gaps, which is what
/// cuts a leak into a clean boundary.
///
/// Input  : [outlineMask] with 1 = wall/line, 0 = free (fillable). w*h length.
/// Output : Int32List labels — -2 = wall/line (unassigned), 0.. = region ids.
///          Every FREE pixel gets a region; walls stay -2 for the caller's
///          watershed/line-overlay step.
Int32List trappedBallSegment(
  Uint8List outlineMask,
  int w,
  int h, {
  List<int>? radii,
}) {
  final n = w * h;
  final label = Int32List(n);
  for (var i = 0; i < n; i++) {
    label[i] = outlineMask[i] == 1 ? -2 : -1; // -2 wall, -1 free-unassigned
  }
  final work = Uint8List(n); // 1 = free AND still unassigned
  for (var i = 0; i < n; i++) {
    work[i] = label[i] == -1 ? 1 : 0;
  }

  final rads = radii ?? ballRadiiFor(w, h);
  final dist = Int32List(n);
  final q = Int32List(n);
  final layer = Int32List(n);
  var nextId = 0;

  void labelCore(int s, int r) {
    var head = 0, tail = 0;
    q[tail++] = s;
    label[s] = nextId;
    while (head < tail) {
      final i = q[head++];
      final x = i % w;
      if (x > 0) {
        final nb = i - 1;
        if (work[nb] == 1 && label[nb] == -1 && dist[nb] > r) {
          label[nb] = nextId;
          q[tail++] = nb;
        }
      }
      if (x < w - 1) {
        final nb = i + 1;
        if (work[nb] == 1 && label[nb] == -1 && dist[nb] > r) {
          label[nb] = nextId;
          q[tail++] = nb;
        }
      }
      if (i - w >= 0) {
        final nb = i - w;
        if (work[nb] == 1 && label[nb] == -1 && dist[nb] > r) {
          label[nb] = nextId;
          q[tail++] = nb;
        }
      }
      if (i + w < n) {
        final nb = i + w;
        if (work[nb] == 1 && label[nb] == -1 && dist[nb] > r) {
          label[nb] = nextId;
          q[tail++] = nb;
        }
      }
    }
    nextId++;
  }

  // Grow every labelled core back into the still-unfilled free area by up to [r]
  // layers. Multi-source BFS seeded from all labelled pixels touching an
  // unassigned free pixel; first label to arrive wins, so two cores that were
  // split at a gap meet at a midline boundary rather than re-merging.
  void boundedGrow(int r) {
    var head = 0, tail = 0;
    for (var i = 0; i < n; i++) {
      if (label[i] < 0) continue;
      final x = i % w;
      var adj = false;
      if (x > 0 && label[i - 1] == -1 && work[i - 1] == 1) {
        adj = true;
      } else if (x < w - 1 && label[i + 1] == -1 && work[i + 1] == 1) {
        adj = true;
      } else if (i - w >= 0 && label[i - w] == -1 && work[i - w] == 1) {
        adj = true;
      } else if (i + w < n && label[i + w] == -1 && work[i + w] == 1) {
        adj = true;
      }
      if (adj) {
        q[tail++] = i;
        layer[i] = 0;
      }
    }
    while (head < tail) {
      final i = q[head++];
      final d = layer[i];
      if (d >= r) continue;
      final id = label[i];
      final x = i % w;
      if (x > 0) {
        final nb = i - 1;
        if (label[nb] == -1 && work[nb] == 1) {
          label[nb] = id;
          layer[nb] = d + 1;
          q[tail++] = nb;
        }
      }
      if (x < w - 1) {
        final nb = i + 1;
        if (label[nb] == -1 && work[nb] == 1) {
          label[nb] = id;
          layer[nb] = d + 1;
          q[tail++] = nb;
        }
      }
      if (i - w >= 0) {
        final nb = i - w;
        if (label[nb] == -1 && work[nb] == 1) {
          label[nb] = id;
          layer[nb] = d + 1;
          q[tail++] = nb;
        }
      }
      if (i + w < n) {
        final nb = i + w;
        if (label[nb] == -1 && work[nb] == 1) {
          label[nb] = id;
          layer[nb] = d + 1;
          q[tail++] = nb;
        }
      }
    }
  }

  for (final r in rads) {
    if (r <= 0) continue;
    chebyshevDistance(work, w, h, dist);
    for (var s = 0; s < n; s++) {
      if (work[s] == 1 && label[s] == -1 && dist[s] > r) {
        labelCore(s, r);
      }
    }
    boundedGrow(r);
    for (var i = 0; i < n; i++) {
      if (label[i] >= 0) work[i] = 0;
    }
  }

  // Absorb leftover thin rim pixels (≤2px strips the smallest ball couldn't seed)
  // into the NEAREST EXISTING region via an unlimited multi-source BFS — instead
  // of spawning a brand-new region per strip. Spawning rim regions over-segments
  // the background into slivers, which (a) makes "which region is the background"
  // ambiguous downstream and (b) needlessly multiplies regions. A genuine thin
  // region ≥3px wide already got its own core at r=1, so it is NOT a leftover and
  // is preserved here.
  {
    var head = 0, tail = 0;
    for (var i = 0; i < n; i++) {
      if (label[i] >= 0) q[tail++] = i;
    }
    while (head < tail) {
      final i = q[head++];
      final id = label[i];
      final x = i % w;
      if (x > 0) {
        final nb = i - 1;
        if (label[nb] == -1) {
          label[nb] = id;
          q[tail++] = nb;
        }
      }
      if (x < w - 1) {
        final nb = i + 1;
        if (label[nb] == -1) {
          label[nb] = id;
          q[tail++] = nb;
        }
      }
      if (i - w >= 0) {
        final nb = i - w;
        if (label[nb] == -1) {
          label[nb] = id;
          q[tail++] = nb;
        }
      }
      if (i + w < n) {
        final nb = i + w;
        if (label[nb] == -1) {
          label[nb] = id;
          q[tail++] = nb;
        }
      }
    }
  }

  // Fallback: if no region was ever seeded (e.g. an all-thin image), flood-fill
  // any remaining free pixels into fresh regions so nothing is left unassigned.
  for (var s = 0; s < n; s++) {
    if (label[s] != -1) continue;
    var head = 0, tail = 0;
    q[tail++] = s;
    label[s] = nextId;
    while (head < tail) {
      final i = q[head++];
      final x = i % w;
      if (x > 0) {
        final nb = i - 1;
        if (label[nb] == -1) {
          label[nb] = nextId;
          q[tail++] = nb;
        }
      }
      if (x < w - 1) {
        final nb = i + 1;
        if (label[nb] == -1) {
          label[nb] = nextId;
          q[tail++] = nb;
        }
      }
      if (i - w >= 0) {
        final nb = i - w;
        if (label[nb] == -1) {
          label[nb] = nextId;
          q[tail++] = nb;
        }
      }
      if (i + w < n) {
        final nb = i + w;
        if (label[nb] == -1) {
          label[nb] = nextId;
          q[tail++] = nb;
        }
      }
    }
    nextId++;
  }

  return label;
}

/// Descending ball radii for an image of size w×h. The largest seals the biggest
/// expected gaps in the line art (scaled to image size); the run down to 1 keeps
/// thin regions fillable. Clamped so tiny test images still get a sane sequence.
List<int> ballRadiiFor(int w, int h) {
  final short = w < h ? w : h;
  var maxR = short ~/ 200; // ~0.5% of the short side
  if (maxR < 2) maxR = 2;
  if (maxR > 7) maxR = 7;
  final rads = <int>[];
  var r = maxR;
  while (r > 1) {
    rads.add(r);
    r = (r * 2) ~/ 3; // 7→4→2 ; 5→3→2
  }
  rads.add(1);
  // dedupe while preserving descending order
  final seen = <int>{};
  return rads.where((e) => seen.add(e)).toList();
}

/// In-place Chebyshev (8-connected, unit-cost) distance transform of [src]:
/// dist[i] = number of steps from pixel i to the nearest src==0 pixel (0 where
/// src==0). Two-pass; O(w*h). Eroding [src] by a square ball of radius r is then
/// simply `dist > r`.
void chebyshevDistance(Uint8List src, int w, int h, Int32List dist) {
  final n = w * h;
  const inf = 1 << 29;
  for (var i = 0; i < n; i++) {
    dist[i] = src[i] == 0 ? 0 : inf;
  }
  // forward pass (top-left → bottom-right)
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      final i = y * w + x;
      if (dist[i] == 0) continue;
      var m = dist[i];
      if (x > 0 && dist[i - 1] + 1 < m) m = dist[i - 1] + 1;
      if (y > 0 && dist[i - w] + 1 < m) m = dist[i - w] + 1;
      if (x > 0 && y > 0 && dist[i - w - 1] + 1 < m) m = dist[i - w - 1] + 1;
      if (x < w - 1 && y > 0 && dist[i - w + 1] + 1 < m) m = dist[i - w + 1] + 1;
      dist[i] = m;
    }
  }
  // backward pass (bottom-right → top-left)
  for (var y = h - 1; y >= 0; y--) {
    for (var x = w - 1; x >= 0; x--) {
      final i = y * w + x;
      var m = dist[i];
      if (x < w - 1 && dist[i + 1] + 1 < m) m = dist[i + 1] + 1;
      if (y < h - 1 && dist[i + w] + 1 < m) m = dist[i + w] + 1;
      if (x < w - 1 && y < h - 1 && dist[i + w + 1] + 1 < m) m = dist[i + w + 1] + 1;
      if (x > 0 && y < h - 1 && dist[i + w - 1] + 1 < m) m = dist[i + w - 1] + 1;
      dist[i] = m;
    }
  }
}
