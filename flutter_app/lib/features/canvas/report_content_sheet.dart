import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';

/// "Something wrong with this picture?" — lets a child (or parent) flag an
/// AI-generated picture as offensive without leaving the app (Google Play
/// AI-Generated Content policy). Returns the reason id
/// ('scary' | 'inappropriate' | 'wrong' | 'other') or null if dismissed.
/// Preset reasons only — no free text, so no personal data can be typed in.
Future<String?> showReportContentSheet(BuildContext context, L10n l10n) {
  return showModalBottomSheet<String>(
    context: context,
    // Scrollable so the four reasons fit in phone landscape (~390px tall).
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => _ReportContentSheet(l10n: l10n),
  );
}

class _ReportContentSheet extends StatelessWidget {
  final L10n l10n;
  const _ReportContentSheet({required this.l10n});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.9,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            // No hand-drawn grabber: the app theme sets showDragHandle.
            children: [
              Text(
                l10n.t('reportPictureTitle'),
                textAlign: TextAlign.center,
                style: GoogleFonts.fredoka(
                    fontSize: 20, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(
                l10n.t('reportPictureBody'),
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(
                  fontSize: 14,
                  color: cs.onSurface.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 20),
              _ReasonTile(
                  emoji: '😱', title: l10n.t('reportReasonScary'), value: 'scary'),
              const SizedBox(height: 10),
              _ReasonTile(
                  emoji: '🙈',
                  title: l10n.t('reportReasonInappropriate'),
                  value: 'inappropriate'),
              const SizedBox(height: 10),
              _ReasonTile(
                  emoji: '🤔', title: l10n.t('reportReasonWrong'), value: 'wrong'),
              const SizedBox(height: 10),
              _ReasonTile(
                  emoji: '✋', title: l10n.t('reportReasonOther'), value: 'other'),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(l10n.t('cancel'),
                    style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReasonTile extends StatelessWidget {
  final String emoji;
  final String title;
  final String value;

  const _ReasonTile({
    required this.emoji,
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: cs.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        key: ValueKey('report_reason_$value'),
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.of(context).pop(value);
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          child: Row(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 26)),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.fredoka(
                      fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
              Icon(Icons.chevron_right_rounded,
                  color: cs.onSurface.withValues(alpha: 0.4)),
            ],
          ),
        ),
      ),
    );
  }
}
