import 'dart:async';
import 'dart:isolate';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'canvas_models.dart';
import 'flood_fill.dart';

/// Thrown when a region-detection run is abandoned because a newer image load
/// superseded it — lets the awaiting frame unwind and free its buffers.
class _DetectionSuperseded implements Exception {
  const _DetectionSuperseded();
}

class CanvasNotifier extends Notifier<CanvasState> {
  static const _maxUndo = 20;

  // FIX 1: monotonically increasing token for composite rebuilds. Each
  // _rebuildComposite captures the value it bumped to; only the rebuild whose
  // token still matches the latest is allowed to assign state. Rapid taps that
  // finish out of order no longer let an older composite overwrite a newer one.
  int _compositeGen = 0;

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

  Future<void> _rebuildComposite() async {
    final s = state;
    if (s.originalRgba == null || s.detection == null) return;

    // FIX 1: stamp this rebuild with the latest generation. If another rebuild
    // is requested before our isolate returns, _compositeGen advances past ours
    // and we discard our (now stale) result below.
    final gen = ++_compositeGen;

    final colorsInt = <int, int>{};
    s.regionColors.forEach((rid, color) {
      colorsInt[rid] = color.toARGB32();
    });

    final params = CompositeParams(
      originalRgba: s.originalRgba!,
      pixelToRegion: s.detection!.pixelToRegion,
      regionColors: colorsInt,
      width: s.detection!.width,
      height: s.detection!.height,
      lineMask: s.detection!.lineMask,
    );

    final rgba = await Isolate.run(() => buildCompositeRgba(params));

    // FIX 1: a newer rebuild was requested while we awaited — discard this
    // result so the displayed composite always reflects the latest fills.
    if (gen != _compositeGen) return;

    final img = await _rgbaToImage(rgba, params.width, params.height);
    // Re-check after the async image decode too, for the same reason.
    if (gen != _compositeGen) return;
    if (state.detection != null) {
      state = state.copyWith(compositeImage: img, compositeRgba: rgba);
    }
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
    unawaited(_rebuildComposite());
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
        unawaited(_rebuildComposite());
      case CanvasOp.addStroke:
        final strokes = List<Stroke>.from(s.strokes);
        if (strokes.isNotEmpty) strokes.removeLast();
        state = s.copyWith(strokes: strokes, undoStack: remaining);
      case CanvasOp.eraseStrokes:
        // Reinsert each removed stroke at its original index (ascending order
        // keeps indices valid as we go).
        final strokes = List<Stroke>.from(s.strokes);
        for (var k = 0; k < action.strokes.length; k++) {
          final idx = action.strokeIndices[k].clamp(0, strokes.length);
          strokes.insert(idx, action.strokes[k]);
        }
        state = s.copyWith(strokes: strokes, undoStack: remaining);
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

  void beginStroke(Offset p) {
    state = state.copyWith(
        currentStroke: Stroke(points: [p], color: state.activeColor));
  }

  void continueStroke(Offset p) {
    final cs = state.currentStroke;
    if (cs == null) return;
    state = state.copyWith(currentStroke: cs.copyWithPoint(p));
  }

  void endStroke() {
    final cs = state.currentStroke;
    if (cs == null || cs.points.length < 2) {
      state = state.copyWith(clearCurrentStroke: true);
      return;
    }
    state = state.copyWith(
      strokes: [...state.strokes, cs],
      clearCurrentStroke: true,
      undoStack: _pushUndo(state.undoStack, const CanvasAction.addStroke()),
    );
  }

  void reset() => state = const CanvasState();
}

final canvasProvider =
    NotifierProvider<CanvasNotifier, CanvasState>(CanvasNotifier.new);
