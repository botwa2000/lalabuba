import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../progress/progress_service.dart';
import '../settings/settings_controller.dart';
import 'daily_mission.dart';
import 'crayon_packs.dart';
import 'scenes.dart';
import '../mascot/mascot.dart';
import '../mascot/mascot_service.dart';

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
          _MascotCard(l10n: l10n, totalCompleted: progress.totalCompleted),
          const SizedBox(height: 16),
          _DailyMissionCard(progress: progress, l10n: l10n),
          const SizedBox(height: 16),
          _ScenesCard(l10n: l10n, totalCompleted: progress.totalCompleted),
          const SizedBox(height: 20),
          _CrayonPacksSection(progress: progress, l10n: l10n),
          const SizedBox(height: 20),
          _StickerAlbum(progress: progress, l10n: l10n),
        ],
      ),
    );
  }
}

// ─── Mascot card ─────────────────────────────────────────────────────────────

class _MascotCard extends ConsumerWidget {
  final L10n l10n;
  final int totalCompleted;
  const _MascotCard({required this.l10n, required this.totalCompleted});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final ms = ref.watch(mascotProvider).valueOrNull ?? const MascotState();

    return GestureDetector(
      onTap: () => context.pushNamed('mascotStudio'),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              cs.primaryContainer.withValues(alpha: 0.6),
              cs.secondaryContainer.withValues(alpha: 0.6),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: cs.primary.withValues(alpha: 0.25)),
        ),
        child: ms.isSetUp ? _buildSetUp(context, cs, ms) : _buildNotSetUp(context, cs),
      ),
    );
  }

  Widget _buildSetUp(BuildContext context, ColorScheme cs, MascotState ms) {
    final mascot     = ms.mascot!;
    final hat        = ms.hat;
    final accessory  = ms.accessory;
    final expression = ms.expression;
    // Next unlock hint
    final nextItem = kMascotItems
        .where((i) => !isItemUnlocked(i, totalCompleted))
        .fold<MascotItem?>(null, (best, i) =>
            best == null || i.unlockAt < best.unlockAt ? i : best);

    return Row(
      children: [
        // ── Mascot display ──
        SizedBox(
          width: 90, height: 90,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Center(
                child: Text(mascot.emoji,
                    style: const TextStyle(fontSize: 56, height: 1)),
              ),
              if (hat != null)
                Positioned(top: -4, right: 8,
                    child: Text(hat.emoji,
                        style: const TextStyle(fontSize: 24, height: 1))),
              if (accessory != null)
                Positioned(bottom: 0, right: 0,
                    child: Text(accessory.emoji,
                        style: const TextStyle(fontSize: 20, height: 1))),
              if (expression != null)
                Positioned(bottom: 0, left: 0,
                    child: Text(expression.emoji,
                        style: const TextStyle(fontSize: 18, height: 1))),
            ],
          ),
        ),
        const SizedBox(width: 16),
        // ── Text info ──
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(mascot.name,
                  style: GoogleFonts.fredoka(
                      fontSize: 20, fontWeight: FontWeight.w700,
                      color: cs.primary)),
              const SizedBox(height: 4),
              Text(l10n.t('mascotTitle'),
                  style: GoogleFonts.nunito(
                      fontSize: 13,
                      color: cs.onSurface.withValues(alpha: 0.65))),
              if (nextItem != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: cs.surface,
                    borderRadius: BorderRadius.circular(50),
                  ),
                  child: Text(
                    '${nextItem.emoji} ${nextItem.name} at ${nextItem.unlockAt} colorings',
                    style: GoogleFonts.nunito(
                        fontSize: 11, fontWeight: FontWeight.w700,
                        color: cs.onSurface.withValues(alpha: 0.55)),
                  ),
                ),
              ],
            ],
          ),
        ),
        const Icon(Icons.chevron_right_rounded),
      ],
    );
  }

  Widget _buildNotSetUp(BuildContext context, ColorScheme cs) {
    return Row(
      children: [
        Text('🐧🐰🐻', style: const TextStyle(fontSize: 36)),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.t('mascotChooseTitle'),
                  style: GoogleFonts.fredoka(
                      fontSize: 18, fontWeight: FontWeight.w700,
                      color: cs.primary)),
              const SizedBox(height: 4),
              Text(l10n.t('mascotChooseSubtitle'),
                  style: GoogleFonts.nunito(
                      fontSize: 13,
                      color: cs.onSurface.withValues(alpha: 0.65))),
            ],
          ),
        ),
        const Icon(Icons.chevron_right_rounded),
      ],
    );
  }
}

// ─── Daily mission ───────────────────────────────────────────────────────────

class _DailyMissionCard extends ConsumerWidget {
  final Progress progress;
  final L10n l10n;
  const _DailyMissionCard({required this.progress, required this.l10n});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final missionAsync = ref.watch(missionProvider);
    final mission = missionAsync.valueOrNull;
    if (mission == null) return const SizedBox.shrink();

    final cap = '${mission.def.id[0].toUpperCase()}${mission.def.id.substring(1)}';
    final done = mission.isDone(progress);
    final count = mission.progressCount(progress);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: done
              ? const [Color(0xFFD4FC79), Color(0xFF96E6A1)]
              : [cs.primaryContainer, cs.secondaryContainer],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
              color: cs.primary.withValues(alpha: 0.12),
              blurRadius: 10,
              offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.75),
              shape: BoxShape.circle,
            ),
            child: Center(
                child: Text(mission.def.emoji,
                    style: const TextStyle(fontSize: 28))),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.t('missionTitle'),
                  style: GoogleFonts.fredoka(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF1F4D3A)),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.t('mission${cap}Text'),
                  style: GoogleFonts.nunito(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF103024)),
                ),
                if (mission.def.amount > 1 && !done) ...[
                  const SizedBox(height: 6),
                  Text(
                    l10n.t('missionProgress',
                        {'done': '$count', 'total': '${mission.def.amount}'}),
                    style: GoogleFonts.nunito(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF1F4D3A)),
                  ),
                ],
              ],
            ),
          ),
          if (done)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(50),
              ),
              child: Text(
                l10n.t('missionDoneBadge'),
                style: GoogleFonts.fredoka(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF1F8A4C)),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Scenes entry card ───────────────────────────────────────────────────────

class _ScenesCard extends StatelessWidget {
  final L10n l10n;
  final int totalCompleted;
  const _ScenesCard({required this.l10n, required this.totalCompleted});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final open = kScenes.where((s) => totalCompleted >= s.unlockAt).length;
    final total = kScenes.length;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        context.pushNamed('scenes');
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFD9F0FF), Color(0xFFEAF7E9)],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
        ),
        child: Row(
          children: [
            const Text('🏞️', style: TextStyle(fontSize: 44)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    l10n.t('scenesCardTitle'),
                    style: GoogleFonts.fredoka(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF103024)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    l10n.t('scenesCardSubtitle',
                        {'open': '$open', 'total': '$total'}),
                    style: GoogleFonts.nunito(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF3A6B57)),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF3A6B57)),
          ],
        ),
      ),
    );
  }
}

// ─── Crayon packs (unlockable palettes) ──────────────────────────────────────

class _CrayonPacksSection extends ConsumerWidget {
  final Progress progress;
  final L10n l10n;
  const _CrayonPacksSection({required this.progress, required this.l10n});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current =
        ref.watch(settingsProvider).valueOrNull?.palette ?? 'classic';
    final unlocked = kCrayonPacks.where((p) => isPackUnlocked(progress, p.id)).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.t('crayonPacksHeader'),
                style: GoogleFonts.fredoka(
                    fontSize: 20, fontWeight: FontWeight.w700),
              ),
            ),
            _CountPill(
                earned: unlocked, total: kCrayonPacks.length, l10n: l10n),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final pack in kCrayonPacks)
              _CrayonPackTile(
                pack: pack,
                unlocked: isPackUnlocked(progress, pack.id),
                inUse: current == pack.id,
                remaining: pack.unlockAt - progress.totalCompleted,
                l10n: l10n,
                onUse: () {
                  HapticFeedback.lightImpact();
                  ref.read(settingsProvider.notifier).setPalette(pack.id);
                },
              ),
          ],
        ),
      ],
    );
  }
}

class _CrayonPackTile extends StatelessWidget {
  final CrayonPack pack;
  final bool unlocked;
  final bool inUse;
  final int remaining;
  final L10n l10n;
  final VoidCallback onUse;

  const _CrayonPackTile({
    required this.pack,
    required this.unlocked,
    required this.inUse,
    required this.remaining,
    required this.l10n,
    required this.onUse,
  });

  String get _cap => '${pack.id[0].toUpperCase()}${pack.id.substring(1)}';

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final preview = pack.colors.take(6).toList();
    return GestureDetector(
      onTap: unlocked ? onUse : null,
      child: Container(
        width: 158,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: inUse
                ? cs.primary
                : (unlocked
                    ? cs.outlineVariant
                    : cs.outlineVariant.withValues(alpha: 0.5)),
            width: inUse ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Text(pack.emoji, style: const TextStyle(fontSize: 18)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    l10n.t('pack${_cap}Name'),
                    style: GoogleFonts.fredoka(
                        fontSize: 14, fontWeight: FontWeight.w700),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Colour preview dots
            Opacity(
              opacity: unlocked ? 1 : 0.4,
              child: Row(
                children: [
                  for (final c in preview)
                    Container(
                      width: 18,
                      height: 18,
                      margin: const EdgeInsets.only(right: 3),
                      decoration: BoxDecoration(
                        color: c,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: Colors.black.withValues(alpha: 0.08)),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            if (!unlocked)
              Text(
                l10n.t('crayonLockedHint',
                    {'count': '${remaining < 1 ? 1 : remaining}'}),
                style: GoogleFonts.nunito(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: cs.onSurface.withValues(alpha: 0.55)),
              )
            else
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: inUse ? cs.primary : cs.primaryContainer,
                  borderRadius: BorderRadius.circular(50),
                ),
                child: Text(
                  l10n.t(inUse ? 'crayonInUse' : 'crayonUse'),
                  style: GoogleFonts.nunito(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: inUse ? cs.onPrimary : cs.onPrimaryContainer,
                  ),
                ),
              ),
          ],
        ),
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
