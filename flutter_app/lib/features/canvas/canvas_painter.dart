import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'canvas_models.dart';

class CanvasPainter extends CustomPainter {
  final CanvasState canvasState;

  CanvasPainter(this.canvasState) : super(repaint: null);

  @override
  void paint(Canvas canvas, Size size) {
    final img = canvasState.compositeImage ?? canvasState.baseImage;
    if (img == null) return;

    final src = Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble());
    // Letterbox-fit the image to preserve aspect ratio
    final dst = fitImageRect(
        img.width.toDouble(), img.height.toDouble(), size.width, size.height);

    canvas.drawImageRect(img, src, dst, Paint());

    // Draw region numbers using the letterboxed display rect for correct positions
    if (canvasState.showNumbers && canvasState.detection != null) {
      _drawNumbers(canvas, size, canvasState.detection!, dst);
    }

    // Draw pencil strokes
    for (final stroke in canvasState.strokes) {
      _drawStroke(canvas, stroke);
    }
    if (canvasState.currentStroke != null) {
      _drawStroke(canvas, canvasState.currentStroke!);
    }
  }

  void _drawNumbers(Canvas canvas, Size size, RegionDetectionResult detection,
      Rect displayRect) {
    final iw = detection.width.toDouble();
    final ih = detection.height.toDouble();
    final scaleX = displayRect.width / iw;
    final scaleY = displayRect.height / ih;

    final filled = canvasState.regionColors;
    final maxShow = detection.regions.length.clamp(0, 40);

    for (var i = 0; i < maxShow; i++) {
      final region = detection.regions[i];
      if (filled.containsKey(region.id)) continue;
      if (region.pixelCount < 200) continue;

      // Only label regions that map to a palette colour. The background region
      // has no palette index, so skip it — otherwise it was drawn with a
      // fallback "id+1" label, producing a stray "1" floating in empty space.
      final pi = detection.regionPaletteIndex[region.id];
      if (pi == null) continue;
      // Show the 1-based palette index so it matches the palette swatch order.
      final label = (pi + 1).toString();

      // Map the interior label point from image-space to canvas-space.
      final cx = displayRect.left + region.centroid.dx * scaleX;
      final cy = displayRect.top + region.centroid.dy * scaleY;

      final fontSize = _numberSize(region.pixelCount, scaleX);
      final textPainter = TextPainter(
        text: TextSpan(
          text: label,
          style: GoogleFonts.fredoka(
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            color: Colors.black87,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      // Visible background circle — large enough to contain the label. Padding
      // scales with the glyph (relative, not a fixed pixel amount).
      final bgRadius =
          math.max(textPainter.width, textPainter.height) * 0.65 + fontSize * 0.28;

      canvas.drawCircle(
          Offset(cx, cy),
          bgRadius,
          Paint()
            ..color = Colors.white.withValues(alpha: 0.94)
            ..style = PaintingStyle.fill);

      canvas.drawCircle(
          Offset(cx, cy),
          bgRadius,
          Paint()
            ..color = Colors.black.withValues(alpha: 0.22)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2);

      textPainter.paint(
          canvas,
          Offset(cx - textPainter.width / 2, cy - textPainter.height / 2));
    }
  }

  // Mirrors the web badge sizing exactly (canvas.js): the radius is proportional
  // to sqrt(region area) measured in SOURCE-image pixels, clamped to [14, 26]
  // source px, then multiplied by the letterbox [scale] (displayRect.width /
  // image width). That makes the badge proportional to both the region and the
  // displayed picture, and — because the painter is drawn inside the
  // InteractiveViewer — it grows when the user zooms in, just like the artwork.
  double _numberSize(int pixelCount, double scale) {
    final srcRadius = (math.sqrt(pixelCount.toDouble()) * 0.08).clamp(14.0, 26.0);
    return srcRadius * scale;
  }

  void _drawStroke(Canvas canvas, Stroke stroke) {
    if (stroke.points.length < 2) return;
    final paint = Paint()
      ..color = stroke.color
      ..strokeWidth = stroke.width
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    final path = Path();
    path.moveTo(stroke.points[0].dx, stroke.points[0].dy);
    for (var i = 1; i < stroke.points.length - 1; i++) {
      final mid = Offset(
        (stroke.points[i].dx + stroke.points[i + 1].dx) / 2,
        (stroke.points[i].dy + stroke.points[i + 1].dy) / 2,
      );
      path.quadraticBezierTo(
          stroke.points[i].dx, stroke.points[i].dy, mid.dx, mid.dy);
    }
    path.lineTo(stroke.points.last.dx, stroke.points.last.dy);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(CanvasPainter old) =>
      old.canvasState.compositeImage != canvasState.compositeImage ||
      old.canvasState.showNumbers != canvasState.showNumbers ||
      old.canvasState.regionColors != canvasState.regionColors ||
      old.canvasState.strokes != canvasState.strokes ||
      old.canvasState.currentStroke != canvasState.currentStroke;
}
