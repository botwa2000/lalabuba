import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/di/providers.dart';
import '../models/leaderboard_model.dart';
import 'community_artwork_card.dart' show avatarEmoji;

class LeaderboardEntryWidget extends ConsumerWidget {
  final LeaderboardEntry entry;
  final bool isOwn;

  const LeaderboardEntryWidget({
    super.key,
    required this.entry,
    this.isOwn = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final l10n = ref.watch(l10nProvider);
    final rankEmoji = switch (entry.rank) {
      1 => '🥇',
      2 => '🥈',
      3 => '🥉',
      _ => '${entry.rank}',
    };

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isOwn
            ? cs.primaryContainer
            : cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
        border: isOwn
            ? Border.all(color: cs.primary, width: 1.5)
            : null,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 36,
            child: Text(
              rankEmoji,
              textAlign: TextAlign.center,
              style: GoogleFonts.fredoka(
                fontSize: entry.rank <= 3 ? 22 : 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(avatarEmoji(entry.avatarIndex),
              style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.nickname,
                  style: GoogleFonts.fredoka(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: isOwn ? cs.onPrimaryContainer : cs.onSurface,
                  ),
                ),
                if (entry.weeklyCompleted != null)
                  Text(
                    l10n.t('communityLbScoreWeekly', {
                      'count': '${entry.weeklyCompleted}',
                      'stars': '${entry.weeklyStars ?? 0}',
                    }),
                    style: GoogleFonts.nunito(
                      fontSize: 11,
                      color: (isOwn ? cs.onPrimaryContainer : cs.onSurface)
                          .withValues(alpha: 0.7),
                    ),
                  ),
              ],
            ),
          ),
          Text(
            '${entry.score}',
            style: GoogleFonts.fredoka(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isOwn ? cs.onPrimaryContainer : cs.primary,
            ),
          ),
        ],
      ),
    );
  }
}
