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

  // Stage-level gesture state — all placed-item manipulation lives here so that
  // the second finger of a pinch/rotate can land anywhere on the stage, not just
  // on the sticker's small visual footprint.
  int?   _activeIdx;
  double _gs = 1.0;          // baseline scale captured at onScaleStart
  double _gr = 0.0;          // baseline rotation captured at onScaleStart
  Offset _gc = Offset.zero;  // running centre in stage logical pixels
  Offset _doubleTapPos = Offset.zero;

  String _cap(String id) => '${id[0].toUpperCase()}${id.substring(1)}';
  String _sceneName(L10n l10n, String id) => l10n.t('scene${_cap(id)}Name');

  /// True when [pos] (stage-local logical pixels) is within the circular hit
  /// area of [p]. Minimum radius 24 px so tiny stickers remain tappable.
  bool _hitIn(Placement p, double w, double h, Offset pos) {
    final cx = p.x * w;
    final cy = p.y * h;
    final base = p.art != null ? 60.0 : 44.0;
    final radius = ((base * p.scale) / 2).clamp(24.0, 80.0);
    return (pos - Offset(cx, cy)).distance <= radius;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ref.watch(l10nProvider);
    final cs = Theme.of(context).colorScheme;
    final total =
        (ref.watch(progressProvider).value ?? const Progress())
            .totalCompleted;
    final scenes = ref.watch(scenesProvider).value ?? const ScenesState();

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
      height: 80,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
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
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(unlocked ? s.emoji : '🔒',
                        style: const TextStyle(fontSize: 22)),
                    const SizedBox(height: 2),
                    Flexible(
                      child: Text(
                        unlocked
                            ? _sceneName(l10n, s.id)
                            : l10n.t('sceneLockedShort', {'n': '$need'}),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.nunito(
                            fontSize: 10, fontWeight: FontWeight.w700),
                      ),
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
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            // Double-tap removes the topmost sticker under the finger.
            onDoubleTapDown: (d) => _doubleTapPos = d.localPosition,
            onDoubleTap: () {
              final ps = ref.read(scenesProvider).value
                      ?.placedIn(_current) ??
                  const [];
              for (int i = ps.length - 1; i >= 0; i--) {
                if (_hitIn(ps[i], w, h, _doubleTapPos)) {
                  HapticFeedback.lightImpact();
                  ref.read(scenesProvider.notifier).removeAt(_current, i);
                  break;
                }
              }
            },
            // Scale handles 1-finger drag AND 2-finger pinch+rotate in one
            // recogniser. Placed at the stage level so the second finger can
            // land anywhere on the stage, not just on the sticker's own bounds.
            onScaleStart: (d) {
              final ps = ref.read(scenesProvider).value
                      ?.placedIn(_current) ??
                  const [];
              _activeIdx = null;
              for (int i = ps.length - 1; i >= 0; i--) {
                if (_hitIn(ps[i], w, h, d.localFocalPoint)) {
                  final p = ps[i];
                  _activeIdx = i;
                  _gs = p.scale;
                  _gr = p.rotation;
                  _gc = Offset(p.x * w, p.y * h);
                  break;
                }
              }
            },
            onScaleUpdate: (d) {
              final i = _activeIdx;
              if (i == null) return;
              // focalPointDelta is in global logical pixels; since the stage
              // has no transform, this equals the local-coordinate delta.
              _gc += d.focalPointDelta;
              ref.read(scenesProvider.notifier).setLocalTransform(
                _current, i,
                nx: (_gc.dx / w).clamp(0.04, 0.96),
                ny: (_gc.dy / h).clamp(0.04, 0.96),
                scale: _gs * d.scale,
                rotation: _gr + d.rotation,
              );
            },
            onScaleEnd: (_) {
              if (_activeIdx != null) {
                ref.read(scenesProvider.notifier).commit();
              }
              _activeIdx = null;
            },
            child: DecoratedBox(
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
                    CustomPaint(
                      size: Size(w, h),
                      painter: _ScenePainter(scene.id),
                    ),
                    for (var i = 0; i < placed.length; i++)
                      _PlacedItem(
                        key: ValueKey('$_current-$i'),
                        placement: placed[i],
                        art: placed[i].art != null
                            ? scenes.artById(placed[i].art!)
                            : null,
                        stageW: w,
                        stageH: h,
                      ),
                    if (placed.isEmpty && hasItems) _hint(l10n.t('sceneHint')),
                    if (!hasItems) _hint(l10n.t('sceneEarnHint')),
                  ],
                ),
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
                fontWeight: FontWeight.w700,
                color: cs.onSurface.withValues(alpha: 0.6))),
      );
}

/// A placed decoration (emoji) or art sticker (image). Pure display widget —
/// all gesture handling (drag, pinch-resize, twist-rotate, double-tap-remove)
/// is at the parent stage level so the second finger can land anywhere on the
/// stage, not just within this widget's visual footprint.
class _PlacedItem extends StatelessWidget {
  final Placement placement;
  final ArtSticker? art;
  final double stageW;
  final double stageH;

  const _PlacedItem({
    super.key,
    required this.placement,
    required this.art,
    required this.stageW,
    required this.stageH,
  });

  @override
  Widget build(BuildContext context) {
    final p = placement;
    final isArt = p.art != null;
    final base = isArt ? 60.0 : 44.0;
    final size = (base * p.scale)
        .clamp(base * Placement.minScale, base * Placement.maxScale);
    final left = (p.x * stageW) - size / 2;
    final top  = (p.y * stageH) - size / 2;
    return Positioned(
      left: left.clamp(0.0, (stageW - size).clamp(0.0, stageW)),
      top:  top.clamp(0.0,  (stageH - size).clamp(0.0, stageH)),
      child: Transform.rotate(
        angle: p.rotation,
        child: SizedBox(
          width: size,
          height: size,
          child: Center(
            child: isArt && art != null
                ? Container(
                    width: size,
                    height: size,
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
                          filterQuality: FilterQuality.medium,
                          errorBuilder: (_, __, ___) =>
                              const Center(child: Text('🎨'))),
                    ),
                  )
                : Text(
                    isArt ? '🎨' : (decoById(p.deco ?? '')?.emoji ?? '⭐'),
                    style: TextStyle(fontSize: size * 0.78),
                  ),
          ),
        ),
      ),
    );
  }
}

// ─── Scene environment painter ───────────────────────────────────────────────
// Draws ground/sky elements on top of the gradient but behind stickers, so each
// scene has recognisable visual context before the child adds any decorations.

class _ScenePainter extends CustomPainter {
  final String sceneId;
  const _ScenePainter(this.sceneId);

  @override
  void paint(Canvas canvas, Size size) {
    switch (sceneId) {
      case 'meadow':
        _paintMeadow(canvas, size);
      case 'iceberg':
        _paintIceberg(canvas, size);
      case 'ocean':
        _paintOcean(canvas, size);
      case 'city':
        _paintCity(canvas, size);
      case 'space':
        _paintSpace(canvas, size);
    }
  }

  void _paintMeadow(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    // Grass ground strip with wavy top edge
    final groundPaint = Paint()..color = const Color(0xFF6DC46C);
    final grassY = h * 0.74;
    final groundPath = Path()
      ..moveTo(0, grassY + 8)
      ..quadraticBezierTo(w * 0.2, grassY - 14, w * 0.5, grassY + 4)
      ..quadraticBezierTo(w * 0.8, grassY + 20, w, grassY - 4)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(groundPath, groundPaint);

    // Grass blades
    final bladePaint = Paint()
      ..color = const Color(0xFF4AA84A)
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    for (final xf in [0.1, 0.22, 0.36, 0.52, 0.67, 0.8, 0.9]) {
      final x = w * xf;
      canvas.drawLine(Offset(x - 4, grassY + 6), Offset(x, grassY - 12), bladePaint);
      canvas.drawLine(Offset(x + 4, grassY + 6), Offset(x, grassY - 12), bladePaint);
    }

    // Sun
    canvas.drawCircle(Offset(w * 0.84, h * 0.14), 20,
        Paint()..color = const Color(0xFFFDD835));
  }

  void _paintIceberg(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    // Ice shelf with jagged edge
    final icePaint = Paint()..color = const Color(0xFFADD8EC);
    final iceY = h * 0.72;
    final icePath = Path()..moveTo(0, iceY + 4)
      ..lineTo(w * 0.08, iceY - 18)
      ..lineTo(w * 0.18, iceY - 6)
      ..lineTo(w * 0.32, iceY - 24)
      ..lineTo(w * 0.48, iceY - 10)
      ..lineTo(w * 0.62, iceY - 20)
      ..lineTo(w * 0.78, iceY - 4)
      ..lineTo(w * 0.9, iceY - 22)
      ..lineTo(w, iceY - 8)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(icePath, icePaint);

    // Snowflakes
    final snowPaint = Paint()..color = Colors.white.withValues(alpha: 0.75);
    for (final pos in [
      [0.14, 0.18], [0.34, 0.1], [0.56, 0.22], [0.72, 0.12], [0.88, 0.2]
    ]) {
      canvas.drawCircle(Offset(w * pos[0], h * pos[1]), 3, snowPaint);
    }
  }

  void _paintOcean(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    // Sandy ocean floor
    canvas.drawRect(
      Rect.fromLTWH(0, h * 0.76, w, h * 0.24),
      Paint()..color = const Color(0xFFF9D8A0),
    );
    // Wave line at waterline
    final wavePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.55)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final waveY = h * 0.76;
    final wavePath = Path()..moveTo(0, waveY);
    var x = 0.0;
    while (x < w) {
      wavePath.quadraticBezierTo(x + 18, waveY - 16, x + 36, waveY);
      x += 36;
    }
    canvas.drawPath(wavePath, wavePaint);
    // Bubbles
    final bubblePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8;
    canvas.drawCircle(Offset(w * 0.25, h * 0.5), 9, bubblePaint);
    canvas.drawCircle(Offset(w * 0.62, h * 0.4), 6, bubblePaint);
    canvas.drawCircle(Offset(w * 0.8, h * 0.58), 11, bubblePaint);
  }

  void _paintCity(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    // Building silhouettes
    final buildPaint = Paint()..color = const Color(0xFFE08070);
    final winPaint = Paint()..color = const Color(0xFFFFEE58);
    // Each entry: [xStart, yTopFrac, widthFrac, heightFrac]
    final buildings = [
      [0.0, 0.55, 0.18, 0.45],
      [0.16, 0.4, 0.13, 0.6],
      [0.27, 0.52, 0.14, 0.48],
      [0.39, 0.35, 0.14, 0.65],
      [0.51, 0.48, 0.13, 0.52],
      [0.62, 0.42, 0.12, 0.58],
      [0.72, 0.5, 0.14, 0.5],
      [0.84, 0.45, 0.16, 0.55],
    ];
    for (final b in buildings) {
      final bx = w * b[0];
      final by = h * b[1];
      final bw = w * b[2];
      final bh = h * b[3];
      canvas.drawRect(Rect.fromLTWH(bx, by, bw, bh), buildPaint);
      // 2×3 grid of windows
      for (var row = 0; row < 3; row++) {
        for (var col = 0; col < 2; col++) {
          canvas.drawRect(
            Rect.fromLTWH(
              bx + bw * (0.2 + col * 0.45),
              by + bh * (0.12 + row * 0.22),
              bw * 0.22,
              bh * 0.1,
            ),
            winPaint,
          );
        }
      }
    }
  }

  void _paintSpace(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    // Stars
    final starPaint = Paint()..color = Colors.white.withValues(alpha: 0.9);
    for (final s in [
      [0.1, 0.08, 2.0], [0.24, 0.16, 1.5], [0.39, 0.06, 2.5],
      [0.55, 0.13, 1.5], [0.7, 0.07, 2.0], [0.85, 0.19, 1.5],
      [0.08, 0.28, 1.0], [0.44, 0.32, 1.5], [0.63, 0.22, 1.0],
      [0.91, 0.3, 2.0], [0.17, 0.44, 1.5], [0.76, 0.38, 1.0],
    ]) {
      canvas.drawCircle(Offset(w * s[0], h * s[1]), s[2], starPaint);
    }
    // Planet with ring
    canvas.drawCircle(Offset(w * 0.22, h * 0.66), 30,
        Paint()..color = const Color(0xFF9C6FFF).withValues(alpha: 0.85));
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(w * 0.22, h * 0.66), width: 76, height: 22),
      Paint()
        ..color = const Color(0xFF9C6FFF).withValues(alpha: 0.45)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5,
    );
    // Moon
    canvas.drawCircle(Offset(w * 0.8, h * 0.18), 24,
        Paint()..color = const Color(0xFFFFE082).withValues(alpha: 0.65));
  }

  @override
  bool shouldRepaint(_ScenePainter old) => old.sceneId != sceneId;
}
