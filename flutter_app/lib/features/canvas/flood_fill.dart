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

  // Dilate 6 passes
  Uint8List cur = bufA;
  Uint8List nxt = bufB;
  for (var pass = 0; pass < 6; pass++) {
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

  // Erode 6 passes
  for (var pass = 0; pass < 6; pass++) {
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
  // pixelToRegion: -1 = unvisited, -2 = outline, regionId >= 0 (tentative)
  final pixelToRegion = Int32List(w * h);
  for (var i = 0; i < w * h; i++) {
    pixelToRegion[i] = outlineMask[i] == 1 ? -2 : -1;
  }

  // Use a pre-allocated Int32List as a BFS queue to avoid Dart List GC pressure
  final bfsQueue = Int32List(w * h);

  final rawRegions = <_RegionData>[];
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
    var sumR = 0;
    var sumG = 0;
    var sumB = 0;

    while (head < tail) {
      final idx = bfsQueue[head++];
      final x = idx % w;
      final y = idx ~/ w;
      sumX += x;
      sumY += y;
      count++;
      sumR += pixels[idx * 4];
      sumG += pixels[idx * 4 + 1];
      sumB += pixels[idx * 4 + 2];

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

    if (count >= minArea) {
      final centroid = Offset(sumX / count, sumY / count);
      final avgR = sumR ~/ count;
      final avgG = sumG ~/ count;
      final avgB = sumB ~/ count;
      rawRegions.add(_RegionData(
        id: nextId,
        centroid: centroid,
        pixelCount: count,
        avgR: avgR,
        avgG: avgG,
        avgB: avgB,
      ));
      nextId++;
    } else {
      // Too small — reclassify as outline/discard (-2).
      // bfsQueue[head-count .. head-1] are the pixels belonging to this region.
      final qStart = head - count;
      for (var qi = qStart; qi < head; qi++) {
        pixelToRegion[bfsQueue[qi]] = -2;
      }
    }
  }

  // ── 5. Sort by pixelCount desc, remap IDs ──
  rawRegions.sort((a, b) => b.pixelCount.compareTo(a.pixelCount));

  // oldId → newId
  final idRemap = <int, int>{};
  for (var i = 0; i < rawRegions.length; i++) {
    idRemap[rawRegions[i].id] = i;
  }

  // Remap pixelToRegion in-place
  for (var i = 0; i < w * h; i++) {
    final v = pixelToRegion[i];
    if (v >= 0) {
      pixelToRegion[i] = idRemap[v] ?? -2;
    }
  }

  // Rebuild Region list with new sorted IDs
  final sortedRegions = List.generate(
    rawRegions.length,
    (i) => Region(
      id: i,
      centroid: rawRegions[i].centroid,
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

  // ── 7. Color assignment ──
  final regionColorMap = <int, int>{};
  if (palette.isNotEmpty) {
    for (var i = 0; i < rawRegions.length; i++) {
      final newId = i; // already sorted
      if (newId == backgroundRegionId) continue;
      final rd = rawRegions[i];
      final paletteIdx = _nearestPalette(rd.avgR, rd.avgG, rd.avgB, palette);
      regionColorMap[newId] = palette[paletteIdx];
    }
  }

  return RegionDetectionResult(
    pixelToRegion: pixelToRegion,
    regions: sortedRegions,
    width: w,
    height: h,
    backgroundRegionId: backgroundRegionId,
    regionColorMap: regionColorMap,
  );
}

// Returns the index into [palette] whose color is closest to (r, g, b)
// using squared Euclidean distance in RGB space.
int _nearestPalette(int r, int g, int b, List<int> palette) {
  var bestIdx = 0;
  var bestDist = 0x7FFFFFFF;
  for (var i = 0; i < palette.length; i++) {
    final pr = (palette[i] >> 16) & 0xFF;
    final pg = (palette[i] >> 8) & 0xFF;
    final pb = palette[i] & 0xFF;
    final dr = r - pr;
    final dg = g - pg;
    final db = b - pb;
    final dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
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
