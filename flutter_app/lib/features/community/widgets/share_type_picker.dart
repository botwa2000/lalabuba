import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/l10n/l10n_service.dart';

/// Returns the chosen share type string ('colored', 'template', 'freehand')
/// or null if the user dismissed.
Future<String?> showShareTypePicker(
  BuildContext context,
  L10n l10n, {
  bool hasFreehand = false,
}) async {
  return showModalBottomSheet<String>(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => _ShareTypeSheet(hasFreehand: hasFreehand, l10n: l10n),
  );
}

class _ShareTypeSheet extends StatelessWidget {
  final bool hasFreehand;
  final L10n l10n;
  const _ShareTypeSheet({required this.hasFreehand, required this.l10n});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: cs.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.t('shareTypeTitle'),
              style:
                  GoogleFonts.fredoka(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              l10n.t('shareTypeQuestion'),
              style: GoogleFonts.nunito(
                fontSize: 14,
                color: cs.onSurface.withValues(alpha: 0.7),
              ),
            ),
            const SizedBox(height: 20),
            _TypeTile(
              emoji: '🎨',
              title: l10n.t('shareTypeColored'),
              subtitle: l10n.t('shareTypeColoredDesc'),
              value: 'colored',
            ),
            const SizedBox(height: 10),
            _TypeTile(
              emoji: '📋',
              title: l10n.t('shareTypeTemplate'),
              subtitle: l10n.t('shareTypeTemplateDesc'),
              value: 'template',
            ),
            if (hasFreehand) ...[
              const SizedBox(height: 10),
              _TypeTile(
                emoji: '✏️',
                title: l10n.t('shareTypeDrawing'),
                subtitle: l10n.t('shareTypeDrawingDesc'),
                value: 'freehand',
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TypeTile extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  final String value;

  const _TypeTile({
    required this.emoji,
    required this.title,
    required this.subtitle,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: cs.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.of(context).pop(value);
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          child: Row(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 28)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.fredoka(
                          fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    Text(
                      subtitle,
                      style: GoogleFonts.nunito(
                        fontSize: 13,
                        color: cs.onSurface.withValues(alpha: 0.6),
                      ),
                    ),
                  ],
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
