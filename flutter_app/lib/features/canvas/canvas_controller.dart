import 'dart:async';
import 'dart:isolate';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'canvas_models.dart';
import 'flood_fill.dart';
import 'stroke_mask.dart';

/// Thrown when a region-detection run is abandoned because a newer image load
/// superseded it — lets the awaiting frame unwind and free its buffers.
class _DetectionSuperseded implements Exception {
  const _DetectionSuperseded();
}

class CanvasNotifier extends Notifier<CanvasState> {
  static const _maxUndo = 20;

  // FIX 1: monotonically increasing token for composite updates. Each update
  // captures the value it bumped to; only the update whose token still matches
  // the latest is allowed to assign state. Rapid taps that finish out of order
  // no longer let an older composite overwrite a newer one.
  int _compositeGen = 0;

  // Retained composite pixel buffer, mutated in place per fill (see
  // _applyRegionComposite). Reset on every new image load.
  Uint8List? _compositeBuf;

  // Last canvas (widget) size seen on a stroke end — lets us map freehand
  // strokes (stored in canvas space) into image space to measure per-area
  // coverage for free-mode completion. Null until the first stroke ends.
  Size? _lastCanvasSize;

  // A freehand area counts as "coloured" once this fraction of its interior is
  // covered. Low + forgiving: children colour unevenly, leaving white gaps.
  static const double _coverThreshold = 0.45;

  // Masked "stay-in-the-lines" freehand: the region the current pencil stroke
  // began in (assist clamp) and whether the clamp is active this stroke.
  int _strokeStartRegion = -1;
  bool _strokeAssist = false;

  // FIX 2: generation token + in-flight isolate handle for region detection.
  // A new loadImage bumps _detectGen, kills any previous in-flight detection
  // isolate, and ignores late messages stamped with a stale generation, so an
  // abandoned full-image flood fill can neither leak nor clobber fresh state.
  int _detectGen = 0;
  Isolate? _detectIsolate;
  ReceivePort? _detectPort;

  @override
  CanvasState build() => const CanvasState();

  Future<void> loadImage(Uint8List imageBytes, int minArea, {
    bool showNumbers = true,
    List<Color> palette = const [],
    int maxNumbered = 48,
  }) async {
    // FIX 2: starting a new load invalidates any earlier in-flight detection.
    // Bump the generation and tear down a previous detection isolate so its
    // late result is ignored and it stops consuming CPU on an abandoned image.
    final gen = ++_detectGen;
    _killDetectIsolate();

    state = CanvasState(isProcessing: true, showNumbers: showNumbers);

    final codec = await ui.instantiateImageCodec(imageBytes);
    final frame = await codec.getNextFrame();
    final img = frame.image;

    final byteData = await img.toByteData(format: ui.ImageByteFormat.rawRgba);
    if (byteData == null) {
      // A newer load superseded us while decoding — don't clobber its state.
      if (gen != _detectGen) return;
      state = const CanvasState();
      return;
    }
    final rgba = byteData.buffer.asUint8List();

    // A newer load started while we were decoding; abandon this one.
    if (gen != _detectGen) return;

    state = state.copyWith(
      baseImage: img,
      compositeImage: img,
      originalRgba: rgba,
      compositeRgba: rgba, // composite == base until the first fill
      isProcessing: true,
    );

    final paletteArgb = palette.map((c) => c.toARGB32()).toList();
    final params = RegionDetectParams(
      rgbaBytes: rgba,
      width: img.width,
      height: img.height,
      minArea: minArea,
      maxNumbered: maxNumbered,
      paletteArgb: paletteArgb,
    );

    final RegionDetectionResult result;
    try {
      result = await _detectInIsolate(params, gen);
    } on _DetectionSuperseded {
      // A newer loadImage took over while this one was spawning/running. Return
      // so this async frame (and its captured ~8 MB of image buffers) unwinds and
      // is GC'd, instead of awaiting a future that never completes (a leak).
      return;
    }

    // FIX 2: a newer loadImage started while detection ran — drop this result
    // so the stale detection can't overwrite the newer image's state.
    if (gen != _detectGen) return;

    // Convert Map<int,int> regionColorMap → Map<int,Color>
    final colorMap = <int, Color>{};
    result.regionColorMap.forEach((id, argb) {
      colorMap[id] = Color(argb);
    });

    // Seed the retained composite buffer with the original (line art, no fills);
    // subsequent fills mutate it region-by-region (see _applyRegionComposite).
    _compositeBuf = Uint8List.fromList(rgba);

    state = state.copyWith(
      detection: result,
      regionColors: {},
      undoStack: [],
      strokes: [],
      isProcessing: false,
      regionColorMap: colorMap,
    );
  }

  // FIX 2: kill the in-flight detection isolate (if any) and close its port.
  // Safe to call repeatedly; clears the handles so a stale onError/onDone can't
  // act on a dead isolate.
  void _killDetectIsolate() {
    _detectIsolate?.kill(priority: Isolate.immediate);
    _detectIsolate = null;
    _detectPort?.close();
    _detectPort = null;
  }

  Future<RegionDetectionResult> _detectInIsolate(
      RegionDetectParams params, int gen) async {
    final recv = ReceivePort();
    final isolate = await Isolate.spawn(regionDetectIsolate, recv.sendPort);

    // FIX 2: retain the handle + port so a subsequent loadImage can kill this
    // detection. If a newer load already superseded us while spawning, kill
    // immediately rather than leaving an orphaned full-image flood fill.
    if (gen != _detectGen) {
      isolate.kill(priority: Isolate.immediate);
      recv.close();
      throw const _DetectionSuperseded(); // caller unwinds (no leaked future)
    }
    _detectIsolate = isolate;
    _detectPort = recv;

    final completer = Completer<RegionDetectionResult>();
    SendPort? workerPort;

    recv.listen((msg) {
      if (msg is SendPort) {
        workerPort = msg;
        workerPort!.send(params);
      } else if (msg is RegionDetectionResult) {
        if (!completer.isCompleted) completer.complete(msg);
        // Detection finished cleanly — release the isolate + port.
        _killDetectIsolate();
      }
    }, onError: (e) {
      if (!completer.isCompleted) completer.completeError(e);
      // FIX 2: on error, kill the isolate and close the port so the failed
      // detection doesn't keep running / leak its receive port.
      _killDetectIsolate();
    });

    return completer.future;
  }

  /// Incremental composite update for ONE region (a fill, erase, or undo of a
  /// fill). Mutates the retained [_compositeBuf] in place and decodes it on the
  /// main thread — no isolate spawn, no ~13 MB cross-isolate copy, and only the
  /// changed region's pixels are touched. Result is byte-identical to a full
  /// buildCompositeRgba (asserted by tests). [argb] null = region unfilled.
  Future<void> _applyRegionComposite(int regionId, Color? color) async {
    final s = state;
    final d = s.detection;
    final orig = s.originalRgba;
    if (d == null || orig == null) return;
    final buf = _compositeBuf ??= Uint8List.fromList(orig);

    final gen = ++_compositeGen;
    paintRegionInComposite(
      out: buf,
      orig: orig,
      pixelToRegion: d.pixelToRegion,
      lineMask: d.lineMask,
      regionId: regionId,
      argb: color?.toARGB32(),
    );

    final img = await _rgbaToImage(buf, d.width, d.height);
    // A newer update (or a new image load) superseded us — discard so the shown
    // composite always reflects the latest state.
    if (gen != _compositeGen || state.detection != d) return;
    state = state.copyWith(compositeImage: img, compositeRgba: buf);
  }

  /// Samples the colour currently shown at canvas-space [pos] (eyedropper).
  /// Reads the composite pixels (line art + fills), mapping through the same
  /// letterbox rect the painter uses. Returns null if [pos] is in the margins.
  Color? colorAtOffset(Offset pos, Size canvasSize) {
    final d = state.detection;
    final rgba = state.compositeRgba ?? state.originalRgba;
    if (d == null || rgba == null) return null;

    final displayRect = fitImageRect(
      d.width.toDouble(), d.height.toDouble(),
      canvasSize.width, canvasSize.height,
    );
    if (!displayRect.contains(pos)) return null;

    final nx = (pos.dx - displayRect.left) / displayRect.width;
    final ny = (pos.dy - displayRect.top) / displayRect.height;
    final x = (nx * d.width).round().clamp(0, d.width - 1);
    final y = (ny * d.height).round().clamp(0, d.height - 1);
    final idx = (y * d.width + x) * 4;
    if (idx < 0 || idx + 2 >= rgba.length) return null;
    return Color.fromARGB(255, rgba[idx], rgba[idx + 1], rgba[idx + 2]);
  }

  static Future<ui.Image> _rgbaToImage(Uint8List rgba, int w, int h) {
    final completer = Completer<ui.Image>();
    ui.decodeImageFromPixels(
        rgba, w, h, ui.PixelFormat.rgba8888, completer.complete);
    return completer.future;
  }

  /// Maps a canvas-space [pos] (from GestureDetector localPosition) to a
  /// region id, accounting for the letterbox rect used by the painter.
  int? regionAtOffset(Offset pos, Size canvasSize) {
    final d = state.detection;
    if (d == null) return null;

    final displayRect = fitImageRect(
      d.width.toDouble(), d.height.toDouble(),
      canvasSize.width, canvasSize.height,
    );

    // Ignore taps that land in the letterbox margins outside the image
    if (!displayRect.contains(pos)) return null;

    final nx = (pos.dx - displayRect.left) / displayRect.width;
    final ny = (pos.dy - displayRect.top) / displayRect.height;
    final x = (nx * d.width).round().clamp(0, d.width - 1);
    final y = (ny * d.height).round().clamp(0, d.height - 1);

    final idx = y * d.width + x;
    final r = d.pixelToRegion[idx];
    if (r >= 0 && r != d.backgroundRegionId) return r;

    // The tap landed on the outline band (-2) or the uncolourable background.
    // Thin lines and small numberless details are easy to "miss" by a pixel —
    // tapping the black line between two areas, or just inside a tiny shape,
    // returned null and nothing filled ("can't colour the areas without
    // numbers"). Snap to the nearest genuine, fillable region within a small
    // radius so those taps resolve to the area the child clearly meant. We do
    // NOT snap when the tap is on the true background id directly (r == bg),
    // since the background is intentionally uncolourable and a near-edge tap on
    // it should not bleed colour into the subject.
    if (r != -2) return null;
    const snap = 5; // image-space px to search outward
    var bestRegion = -1;
    var bestDist2 = 1 << 30;
    for (var dy = -snap; dy <= snap; dy++) {
      final yy = y + dy;
      if (yy < 0 || yy >= d.height) continue;
      for (var dx = -snap; dx <= snap; dx++) {
        final xx = x + dx;
        if (xx < 0 || xx >= d.width) continue;
        final rr = d.pixelToRegion[yy * d.width + xx];
        if (rr < 0 || rr == d.backgroundRegionId) continue;
        final dist2 = dx * dx + dy * dy;
        if (dist2 < bestDist2) {
          bestDist2 = dist2;
          bestRegion = rr;
        }
      }
    }
    return bestRegion >= 0 ? bestRegion : null;
  }

  Future<void> fillRegion(int regionId) async {
    final s = state;
    if (!s.isReady) return;
    // Don't fill the background
    if (regionId == (s.detection?.backgroundRegionId ?? -99)) return;

    final isErasing = s.activeColor == Colors.transparent;

    // Color-by-number enforcement (skip when erasing or in free mode)
    if (!isErasing && !s.isFreeMode && s.showNumbers && s.regionColorMap.isNotEmpty) {
      final assignedColor = s.regionColorMap[regionId];
      if (assignedColor != null && assignedColor != s.activeColor) {
        // Wrong color — flash hint, block fill
        state = s.copyWith(hintColor: assignedColor);
        Future.delayed(const Duration(milliseconds: 1500), () {
          final cur = state;
          if (cur.hintColor == assignedColor) {
            state = cur.copyWith(clearHintColor: true);
          }
        });
        return;
      }
    }

    final prev = s.regionColors[regionId];
    final newColors = Map<int, Color>.from(s.regionColors);

    if (isErasing) {
      if (prev == null) return; // already empty
      newColors.remove(regionId);
    } else {
      if (prev == s.activeColor) return;
      newColors[regionId] = s.activeColor;
    }

    final action =
        CanvasAction.fill(regionId: regionId, previousColor: prev);
    state = s.copyWith(
        regionColors: newColors, undoStack: _pushUndo(s.undoStack, action));
    unawaited(_applyRegionComposite(regionId, isErasing ? null : s.activeColor));
  }

  /// Erase any freehand strokes passing within [radius] (canvas-local px) of
  /// [p]. Pairs with region-erase so the eraser removes *whatever* is under the
  /// finger — fills AND pencil/doodle marks — which is what users expect. A
  /// single eraser gesture can clear several strokes; they're recorded together
  /// so one undo brings them all back at their original stack positions.
  void eraseStrokesAt(Offset p, {double radius = 18.0}) {
    final s = state;
    if (s.strokes.isEmpty) return;
    final r2 = radius * radius;
    final kept = <Stroke>[];
    final removed = <Stroke>[];
    final removedIdx = <int>[];
    for (var i = 0; i < s.strokes.length; i++) {
      final stroke = s.strokes[i];
      if (_strokeHit(stroke, p, r2)) {
        removed.add(stroke);
        removedIdx.add(i);
      } else {
        kept.add(stroke);
      }
    }
    if (removed.isEmpty) return;
    HapticFeedback.selectionClick();
    state = s.copyWith(
      strokes: kept,
      undoStack: _pushUndo(
          s.undoStack, CanvasAction.eraseStrokes(removed, removedIdx)),
    );
    _recomputeCoverage();
  }

  // True if any vertex of [stroke] (inflated by its own half-width) lies within
  // the squared eraser radius of [p]. Cheap and accurate enough for fat strokes.
  bool _strokeHit(Stroke stroke, Offset p, double r2) {
    final pad = stroke.width / 2;
    for (final pt in stroke.points) {
      final dx = pt.dx - p.dx;
      final dy = pt.dy - p.dy;
      final hit = math.sqrt(dx * dx + dy * dy) - pad;
      if (hit <= 0 || hit * hit <= r2) return true;
    }
    return false;
  }

  List<CanvasAction> _pushUndo(List<CanvasAction> stack, CanvasAction a) {
    final next = [...stack, a];
    if (next.length > _maxUndo) next.removeAt(0);
    return next;
  }

  Future<void> undo() async {
    final s = state;
    if (s.undoStack.isEmpty) return;
    final action = s.undoStack.last;
    final remaining = s.undoStack.sublist(0, s.undoStack.length - 1);
    switch (action.op) {
      case CanvasOp.fill:
        final newColors = Map<int, Color>.from(s.regionColors);
        if (action.previousColor == null) {
          newColors.remove(action.regionId);
        } else {
          newColors[action.regionId] = action.previousColor!;
        }
        state = s.copyWith(regionColors: newColors, undoStack: remaining);
        unawaited(_applyRegionComposite(action.regionId, action.previousColor));
      case CanvasOp.addStroke:
        final strokes = List<Stroke>.from(s.strokes);
        if (strokes.isNotEmpty) strokes.removeLast();
        state = s.copyWith(strokes: strokes, undoStack: remaining);
        _recomputeCoverage();
      case CanvasOp.eraseStrokes:
        // Reinsert each removed stroke at its original index (ascending order
        // keeps indices valid as we go).
        final strokes = List<Stroke>.from(s.strokes);
        for (var k = 0; k < action.strokes.length; k++) {
          final idx = action.strokeIndices[k].clamp(0, strokes.length);
          strokes.insert(idx, action.strokes[k]);
        }
        state = s.copyWith(strokes: strokes, undoStack: remaining);
        _recomputeCoverage();
    }
  }

  void setActiveColor(Color c) => state = state.copyWith(activeColor: c);
  void setMode(DrawMode m) =>
      state = state.copyWith(mode: m, clearCurrentStroke: true);
  void toggleNumbers() =>
      state = state.copyWith(showNumbers: !state.showNumbers);
  void setFreeMode() =>
      state = state.copyWith(isFreeMode: true, showNumbers: false);
  /// Reverse of [setFreeMode]: return to guided color-by-number coloring.
  /// Existing fills are preserved (regionColors untouched); numbers come back on.
  void exitFreeMode() =>
      state = state.copyWith(isFreeMode: false, showNumbers: true);

  // Masked "stay-in-the-lines" freehand. Pencil points that land on a black line
  // — or, in [assist] mode (Easy/Medium), that leave the shape the stroke began
  // in — are dropped; leaving a paintable area seals the current segment and a
  // new one begins when the finger re-enters one. Keeps a child's pencilling
  // inside the lines without changing the natural feel of drawing. The decision
  // is the pure stroke_mask.freehandKeepsPaint (unit-tested).
  void beginStroke(Offset p, {Size? canvasSize, bool assist = false}) {
    if (canvasSize != null) _lastCanvasSize = canvasSize;
    _strokeAssist = assist;
    final s = _sampleStroke(p);
    _strokeStartRegion = s?.region ?? -1;
    if (s != null &&
        !freehandKeepsPaint(
            onLine: s.onLine,
            region: s.region,
            startRegion: _strokeStartRegion,
            assist: _strokeAssist)) {
      state = state.copyWith(clearCurrentStroke: true);
      return;
    }
    state = state.copyWith(
        currentStroke: Stroke(points: [p], color: state.activeColor));
  }

  void continueStroke(Offset p) {
    final s = _sampleStroke(p);
    final ok = s == null ||
        freehandKeepsPaint(
            onLine: s.onLine,
            region: s.region,
            startRegion: _strokeStartRegion,
            assist: _strokeAssist);
    final cs = state.currentStroke;
    if (cs == null) {
      // Paused on a line / outside the shape — resume a fresh segment on re-entry.
      if (ok) {
        state = state.copyWith(
            currentStroke: Stroke(points: [p], color: state.activeColor));
      }
      return;
    }
    if (ok) {
      state = state.copyWith(currentStroke: cs.copyWithPoint(p));
    } else {
      _commitStroke(); // left the paintable area → seal this segment
    }
  }

  void endStroke([Size? canvasSize]) {
    if (canvasSize != null) _lastCanvasSize = canvasSize;
    _commitStroke();
  }

  void _commitStroke() {
    final cs = state.currentStroke;
    if (cs == null) return;
    if (cs.points.length < 2) {
      state = state.copyWith(clearCurrentStroke: true);
      return;
    }
    state = state.copyWith(
      strokes: [...state.strokes, cs],
      clearCurrentStroke: true,
      undoStack: _pushUndo(state.undoStack, const CanvasAction.addStroke()),
    );
    _recomputeCoverage();
  }

  // Sample the region + whether [p] (canvas space) is on a black line, mapping
  // through the painter's letterbox rect. Null when we can't resolve a pixel
  // (no detection / size yet, or the point is in the letterbox margin).
  ({int region, bool onLine})? _sampleStroke(Offset p) {
    final d = state.detection;
    final size = _lastCanvasSize;
    if (d == null || size == null) return null;
    final rect = fitImageRect(
        d.width.toDouble(), d.height.toDouble(), size.width, size.height);
    if (!rect.contains(p)) return null;
    final x = (((p.dx - rect.left) / rect.width) * d.width)
        .round()
        .clamp(0, d.width - 1);
    final y = (((p.dy - rect.top) / rect.height) * d.height)
        .round()
        .clamp(0, d.height - 1);
    final idx = y * d.width + x;
    final lm = d.lineMask;
    final onLine = lm != null && idx < lm.length && lm[idx] == 1;
    return (region: d.pixelToRegion[idx], onLine: onLine);
  }

  /// Recompute which meaningful areas freehand strokes have covered enough to
  /// count toward free-mode completion. Strokes are stored in canvas (widget)
  /// space; we map them through the painter's letterbox rect into image space
  /// and tally covered interior pixels per region. Bounded by image size via the
  /// [seen] dedupe, so it is cheap to run on every stroke end / undo / erase.
  /// No-op until a canvas size is known and (cheaply) only matters in free mode.
  void _recomputeCoverage() {
    final d = state.detection;
    final size = _lastCanvasSize;
    if (d == null || size == null) return;
    final w = d.width, h = d.height;
    final rect = fitImageRect(
        d.width.toDouble(), d.height.toDouble(), size.width, size.height);
    if (rect.width <= 0 || rect.height <= 0) return;
    final sx = w / rect.width, sy = h / rect.height;
    final p2r = d.pixelToRegion;
    final coverCount = <int, int>{};
    final seen = Uint8List(w * h);
    for (final stroke in state.strokes) {
      final ri = ((stroke.width / 2) * ((sx + sy) / 2)).ceil().clamp(1, 40);
      final ri2 = ri * ri;
      for (final pt in stroke.points) {
        final ix = ((pt.dx - rect.left) * sx).round();
        final iy = ((pt.dy - rect.top) * sy).round();
        for (var dy = -ri; dy <= ri; dy++) {
          final yy = iy + dy;
          if (yy < 0 || yy >= h) continue;
          for (var dx = -ri; dx <= ri; dx++) {
            if (dx * dx + dy * dy > ri2) continue;
            final xx = ix + dx;
            if (xx < 0 || xx >= w) continue;
            final idx = yy * w + xx;
            if (seen[idx] == 1) continue;
            seen[idx] = 1;
            final reg = p2r[idx];
            if (reg >= 0 && reg != d.backgroundRegionId) {
              coverCount[reg] = (coverCount[reg] ?? 0) + 1;
            }
          }
        }
      }
    }
    final covered = <int>{};
    for (final region in d.regions) {
      final c = coverCount[region.id] ?? 0;
      if (region.pixelCount > 0 && c / region.pixelCount >= _coverThreshold) {
        covered.add(region.id);
      }
    }
    if (!setEquals(covered, state.coveredRegions)) {
      state = state.copyWith(coveredRegions: covered);
    }
  }

  void reset() {
    _compositeBuf = null;
    _lastCanvasSize = null;
    state = const CanvasState();
  }
}

final canvasProvider =
    NotifierProvider<CanvasNotifier, CanvasState>(CanvasNotifier.new);
