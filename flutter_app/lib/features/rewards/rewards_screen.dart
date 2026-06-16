import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../progress/progress_service.dart';

/// The Rewards home — the child's collection hub. Holds the sticker album
/// (grouped collections), and is the destination of the pulsing 🏆 icon on the
/// home bar. Daily mission, crayon packs and the mascot are added as further
/// sections. Everything here is local-only and anonymous.
class RewardsScreen extends ConsumerWidget {
  const RewardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = ref.watch(l10nProvider);
    final progress =
        ref.watch(progressProvider).valueOrNull ?? const Progress();

    return Scaffold(
      appBar: AppBar(
        title: Text(
          l10n.t('rewardsTitle'),
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          _StickerAlbum(progress: progress, l10n: l10n),
        ],
      ),
    );
  }
}

// ─── Sticker album (grouped collections) ─────────────────────────────────────

class _StickerAlbum extends StatelessWidget {
  final Progress progress;
  final L10n l10n;
  const _StickerAlbum({required this.progress, required this.l10n});

  static const _groupMeta = <BadgeGroup, (String, String)>{
    BadgeGroup.milestones: ('🏆', 'groupMilestonesTitle'),
    BadgeGroup.streaks: ('🔥', 'groupStreaksTitle'),
    BadgeGroup.explorer: ('🧭', 'groupExplorerTitle'),
    BadgeGroup.creativity: ('🎨', 'groupCreativityTitle'),
    BadgeGroup.sharing: ('📤', 'groupSharingTitle'),
  };

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final earned = progress.badges.toSet();
    final totalEarned = kBadges.where((b) => earned.contains(b.id)).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Album header + total progress
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.t('rewardsStickersHeader'),
                style: GoogleFonts.fredoka(
                    fontSize: 20, fontWeight: FontWeight.w700),
              ),
            ),
            _CountPill(earned: totalEarned, total: kBadges.length, l10n: l10n),
          ],
        ),
        if (totalEarned == 0)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              l10n.t('rewardsEmptyHint'),
              style: GoogleFonts.nunito(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: cs.onSurface.withValues(alpha: 0.6)),
            ),
          ),
        const SizedBox(height: 8),
        for (final group in BadgeGroup.values)
          _GroupSection(
            group: group,
            emoji: _groupMeta[group]!.$1,
            title: l10n.t(_groupMeta[group]!.$2),
            badges: Progress.badgesIn(group),
            earned: earned,
            l10n: l10n,
          ),
      ],
    );
  }
}

class _GroupSection extends StatelessWidget {
  final BadgeGroup group;
  final String emoji;
  final String title;
  final List<StickerBadge> badges;
  final Set<String> earned;
  final L10n l10n;

  const _GroupSection({
    required this.group,
    required this.emoji,
    required this.title,
    required this.badges,
    required this.earned,
    required this.l10n,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final got = badges.where((b) => earned.contains(b.id)).length;
    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 16)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.fredoka(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: cs.onSurface.withValues(alpha: 0.85)),
                ),
              ),
              Text(
                l10n.t('stickerCount',
                    {'earned': '$got', 'total': '${badges.length}'}),
                style: GoogleFonts.nunito(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: cs.onSurface.withValues(alpha: 0.5)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final b in badges)
                _StickerTile(
                  badge: b,
                  earned: earned.contains(b.id),
                  l10n: l10n,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StickerTile extends StatelessWidget {
  final StickerBadge badge;
  final bool earned;
  final L10n l10n;

  const _StickerTile({
    required this.badge,
    required this.earned,
    required this.l10n,
  });

  String get _cap => '${badge.id[0].toUpperCase()}${badge.id.substring(1)}';

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        _showStickerDetail(context, l10n, badge, earned);
      },
      child: SizedBox(
        width: 78,
        child: Column(
          children: [
            Container(
              width: 78,
              height: 78,
              decoration: BoxDecoration(
                gradient: earned
                    ? const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFFFFF7E0), Color(0xFFFFE6F2)])
                    : null,
                color: earned ? null : cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: earned ? const Color(0xFFFFD166) : cs.outlineVariant,
                  width: earned ? 2 : 1,
                ),
                boxShadow: earned
                    ? [
                        BoxShadow(
                            color: const Color(0xFFFFD166).withValues(alpha: 0.35),
                            blurRadius: 8,
                            offset: const Offset(0, 3)),
                      ]
                    : null,
              ),
              child: Center(
                child: Opacity(
                  opacity: earned ? 1 : 0.55,
                  child: Text(earned ? badge.emoji : '🔒',
                      style: const TextStyle(fontSize: 32)),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              l10n.t('badge${_cap}Title'),
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.nunito(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: earned
                    ? cs.onSurface
                    : cs.onSurface.withValues(alpha: 0.55),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

void _showStickerDetail(
    BuildContext context, L10n l10n, StickerBadge badge, bool earned) {
  final cap = '${badge.id[0].toUpperCase()}${badge.id.substring(1)}';
  showDialog(
    context: context,
    builder: (ctx) {
      final cs = Theme.of(ctx).colorScheme;
      return Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  gradient: earned
                      ? const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFFFFF7E0), Color(0xFFFFE6F2)])
                      : null,
                  color: earned ? null : cs.surfaceContainerHighest,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color:
                        earned ? const Color(0xFFFFD166) : cs.outlineVariant,
                    width: earned ? 3 : 1.5,
                  ),
                ),
                child: Center(
                  child: Opacity(
                    opacity: earned ? 1 : 0.5,
                    child: Text(earned ? badge.emoji : '🔒',
                        style: const TextStyle(fontSize: 48)),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                l10n.t('badge${cap}Title'),
                textAlign: TextAlign.center,
                style: GoogleFonts.fredoka(
                    fontSize: 20, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(
                l10n.t('badge${cap}Desc'),
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: cs.onSurface.withValues(alpha: 0.75)),
              ),
              const SizedBox(height: 14),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: earned
                      ? const Color(0xFFE6F9ED)
                      : cs.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(50),
                ),
                child: Text(
                  l10n.t(earned ? 'stickerEarnedLabel' : 'stickerLockedLabel'),
                  style: GoogleFonts.nunito(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: earned
                        ? const Color(0xFF1F8A4C)
                        : cs.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text(l10n.t('stickerCloseBtn'),
                    style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _CountPill extends StatelessWidget {
  final int earned;
  final int total;
  final L10n l10n;
  const _CountPill(
      {required this.earned, required this.total, required this.l10n});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
            colors: [Color(0xFFFFE0B2), Color(0xFFFFD166)]),
        borderRadius: BorderRadius.circular(50),
      ),
      child: Text(
        l10n.t('stickerCount', {'earned': '$earned', 'total': '$total'}),
        style: GoogleFonts.fredoka(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF7A4F00)),
      ),
    );
  }
}
