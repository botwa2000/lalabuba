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

    final src = Rect.fromLTWH(
        0, 0, img.width.toDouble(), img.height.toDouble());
    final dst = Rect.fromLTWH(0, 0, size.width, size.height);

    canvas.drawImageRect(img, src, dst, Paint());

    // Draw region numbers
    if (canvasState.showNumbers && canvasState.detection != null) {
      _drawNumbers(canvas, size, canvasState.detection!);
    }

    // Draw pencil strokes
    for (final stroke in canvasState.strokes) {
      _drawStroke(canvas, size, stroke, canvasState.detection);
    }
    if (canvasState.currentStroke != null) {
      _drawStroke(
          canvas, size, canvasState.currentStroke!, canvasState.detection);
    }
  }

  void _drawNumbers(
      Canvas canvas, Size size, RegionDetectionResult detection) {
    final iw = detection.width.toDouble();
    final ih = detection.height.toDouble();
    final scaleX = size.width / iw;
    final scaleY = size.height / ih;

    // Only show numbers for unfilled regions
    final filled = canvasState.regionColors;
    final maxShow =
        detection.regions.length.clamp(0, 40); // cap for performance

    for (var i = 0; i < maxShow; i++) {
      final region = detection.regions[i];
      if (filled.containsKey(region.id)) continue;
      if (region.pixelCount < 200) continue; // too small to show number

      final cx = region.centroid.dx * scaleX;
      final cy = region.centroid.dy * scaleY;

      final label = (region.id + 1).toString();
      final textPainter = TextPainter(
        text: TextSpan(
          text: label,
          style: GoogleFonts.fredoka(
            fontSize: _numberSize(region.pixelCount, size),
            fontWeight: FontWeight.w700,
            color: Colors.black87,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      // White background circle
      final bgRadius = textPainter.width * 0.8;
      canvas.drawCircle(
          Offset(cx, cy),
          bgRadius,
          Paint()
            ..color = Colors.white.withValues(alpha: 0.85)
            ..style = PaintingStyle.fill);

      textPainter.paint(
          canvas,
          Offset(
              cx - textPainter.width / 2, cy - textPainter.height / 2));
    }
  }

  double _numberSize(int pixelCount, Size canvasSize) {
    // Scale number size relative to region size and canvas
    final area = canvasSize.width * canvasSize.height;
    final fraction = pixelCount / area;
    return (8 + fraction * 120).clamp(8.0, 20.0);
  }

  void _drawStroke(Canvas canvas, Size size, Stroke stroke,
      RegionDetectionResult? detection) {
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
    path.lineTo(
        stroke.points.last.dx, stroke.points.last.dy);
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
