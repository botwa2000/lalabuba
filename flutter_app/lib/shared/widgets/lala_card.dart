import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

class LalaCard extends StatefulWidget {
  final String emoji;
  final String label;
  final List<Color> gradient;
  final VoidCallback? onTap;
  final int animationIndex; // stagger delay index

  const LalaCard({
    super.key,
    required this.emoji,
    required this.label,
    required this.gradient,
    this.onTap,
    this.animationIndex = 0,
  });

  @override
  State<LalaCard> createState() => _LalaCardState();
}

class _LalaCardState extends State<LalaCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _hover;
  late Animation<double> _scale;
  late Animation<double> _emojiScale;

  @override
  void initState() {
    super.initState();
    _hover = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 120),
      lowerBound: 0.0,
      upperBound: 1.0,
    );
    _scale = Tween<double>(begin: 1.0, end: 0.96)
        .animate(CurvedAnimation(parent: _hover, curve: Curves.easeInOut));
    _emojiScale = Tween<double>(begin: 1.0, end: 1.15)
        .animate(CurvedAnimation(parent: _hover, curve: Curves.elasticOut));
  }

  @override
  void dispose() {
    _hover.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return GestureDetector(
      onTapDown: (_) {
        _hover.forward();
        HapticFeedback.selectionClick();
      },
      onTapUp: (_) {
        _hover.reverse();
        widget.onTap?.call();
      },
      onTapCancel: () => _hover.reverse(),
      child: AnimatedBuilder(
        animation: _hover,
        builder: (_, __) => Transform.scale(
          scale: _scale.value,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: cs.outlineVariant, width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.07),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            clipBehavior: Clip.hardEdge,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Gradient art area
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(8, 16, 8, 12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: widget.gradient,
                    ),
                  ),
                  child: AnimatedBuilder(
                    animation: _emojiScale,
                    builder: (_, __) => Transform.scale(
                      scale: _emojiScale.value,
                      child: Text(
                        widget.emoji,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 36, height: 1.1),
                      ),
                    ),
                  ),
                ),
                // Label
                Container(
                  width: double.infinity,
                  color: cs.surface,
                  padding: const EdgeInsets.fromLTRB(6, 6, 6, 10),
                  child: Text(
                    widget.label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.fredoka(
                      color: cs.onSurface,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
