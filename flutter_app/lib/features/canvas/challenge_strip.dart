// Challenge strip — "🏆 Challenge a friend … [Share →]" under the picture.
//
// Twin of the web #challenge-strip. Challenge links are the product's top
// traffic source, but the only entry point here was 🏆 Challenge — the LAST
// button of a horizontally scrolling action bar (after 3 zoom buttons, Print,
// Save, Share art, Community), so on a phone it sat off-screen. The strip is
// in the layout's flow (never over the picture or palette) and just opens the
// same challenge dialog as the toolbar button, so one challenge is still
// counted once (challenge_created + Challenger sticker fire on share there).
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ChallengeStrip extends StatelessWidget {
  const ChallengeStrip({
    super.key,
    required this.hint,
    required this.shareLabel,
    required this.onShare,
    this.compact = false,
  });

  /// l10n `challengeHint` — "🏆 Challenge a friend — share this picture…"
  final String hint;

  /// l10n `challengeShare` — "Share →"
  final String shareLabel;

  final VoidCallback onShare;

  /// Landscape: one line (ellipsis) and slimmer, as height is scarcest there.
  final bool compact;

  static const _orange = Color(0xFFFF7043);
  static const _red = Color(0xFFFF4757);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      key: const ValueKey('challenge-strip'),
      padding: compact
          ? const EdgeInsets.fromLTRB(12, 4, 8, 4)
          : const EdgeInsets.fromLTRB(14, 6, 10, 6),
      decoration: BoxDecoration(
        gradient: dark
            ? null
            : const LinearGradient(
                colors: [Color(0xFFFFF8E1), Color(0xFFFFF3E0)]),
        color: dark ? _orange.withValues(alpha: 0.14) : null,
        border: Border(
          top: BorderSide(
              color: _orange.withValues(alpha: dark ? 0.25 : 0.2), width: 1.5),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              hint,
              maxLines: compact ? 1 : 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.nunito(
                fontSize: compact ? 12 : 13,
                height: 1.25,
                fontWeight: FontWeight.w700,
                color: cs.onSurface,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Semantics(
            button: true,
            label: shareLabel,
            excludeSemantics: true,
            child: GestureDetector(
              key: const ValueKey('challenge-strip-share'),
              onTap: onShare,
              behavior: HitTestBehavior.opaque,
              child: Container(
                // Sized by padding only: `alignment` here would make the button
                // grow to the parent's full height under bounded constraints.
                padding: EdgeInsets.symmetric(
                    horizontal: compact ? 12 : 16, vertical: compact ? 7 : 10),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [_orange, _red]),
                  borderRadius: BorderRadius.circular(50),
                  boxShadow: [
                    BoxShadow(
                        color: _red.withValues(alpha: 0.3),
                        blurRadius: 10,
                        offset: const Offset(0, 3)),
                  ],
                ),
                child: Text(
                  shareLabel,
                  maxLines: 1,
                  softWrap: false,
                  style: GoogleFonts.fredoka(
                    fontSize: compact ? 13 : 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
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
