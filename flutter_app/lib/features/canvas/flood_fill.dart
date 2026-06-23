import 'dart:isolate';
import 'dart:typed_data';
import 'dart:ui' show Offset;
import 'canvas_models.dart';
import 'line_bridge.dart';
import 'trapped_ball.dart';

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
  final outlineMask = buildOutlineMask(pixels, w, h);

  // Snapshot the THIN line mask now, before the closing below thickens it. This
  // is the visible line art the composite re-draws on top of the flat fills
  // (the watershed step fills the closed band, so without this overlay the lines
  // would be painted over). It excludes the virtual frame (added in step 3) so
  // image edges stay clean.
  final lineMask = Uint8List.fromList(outlineMask);

  // ── 1b. Bridge genuine line BREAKS (Stage-2; line_bridge.dart) ──
  // Join boundary-line tips that FACE each other across a short gap, sealing
  // real breaks the hysteresis mask can't (it only closes faint AA pin-gaps).
  // Applied AFTER the lineMask snapshot so a bridge is an INVISIBLE wall — the
  // two regions separate cleanly with no fake ink drawn across the gap. The
  // facing test means parallel groove tips are NOT joined, so this doesn't
  // re-create the "can't colour" over-seal.
  bridgeLineGaps(outlineMask, w, h);

  // ── 2. Sealed virtual frame ──
  // Mark the outermost row/col as wall so any region open at the image boundary
  // closes (done BEFORE segmentation so trapped-ball treats the edge as a wall).
  for (var x = 0; x < w; x++) {
    outlineMask[x] = 1; // top row
    outlineMask[(h - 1) * w + x] = 1; // bottom row
  }
  for (var y = 0; y < h; y++) {
    outlineMask[y * w] = 1; // left col
    outlineMask[y * w + (w - 1)] = 1; // right col
  }

  // ── 3. TRAPPED-BALL segmentation (replaces single-radius close + flat BFS) ──
  // A single morphological-close radius cannot be both big enough to seal large
  // gaps in the line art (else fills leak → "colours mixing") and small enough
  // to keep thin regions open (else they're sealed → "can't colour this area").
  // Multi-radius trapped-ball uses the largest ball that still fits per region:
  // big balls seal big gaps without leaking, small balls preserve thin regions —
  // fixing both symptoms at once. Every free pixel gets a region id; walls = -2.
  // (See trapped_ball.dart; reproduced+verified in test/trapped_ball_test.dart.)
  final pixelToRegion = trappedBallSegment(outlineMask, w, h);

  // ── 4. Tentative per-region accumulators (index = region id) ──
  // Consumed UNCHANGED by the merge/sort/colour/watershed steps below, so the
  // tested post-processing (small-region merge, free-fill promotion, sizing,
  // numbering) is reused exactly.
  var nextId = 0;
  for (var i = 0; i < w * h; i++) {
    final r = pixelToRegion[i];
    if (r >= 0 && r + 1 > nextId) nextId = r + 1;
  }
  final tentCount = List<int>.filled(nextId, 0);
  final tentSumX = List<int>.filled(nextId, 0);
  final tentSumY = List<int>.filled(nextId, 0);
  for (var i = 0; i < w * h; i++) {
    final r = pixelToRegion[i];
    if (r >= 0) {
      tentCount[r]++;
      tentSumX[r] += i % w;
      tentSumY[r] += i ~/ w;
    }
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
  final maxNumbered = params.maxNumbered;
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

/// Build the WALL/outline mask from an RGBA image (1 = wall/line, 0 = free).
///
/// A pixel is a wall if it is globally dark OR locally darker than its
/// surroundings (an interior line). A single global threshold misses the faint
/// grey interior lines AI line art draws; a raised global threshold instead
/// turns flat mid-grey SHADING into all-wall. The local (adaptive) test caught
/// the visible lines, but a line's faint ANTI-ALIASED pixels still slipped
/// through in spots, leaving 1-px pin-gaps that a fill bled through (the
/// "colours bleeding across areas" reports — e.g. red leaking between a whale's
/// throat grooves / tail flukes, where the gap is as wide as the thin groove so
/// trapped-ball can't seal it without eating the groove).
///
/// HYSTERESIS fixes that at the source: classify each pixel as strong (2),
/// weak (1) or free (0), then promote a weak pixel to wall ONLY if it is
/// 8-connected to a strong line through weak/strong pixels. This seals the faint
/// gaps inside a thin line (their pixels are weakly dark AND adjacent to the
/// strong line) WITHOUT promoting flat shading — an isolated weak speck in a
/// shaded region has no strong line to join, so it stays colourable.
Uint8List buildOutlineMask(Uint8List pixels, int w, int h) {
  final n = w * h;
  final bright = Uint8List(n);
  for (var i = 0; i < n; i++) {
    bright[i] = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) ~/ 3;
  }
  // Summed-area table for O(1) box-mean queries. Padded (w+1)×(h+1); row/col 0
  // are zero. Max accumulated value is 255·w·h, within a 64-bit int for pages up
  // to ~2900px/side — the app caps generated pages at 1024px, so no overflow.
  final sw = w + 1;
  final sat = Int64List(sw * (h + 1));
  for (var y = 0; y < h; y++) {
    var rowSum = 0;
    for (var x = 0; x < w; x++) {
      rowSum += bright[y * w + x];
      sat[(y + 1) * sw + (x + 1)] = sat[y * sw + (x + 1)] + rowSum;
    }
  }
  // Box radius scales with the image (≈ line spacing), clamped so the local mean
  // reflects the immediate neighbourhood, not the page.
  final radRaw = (w < h ? w : h) ~/ 64;
  final radius = radRaw < 4 ? 4 : (radRaw > 24 ? 24 : radRaw);
  const localMargin = 22;   // strong: this much darker than local mean → definite line
  const adaptiveCeil = 150; // strong local test ignores pixels at/above this
  const weakMargin = 8;     // weak: even this little darker than local mean is a candidate
  const weakCeil = 205;     // weak test ignores near-white pixels

  // Classify: 2 = strong wall, 1 = weak candidate, 0 = free.
  final cls = Uint8List(n);
  for (var y = 0; y < h; y++) {
    final y0 = y - radius < 0 ? 0 : y - radius;
    final y1 = y + radius >= h ? h - 1 : y + radius;
    for (var x = 0; x < w; x++) {
      final i = y * w + x;
      final br = bright[i];
      if (br < 100) {
        cls[i] = 2; // globally dark → definite line
        continue;
      }
      if (br >= weakCeil) {
        cls[i] = 0; // near-white → never a line
        continue;
      }
      final x0 = x - radius < 0 ? 0 : x - radius;
      final x1 = x + radius >= w ? w - 1 : x + radius;
      final area = (x1 - x0 + 1) * (y1 - y0 + 1);
      final sum = sat[(y1 + 1) * sw + (x1 + 1)] -
          sat[y0 * sw + (x1 + 1)] -
          sat[(y1 + 1) * sw + x0] +
          sat[y0 * sw + x0];
      final mean = sum ~/ area;
      if (br < adaptiveCeil && br <= mean - localMargin) {
        cls[i] = 2; // strong: clearly darker than its surroundings
      } else if (br <= mean - weakMargin) {
        cls[i] = 1; // weak: slightly darker — kept only if joined to a strong line
      } else {
        cls[i] = 0;
      }
    }
  }

  // Hysteresis flood: every strong pixel is a wall + a BFS seed; weak pixels are
  // promoted to wall when reached through 8-connectivity.
  final outlineMask = Uint8List(n);
  final q = Int32List(n);
  var head = 0, tail = 0;
  for (var i = 0; i < n; i++) {
    if (cls[i] == 2) {
      outlineMask[i] = 1;
      q[tail++] = i;
    }
  }
  while (head < tail) {
    final i = q[head++];
    final x = i % w;
    final y = i ~/ w;
    for (var dy = -1; dy <= 1; dy++) {
      final ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      for (var dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) continue;
        final nx = x + dx;
        if (nx < 0 || nx >= w) continue;
        final nb = ny * w + nx;
        if (cls[nb] == 1 && outlineMask[nb] == 0) {
          outlineMask[nb] = 1;
          q[tail++] = nb;
        }
      }
    }
  }
  return outlineMask;
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
