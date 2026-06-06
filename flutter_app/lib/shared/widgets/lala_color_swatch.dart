import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class LalaColorSwatch extends StatefulWidget {
  final Color color;
  final bool active;
  final bool pulse; // wrong-color hint: pulses amber glow to indicate correct color
  final VoidCallback? onTap;
  final double size;

  const LalaColorSwatch({
    super.key,
    required this.color,
    this.active = false,
    this.pulse = false,
    this.onTap,
    this.size = 40,
  });

  @override
  State<LalaColorSwatch> createState() => _LalaColorSwatchState();
}

class _LalaColorSwatchState extends State<LalaColorSwatch>
    with TickerProviderStateMixin {
  // Tap bounce (one-shot)
  late AnimationController _flash;
  late Animation<double> _scale;

  // Wrong-color pulse (repeating)
  late AnimationController _pulseCtrl;
  late Animation<double> _pulseScale;

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

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 480),
    );
    _pulseScale = Tween<double>(begin: 1.0, end: 1.38).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void didUpdateWidget(LalaColorSwatch old) {
    super.didUpdateWidget(old);
    if (widget.pulse && !old.pulse) {
      _pulseCtrl.repeat(reverse: true);
    } else if (!widget.pulse && old.pulse) {
      _pulseCtrl.stop();
      _pulseCtrl.animateTo(0, duration: const Duration(milliseconds: 200));
    }
  }

  @override
  void dispose() {
    _flash.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  void _onTap() {
    HapticFeedback.selectionClick();
    _flash.forward(from: 0);
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _onTap,
      child: AnimatedBuilder(
        animation: Listenable.merge([_scale, _pulseScale]),
        builder: (_, __) {
          final tapV = _scale.value;
          final pulseV = widget.pulse ? _pulseScale.value : 1.0;
          final combined = tapV > pulseV ? tapV : pulseV;

          return Transform.scale(
            scale: combined,
            child: Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                color: widget.color,
                shape: BoxShape.circle,
                border: Border.all(
                  color: widget.pulse
                      ? Colors.amber
                      : Colors.white,
                  width: widget.pulse ? 3.0 : 2.5,
                ),
                boxShadow: [
                  if (widget.pulse) ...[
                    BoxShadow(
                        color: Colors.amber.withValues(alpha: 0.85),
                        blurRadius: 0,
                        spreadRadius: 3),
                    BoxShadow(
                        color: Colors.amber.withValues(alpha: 0.35),
                        blurRadius: 14,
                        spreadRadius: 6),
                  ] else if (widget.active) ...[
                    BoxShadow(
                        color: Colors.white, blurRadius: 0, spreadRadius: 2),
                    BoxShadow(
                        color: widget.color, blurRadius: 0, spreadRadius: 4),
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.35),
                        blurRadius: 0,
                        spreadRadius: 6),
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        blurRadius: 12,
                        offset: const Offset(0, 4)),
                  ] else
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.18),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
