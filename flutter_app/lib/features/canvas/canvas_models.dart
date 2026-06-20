import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';

/// Returns the letterbox [Rect] for an [imgW]×[imgH] image displayed inside
/// a [canvasW]×[canvasH] viewport, preserving aspect ratio (contain-fit).
Rect fitImageRect(double imgW, double imgH, double canvasW, double canvasH) {
  if (imgW <= 0 || imgH <= 0 || canvasW <= 0 || canvasH <= 0) {
    return Rect.fromLTWH(0, 0, canvasW, canvasH);
  }
  final imgAspect = imgW / imgH;
  final canvasAspect = canvasW / canvasH;
  if (imgAspect > canvasAspect) {
    final h = canvasW / imgAspect;
    return Rect.fromLTWH(0, (canvasH - h) / 2, canvasW, h);
  } else {
    final w = canvasH * imgAspect;
    return Rect.fromLTWH((canvasW - w) / 2, 0, w, canvasH);
  }
}

enum DrawMode { tap, paint, pencil, eyedropper }

class Region {
  final int id;
  final Offset centroid;
  final int pixelCount;

  const Region({
    required this.id,
    required this.centroid,
    required this.pixelCount,
  });
}

class Stroke {
  final List<Offset> points;
  final Color color;
  final double width;

  const Stroke({
    required this.points,
    required this.color,
    this.width = 4.0,
  });

  Stroke copyWithPoint(Offset p) =>
      Stroke(points: [...points, p], color: color, width: width);
}

class RegionDetectionResult {
  final Int32List pixelToRegion; // length = width * height; -1 = outline, 0+ = region id
  final List<Region> regions;   // sorted by area desc (region 0 = largest)
  final int width;
  final int height;
  final int backgroundRegionId;         // id of the outer background region
  final Map<int, int> regionColorMap;       // regionId → ARGB32 int (pre-assigned palette)
  final Map<int, int> regionPaletteIndex;   // regionId → 0-based palette index (for number display)
  final Uint8List? lineMask;            // length = width*height; 1 = visible line-art pixel

  const RegionDetectionResult({
    required this.pixelToRegion,
    required this.regions,
    required this.width,
    required this.height,
    this.backgroundRegionId = 0,
    this.regionColorMap = const {},
    this.regionPaletteIndex = const {},
    this.lineMask,
  });
}

// Message sent to the region-detection Isolate
class RegionDetectParams {
  final Uint8List rgbaBytes; // RGBA, width*height*4 bytes
  final int width;
  final int height;
  final int minArea;
  final List<int> paletteArgb; // ARGB32 values of the palette colors

  const RegionDetectParams({
    required this.rgbaBytes,
    required this.width,
    required this.height,
    required this.minArea,
    this.paletteArgb = const [],
  });
}

// Message sent to the composite-image Isolate
class CompositeParams {
  final Uint8List originalRgba;
  final Int32List pixelToRegion;
  final Map<int, int> regionColors; // region id → ARGB int
  final int width;
  final int height;
  final Uint8List? lineMask; // 1 = visible line-art pixel, drawn on top of fills

  const CompositeParams({
    required this.originalRgba,
    required this.pixelToRegion,
    required this.regionColors,
    required this.width,
    required this.height,
    this.lineMask,
  });
}

/// What an undo entry reverses. Coloring mixes three edit kinds — region fills,
/// freehand strokes added, and freehand strokes erased — and a single undo stack
/// must reverse whichever came last. (Previously the stack only knew about region
/// fills, so pencil strokes couldn't be undone and the eraser left them behind.)
enum CanvasOp { fill, addStroke, eraseStrokes }

class CanvasAction {
  final CanvasOp op;

  // fill
  final int regionId;
  final Color? previousColor; // null = region was unfilled before

  // addStroke: the single stroke appended (undo pops it).
  // eraseStrokes: the strokes removed, paired with [strokeIndices] (their
  // original positions, ascending) so undo reinserts them exactly where they were.
  final List<Stroke> strokes;
  final List<int> strokeIndices;

  const CanvasAction.fill({required this.regionId, required this.previousColor})
      : op = CanvasOp.fill,
        strokes = const [],
        strokeIndices = const [];

  const CanvasAction.addStroke()
      : op = CanvasOp.addStroke,
        regionId = -1,
        previousColor = null,
        strokes = const [],
        strokeIndices = const [];

  const CanvasAction.eraseStrokes(this.strokes, this.strokeIndices)
      : op = CanvasOp.eraseStrokes,
        regionId = -1,
        previousColor = null;
}

class CanvasState {
  final ui.Image? baseImage;
  final ui.Image? compositeImage;
  final Uint8List? originalRgba;
  final Uint8List? compositeRgba; // current composite pixels — for the eyedropper
  final RegionDetectionResult? detection;
  final Map<int, Color> regionColors;
  final Color activeColor;
  final bool showNumbers;
  final DrawMode mode;
  final List<Stroke> strokes;
  final Stroke? currentStroke;
  final List<CanvasAction> undoStack;
  final bool isProcessing;
  final Map<int, Color> regionColorMap; // pre-assigned colors for guided mode
  final Color? hintColor;              // transient: pulses correct swatch on wrong tap
  final bool isFreeMode;               // one-way unlock: no enforcement, free color picker

  const CanvasState({
    this.baseImage,
    this.compositeImage,
    this.originalRgba,
    this.compositeRgba,
    this.detection,
    this.regionColors = const {},
    this.activeColor = const Color(0xFFFF4757),
    this.showNumbers = true,
    this.mode = DrawMode.tap,
    this.strokes = const [],
    this.currentStroke,
    this.undoStack = const [],
    this.isProcessing = false,
    this.regionColorMap = const {},
    this.hintColor,
    this.isFreeMode = false,
  });

  bool get hasImage => baseImage != null;
  bool get isReady => hasImage && detection != null && !isProcessing;

  /// True when every guided (numbered) region has been filled with its assigned
  /// colour — the trigger for the completion celebration. Mirrors the web app's
  /// checkCompletion (all regionColorMap keys completed). Only meaningful in
  /// guided mode (regionColorMap is empty in free mode → never "complete").
  bool get isComplete {
    if (regionColorMap.isEmpty) return false;
    for (final entry in regionColorMap.entries) {
      final filled = regionColors[entry.key];
      if (filled == null || filled.toARGB32() != entry.value.toARGB32()) {
        return false;
      }
    }
    return true;
  }

  CanvasState copyWith({
    ui.Image? baseImage,
    ui.Image? compositeImage,
    Uint8List? originalRgba,
    Uint8List? compositeRgba,
    RegionDetectionResult? detection,
    Map<int, Color>? regionColors,
    Color? activeColor,
    bool? showNumbers,
    DrawMode? mode,
    List<Stroke>? strokes,
    Stroke? currentStroke,
    bool clearCurrentStroke = false,
    List<CanvasAction>? undoStack,
    bool? isProcessing,
    Map<int, Color>? regionColorMap,
    Color? hintColor,
    bool clearHintColor = false,
    bool? isFreeMode,
  }) => CanvasState(
        baseImage: baseImage ?? this.baseImage,
        compositeImage: compositeImage ?? this.compositeImage,
        originalRgba: originalRgba ?? this.originalRgba,
        compositeRgba: compositeRgba ?? this.compositeRgba,
        detection: detection ?? this.detection,
        regionColors: regionColors ?? this.regionColors,
        activeColor: activeColor ?? this.activeColor,
        showNumbers: showNumbers ?? this.showNumbers,
        mode: mode ?? this.mode,
        strokes: strokes ?? this.strokes,
        currentStroke: clearCurrentStroke ? null : (currentStroke ?? this.currentStroke),
        undoStack: undoStack ?? this.undoStack,
        isProcessing: isProcessing ?? this.isProcessing,
        regionColorMap: regionColorMap ?? this.regionColorMap,
        hintColor: clearHintColor ? null : (hintColor ?? this.hintColor),
        isFreeMode: isFreeMode ?? this.isFreeMode,
      );
}
