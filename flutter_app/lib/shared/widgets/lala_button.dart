import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum LalaButtonVariant { primary, secondary, outline, ghost }

class LalaButton extends StatefulWidget {
  final String label;
  final VoidCallback? onPressed;
  final LalaButtonVariant variant;
  final bool loading;
  final bool wide; // fills parent width
  final IconData? icon;
  final double? fontSize;

  const LalaButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = LalaButtonVariant.primary,
    this.loading = false,
    this.wide = false,
    this.icon,
    this.fontSize,
  });

  @override
  State<LalaButton> createState() => _LalaButtonState();
}

class _LalaButtonState extends State<LalaButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _scale;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _scale = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 80),
      lowerBound: 0.0,
      upperBound: 0.06,
    );
    _scaleAnim = Tween<double>(begin: 1.0, end: 0.94)
        .animate(CurvedAnimation(parent: _scale, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _scale.dispose();
    super.dispose();
  }

  void _onTapDown(_) => _scale.forward();
  void _onTapUp(_) => _scale.reverse();
  void _onTapCancel() => _scale.reverse();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final disabled = widget.onPressed == null || widget.loading;

    Color bg, fg, border;
    switch (widget.variant) {
      case LalaButtonVariant.primary:
        bg = cs.primary;
        fg = Colors.white;
        border = cs.primary;
      case LalaButtonVariant.secondary:
        bg = cs.secondary;
        fg = Colors.white;
        border = cs.secondary;
      case LalaButtonVariant.outline:
        bg = Colors.transparent;
        fg = cs.primary;
        border = cs.primary;
      case LalaButtonVariant.ghost:
        bg = Colors.transparent;
        fg = cs.onSurface.withValues(alpha: 0.7);
        border = Colors.transparent;
    }

    if (disabled) {
      bg = bg.withValues(alpha: 0.45);
      fg = fg.withValues(alpha: 0.6);
    }

    Widget content = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.loading)
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2.5, color: fg),
          )
        else if (widget.icon != null) ...[
          Icon(widget.icon, color: fg, size: 18),
          const SizedBox(width: 6),
        ],
        if (!widget.loading)
          Text(
            widget.label,
            style: GoogleFonts.fredoka(
              color: fg,
              fontSize: widget.fontSize ?? 16,
              fontWeight: FontWeight.w700,
            ),
          ),
      ],
    );

    if (widget.wide) content = SizedBox(width: double.infinity, child: content);

    return GestureDetector(
      onTapDown: disabled ? null : _onTapDown,
      onTapUp: disabled ? null : _onTapUp,
      onTapCancel: _onTapCancel,
      onTap: disabled ? null : widget.onPressed,
      child: AnimatedBuilder(
        animation: _scaleAnim,
        builder: (_, child) => Transform.scale(scale: _scaleAnim.value, child: child),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(50),
            border: Border.all(color: border, width: 2),
            boxShadow: disabled || widget.variant == LalaButtonVariant.ghost
                ? null
                : [
                    BoxShadow(
                      color: bg.withValues(alpha: 0.35),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
          ),
          child: content,
        ),
      ),
    );
  }
}
