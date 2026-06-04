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

  // Build luminance map: 0=dark(outline), 255=light(fillable)
  final luma = Uint8List(w * h);
  for (var i = 0; i < w * h; i++) {
    final r = pixels[i * 4];
    final g = pixels[i * 4 + 1];
    final b = pixels[i * 4 + 2];
    final l = (0.299 * r + 0.587 * g + 0.114 * b).round();
    luma[i] = l;
  }

  final pixelToRegion = Int32List(w * h);
  for (var i = 0; i < pixelToRegion.length; i++) {
    pixelToRegion[i] = -1; // unvisited
  }

  final regions = <Region>[];
  var regionId = 0;

  // Mark outline pixels
  for (var i = 0; i < w * h; i++) {
    if (luma[i] < 80) pixelToRegion[i] = -2; // outline (never a region)
  }

  // BFS to find connected light regions
  for (var startIdx = 0; startIdx < w * h; startIdx++) {
    if (pixelToRegion[startIdx] != -1) continue; // already visited or outline
    if (luma[startIdx] < 150) continue; // too dark to be a region

    // BFS from this pixel
    final queue = <int>[];
    queue.add(startIdx);
    pixelToRegion[startIdx] = regionId + 100; // tentative mark

    var head = 0;
    var sumX = 0, sumY = 0, count = 0;

    while (head < queue.length) {
      final idx = queue[head++];
      final x = idx % w;
      final y = idx ~/ w;
      sumX += x;
      sumY += y;
      count++;

      // 4-connected neighbors
      final neighbors = [
        if (x > 0) idx - 1,
        if (x < w - 1) idx + 1,
        if (y > 0) idx - w,
        if (y < h - 1) idx + w,
      ];
      for (final n in neighbors) {
        if (pixelToRegion[n] == -1 && luma[n] >= 80) {
          pixelToRegion[n] = regionId + 100; // tentative
          queue.add(n);
        }
      }
    }

    if (count >= minArea) {
      // Commit this region
      for (final idx in queue) {
        pixelToRegion[idx] = regionId;
      }
      final centroid = Offset(sumX / count, sumY / count);
      regions.add(Region(id: regionId, centroid: centroid, pixelCount: count));
      regionId++;
    } else {
      // Too small — mark as background (-3)
      for (final idx in queue) {
        pixelToRegion[idx] = -3;
      }
    }
  }

  // Sort regions by area descending (largest region gets ID 0)
  regions.sort((a, b) => b.pixelCount.compareTo(a.pixelCount));

  // Rebuild pixelToRegion with sorted IDs
  final idRemap = <int, int>{};
  for (var i = 0; i < regions.length; i++) {
    idRemap[regions[i].id] = i;
  }

  final remapped = Int32List(w * h);
  for (var i = 0; i < w * h; i++) {
    final v = pixelToRegion[i];
    if (v >= 0) {
      remapped[i] = idRemap[v] ?? -3;
    } else {
      remapped[i] = v;
    }
  }

  // Rebuild regions list with new IDs
  final sortedRegions = List.generate(
    regions.length,
    (i) => Region(
      id: i,
      centroid: regions[i].centroid,
      pixelCount: regions[i].pixelCount,
    ),
  );

  return RegionDetectionResult(
    pixelToRegion: remapped,
    regions: sortedRegions,
    width: w,
    height: h,
  );
}

// Composite image generation — blends fill colors with original pixels
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
