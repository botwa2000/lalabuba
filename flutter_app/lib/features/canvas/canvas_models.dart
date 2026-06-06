import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';

enum DrawMode { tap, paint, pencil }

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
  final Map<int, int> regionColorMap;   // regionId → ARGB32 int (pre-assigned palette)

  const RegionDetectionResult({
    required this.pixelToRegion,
    required this.regions,
    required this.width,
    required this.height,
    this.backgroundRegionId = 0,
    this.regionColorMap = const {},
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

  const CompositeParams({
    required this.originalRgba,
    required this.pixelToRegion,
    required this.regionColors,
    required this.width,
    required this.height,
  });
}

class CanvasAction {
  final int regionId;
  final Color? previousColor; // null = was unfilled

  const CanvasAction({required this.regionId, required this.previousColor});
}

class CanvasState {
  final ui.Image? baseImage;
  final ui.Image? compositeImage;
  final Uint8List? originalRgba;
  final RegionDetectionResult? detection;
  final Map<int, Color> regionColors;
  final Color activeColor;
  final bool showNumbers;
  final DrawMode mode;
  final List<Stroke> strokes;
  final Stroke? currentStroke;
  final List<CanvasAction> undoStack;
  final bool isProcessing; // region detection running
  final Map<int, Color> regionColorMap; // pre-assigned colors for color-by-number
  final Color? hintColor;              // transient: pulses correct color swatch on wrong tap

  const CanvasState({
    this.baseImage,
    this.compositeImage,
    this.originalRgba,
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
  });

  bool get hasImage => baseImage != null;
  bool get isReady => hasImage && detection != null && !isProcessing;

  CanvasState copyWith({
    ui.Image? baseImage,
    ui.Image? compositeImage,
    Uint8List? originalRgba,
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
  }) => CanvasState(
        baseImage: baseImage ?? this.baseImage,
        compositeImage: compositeImage ?? this.compositeImage,
        originalRgba: originalRgba ?? this.originalRgba,
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
      );
}
