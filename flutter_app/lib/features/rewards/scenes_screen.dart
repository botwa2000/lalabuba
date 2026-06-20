import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../progress/progress_service.dart';
import 'scenes.dart';

/// "Sticker Scenes" editor — the child picks a scene, fills it with earned
/// decorations and their own finished pages ("My Art"), drags them around, and
/// double-taps to remove. Replaces the old decorate-the-penguin screen. A full
/// screen so drag gestures never fight a scroll. Parity with the web scenes modal.
class ScenesScreen extends ConsumerStatefulWidget {
  const ScenesScreen({super.key});

  @override
  ConsumerState<ScenesScreen> createState() => _ScenesScreenState();
}

class _ScenesScreenState extends ConsumerState<ScenesScreen> {
  String _current = 'meadow';

  String _cap(String id) => '${id[0].toUpperCase()}${id.substring(1)}';
  String _sceneName(L10n l10n, String id) => l10n.t('scene${_cap(id)}Name');

  @override
  Widget build(BuildContext context) {
    final l10n = ref.watch(l10nProvider);
    final cs = Theme.of(context).colorScheme;
    final total =
        (ref.watch(progressProvider).valueOrNull ?? const Progress())
            .totalCompleted;
    final scenes = ref.watch(scenesProvider).valueOrNull ?? const ScenesState();

    // Keep `_current` on a scene the child can actually open.
    if (!isSceneUnlocked(total, _current)) {
      final open = scenesUnlocked(total);
      _current = open.isNotEmpty ? open.first.id : 'meadow';
    }
    final scene = sceneById(_current)!;
    final placed = scenes.placedIn(_current);
    final trayDecos = scenes.unlockedDecosForScene(_current);
    final arts = scenes.artNewestFirst;
    final hasItems = trayDecos.isNotEmpty || arts.isNotEmpty;
    final allInScene = decosForScene(_current).length;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('scenesTitle'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        actions: [
          if (placed.isNotEmpty)
            TextButton(
              onPressed: () {
                HapticFeedback.lightImpact();
                ref.read(scenesProvider.notifier).clearScene(_current);
              },
              child: Text(l10n.t('sceneClear'),
                  style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
            ),
        ],
      ),
      body: Column(
        children: [
          _buildTabs(l10n, cs, total),
          Expanded(child: _buildStage(l10n, cs, scene, placed, scenes, hasItems)),
          _buildTrays(l10n, cs, arts, trayDecos, allInScene),
          SizedBox(height: MediaQuery.paddingOf(context).bottom),
        ],
      ),
    );
  }

  Widget _buildTabs(L10n l10n, ColorScheme cs, int total) {
    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        itemCount: kScenes.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final s = kScenes[i];
          final unlocked = isSceneUnlocked(total, s.id);
          final active = s.id == _current;
          final need = (s.unlockAt - total).clamp(1, 9999);
          return GestureDetector(
            onTap: unlocked
                ? () {
                    HapticFeedback.selectionClick();
                    setState(() => _current = s.id);
                  }
                : null,
            child: Container(
              width: 66,
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: active
                    ? cs.primaryContainer
                    : cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: active ? cs.primary : cs.outlineVariant,
                  width: active ? 2 : 1,
                ),
              ),
              child: Opacity(
                opacity: unlocked ? 1 : 0.55,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(unlocked ? s.emoji : '🔒',
                        style: const TextStyle(fontSize: 22)),
                    const SizedBox(height: 2),
                    Text(
                      unlocked
                          ? _sceneName(l10n, s.id)
                          : l10n.t('sceneLockedShort', {'n': '$need'}),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.nunito(
                          fontSize: 10, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildStage(L10n l10n, ColorScheme cs, Scene scene,
      List<Placement> placed, ScenesState scenes, bool hasItems) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final h = constraints.maxHeight;
          return DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(scene.bg[0]), Color(scene.bg[1])],
              ),
              borderRadius: BorderRadius.circular(24),
              border:
                  Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Stack(
                children: [
                  for (var i = 0; i < placed.length; i++)
                    _PlacedItem(
                      key: ValueKey('$_current-$i'),
                      placement: placed[i],
                      art: placed[i].art != null
                          ? scenes.artById(placed[i].art!)
                          : null,
                      stageW: w,
                      stageH: h,
                      onMove: (nx, ny) => ref
                          .read(scenesProvider.notifier)
                          .setLocal(_current, i, nx, ny),
                      onEnd: () => ref.read(scenesProvider.notifier).commit(),
                      onRemove: () {
                        HapticFeedback.lightImpact();
                        ref.read(scenesProvider.notifier).removeAt(_current, i);
                      },
                    ),
                  if (placed.isEmpty && hasItems)
                    _hint(l10n.t('sceneHint')),
                  if (!hasItems) _hint(l10n.t('sceneEarnHint')),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _hint(String text) => Align(
        alignment: const Alignment(0, 0.9),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(text,
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF2B3A4A))),
        ),
      );

  Widget _buildTrays(L10n l10n, ColorScheme cs, List<ArtSticker> arts,
      List<SceneDeco> trayDecos, int allInScene) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(top: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // My Art — the child's own finished pages, placeable in ANY scene.
          if (arts.isNotEmpty) ...[
            _trayHead(l10n.t('sceneTrayMyArt'), cs),
            SizedBox(
              height: 56,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: arts.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final a = arts[i];
                  return GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      ref.read(scenesProvider.notifier).placeArt(_current, a.id);
                    },
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          border: Border.all(color: cs.primary, width: 2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Image.file(File(a.file),
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) =>
                                const Center(child: Text('🎨'))),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
          // This scene's unlocked emoji decorations.
          _trayHead(
              l10n.t('sceneTrayHead',
                  {'n': '${trayDecos.length}', 'total': '$allInScene'}),
              cs),
          SizedBox(
            height: 56,
            child: trayDecos.isEmpty
                ? Align(
                    alignment: Alignment.centerLeft,
                    child: Text(l10n.t('sceneTrayEmpty'),
                        style: GoogleFonts.nunito(
                            fontWeight: FontWeight.w700,
                            color: cs.onSurface.withValues(alpha: 0.6))))
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: trayDecos.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      final d = trayDecos[i];
                      return GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          ref
                              .read(scenesProvider.notifier)
                              .placeDeco(_current, d.id);
                        },
                        child: Container(
                          width: 52,
                          decoration: BoxDecoration(
                            color: cs.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: cs.outlineVariant),
                          ),
                          child: Center(
                              child: Text(d.emoji,
                                  style: const TextStyle(fontSize: 26))),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _trayHead(String text, ColorScheme cs) => Padding(
        padding: const EdgeInsets.only(left: 2, bottom: 6, top: 2),
        child: Text(text,
            style: GoogleFonts.nunito(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: cs.onSurface.withValues(alpha: 0.6))),
      );
}

/// A placed decoration (emoji) or art sticker (image), draggable + double-tap
/// to remove. Position is normalized 0..1 within the stage.
class _PlacedItem extends StatelessWidget {
  final Placement placement;
  final ArtSticker? art;
  final double stageW;
  final double stageH;
  final void Function(double nx, double ny) onMove;
  final VoidCallback onEnd;
  final VoidCallback onRemove;

  const _PlacedItem({
    super.key,
    required this.placement,
    required this.art,
    required this.stageW,
    required this.stageH,
    required this.onMove,
    required this.onEnd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final isArt = placement.art != null;
    final size = isArt ? 60.0 : 44.0;
    final left = (placement.x * stageW) - size / 2;
    final top = (placement.y * stageH) - size / 2;
    return Positioned(
      left: left.clamp(0.0, (stageW - size).clamp(0.0, stageW)),
      top: top.clamp(0.0, (stageH - size).clamp(0.0, stageH)),
      child: GestureDetector(
        onPanUpdate: (d) {
          final nx = (left + size / 2 + d.delta.dx) / stageW;
          final ny = (top + size / 2 + d.delta.dy) / stageH;
          onMove(nx, ny);
        },
        onPanEnd: (_) => onEnd(),
        onDoubleTap: onRemove,
        child: SizedBox(
          width: size,
          height: size,
          child: Center(
            child: isArt && art != null
                ? Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: [
                        BoxShadow(
                            color: Colors.black.withValues(alpha: 0.3),
                            blurRadius: 5,
                            offset: const Offset(0, 2)),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.file(File(art!.file),
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const Center(child: Text('🎨'))),
                    ),
                  )
                : Text(isArt ? '🎨' : (decoById(placement.deco ?? '')?.emoji ?? '⭐'),
                    style: const TextStyle(fontSize: 34)),
          ),
        ),
      ),
    );
  }
}
