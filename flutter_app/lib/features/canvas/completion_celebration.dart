import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../progress/progress_service.dart';

/// The completion celebration — the emotional peak of the loop (DESIGN_SPEC
/// step 3): celebrate → reveal a freshly-earned sticker → confirm "Added to your
/// Journal!" → offer a what-next loop that closes back to creation.
///
/// Pure presentation: the caller passes the recorded [progress] + any
/// [newBadges] and the what-next callbacks (which reuse the screen's existing
/// regenerate / new / share actions).
Future<void> showCompletionCelebration(
  BuildContext context, {
  required L10n l10n,
  required Progress progress,
  required List<StickerBadge> newBadges,
  required VoidCallback onAgain,
  required VoidCallback onNew,
  required VoidCallback onShare,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => _CelebrationDialog(
      l10n: l10n,
      progress: progress,
      newBadges: newBadges,
      onAgain: onAgain,
      onNew: onNew,
      onShare: onShare,
    ),
  );
}

class _CelebrationDialog extends StatelessWidget {
  final L10n l10n;
  final Progress progress;
  final List<StickerBadge> newBadges;
  final VoidCallback onAgain;
  final VoidCallback onNew;
  final VoidCallback onShare;

  const _CelebrationDialog({
    required this.l10n,
    required this.progress,
    required this.newBadges,
    required this.onAgain,
    required this.onNew,
    required this.onShare,
  });

  String _statsText() {
    if (progress.totalCompleted == 1) {
      return l10n.t('celebMasterpiecesOne', {'count': '1'});
    }
    final base =
        l10n.t('celebMasterpieces', {'count': '${progress.totalCompleted}'});
    final streak = progress.streak > 1
        ? l10n.t('celebStreakSuffix', {'streak': '${progress.streak}'})
        : '';
    return '$base$streak';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final sticker = newBadges.isNotEmpty ? newBadges.first : null;

    void close() => Navigator.of(context).pop();

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🎨', style: TextStyle(fontSize: 60)),
              const SizedBox(height: 8),
              Text(
                l10n.t('celebTitle'),
                textAlign: TextAlign.center,
                style:
                    GoogleFonts.fredoka(fontSize: 26, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              Text(
                l10n.t('celebMsg'),
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(
                    fontSize: 15, color: cs.onSurface.withValues(alpha: 0.7)),
              ),

              // Sticker reveal (only when a new badge was earned)
              if (sticker != null) ...[
                const SizedBox(height: 18),
                _StickerReveal(l10n: l10n, badge: sticker),
              ],

              const SizedBox(height: 16),
              Text(
                l10n.t('celebJournalSaved'),
                textAlign: TextAlign.center,
                style: GoogleFonts.fredoka(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF2E9E5B)),
              ),
              const SizedBox(height: 4),
              Text(
                _statsText(),
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(
                    fontSize: 14, color: cs.onSurface.withValues(alpha: 0.7)),
              ),

              // What-next loop
              const SizedBox(height: 22),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                alignment: WrapAlignment.center,
                children: [
                  _WhatNextBtn(
                    label: l10n.t('celebAgain'),
                    primary: true,
                    onTap: () {
                      close();
                      onAgain();
                    },
                  ),
                  _WhatNextBtn(
                    label: l10n.t('celebNew'),
                    onTap: () {
                      close();
                      onNew();
                    },
                  ),
                  _WhatNextBtn(
                    label: l10n.t('celebShare'),
                    onTap: () {
                      close();
                      onShare();
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: close,
                child: Text(
                  l10n.t('celebKeep'),
                  style: GoogleFonts.nunito(
                      fontSize: 13,
                      color: cs.onSurface.withValues(alpha: 0.6),
                      decoration: TextDecoration.underline),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StickerReveal extends StatelessWidget {
  final L10n l10n;
  final StickerBadge badge;
  const _StickerReveal({required this.l10n, required this.badge});

  @override
  Widget build(BuildContext context) {
    final cap = '${badge.id[0].toUpperCase()}${badge.id.substring(1)}';
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.6, end: 1.0),
      duration: const Duration(milliseconds: 450),
      curve: Curves.elasticOut,
      builder: (_, scale, child) =>
          Transform.scale(scale: scale, child: child),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
              colors: [Color(0xFFFFF7E0), Color(0xFFFFE6F2)]),
          border: Border.all(color: const Color(0xFFFFD166), width: 2),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(badge.emoji, style: const TextStyle(fontSize: 44)),
            const SizedBox(width: 14),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    l10n.t('celebNewSticker').toUpperCase(),
                    style: GoogleFonts.nunito(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.6,
                        color: const Color(0xFFD97706)),
                  ),
                  Text(
                    l10n.t('badge${cap}Title'),
                    style: GoogleFonts.fredoka(
                        fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  Text(
                    l10n.t('badge${cap}Desc'),
                    style: GoogleFonts.nunito(
                        fontSize: 12,
                        color: Colors.black.withValues(alpha: 0.6)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WhatNextBtn extends StatelessWidget {
  final String label;
  final bool primary;
  final VoidCallback onTap;
  const _WhatNextBtn(
      {required this.label, required this.onTap, this.primary = false});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 44),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
        decoration: BoxDecoration(
          gradient: primary
              ? const LinearGradient(
                  colors: [Color(0xFFFF8E53), Color(0xFFFF4757)])
              : null,
          color: primary ? null : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(50),
          border:
              primary ? null : Border.all(color: cs.outlineVariant, width: 1.5),
        ),
        child: Text(
          label,
          style: GoogleFonts.fredoka(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: primary ? Colors.white : cs.onSurface,
          ),
        ),
      ),
    );
  }
}
