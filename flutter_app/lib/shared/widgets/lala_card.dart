import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

class LalaCard extends StatefulWidget {
  final String emoji;
  final String label;
  final List<Color> gradient;
  final VoidCallback? onTap;
  final int animationIndex; // stagger delay index
  final double scale; // 1.0 = phone sizing; >1 enlarges emoji/label for tablets

  const LalaCard({
    super.key,
    required this.emoji,
    required this.label,
    required this.gradient,
    this.onTap,
    this.animationIndex = 0,
    this.scale = 1.0,
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
            constraints: const BoxConstraints.expand(),
            decoration: BoxDecoration(
              color: cs.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: cs.outlineVariant, width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.07),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            clipBehavior: Clip.hardEdge,
            child: Column(
              mainAxisSize: MainAxisSize.max,
              children: [
                // Gradient art area — expands to fill card, emoji centered
                Expanded(
                  child: Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: widget.gradient,
                      ),
                    ),
                    child: Center(
                      child: AnimatedBuilder(
                        animation: _emojiScale,
                        builder: (_, __) => Transform.scale(
                          scale: _emojiScale.value,
                          child: Text(
                            widget.emoji,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 32 * widget.scale, height: 1.1),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                // Label pinned at bottom
                Container(
                  width: double.infinity,
                  color: cs.surface,
                  padding: EdgeInsets.fromLTRB(
                      6, 5 * widget.scale, 6, 6 * widget.scale),
                  child: Text(
                    widget.label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.fredoka(
                      color: cs.onSurface,
                      fontSize: 12 * widget.scale,
                      fontWeight: FontWeight.w700,
                      height: 1.25,
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
