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

  // ── 1. Build outline mask — a pixel is a WALL (outline) if it is either
  // globally dark OR locally darker than its surroundings (an interior line). ──
  //
  // A single global threshold (br < 100) only catches near-black ink. AI line
  // art constantly draws the INTERIOR divisions of a subject as faint grey lines
  // (anti-aliased thin strokes average up to luma ~110-160). Those slip under
  // br < 100, so the facets they divide MERGE into one region and the child
  // can't colour them separately — the reported "tons of areas can't be tapped"
  // / "no separators" bug.
  //
  // The fix is a LOCAL comparison: a line is darker than the light area around
  // it. Crucially, we do NOT just raise the global threshold — that would turn a
  // uniformly mid-grey SHADED fill into all-wall (every pixel < the raised
  // threshold) and make whole regions uncolourable, i.e. strictly worse. With a
  // relative test a flat shaded region has every pixel ≈ its local mean, so
  // nothing trips it; only pixels that are genuinely darker than their neighbours
  // (real lines/edges) become walls.
  final bright = Uint8List(w * h);
  for (var i = 0; i < w * h; i++) {
    bright[i] = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) ~/ 3;
  }
  // Summed-area table for O(1) box-mean queries. Padded (w+1)×(h+1); row/col 0
  // are zero. Max accumulated value is 255·w·h, which stays within a 64-bit Dart
  // int (and even Int32) for pages up to ~2900px/side — the app caps generated
  // pages at 1024px, so this never overflows.
  final sw = w + 1;
  final sat = Int64List(sw * (h + 1));
  for (var y = 0; y < h; y++) {
    var rowSum = 0;
    for (var x = 0; x < w; x++) {
      rowSum += bright[y * w + x];
      sat[(y + 1) * sw + (x + 1)] = sat[y * sw + (x + 1)] + rowSum;
    }
  }
  // Box radius scales with the image (≈ line spacing) and is clamped to a sane
  // range so the local mean reflects the immediate neighbourhood, not the page.
  final radRaw = (w < h ? w : h) ~/ 64;
  final radius = radRaw < 4 ? 4 : (radRaw > 24 ? 24 : radRaw);
  const localMargin = 22;   // how much darker than local mean still counts as a line
  const adaptiveCeil = 150; // light pixels never become lines via the local test
  final outlineMask = Uint8List(w * h);
  for (var y = 0; y < h; y++) {
    final y0 = y - radius < 0 ? 0 : y - radius;
    final y1 = y + radius >= h ? h - 1 : y + radius;
    for (var x = 0; x < w; x++) {
      final i = y * w + x;
      final br = bright[i];
      if (br < 100) {
        outlineMask[i] = 1; // globally dark → definitely a line
        continue;
      }
      if (br < adaptiveCeil) {
        final x0 = x - radius < 0 ? 0 : x - radius;
        final x1 = x + radius >= w ? w - 1 : x + radius;
        final area = (x1 - x0 + 1) * (y1 - y0 + 1);
        final sum = sat[(y1 + 1) * sw + (x1 + 1)] -
            sat[y0 * sw + (x1 + 1)] -
            sat[(y1 + 1) * sw + x0] +
            sat[y0 * sw + x0];
        final mean = sum ~/ area;
        if (br <= mean - localMargin) {
          outlineMask[i] = 1; // locally darker than its surroundings → a line
          continue;
        }
      }
      outlineMask[i] = 0;
    }
  }

  // Snapshot the THIN line mask now, before the closing below thickens it. This
  // is the visible line art the composite re-draws on top of the flat fills
  // (the watershed step fills the closed band, so without this overlay the lines
  // would be painted over). It excludes the virtual frame (added in step 3) so
  // image edges stay clean.
  final lineMask = Uint8List.fromList(outlineMask);

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

  // ── 8. WATERSHED: give every remaining outline-band (-2) pixel to its nearest
  // region, so the final label map tiles the WHOLE image with no unowned band. ──
  //
  // This is the structural fix for the recurring "colours not clean" family:
  // jagged white seams between adjacent fills, the uncolourable white band around
  // a shape (the bear's mouth), and taps that do nothing when zoomed in. All three
  // came from that wide -2 no-man's-land the morphological closing leaves between
  // regions, which the old bleed/re-stamp heuristics could only partly paint.
  // With every pixel owned, two fills meet exactly at the (overlaid) line — no
  // seam — and every tap resolves to a real region. The visible lines are drawn
  // back on top from [lineMask] in buildCompositeRgba, so filling the band never
  // hides them. Multi-source BFS from all region pixels = each band pixel takes
  // the label of the nearest region (ties by scan order → a clean midline split).
  final waterQ = Int32List(w * h);
  var wHead = 0, wTail = 0;
  for (var i = 0; i < w * h; i++) {
    if (pixelToRegion[i] >= 0) waterQ[wTail++] = i;
  }
  while (wHead < wTail) {
    final i = waterQ[wHead++];
    final id = pixelToRegion[i];
    final x = i % w;
    if (x > 0)     { final nb = i - 1; if (pixelToRegion[nb] == -2) { pixelToRegion[nb] = id; waterQ[wTail++] = nb; } }
    if (x < w - 1) { final nb = i + 1; if (pixelToRegion[nb] == -2) { pixelToRegion[nb] = id; waterQ[wTail++] = nb; } }
    if (i - w >= 0)      { final nb = i - w; if (pixelToRegion[nb] == -2) { pixelToRegion[nb] = id; waterQ[wTail++] = nb; } }
    if (i + w < w * h)   { final nb = i + w; if (pixelToRegion[nb] == -2) { pixelToRegion[nb] = id; waterQ[wTail++] = nb; } }
  }

  return RegionDetectionResult(
    pixelToRegion: pixelToRegion,
    regions: sortedRegions,
    width: w,
    height: h,
    backgroundRegionId: backgroundRegionId,
    regionColorMap: regionColorMap,
    regionPaletteIndex: regionPaletteIndex,
    lineMask: lineMask,
  );
}

// ── Composite image generation (watershed model) ──
//
// Two layers, in order:
//   1. FLAT FILL — every pixel is painted its region's solid colour (or left as
//      the original when the region is uncoloured / is the background). Because
//      the watershed step gave every pixel to a region, adjacent fills meet with
//      NO gap — this is what removes the jagged white seams between colours.
//   2. LINE OVERLAY — the thin original line art ([lineMask]) is composited back
//      on top, its opacity driven by how dark the source pixel is, so the black
//      outlines stay crisp over the flat colour. Only genuine line pixels are
//      overlaid, so interior grey SHADING (not a line) does not show through —
//      keeping fills flat. If no lineMask is supplied (older callers/tests) the
//      overlay is skipped and you get pure flat fills.
Uint8List buildCompositeRgba(CompositeParams params) {
  final orig = params.originalRgba;
  final p2r = params.pixelToRegion;
  final colors = params.regionColors;
  final lineMask = params.lineMask;
  final n = params.width * params.height;

  // How the line overlay opacity ramps with source darkness: solid ink at/below
  // [lineFloor], invisible at/above [lineCeil], linear between. Anti-aliases the
  // line smoothly over the fill so edges look clean, not stair-stepped.
  const lineFloor = 45.0;
  const lineCeil = 205.0;
  const lineSpan = lineCeil - lineFloor;

  final out = Uint8List(n * 4);
  for (var i = 0; i < n; i++) {
    final ri = p2r[i];
    int br, bg, bb, ba;
    if (ri >= 0 && colors.containsKey(ri)) {
      final argb = colors[ri]!;
      br = (argb >> 16) & 0xFF;
      bg = (argb >> 8) & 0xFF;
      bb = argb & 0xFF;
      ba = 255;
    } else {
      br = orig[i * 4];
      bg = orig[i * 4 + 1];
      bb = orig[i * 4 + 2];
      ba = orig[i * 4 + 3];
    }

    if (lineMask != null && lineMask[i] == 1) {
      final or_ = orig[i * 4];
      final og = orig[i * 4 + 1];
      final ob = orig[i * 4 + 2];
      final lu = 0.299 * or_ + 0.587 * og + 0.114 * ob;
      var a = (lineCeil - lu) / lineSpan;
      if (a < 0) {
        a = 0;
      } else if (a > 1) {
        a = 1;
      }
      final ia = 1 - a;
      out[i * 4] = (br * ia + or_ * a).round().clamp(0, 255);
      out[i * 4 + 1] = (bg * ia + og * a).round().clamp(0, 255);
      out[i * 4 + 2] = (bb * ia + ob * a).round().clamp(0, 255);
      out[i * 4 + 3] = 255;
    } else {
      out[i * 4] = br;
      out[i * 4 + 1] = bg;
      out[i * 4 + 2] = bb;
      out[i * 4 + 3] = ba;
    }
  }

  return out;
}

/// In-place repaint of a SINGLE region into an existing composite buffer [out],
/// matching buildCompositeRgba's per-pixel rules (flat fill + line overlay), or
/// reverting the region to the original when [argb] is null (an erase/undo).
///
/// This is the incremental update used on every fill tap instead of rebuilding
/// the whole composite in a fresh isolate (which copied ~13 MB and spawned an
/// isolate per tap — heavy on the low-end Android devices kids use). Only the
/// changed region's pixels are touched; the result is byte-identical to a full
/// buildCompositeRgba for that region (asserted by tests).
void paintRegionInComposite({
  required Uint8List out,
  required Uint8List orig,
  required Int32List pixelToRegion,
  required Uint8List? lineMask,
  required int regionId,
  required int? argb, // null = unfilled (revert to original)
}) {
  const lineFloor = 45.0;
  const lineCeil = 205.0;
  const lineSpan = lineCeil - lineFloor;
  final n = pixelToRegion.length;
  final fr = argb == null ? 0 : (argb >> 16) & 0xFF;
  final fg = argb == null ? 0 : (argb >> 8) & 0xFF;
  final fb = argb == null ? 0 : argb & 0xFF;
  for (var i = 0; i < n; i++) {
    if (pixelToRegion[i] != regionId) continue;
    final o = i * 4;
    int br, bg, bb, ba;
    if (argb == null) {
      br = orig[o]; bg = orig[o + 1]; bb = orig[o + 2]; ba = orig[o + 3];
    } else {
      br = fr; bg = fg; bb = fb; ba = 255;
    }
    if (lineMask != null && lineMask[i] == 1) {
      final or_ = orig[o];
      final og = orig[o + 1];
      final ob = orig[o + 2];
      final lu = 0.299 * or_ + 0.587 * og + 0.114 * ob;
      var a = (lineCeil - lu) / lineSpan;
      if (a < 0) {
        a = 0;
      } else if (a > 1) {
        a = 1;
      }
      final ia = 1 - a;
      out[o] = (br * ia + or_ * a).round().clamp(0, 255);
      out[o + 1] = (bg * ia + og * a).round().clamp(0, 255);
      out[o + 2] = (bb * ia + ob * a).round().clamp(0, 255);
      out[o + 3] = 255;
    } else {
      out[o] = br;
      out[o + 1] = bg;
      out[o + 2] = bb;
      out[o + 3] = ba;
    }
  }
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
