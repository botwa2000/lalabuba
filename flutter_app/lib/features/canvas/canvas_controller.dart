import 'dart:async';
import 'dart:isolate';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'canvas_models.dart';
import 'flood_fill.dart';

class CanvasNotifier extends Notifier<CanvasState> {
  static const _maxUndo = 20;

  @override
  CanvasState build() => const CanvasState();

  Future<void> loadImage(Uint8List imageBytes, int minArea, {
    bool showNumbers = true,
    List<Color> palette = const [],
  }) async {
    state = CanvasState(isProcessing: true, showNumbers: showNumbers);

    final codec = await ui.instantiateImageCodec(imageBytes);
    final frame = await codec.getNextFrame();
    final img = frame.image;

    final byteData = await img.toByteData(format: ui.ImageByteFormat.rawRgba);
    if (byteData == null) {
      state = const CanvasState();
      return;
    }
    final rgba = byteData.buffer.asUint8List();

    state = state.copyWith(
      baseImage: img,
      compositeImage: img,
      originalRgba: rgba,
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

    final result = await _detectInIsolate(params);

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

  Future<RegionDetectionResult> _detectInIsolate(
      RegionDetectParams params) async {
    final recv = ReceivePort();
    await Isolate.spawn(regionDetectIsolate, recv.sendPort);

    final completer = Completer<RegionDetectionResult>();
    SendPort? workerPort;

    recv.listen((msg) {
      if (msg is SendPort) {
        workerPort = msg;
        workerPort!.send(params);
      } else if (msg is RegionDetectionResult) {
        if (!completer.isCompleted) completer.complete(msg);
        recv.close();
      }
    }, onError: (e) {
      if (!completer.isCompleted) completer.completeError(e);
    });

    return completer.future;
  }

  Future<void> _rebuildComposite() async {
    final s = state;
    if (s.originalRgba == null || s.detection == null) return;

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
    );

    final rgba = await Isolate.run(() => buildCompositeRgba(params));
    final img = await _rgbaToImage(rgba, params.width, params.height);
    if (state.detection != null) {
      state = state.copyWith(compositeImage: img);
    }
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
    if (r < 0 || r == d.backgroundRegionId) return null;
    return r;
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

    final action = CanvasAction(regionId: regionId, previousColor: prev);
    final newUndo = [...s.undoStack, action];
    if (newUndo.length > _maxUndo) newUndo.removeAt(0);
    state = s.copyWith(regionColors: newColors, undoStack: newUndo);
    unawaited(_rebuildComposite());
  }

  Future<void> undo() async {
    final s = state;
    if (s.undoStack.isEmpty) return;
    final action = s.undoStack.last;
    final newColors = Map<int, Color>.from(s.regionColors);
    if (action.previousColor == null) {
      newColors.remove(action.regionId);
    } else {
      newColors[action.regionId] = action.previousColor!;
    }
    state = s.copyWith(
      regionColors: newColors,
      undoStack: s.undoStack.sublist(0, s.undoStack.length - 1),
    );
    unawaited(_rebuildComposite());
  }

  void setActiveColor(Color c) => state = state.copyWith(activeColor: c);
  void setMode(DrawMode m) =>
      state = state.copyWith(mode: m, clearCurrentStroke: true);
  void toggleNumbers() =>
      state = state.copyWith(showNumbers: !state.showNumbers);
  void setFreeMode() =>
      state = state.copyWith(isFreeMode: true, showNumbers: false);

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
    );
  }

  void reset() => state = const CanvasState();
}

final canvasProvider =
    NotifierProvider<CanvasNotifier, CanvasState>(CanvasNotifier.new);
