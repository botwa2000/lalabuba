import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:showcaseview/showcaseview.dart';

/// A consistent, kid-friendly coach-mark wrapper around showcaseview's
/// [Showcase]. Centralizes the tooltip styling so every step on every screen
/// looks the same: a warm rounded bubble drawn from the app's [ColorScheme]
/// (so it adapts to BOTH light and dark themes), Fredoka-bold title with a
/// friendly mascot emoji, Nunito body text, comfortable padding and an arrow.
///
/// Only parameters that actually exist on `Showcase` in showcaseview 5.0.2 are
/// used here: titleTextStyle, descTextStyle, tooltipBackgroundColor, textColor,
/// tooltipBorderRadius, tooltipPadding, showArrow, targetBorderRadius,
/// disableMovingAnimation, titlePadding, descriptionPadding.
///
/// Note: showcaseview reads these style values at *build* time of the Showcase
/// widget, so resolving them from `Theme.of(context)` here makes the bubble
/// theme-correct in both light and dark mode (no hardcoded light-on-light).
class LalaShowcase extends StatelessWidget {
  final GlobalKey showcaseKey;
  final String title;
  final String description;
  final Widget child;

  /// Optional rounding for the highlighted target (passed straight through).
  final BorderRadius? targetBorderRadius;

  const LalaShowcase({
    super.key,
    required this.showcaseKey,
    required this.title,
    required this.description,
    required this.child,
    this.targetBorderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    // Warm, friendly bubble. primaryContainer gives a soft tinted background in
    // both themes, and onPrimaryContainer is its guaranteed-contrast foreground
    // (Material 3 container/on-container pairs are designed for legibility in
    // light AND dark), so text never disappears.
    final bg = cs.primaryContainer;
    final fg = cs.onPrimaryContainer;

    // Prefix a mascot emoji on the title if the localized string doesn't already
    // start with one (several tip titles are plain words like "Tools").
    final friendlyTitle = _hasLeadingEmoji(title) ? title : '🎨 $title';

    return Showcase(
      key: showcaseKey,
      title: friendlyTitle,
      description: description,
      // Kid-friendly type: rounded bold Fredoka headline, soft Nunito body.
      titleTextStyle: GoogleFonts.fredoka(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: fg,
        height: 1.15,
      ),
      descTextStyle: GoogleFonts.nunito(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: fg.withValues(alpha: 0.9),
        height: 1.3,
      ),
      tooltipBackgroundColor: bg,
      // textColor is the package's default colour for any text it styles itself;
      // keep it in sync with our foreground so nothing falls back to black.
      textColor: fg,
      tooltipBorderRadius: BorderRadius.circular(20),
      tooltipPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      titlePadding: const EdgeInsets.only(bottom: 6),
      descriptionPadding: EdgeInsets.zero,
      showArrow: true,
      // Match the existing call sites: no moving animation between steps.
      disableMovingAnimation: true,
      targetBorderRadius: targetBorderRadius,
      child: child,
    );
  }

  // True if the string starts with a non-ASCII glyph (emoji/symbol) — good
  // enough to avoid double-prefixing titles that already lead with one.
  static bool _hasLeadingEmoji(String s) {
    final t = s.trimLeft();
    if (t.isEmpty) return false;
    return t.runes.first > 0x2000;
  }
}
