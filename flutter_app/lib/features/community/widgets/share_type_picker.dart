import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Returns the chosen share type string ('colored', 'template', 'freehand')
/// or null if the user dismissed.
Future<String?> showShareTypePicker(
  BuildContext context, {
  bool hasFreehand = false,
}) async {
  return showModalBottomSheet<String>(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => _ShareTypeSheet(hasFreehand: hasFreehand),
  );
}

class _ShareTypeSheet extends StatelessWidget {
  final bool hasFreehand;
  const _ShareTypeSheet({required this.hasFreehand});

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
              'Share to Community 🌟',
              style:
                  GoogleFonts.fredoka(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              'What would you like to share?',
              style: GoogleFonts.nunito(
                fontSize: 14,
                color: cs.onSurface.withValues(alpha: 0.7),
              ),
            ),
            const SizedBox(height: 20),
            _TypeTile(
              emoji: '🎨',
              title: 'My coloring',
              subtitle: 'Share your finished artwork',
              value: 'colored',
            ),
            const SizedBox(height: 10),
            _TypeTile(
              emoji: '📋',
              title: 'The template',
              subtitle: 'Others can color it too!',
              value: 'template',
            ),
            if (hasFreehand) ...[
              const SizedBox(height: 10),
              _TypeTile(
                emoji: '✏️',
                title: 'My drawing',
                subtitle: 'Share your freehand creation',
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
