import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Growth plan L12 (CP1, 2026-11-26): only 5 of 24 opened pictures got a first
/// colour. The canvas opens with the largest area's colour selected and this
/// pulsing "Tap here!" marker on that area until the first colour goes in
/// (twin of the web's public/js/first-fill-hint.js). It never takes a tap.
class TapHereHint extends StatefulWidget {
  /// Marker centre in the canvas box's local coordinates.
  final Offset center;
  /// The canvas box the marker is laid out in (the label stays inside it).
  final Size area;
  final String label;

  const TapHereHint({
    super.key,
    required this.center,
    required this.area,
    required this.label,
  });

  static const double ringSize = 52;
  static const Color accent = Color(0xFF7C4DFF);

  @override
  State<TapHereHint> createState() => _TapHereHintState();
}

class _TapHereHintState extends State<TapHereHint>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 800),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reduced motion: a still ring, no pulse.
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      _c.stop();
      _c.value = 0.5;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const ring = TapHereHint.ringSize;
    final cx = widget.center.dx, cy = widget.center.dy;
    final w = widget.area.width, h = widget.area.height;
    // Near the top edge the label goes under the ring; horizontally it is
    // aligned by the marker's own position, so it never leaves the picture.
    final below = cy < h * 0.2;
    final ax = w > 0 ? (2 * cx / w - 1).clamp(-1.0, 1.0) : 0.0;

    return IgnorePointer(
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: cx - ring / 2,
            top: cy - ring / 2,
            width: ring,
            height: ring,
            child: AnimatedBuilder(
              animation: _c,
              builder: (_, child) => Transform.scale(
                scale: 0.85 + 0.3 * _c.value,
                child: Opacity(opacity: 1 - 0.45 * _c.value, child: child),
              ),
              child: Container(
                key: const ValueKey('tap-here-ring'),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: TapHereHint.accent, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.white.withValues(alpha: 0.85),
                      spreadRadius: 3,
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: below ? cy + ring / 2 + 6 : null,
            bottom: below ? null : h - (cy - ring / 2 - 6),
            child: Align(
              alignment: Alignment(ax, 0),
              child: AnimatedBuilder(
                animation: _c,
                builder: (_, child) => Transform.translate(
                  offset: Offset(0, (below ? 1 : -1) * 4 * _c.value),
                  child: child,
                ),
                child: Container(
                  key: const ValueKey('tap-here-label'),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 11, vertical: 4),
                  decoration: BoxDecoration(
                    color: TapHereHint.accent,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.25),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    widget.label,
                    maxLines: 1,
                    softWrap: false,
                    style: GoogleFonts.fredoka(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      height: 1.3,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A small one-shot sparkle burst for the first colour of a picture. Plays
/// once (~0.9 s) around [center] and calls [onDone]. Skipped with reduced motion.
class FirstFillSparkle extends StatefulWidget {
  final Offset center;
  final VoidCallback? onDone;

  const FirstFillSparkle({super.key, required this.center, this.onDone});

  static const _glyphs = ['✨', '⭐', '🌟', '💫'];
  static const int count = 8;

  @override
  State<FirstFillSparkle> createState() => _FirstFillSparkleState();
}

class _FirstFillSparkleState extends State<FirstFillSparkle>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.status != AnimationStatus.dismissed) return;
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      WidgetsBinding.instance.addPostFrameCallback((_) => widget.onDone?.call());
      return;
    }
    _c.forward().whenComplete(() => widget.onDone?.call());
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, __) {
          final t = Curves.easeOutCubic.transform(_c.value);
          return Stack(
            clipBehavior: Clip.none,
            children: [
              for (var i = 0; i < FirstFillSparkle.count; i++)
                _particle(i, t),
            ],
          );
        },
      ),
    );
  }

  Widget _particle(int i, double t) {
    const n = FirstFillSparkle.count;
    // Same deterministic fan-out as the web's fx.js sparkleBurst.
    final ang = (math.pi * 2 * i) / n + (i.isOdd ? 0.4 : -0.3);
    final dist = 46.0 + ((i * 13) % 38);
    final dx = math.cos(ang) * dist * t;
    final dy = (math.sin(ang) * dist - 18) * t + 26 * t * t;
    final size = 14.0 + ((i * 7) % 12);
    return Positioned(
      left: widget.center.dx + dx - size / 2,
      top: widget.center.dy + dy - size / 2,
      child: Opacity(
        opacity: (1 - _c.value).clamp(0.0, 1.0),
        child: Transform.rotate(
          angle: dx / 40,
          child: Text(
            FirstFillSparkle._glyphs[i % FirstFillSparkle._glyphs.length],
            style: TextStyle(fontSize: size, height: 1),
          ),
        ),
      ),
    );
  }
}
