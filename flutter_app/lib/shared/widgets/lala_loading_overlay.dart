import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class LalaLoadingOverlay extends StatefulWidget {
  final String message;
  const LalaLoadingOverlay({super.key, required this.message});

  @override
  State<LalaLoadingOverlay> createState() => _LalaLoadingOverlayState();
}

class _LalaLoadingOverlayState extends State<LalaLoadingOverlay>
    with TickerProviderStateMixin {
  late AnimationController _pencil;
  late List<AnimationController> _dots;

  static const _dotColors = [
    Color(0xFFFF4757),
    Color(0xFFFF7043),
    Color(0xFFFFCA28),
    Color(0xFF26C281),
    Color(0xFF1E90FF),
    Color(0xFF7C4DFF),
  ];

  @override
  void initState() {
    super.initState();
    _pencil = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();

    _dots = List.generate(6, (i) {
      final ctrl = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 1400),
      );
      Future.delayed(Duration(milliseconds: i * 150), () {
        if (mounted) ctrl.repeat(reverse: false);
      });
      return ctrl;
    });
  }

  @override
  void dispose() {
    _pencil.dispose();
    for (final d in _dots) {
      d.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      color: cs.surface,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Animated pencil
          AnimatedBuilder(
            animation: _pencil,
            builder: (_, __) {
              // Every term MUST be periodic over the controller's 0→1 cycle, or
              // the motion jumps when value wraps 1.0→0.0. Using non-integer
              // frequency multipliers (1.3, 0.7) made y and rotation discontinuous
              // at the wrap — the pencil "dropped" then resumed. Integer harmonics
              // (1×, 2×) complete whole cycles, so the loop is seamless: x/y trace
              // a smooth figure-eight and the tilt eases back to 0 at the seam.
              final t = _pencil.value * 2 * pi;
              final x = sin(t) * 26;
              final y = sin(2 * t) * 12;
              final r = sin(t) * 18 * (pi / 180);
              return Transform.translate(
                offset: Offset(x, y),
                child: Transform.rotate(
                  angle: r,
                  child: const Text('✏️', style: TextStyle(fontSize: 48)),
                ),
              );
            },
          ),
          const SizedBox(height: 28),
          // Bouncing dots
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(6, (i) => _buildDot(i)),
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              widget.message,
              textAlign: TextAlign.center,
              style: GoogleFonts.fredoka(
                color: cs.onSurface.withValues(alpha: 0.6),
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDot(int i) {
    return AnimatedBuilder(
      animation: _dots[i],
      builder: (_, __) {
        final t = _dots[i].value;
        // 0..0.4: bounce up, 0.4..1.0: come back + fade
        final bounce = t < 0.4 ? sin(t / 0.4 * pi) : 0.0;
        final opacity = 0.55 + 0.45 * (t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6);
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 5),
          child: Transform.translate(
            offset: Offset(0, -14 * bounce),
            child: Transform.scale(
              scale: 1 + 0.5 * bounce,
              child: Opacity(
                opacity: opacity.clamp(0.0, 1.0),
                child: Container(
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    color: _dotColors[i],
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
