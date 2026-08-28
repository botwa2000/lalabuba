import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../progress/progress_service.dart';
import 'mascot.dart';
import 'mascot_service.dart';

// ── Mascot Avatar widget (used in nav bar + rewards card) ─────────────────────

class MascotAvatar extends ConsumerWidget {
  final double size;
  final VoidCallback? onTap;

  const MascotAvatar({super.key, this.size = 36, this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs    = Theme.of(context).colorScheme;
    final ms    = ref.watch(mascotProvider).value;
    final mascot = ms?.mascot;
    final hat    = ms?.hat;

    final baseEmoji = mascot?.emoji ?? '🐧';
    final hatEmoji  = hat?.emoji;

    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [cs.primaryContainer, cs.secondaryContainer],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              border: Border.all(color: cs.primary.withValues(alpha: 0.4), width: 2),
            ),
            child: Center(
              child: Text(baseEmoji,
                  style: TextStyle(fontSize: size * 0.52, height: 1)),
            ),
          ),
          if (hatEmoji != null)
            Positioned(
              top: -4, right: -4,
              child: Text(hatEmoji,
                  style: TextStyle(fontSize: size * 0.38, height: 1)),
            ),
        ],
      ),
    );
  }
}

// ── Mascot Chooser (first-time setup) ─────────────────────────────────────────

class MascotChooser extends ConsumerWidget {
  const MascotChooser({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs  = Theme.of(context).colorScheme;
    final l10n = ref.watch(l10nProvider);
    final ms  = ref.watch(mascotProvider).value ?? const MascotState();

    final unlocked = kMascots.where((m) => isMascotUnlocked(m, ms.loadouts)).toList();
    final locked   = kMascots.where((m) => !isMascotUnlocked(m, ms.loadouts)).toList();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.t('mascotChooseTitle'),
            style: GoogleFonts.fredoka(
                fontSize: 20, fontWeight: FontWeight.w700, color: cs.primary)),
        const SizedBox(height: 4),
        Text(l10n.t('mascotChooseSubtitle'),
            style: GoogleFonts.nunito(
                fontSize: 14, color: cs.onSurface.withValues(alpha: 0.7))),
        const SizedBox(height: 16),
        Text('Your companions',
            style: GoogleFonts.fredoka(fontSize: 14, fontWeight: FontWeight.w700,
                color: cs.onSurface.withValues(alpha: 0.6))),
        const SizedBox(height: 8),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: unlocked.map((m) => _MascotChip(m: m)).toList(),
        ),
        if (locked.isNotEmpty) ...[
          const SizedBox(height: 20),
          Text('Coming soon',
              style: GoogleFonts.fredoka(fontSize: 14, fontWeight: FontWeight.w700,
                  color: cs.onSurface.withValues(alpha: 0.4))),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: locked.map((m) => _buildLockedChip(context, cs, m)).toList(),
          ),
        ],
      ],
    );
  }

  Widget _buildLockedChip(BuildContext context, ColorScheme cs, Mascot m) {
    return Opacity(
      opacity: 0.45,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: cs.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: cs.outlineVariant, width: 1),
            ),
            child: Column(
              children: [
                Text(m.emoji, style: const TextStyle(fontSize: 32)),
                const SizedBox(height: 4),
                Text(m.name, style: GoogleFonts.fredoka(
                    fontSize: 12, fontWeight: FontWeight.w700,
                    color: cs.onSurface)),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Text('🔒 ${mascotUnlockHint(m)}',
              style: GoogleFonts.nunito(fontSize: 10,
                  color: cs.onSurface.withValues(alpha: 0.5))),
        ],
      ),
    );
  }
}

class _MascotChip extends ConsumerWidget {
  final Mascot m;
  const _MascotChip({required this.m});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final ms = ref.watch(mascotProvider).value;
    final selected = ms?.selectedMascotId == m.id;

    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        ref.read(mascotProvider.notifier).chooseMascot(m.id);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? cs.primaryContainer : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? cs.primary : cs.outlineVariant,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Text(m.emoji, style: const TextStyle(fontSize: 32)),
            const SizedBox(height: 4),
            Text(m.name, style: GoogleFonts.fredoka(
                fontSize: 12, fontWeight: FontWeight.w700,
                color: selected ? cs.primary : cs.onSurface)),
          ],
        ),
      ),
    );
  }
}

// ── Mascot Studio Screen ──────────────────────────────────────────────────────

class MascotStudioScreen extends ConsumerStatefulWidget {
  const MascotStudioScreen({super.key});

  @override
  ConsumerState<MascotStudioScreen> createState() => _MascotStudioScreenState();
}

class _MascotStudioScreenState extends ConsumerState<MascotStudioScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _categories = ['hat', 'accessory', 'expression'];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: _categories.length, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n     = ref.watch(l10nProvider);
    final ms       = ref.watch(mascotProvider).value ?? const MascotState();
    final progress = ref.watch(progressProvider).value ?? const Progress();
    final total    = progress.totalCompleted;

    if (!ms.isSetUp) {
      return Scaffold(
        appBar: AppBar(
          title: Text(l10n.t('mascotStudioTitle'),
              style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: MascotChooser(),
        ),
      );
    }

    final catLabels = [
      l10n.t('mascotHats'),
      l10n.t('mascotAccessories'),
      l10n.t('mascotExpressions'),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('mascotStudioTitle'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        bottom: TabBar(
          controller: _tabs,
          tabs: catLabels.map((l) => Tab(text: l)).toList(),
          labelStyle: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
          unselectedLabelStyle: GoogleFonts.fredoka(fontWeight: FontWeight.w400),
        ),
      ),
      body: Column(
        children: [
          // ── Companion selector row ────────────────────────────────────────
          _CompanionSelector(ms: ms),
          // ── Large mascot preview (interactive — drag/pinch items to arrange) ──
          _MascotPreview(ms: ms),
          // ── Item grid ────────────────────────────────────────────────────
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: _categories.map((cat) => _ItemGrid(
                category: cat,
                mascotState: ms,
                totalCompleted: total,
              )).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Companion selector (switch between owned mascots) ─────────────────────────

class _CompanionSelector extends ConsumerWidget {
  final MascotState ms;
  const _CompanionSelector({required this.ms});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs       = Theme.of(context).colorScheme;
    final unlocked = ms.unlockedMascots;
    if (unlocked.length <= 1) return const SizedBox.shrink();

    return Container(
      height: 64,
      color: cs.surface,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: unlocked.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final m        = unlocked[i];
          final selected = ms.selectedMascotId == m.id;
          final loadout  = ms.loadouts[m.id] ?? const MascotLoadout();
          final hatItem  = loadout.hat == null ? null :
              kMascotItems.where((item) => item.id == loadout.hat).firstOrNull;

          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              ref.read(mascotProvider.notifier).chooseMascot(m.id);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: selected ? cs.primaryContainer : cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: selected ? cs.primary : cs.outlineVariant,
                  width: selected ? 2 : 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    hatItem != null ? '${m.emoji}${hatItem.emoji}' : m.emoji,
                    style: const TextStyle(fontSize: 20, height: 1),
                  ),
                  const SizedBox(width: 6),
                  Text(m.name, style: GoogleFonts.fredoka(
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w700,
                    color: selected ? cs.primary : cs.onSurface,
                  )),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _MascotPreview extends ConsumerStatefulWidget {
  final MascotState ms;
  const _MascotPreview({required this.ms});

  @override
  ConsumerState<_MascotPreview> createState() => _MascotPreviewState();
}

class _MascotPreviewState extends ConsumerState<_MascotPreview> {
  static const _previewH = 280.0;
  static const _hitSize  = 68.0;

  // Default offsets from preview center for each slot
  static const _defaults = {
    'hat':        Offset(0,   -68),
    'accessory':  Offset(52,   12),
    'expression': Offset(-52,  52),
  };
  static const _fontSizes = {
    'hat': 40.0, 'accessory': 32.0, 'expression': 28.0,
  };

  late Map<String, ItemTransform> _liveXf;
  final Map<String, double> _baseScale = {};
  final Map<String, double> _baseAngle = {};
  String? _activeSlot;

  @override
  void initState() {
    super.initState();
    _syncFromProvider();
  }

  @override
  void didUpdateWidget(covariant _MascotPreview old) {
    super.didUpdateWidget(old);
    if (_activeSlot == null) _syncFromProvider();
  }

  void _syncFromProvider() {
    final l = widget.ms.currentLoadout;
    _liveXf = {
      'hat':        l.hatTransform,
      'accessory':  l.accessoryTransform,
      'expression': l.expressionTransform,
    };
  }

  @override
  Widget build(BuildContext context) {
    final cs     = Theme.of(context).colorScheme;
    final mascot = widget.ms.mascot;
    if (mascot == null) return const SizedBox.shrink();

    final hat = widget.ms.hat;
    final acc = widget.ms.accessory;
    final exp = widget.ms.expression;
    final hasCustom = widget.ms.currentLoadout.anyTransformCustomized;
    final hasItems  = hat != null || acc != null || exp != null;

    return LayoutBuilder(builder: (context, constraints) {
      final cx = constraints.maxWidth / 2;
      const cy = _previewH / 2;

      return Container(
        width: double.infinity,
        height: _previewH,
        color: cs.surfaceContainerLowest,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Background circle (not interactive)
            Positioned(
              left: cx - 70, top: cy - 70,
              child: Container(
                width: 140, height: 140,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [cs.primaryContainer, cs.secondaryContainer],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                ),
              ),
            ),
            // Mascot base — always centered, not interactive
            Positioned(
              left: cx - 36, top: cy - 36,
              child: Text(mascot.emoji,
                  style: const TextStyle(fontSize: 72, height: 1)),
            ),
            // Interactive decoration items
            if (hat != null) _buildItem('hat', hat.emoji, cx, cy),
            if (acc != null) _buildItem('accessory', acc.emoji, cx, cy),
            if (exp != null) _buildItem('expression', exp.emoji, cx, cy),
            // Hint (when items present but none customised yet)
            if (hasItems && !hasCustom)
              const Positioned(
                left: 0, right: 0, bottom: 6,
                child: Text(
                  '✦ drag & pinch items to arrange',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: Color(0x66000000)),
                ),
              ),
            // Reset button (when any item has been moved)
            if (hasCustom)
              Positioned(
                right: 12, bottom: 8,
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    ref.read(mascotProvider.notifier).resetTransforms();
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: cs.surfaceContainerHigh,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: cs.outlineVariant),
                    ),
                    child: Text('↺ Reset',
                        style: GoogleFonts.fredoka(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: cs.onSurface.withValues(alpha: 0.7))),
                  ),
                ),
              ),
          ],
        ),
      );
    });
  }

  Widget _buildItem(String slot, String emoji, double cx, double cy) {
    final xf   = _liveXf[slot] ?? const ItemTransform();
    final def  = _defaults[slot]!;
    final fs   = _fontSizes[slot]!;
    final isActive = _activeSlot == slot;

    final left = cx + def.dx + xf.dx - _hitSize / 2;
    final top  = cy + def.dy + xf.dy - _hitSize / 2;

    return Positioned(
      left: left,
      top:  top,
      child: GestureDetector(
        onScaleStart: (d) {
          setState(() => _activeSlot = slot);
          _baseScale[slot] = (_liveXf[slot] ?? const ItemTransform()).scale;
          _baseAngle[slot] = (_liveXf[slot] ?? const ItemTransform()).angle;
        },
        onScaleUpdate: (d) {
          final cur = _liveXf[slot] ?? const ItemTransform();
          setState(() {
            _liveXf[slot] = ItemTransform(
              dx:    cur.dx + d.focalPointDelta.dx,
              dy:    cur.dy + d.focalPointDelta.dy,
              scale: (_baseScale[slot]! * d.scale).clamp(0.5, 3.0),
              angle: _baseAngle[slot]! + d.rotation,
            );
          });
        },
        onScaleEnd: (_) {
          setState(() => _activeSlot = null);
          ref.read(mascotProvider.notifier)
              .saveTransform(slot, _liveXf[slot]!);
        },
        child: SizedBox(
          width: _hitSize, height: _hitSize,
          child: Center(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              decoration: isActive
                  ? BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.amber.withValues(alpha: 0.5),
                          blurRadius: 14,
                          spreadRadius: 2,
                        ),
                      ],
                    )
                  : null,
              child: Transform.rotate(
                angle: xf.angle,
                child: Transform.scale(
                  scale: xf.scale,
                  child: Text(emoji,
                      style: TextStyle(fontSize: fs, height: 1)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ItemGrid extends ConsumerWidget {
  final String category;
  final MascotState mascotState;
  final int totalCompleted;

  const _ItemGrid({
    required this.category,
    required this.mascotState,
    required this.totalCompleted,
  });

  String? _equippedId() {
    final loadout = mascotState.currentLoadout;
    switch (category) {
      case 'hat':        return loadout.hat;
      case 'accessory':  return loadout.accessory;
      case 'expression': return loadout.expression;
      default:           return null;
    }
  }

  Future<void> _equip(WidgetRef ref, String? id) {
    switch (category) {
      case 'hat':        return ref.read(mascotProvider.notifier).equipHat(id);
      case 'accessory':  return ref.read(mascotProvider.notifier).equipAccessory(id);
      case 'expression': return ref.read(mascotProvider.notifier).equipExpression(id);
      default:           return Future.value();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs         = Theme.of(context).colorScheme;
    final items      = itemsByCategory(category);
    final equippedId = _equippedId();

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 110,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.85,
      ),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final item     = items[i];
        final unlocked = isItemUnlocked(item, totalCompleted);
        final equipped = equippedId == item.id;

        return GestureDetector(
          onTap: unlocked
              ? () {
                  HapticFeedback.selectionClick();
                  _equip(ref, equipped ? null : item.id);
                }
              : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            decoration: BoxDecoration(
              color: equipped
                  ? cs.primaryContainer
                  : (unlocked ? cs.surfaceContainerHighest : cs.surfaceContainerLowest),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: equipped
                    ? cs.primary
                    : cs.outlineVariant.withValues(alpha: unlocked ? 1 : 0.4),
                width: equipped ? 2 : 1,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Opacity(
                  opacity: unlocked ? 1 : 0.3,
                  child: Text(item.emoji,
                      style: const TextStyle(fontSize: 36, height: 1)),
                ),
                const SizedBox(height: 6),
                Text(
                  item.name,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.fredoka(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: unlocked
                        ? (equipped ? cs.primary : cs.onSurface)
                        : cs.onSurface.withValues(alpha: 0.35),
                  ),
                ),
                if (!unlocked) ...[
                  const SizedBox(height: 2),
                  Text(
                    '🔒 ${item.unlockAt}',
                    style: GoogleFonts.nunito(
                        fontSize: 10,
                        color: cs.onSurface.withValues(alpha: 0.35)),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
