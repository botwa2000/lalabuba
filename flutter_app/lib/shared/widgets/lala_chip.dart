import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Pill/chip for settings (difficulty, count, palette, toggles).
/// Tapping cycles through values or triggers onTap.
class LalaChip extends StatelessWidget {
  final String label;
  final bool selected;
  final bool locked; // shows lock indicator if Plus feature
  final VoidCallback? onTap;
  final Color? color; // optional accent color

  const LalaChip({
    super.key,
    required this.label,
    this.selected = false,
    this.locked = false,
    this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final accent = color ?? cs.primary;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap?.call();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? accent : cs.surface,
          borderRadius: BorderRadius.circular(50),
          border: Border.all(
            color: selected ? accent : Theme.of(context).dividerColor,
            width: selected ? 2 : 1.5,
          ),
          boxShadow: selected
              ? [BoxShadow(color: accent.withValues(alpha: 0.25), blurRadius: 8, offset: const Offset(0, 3))]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: GoogleFonts.nunito(
                color: selected ? Colors.white : cs.onSurface.withValues(alpha: 0.8),
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (locked) ...[
              const SizedBox(width: 4),
              Icon(Icons.lock_outline_rounded, size: 12,
                  color: selected ? Colors.white70 : cs.onSurface.withValues(alpha: 0.4)),
            ],
          ],
        ),
      ),
    );
  }
}

/// A horizontal scrollable row of chips — convenience wrapper.
class LalaChipRow extends StatelessWidget {
  final List<Widget> chips;
  const LalaChipRow({super.key, required this.chips});

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: Row(
          children: chips
              .expand((c) => [c, const SizedBox(width: 6)])
              .toList()
              ..removeLast(),
        ),
      );
}
