import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class LalaColorSwatch extends StatefulWidget {
  final Color color;
  final bool active;
  final VoidCallback? onTap;
  final double size;

  const LalaColorSwatch({
    super.key,
    required this.color,
    this.active = false,
    this.onTap,
    this.size = 40,
  });

  @override
  State<LalaColorSwatch> createState() => _LalaColorSwatchState();
}

class _LalaColorSwatchState extends State<LalaColorSwatch>
    with SingleTickerProviderStateMixin {
  late AnimationController _flash;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _flash = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.6), weight: 20),
      TweenSequenceItem(tween: Tween(begin: 1.6, end: 1.45), weight: 30),
      TweenSequenceItem(tween: Tween(begin: 1.45, end: 1.55), weight: 25),
      TweenSequenceItem(tween: Tween(begin: 1.55, end: 1.0), weight: 25),
    ]).animate(CurvedAnimation(parent: _flash, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _flash.dispose();
    super.dispose();
  }

  void _onTap() {
    HapticFeedback.selectionClick();
    _flash.forward(from: 0);
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    final activeRingColor = widget.color;

    return GestureDetector(
      onTap: _onTap,
      child: AnimatedBuilder(
        animation: _scale,
        builder: (_, __) => Transform.scale(
          scale: widget.active ? 1.3 * _scale.value.clamp(1.0, 1.6) : _scale.value,
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              color: widget.color,
              shape: BoxShape.circle,
              border: Border.all(
                color: Colors.white,
                width: 2.5,
              ),
              boxShadow: [
                if (widget.active) ...[
                  BoxShadow(color: Colors.white, blurRadius: 0, spreadRadius: 3),
                  BoxShadow(color: activeRingColor, blurRadius: 0, spreadRadius: 6),
                  BoxShadow(
                      color: Colors.black.withValues(alpha:0.18),
                      blurRadius: 0,
                      spreadRadius: 9),
                  BoxShadow(
                      color: Colors.black.withValues(alpha:0.28),
                      blurRadius: 20,
                      offset: const Offset(0, 8)),
                ] else
                  BoxShadow(
                    color: Colors.black.withValues(alpha:0.18),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
