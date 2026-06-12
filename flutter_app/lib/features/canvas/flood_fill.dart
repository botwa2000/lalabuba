import 'dart:isolate';
import 'dart:typed_data';
import 'dart:ui' show Offset;
import 'canvas_models.dart';

// Entry point for the region detection isolate
void regionDetectIsolate(SendPort sendPort) {
  final recv = ReceivePort();
  sendPort.send(recv.sendPort);

  recv.listen((msg) {
    if (msg is RegionDetectParams) {
      final result = detectRegions(msg);
      sendPort.send(result);
    }
  });
}

RegionDetectionResult detectRegions(RegionDetectParams params) {
  final pixels = params.rgbaBytes;
  final w = params.width;
  final h = params.height;
  final minArea = params.minArea;
  final palette = params.paletteArgb;

  // ── 1. Build outline mask: brightness < 100 → outline (1), else fillable (0) ──
  final outlineMask = Uint8List(w * h);
  for (var i = 0; i < w * h; i++) {
    final r = pixels[i * 4];
    final g = pixels[i * 4 + 1];
    final b = pixels[i * 4 + 2];
    final br = (r + g + b) ~/ 3;
    outlineMask[i] = br < 100 ? 1 : 0;
  }

  // ── 2. Morphological closing (6 dilate + 6 erode) using ping-pong buffers ──
  // This bridges genuine gaps in outlines and prevents open-area bleed.
  final bufA = Uint8List.fromList(outlineMask);
  final bufB = Uint8List(w * h);

  // Dilate 8 passes
  Uint8List cur = bufA;
  Uint8List nxt = bufB;
  for (var pass = 0; pass < 8; pass++) {
    nxt.setAll(0, cur); // copy cur → nxt
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        final i = y * w + x;
        if (cur[i] == 0) {
          if (cur[i - 1] == 1 ||
              cur[i + 1] == 1 ||
              cur[i - w] == 1 ||
              cur[i + w] == 1) {
            nxt[i] = 1;
          }
        }
      }
    }
    // swap
    final tmp = cur;
    cur = nxt;
    nxt = tmp;
  }

  // Erode 8 passes
  for (var pass = 0; pass < 8; pass++) {
    nxt.setAll(0, cur); // copy cur → nxt
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        final i = y * w + x;
        if (cur[i] == 1) {
          if (cur[i - 1] == 0 ||
              cur[i + 1] == 0 ||
              cur[i - w] == 0 ||
              cur[i + w] == 0) {
            nxt[i] = 0;
          }
        }
      }
    }
    final tmp = cur;
    cur = nxt;
    nxt = tmp;
  }

  // cur now holds the morphologically closed outline mask
  // Copy back into outlineMask
  outlineMask.setAll(0, cur);

  // ── 3. Virtual sealed frame: mark outermost row/col as outline ──
  // This closes any regions that are open at the image boundary.
  for (var x = 0; x < w; x++) {
    outlineMask[x] = 1;           // top row
    outlineMask[(h - 1) * w + x] = 1; // bottom row
  }
  for (var y = 0; y < h; y++) {
    outlineMask[y * w] = 1;       // left col
    outlineMask[y * w + (w - 1)] = 1; // right col
  }

  // ── 4. BFS region detection ──
  // pixelToRegion: -1 = unvisited, -2 = outline, regionId >= 0 (tentative).
  // Unlike before we keep EVERY region (even sub-minArea ones) labelled with a
  // tentative id; small regions are merged into their enclosing region in step
  // 4b rather than discarded to -2. Discarding them left tiny white specks: a
  // speck sits inside its own dark outline ring, and the composite bleed stops
  // at that dark ring, so the speck interior could never be coloured.
  final pixelToRegion = Int32List(w * h);
  for (var i = 0; i < w * h; i++) {
    pixelToRegion[i] = outlineMask[i] == 1 ? -2 : -1;
  }

  // Use a pre-allocated Int32List as a BFS queue to avoid Dart List GC pressure
  final bfsQueue = Int32List(w * h);

  // Per-tentative-region accumulators (index = tentative id).
  final tentCount = <int>[];
  final tentSumX = <int>[];
  final tentSumY = <int>[];
  var nextId = 0;

  for (var startIdx = 0; startIdx < w * h; startIdx++) {
    if (pixelToRegion[startIdx] != -1) continue;

    // BFS
    var head = 0;
    var tail = 0;
    bfsQueue[tail++] = startIdx;
    pixelToRegion[startIdx] = nextId; // tentative region id

    var sumX = 0;
    var sumY = 0;
    var count = 0;

    while (head < tail) {
      final idx = bfsQueue[head++];
      final x = idx % w;
      final y = idx ~/ w;
      sumX += x;
      sumY += y;
      count++;

      // 4-connected neighbors
      if (x > 0) {
        final n = idx - 1;
        if (pixelToRegion[n] == -1) {
          pixelToRegion[n] = nextId;
          bfsQueue[tail++] = n;
        }
      }
      if (x < w - 1) {
        final n = idx + 1;
        if (pixelToRegion[n] == -1) {
          pixelToRegion[n] = nextId;
          bfsQueue[tail++] = n;
        }
      }
      if (y > 0) {
        final n = idx - w;
        if (pixelToRegion[n] == -1) {
          pixelToRegion[n] = nextId;
          bfsQueue[tail++] = n;
        }
      }
      if (y < h - 1) {
        final n = idx + w;
        if (pixelToRegion[n] == -1) {
          pixelToRegion[n] = nextId;
          bfsQueue[tail++] = n;
        }
      }
    }

    tentCount.add(count);
    tentSumX.add(sumX);
    tentSumY.add(sumY);
    nextId++;
  }

  // Identify the outer background tentative region (corner sample, just inside
  // the virtual frame) BEFORE merging. Small shapes that merely SIT ON the
  // background must not be dissolved into it (see promotion in 4b) — otherwise
  // they take the background's id and become impossible to colour.
  var bgTentId = -1;
  bgScan:
  for (var dy = 1; dy <= 4; dy++) {
    for (var dx = 1; dx <= 4; dx++) {
      final v = pixelToRegion[dy * w + dx];
      if (v >= 0) {
        bgTentId = v;
        break bgScan;
      }
    }
  }

  // ── 4b. Merge sub-minArea regions into the enclosing kept region ──
  // kept = region big enough to stand on its own and be colour-by-numbered.
  final kept = List<bool>.generate(nextId, (i) => tentCount[i] >= minArea);

  // nearestKept[i]: for every NON-kept pixel (outline -2 and small-region
  // pixels alike) the tentative id of the nearest KEPT region, by 4-connected
  // BFS distance. Seeded from non-kept pixels that touch a kept region and
  // expanded only through other non-kept pixels — so it flows across the dark
  // ring around a speck and reaches the big region that surrounds it.
  bool isKeptPixel(int i) {
    final r = pixelToRegion[i];
    return r >= 0 && kept[r];
  }

  final nearestKept = Int32List(w * h)..fillRange(0, w * h, -1);
  final nq = Int32List(w * h);
  var nqHead = 0, nqTail = 0;
  for (var i = 0; i < w * h; i++) {
    if (isKeptPixel(i)) continue;
    final x = i % w, y = i ~/ w;
    int? seed;
    if (x > 0 && isKeptPixel(i - 1)) {
      seed = pixelToRegion[i - 1];
    } else if (x < w - 1 && isKeptPixel(i + 1)) {
      seed = pixelToRegion[i + 1];
    } else if (y > 0 && isKeptPixel(i - w)) {
      seed = pixelToRegion[i - w];
    } else if (y < h - 1 && isKeptPixel(i + w)) {
      seed = pixelToRegion[i + w];
    }
    if (seed != null) {
      nearestKept[i] = seed;
      nq[nqTail++] = i;
    }
  }
  while (nqHead < nqTail) {
    final i = nq[nqHead++];
    final id = nearestKept[i];
    final x = i % w, y = i ~/ w;
    if (x > 0)     { final n = i - 1; if (!isKeptPixel(n) && nearestKept[n] == -1) { nearestKept[n] = id; nq[nqTail++] = n; } }
    if (x < w - 1) { final n = i + 1; if (!isKeptPixel(n) && nearestKept[n] == -1) { nearestKept[n] = id; nq[nqTail++] = n; } }
    if (y > 0)     { final n = i - w; if (!isKeptPixel(n) && nearestKept[n] == -1) { nearestKept[n] = id; nq[nqTail++] = n; } }
    if (y < h - 1) { final n = i + w; if (!isKeptPixel(n) && nearestKept[n] == -1) { nearestKept[n] = id; nq[nqTail++] = n; } }
  }

  // Each small region adopts the nearest kept region (majority vote across its
  // own pixels). A speck enclosed by a coloured region adopts that colour; a
  // speck in the background adopts the background and stays uncoloured.
  final mergeTo = List<int>.generate(nextId, (i) => i); // kept → itself
  final votes = <int, Map<int, int>>{}; // smallId → {keptId: pixelVotes}
  for (var i = 0; i < w * h; i++) {
    final r = pixelToRegion[i];
    if (r < 0 || kept[r]) continue;
    final nk = nearestKept[i];
    if (nk < 0) continue;
    (votes[r] ??= <int, int>{}).update(nk, (v) => v + 1, ifAbsent: () => 1);
  }
  for (var s = 0; s < nextId; s++) {
    if (kept[s]) continue;
    final v = votes[s];
    if (v == null || v.isEmpty) {
      mergeTo[s] = -2; // isolated speck with no kept neighbour → outline
      continue;
    }
    var best = -1, bestVotes = -1;
    v.forEach((keptId, n) {
      if (n > bestVotes) { bestVotes = n; best = keptId; }
    });
    mergeTo[s] = best;
  }

  // Promote sizeable shapes that merely sit ON the outer background into their
  // own free-fill regions instead of dissolving them into the (uncolourable)
  // background. A child must be able to colour small details — toes, teeth, tiny
  // spikes, gaps between limbs — that fall below minArea; absorbing them into the
  // background made them un-tappable ("can't colour the non-numbered spaces").
  // Promoted regions never receive a number (excluded from step 7), so they are
  // always free-fill. Genuine dust (< promoteFloor) still merges so specks vanish.
  const promoteFloor = 50;
  final promotedTent = <int>{};
  if (bgTentId >= 0) {
    for (var s = 0; s < nextId; s++) {
      if (kept[s]) continue;
      if (mergeTo[s] == bgTentId && tentCount[s] >= promoteFloor) {
        kept[s] = true;      // stands on its own now
        mergeTo[s] = s;      // identity → apply-merges loop leaves it untouched
        promotedTent.add(s);
      }
    }
  }

  // Apply merges to pixelToRegion (small-region pixels take the kept id, or -2).
  for (var i = 0; i < w * h; i++) {
    final r = pixelToRegion[i];
    if (r >= 0 && !kept[r]) pixelToRegion[i] = mergeTo[r];
  }

  // ── 5. Build kept regions, sort by pixelCount desc, remap IDs ──
  final rawRegions = <_RegionData>[];
  for (var t = 0; t < nextId; t++) {
    if (!kept[t]) continue;
    final c = tentCount[t];
    rawRegions.add(_RegionData(
      id: t,
      centroid: Offset(tentSumX[t] / c, tentSumY[t] / c),
      pixelCount: c,
      avgR: 0,
      avgG: 0,
      avgB: 0,
    ));
  }
  rawRegions.sort((a, b) => b.pixelCount.compareTo(a.pixelCount));

  // oldId → newId
  final idRemap = <int, int>{};
  for (var i = 0; i < rawRegions.length; i++) {
    idRemap[rawRegions[i].id] = i;
  }

  // New ids of the promoted free-fill shapes (never numbered — see step 7).
  final promotedNewIds = <int>{};
  for (final t in promotedTent) {
    final nid = idRemap[t];
    if (nid != null) promotedNewIds.add(nid);
  }

  // Remap pixelToRegion in-place
  for (var i = 0; i < w * h; i++) {
    final v = pixelToRegion[i];
    if (v >= 0) {
      pixelToRegion[i] = idRemap[v] ?? -2;
    }
  }

  // ── 5b. Label positions: place each number at the region's most-interior pixel
  // (max 4-connected distance from any outline/border), so numbers never sit on
  // the black lines the way a plain centroid does for thin/concave regions. ──
  final dist = Int32List(w * h)..fillRange(0, w * h, -1);
  final dq = Int32List(w * h);
  var dHead = 0, dTail = 0;
  for (var i = 0; i < w * h; i++) {
    final x = i % w, y = i ~/ w;
    final isBorder = x == 0 || y == 0 || x == w - 1 || y == h - 1;
    if (pixelToRegion[i] < 0 || isBorder) {
      dist[i] = 0;
      dq[dTail++] = i;
    }
  }
  while (dHead < dTail) {
    final idx = dq[dHead++];
    final d = dist[idx] + 1;
    final x = idx % w, y = idx ~/ w;
    if (x > 0)     { final n = idx - 1; if (pixelToRegion[n] >= 0 && dist[n] == -1) { dist[n] = d; dq[dTail++] = n; } }
    if (x < w - 1) { final n = idx + 1; if (pixelToRegion[n] >= 0 && dist[n] == -1) { dist[n] = d; dq[dTail++] = n; } }
    if (y > 0)     { final n = idx - w; if (pixelToRegion[n] >= 0 && dist[n] == -1) { dist[n] = d; dq[dTail++] = n; } }
    if (y < h - 1) { final n = idx + w; if (pixelToRegion[n] >= 0 && dist[n] == -1) { dist[n] = d; dq[dTail++] = n; } }
  }
  final bestDist = List<int>.filled(rawRegions.length, -1);
  final bestIdx = List<int>.filled(rawRegions.length, -1);
  for (var i = 0; i < w * h; i++) {
    final r = pixelToRegion[i];
    if (r >= 0 && r < rawRegions.length && dist[i] > bestDist[r]) {
      bestDist[r] = dist[i];
      bestIdx[r] = i;
    }
  }

  // Rebuild Region list with new sorted IDs (label at the interior point)
  final sortedRegions = List.generate(
    rawRegions.length,
    (i) => Region(
      id: i,
      centroid: bestIdx[i] >= 0
          ? Offset((bestIdx[i] % w).toDouble(), (bestIdx[i] ~/ w).toDouble())
          : rawRegions[i].centroid,
      pixelCount: rawRegions[i].pixelCount,
    ),
  );

  // ── 6. Background detection ──
  // Sample a small patch just inside the top-left corner (inside the virtual
  // frame, dy=1..4, dx=1..4).  The first non-negative pixelToRegion value is
  // the outer background region.
  var bgOrigId = -1;
  outerSearch:
  for (var dy = 1; dy <= 4; dy++) {
    for (var dx = 1; dx <= 4; dx++) {
      final v = pixelToRegion[dy * w + dx];
      if (v >= 0) {
        bgOrigId = v; // already remapped
        break outerSearch;
      }
    }
  }
  // Fallback: largest region (id=0 after sort)
  final backgroundRegionId = bgOrigId >= 0 ? bgOrigId : 0;

  // ── 7. Color assignment — sequential round-robin, capped to numbered count ──
  // Coloring pages have white/near-white fill regions so nearest-palette would
  // assign ALL regions to the SAME color. Sequential assignment ensures each
  // region gets a distinct, meaningful palette position for enforcement to work.
  //
  // Only the largest [maxNumbered] regions get a palette number (regions are
  // sorted by size desc, so id order == size order). Smaller regions are left
  // OUT of regionColorMap/regionPaletteIndex on purpose: they show no number
  // badge and, because they carry no enforced colour, the user can fill them
  // with ANY colour they pick (handled in CanvasNotifier.fillRegion). This keeps
  // the painter's badges and the fill enforcement in exact agreement — before,
  // every region was enforced but only the first 40 showed a number, so regions
  // 41+ silently rejected every colour and were impossible to fill.
  const maxNumbered = 48;
  final regionColorMap = <int, int>{};
  final regionPaletteIndex = <int, int>{};
  if (palette.isNotEmpty) {
    var colorIdx = 0;
    for (var i = 0; i < rawRegions.length; i++) {
      final newId = i;
      if (newId == backgroundRegionId) continue;
      if (promotedNewIds.contains(newId)) continue; // promoted = always free-fill
      if (colorIdx >= maxNumbered) break; // remaining regions stay free-fill
      final paletteIdx = colorIdx % palette.length;
      regionColorMap[newId] = palette[paletteIdx];
      regionPaletteIndex[newId] = paletteIdx;
      colorIdx++;
    }
  }

  return RegionDetectionResult(
    pixelToRegion: pixelToRegion,
    regions: sortedRegions,
    width: w,
    height: h,
    backgroundRegionId: backgroundRegionId,
    regionColorMap: regionColorMap,
    regionPaletteIndex: regionPaletteIndex,
  );
}

// ── 8. Composite image generation — unchanged from original ──
Uint8List buildCompositeRgba(CompositeParams params) {
  final orig = params.originalRgba;
  final p2r = params.pixelToRegion;
  final colors = params.regionColors;
  final n = params.width * params.height;

  final out = Uint8List(n * 4);
  for (var i = 0; i < n; i++) {
    final ri = p2r[i];
    if (ri >= 0 && colors.containsKey(ri)) {
      // Get original luma to preserve outline-like shading
      final or_ = orig[i * 4];
      final og = orig[i * 4 + 1];
      final ob = orig[i * 4 + 2];
      final luma = (0.299 * or_ + 0.587 * og + 0.114 * ob).round();

      if (luma < 80) {
        // Outline pixel — keep original dark color
        out[i * 4] = or_;
        out[i * 4 + 1] = og;
        out[i * 4 + 2] = ob;
        out[i * 4 + 3] = orig[i * 4 + 3];
      } else {
        // Fill pixel — use region color, slightly darkened by original luma
        final argb = colors[ri]!;
        final fr = (argb >> 16) & 0xFF;
        final fg = (argb >> 8) & 0xFF;
        final fb = argb & 0xFF;
        // Multiply fill color by original luma factor (1.0 for white, less for gray)
        final factor = luma / 255.0;
        out[i * 4] = (fr * factor).round().clamp(0, 255);
        out[i * 4 + 1] = (fg * factor).round().clamp(0, 255);
        out[i * 4 + 2] = (fb * factor).round().clamp(0, 255);
        out[i * 4 + 3] = 255;
      }
    } else {
      // Unfilled or background — copy original
      out[i * 4] = orig[i * 4];
      out[i * 4 + 1] = orig[i * 4 + 1];
      out[i * 4 + 2] = orig[i * 4 + 2];
      out[i * 4 + 3] = orig[i * 4 + 3];
    }
  }

  // Seam bleed: flood each filled region's colour OUTWARD through the light
  // "outline" (-2) band, but only a short, bounded distance (maxBleed px). This
  // closes the thin white halo that morphological closing leaves between a fill
  // and the black line WITHOUT painting arbitrary midlines across open white.
  //
  // Why bounded (this is the fix for the "border is a random line in the middle
  // of a white area" bug): an UNBOUNDED flood travels through every connected
  // light -2 pixel until it hits dark ink. Where two regions are separated by a
  // faint/broken grey line, that one connected band spans the whole gap, so the
  // two colours flood toward each other and meet at a Voronoi midline sitting in
  // open white — a coloured boundary with no black divider. Capping each flood at
  // maxBleed px confines colour to the immediate seam: it can only ever reach
  // ~maxBleed px past a region edge, never across an open area. A region interior
  // is labelled >= 0 (never -2), so a bounded bleed still cannot enter a
  // neighbour's interior; at worst two colours meet inside a narrow junction
  // pocket, which is invisible.
  //
  // maxBleed (12) ≈ 1.5× the closing radius (8): enough to refill the ring that
  // closing rounded off at concave corners, not enough to cross an open gap.
  // The dark-ink gate is raised to luma < 90 so faint grey lines act as walls
  // too, further preventing one colour from creeping along a light divider.
  final w = params.width;
  final h = params.height;
  const maxBleed = 12;

  // Per-pixel original luma, reused by both the dark-core gate and the final
  // shading factor (cheaper than recomputing inside the BFS).
  final luma = Uint8List(n);
  for (var i = 0; i < n; i++) {
    luma[i] = (0.299 * orig[i * 4] +
            0.587 * orig[i * 4 + 1] +
            0.114 * orig[i * 4 + 2])
        .round()
        .clamp(0, 255);
  }

  // claimColor[i] = ARGB a -2 pixel inherits from the nearest filled region
  //                 (0 = unclaimed). claimDist[i] = its BFS distance from a fill
  //                 edge, used to enforce the maxBleed cap.
  final claimColor = Int32List(n);
  final claimDist = Uint8List(n);
  final queue = Int32List(n);
  var qHead = 0, qTail = 0;

  // Seed: every light -2 pixel directly touching a filled region pixel (dist 1).
  for (var y = 1; y < h - 1; y++) {
    for (var x = 1; x < w - 1; x++) {
      final i = y * w + x;
      if (p2r[i] != -2 || luma[i] < 90) continue;
      for (final nb in [i - 1, i + 1, i - w, i + w]) {
        final ri = p2r[nb];
        if (ri >= 0 && colors.containsKey(ri)) {
          claimColor[i] = colors[ri]!;
          claimDist[i] = 1;
          queue[qTail++] = i;
          break;
        }
      }
    }
  }

  // Expand the frontier through light -2 pixels only, stopping at maxBleed px.
  while (qHead < qTail) {
    final i = queue[qHead++];
    final d = claimDist[i];
    if (d >= maxBleed) continue; // reached the cap — go no further
    final argb = claimColor[i];
    final x = i % w;
    final neighbors = [
      if (x > 0) i - 1,
      if (x < w - 1) i + 1,
      i - w,
      i + w,
    ];
    for (final nb in neighbors) {
      if (nb < 0 || nb >= n) continue;
      if (p2r[nb] != -2 || claimColor[nb] != 0 || luma[nb] < 90) continue;
      claimColor[nb] = argb;
      claimDist[nb] = d + 1;
      queue[qTail++] = nb;
    }
  }

  // Paint every claimed pixel, darkened by its original luma so the colored edge
  // fades naturally into the dark outline core.
  for (var i = 0; i < n; i++) {
    final argb = claimColor[i];
    if (argb == 0) continue;
    final fr = (argb >> 16) & 0xFF;
    final fg = (argb >> 8) & 0xFF;
    final fb = argb & 0xFF;
    final factor = luma[i] / 255.0;
    out[i * 4] = (fr * factor).round().clamp(0, 255);
    out[i * 4 + 1] = (fg * factor).round().clamp(0, 255);
    out[i * 4 + 2] = (fb * factor).round().clamp(0, 255);
    out[i * 4 + 3] = 255;
  }

  return out;
}

// ── Private helper carrying per-region accumulation data ──
class _RegionData {
  final int id;
  final Offset centroid;
  final int pixelCount;
  final int avgR, avgG, avgB;

  const _RegionData({
    required this.id,
    required this.centroid,
    required this.pixelCount,
    required this.avgR,
    required this.avgG,
    required this.avgB,
  });
}
