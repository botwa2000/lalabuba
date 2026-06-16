import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../progress/progress_service.dart';
import 'mascot.dart';

/// Decorate-the-penguin: the child taps earned stickers to place them on the
/// Lalabuba mascot and drags them to arrange a scene. A full screen (not part of
/// the scrolling Rewards list) so drag gestures never fight the scroll.
class MascotScreen extends ConsumerWidget {
  const MascotScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = ref.watch(l10nProvider);
    final cs = Theme.of(context).colorScheme;
    final progress =
        ref.watch(progressProvider).valueOrNull ?? const Progress();
    final placed = ref.watch(mascotProvider).valueOrNull ?? {};

    final earned = progress.earnedBadges;
    final emojiOf = {for (final b in kBadges) b.id: b.emoji};

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('mascotTitle'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        actions: [
          if (placed.isNotEmpty)
            TextButton(
              onPressed: () {
                HapticFeedback.lightImpact();
                ref.read(mascotProvider.notifier).clear();
              },
              child: Text(l10n.t('mascotClear'),
                  style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
            ),
        ],
      ),
      body: Column(
        children: [
          // Stage
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final w = constraints.maxWidth;
                  final h = constraints.maxHeight;
                  return DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0xFFD9F0FF), Color(0xFFEAF7E9)],
                      ),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                          color: cs.outlineVariant.withValues(alpha: 0.5)),
                    ),
                    child: Stack(
                      children: [
                        // The mascot — the Lalabuba penguin.
                        const Align(
                          alignment: Alignment(0, 0.25),
                          child: Text('🐧', style: TextStyle(fontSize: 120)),
                        ),
                        // Placed sticker decorations (draggable).
                        for (final entry in placed.entries)
                          _PlacedSticker(
                            key: ValueKey(entry.key),
                            emoji: emojiOf[entry.key] ?? '⭐',
                            pos: entry.value,
                            stageW: w,
                            stageH: h,
                            onMove: (norm) => ref
                                .read(mascotProvider.notifier)
                                .setLocal(entry.key, norm),
                            onEnd: () =>
                                ref.read(mascotProvider.notifier).commit(),
                          ),
                        // Hint when empty
                        if (placed.isEmpty && earned.isNotEmpty)
                          Align(
                            alignment: const Alignment(0, 0.88),
                            child: Text(
                              l10n.t('mascotHint'),
                              textAlign: TextAlign.center,
                              style: GoogleFonts.nunito(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF3A6B57)),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
          // Sticker tray
          _Tray(earned: earned, placed: placed, l10n: l10n, ref: ref),
          SizedBox(height: MediaQuery.paddingOf(context).bottom),
        ],
      ),
    );
  }
}

class _PlacedSticker extends StatelessWidget {
  final String emoji;
  final Offset pos; // normalized 0..1
  final double stageW;
  final double stageH;
  final ValueChanged<Offset> onMove;
  final VoidCallback onEnd;

  const _PlacedSticker({
    super.key,
    required this.emoji,
    required this.pos,
    required this.stageW,
    required this.stageH,
    required this.onMove,
    required this.onEnd,
  });

  static const _size = 44.0;

  @override
  Widget build(BuildContext context) {
    final left = (pos.dx * stageW) - _size / 2;
    final top = (pos.dy * stageH) - _size / 2;
    return Positioned(
      left: left.clamp(0.0, (stageW - _size).clamp(0.0, stageW)),
      top: top.clamp(0.0, (stageH - _size).clamp(0.0, stageH)),
      child: GestureDetector(
        onPanUpdate: (d) {
          final nx = (left + _size / 2 + d.delta.dx) / stageW;
          final ny = (top + _size / 2 + d.delta.dy) / stageH;
          onMove(Offset(nx, ny));
        },
        onPanEnd: (_) => onEnd(),
        child: SizedBox(
          width: _size,
          height: _size,
          child: Center(
            child: Text(emoji, style: const TextStyle(fontSize: 34)),
          ),
        ),
      ),
    );
  }
}

class _Tray extends StatelessWidget {
  final List<StickerBadge> earned;
  final Map<String, Offset> placed;
  final L10n l10n;
  final WidgetRef ref;

  const _Tray({
    required this.earned,
    required this.placed,
    required this.l10n,
    required this.ref,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(top: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: earned.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Text(
                l10n.t('mascotTrayEmpty'),
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: cs.onSurface.withValues(alpha: 0.6)),
              ),
            )
          : SizedBox(
              height: 56,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: earned.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final b = earned[i];
                  final on = placed.containsKey(b.id);
                  return GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      ref.read(mascotProvider.notifier).toggle(b.id);
                    },
                    child: Container(
                      width: 52,
                      decoration: BoxDecoration(
                        color: on
                            ? cs.primaryContainer
                            : cs.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: on ? cs.primary : cs.outlineVariant,
                          width: on ? 2 : 1,
                        ),
                      ),
                      child: Center(
                          child: Text(b.emoji,
                              style: const TextStyle(fontSize: 26))),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
