import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter_colorpicker/flutter_colorpicker.dart';
import 'package:vector_math/vector_math_64.dart' show Vector3;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderRepaintBoundary;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import '../../core/l10n/l10n_service.dart';
import '../../core/di/providers.dart';
import '../../features/generate/generate_service.dart';
import '../../shared/widgets/lala_color_swatch.dart';
import '../../shared/widgets/lala_loading_overlay.dart';
import 'canvas_models.dart';
import 'canvas_painter.dart';

// Args passed when navigating to CanvasScreen
class CanvasScreenArgs {
  final String subject;
  final String displayLabel;
  final int? seed; // null = generate new

  const CanvasScreenArgs({
    required this.subject,
    required this.displayLabel,
    this.seed,
  });
}

class CanvasScreen extends ConsumerStatefulWidget {
  final CanvasScreenArgs args;
  const CanvasScreen({super.key, required this.args});

  @override
  ConsumerState<CanvasScreen> createState() => _CanvasScreenState();
}

class _CanvasScreenState extends ConsumerState<CanvasScreen> {
  bool _isGenerating = false;
  String? _errorMsg;
  bool _hintVisible = true;
  String _subject = '';
  int? _currentSeed;
  final _canvasKey = GlobalKey();
  final _transformCtrl = TransformationController();

  @override
  void initState() {
    super.initState();
    _subject = widget.args.subject;
    WidgetsBinding.instance.addPostFrameCallback((_) => _generate());
  }

  @override
  void dispose() {
    _transformCtrl.dispose();
    super.dispose();
  }

  Future<void> _generate({int? seed}) async {
    GenerateService svc;
    try {
      svc = ref.read(generateServiceProvider);
    } catch (_) {
      final config = await ref.read(appConfigProvider.future);
      svc = GenerateService(config);
    }
    final settings = ref.read(settingsProvider).valueOrNull;
    final sub = ref.read(subscriptionProvider).valueOrNull;

    if (sub != null && !sub.canGenerate) {
      _showPaywall();
      return;
    }

    setState(() {
      _isGenerating = true;
      _errorMsg = null;
    });
    ref.read(canvasProvider.notifier).reset();

    try {
      final result = await svc.generate(
        subject: _subject,
        difficulty: settings?.difficulty ?? 'medium',
        colorCount: settings?.colorCount ?? 12,
        seed: seed,
      );

      final minArea = _minAreaFor(settings?.difficulty ?? 'medium');
      final paletteColors = _getPaletteColors(
        settings?.palette ?? 'classic',
        settings?.colorCount ?? 12,
      );
      await ref.read(canvasProvider.notifier).loadImage(
        result.imageBytes,
        minArea,
        showNumbers: settings?.showNumbers ?? true,
        palette: paletteColors,
      );

      await ref.read(subscriptionProvider.notifier).recordGeneration();

      if (mounted) {
        setState(() {
          _isGenerating = false;
          _hintVisible = true;
          _currentSeed = result.seed;
        });
        Future.delayed(const Duration(seconds: 4), () {
          if (mounted) setState(() => _hintVisible = false);
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isGenerating = false;
          _errorMsg = e.toString();
        });
      }
    }
  }

  int _minAreaFor(String difficulty) {
    switch (difficulty) {
      case 'easy':    return 2000;
      case 'medium':  return 1000;
      case 'hard':    return 400;
      case 'extreme': return 150;
      default:        return 800;
    }
  }

  void _showPaywall() {
    if (mounted) context.pushNamed('subscription');
  }

  Future<bool> _confirmLeave(BuildContext context, L10n l10n) async {
    final canvas = ref.read(canvasProvider);
    final hasProgress =
        canvas.regionColors.isNotEmpty || canvas.strokes.isNotEmpty;
    if (!hasProgress) return true;

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.t('backConfirmTitle'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        content: Text(l10n.t('backConfirmBody'),
            style: GoogleFonts.nunito(fontSize: 14)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.t('backConfirmStay'),
                style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.t('backConfirmLeave'),
                style: GoogleFonts.nunito(
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.error)),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _onGoFree(BuildContext context, CanvasState canvas, L10n l10n) async {
    if (canvas.isFreeMode) return;
    final hasProgress = canvas.regionColors.isNotEmpty || canvas.strokes.isNotEmpty;

    bool proceed = !hasProgress;
    if (hasProgress) {
      final result = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🎨', style: TextStyle(fontSize: 56)),
              const SizedBox(height: 10),
              Text(
                l10n.t('goFreeTitle'),
                style: GoogleFonts.fredoka(fontSize: 18, fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                l10n.t('goFreeBody'),
                style: GoogleFonts.nunito(fontSize: 14),
                textAlign: TextAlign.center,
              ),
            ],
          ),
          actionsAlignment: MainAxisAlignment.center,
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l10n.t('goFreeCancel'),
                  style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF7C4DFF),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(50)),
              ),
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(l10n.t('goFreeConfirm'),
                  style: GoogleFonts.fredoka(fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ],
        ),
      );
      proceed = result ?? false;
    }

    if (proceed) {
      ref.read(canvasProvider.notifier).setFreeMode();
    }
  }

  void _showColorPickerDialog(BuildContext context, CanvasState canvas, L10n l10n) {
    final initial = canvas.activeColor == Colors.transparent
        ? const Color(0xFFFF4757)
        : canvas.activeColor;
    Color picked = initial;

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
          child: StatefulBuilder(
            builder: (ctx2, setS) => Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('🌈', style: TextStyle(fontSize: 28)),
                const SizedBox(height: 4),
                Text(
                  l10n.t('pickColorBtn'),
                  style: GoogleFonts.fredoka(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 14),
                ColorPicker(
                  pickerColor: picked,
                  onColorChanged: (c) => setS(() => picked = c),
                  pickerAreaHeightPercent: 0.7,
                  enableAlpha: false,
                  displayThumbColor: true,
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: picked,
                      foregroundColor: _isLight(picked) ? Colors.black87 : Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(50)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: () {
                      ref.read(canvasProvider.notifier).setActiveColor(picked);
                      Navigator.pop(ctx);
                    },
                    child: Text(
                      l10n.t('pickColorConfirm'),
                      style: GoogleFonts.fredoka(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  bool _isLight(Color c) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.6;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final l10n = ref.watch(l10nProvider);
    final canvas = ref.watch(canvasProvider);
    final settings = ref.watch(settingsProvider).valueOrNull;
    final isLandscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final ok = await _confirmLeave(context, l10n);
        if (ok && context.mounted) context.pop();
      },
      child: Scaffold(
        backgroundColor: cs.surface,
        appBar: _buildAppBar(context, cs, l10n),
        body: SafeArea(
          top: false,
          bottom: false,
          child: isLandscape
              ? _buildLandscape(context, canvas, settings, l10n)
              : _buildPortrait(context, canvas, settings, l10n),
        ),
      ),
    );
  }

  // ─── Kids-friendly AppBar ────────────────────────────────────────────────────

  PreferredSizeWidget _buildAppBar(BuildContext context, ColorScheme cs, L10n l10n) {
    return AppBar(
      automaticallyImplyLeading: false,
      titleSpacing: 0,
      title: Padding(
        padding: const EdgeInsets.only(left: 8),
        child: Row(
          children: [
            GestureDetector(
              onTap: () async {
                final ok = await _confirmLeave(context, l10n);
                if (ok && context.mounted) context.pop();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF7C4DFF), Color(0xFF448AFF)],
                  ),
                  borderRadius: BorderRadius.circular(50),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF7C4DFF).withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('🏠', style: TextStyle(fontSize: 15)),
                    const SizedBox(width: 4),
                    Text(
                      l10n.t('homeBtn'),
                      style: GoogleFonts.fredoka(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                widget.args.displayLabel,
                style: GoogleFonts.fredoka(fontWeight: FontWeight.w700, fontSize: 16),
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
      actions: [
        IconButton(
          icon: const Text('🎲', style: TextStyle(fontSize: 20)),
          tooltip: l10n.t('regenBtn'),
          onPressed: _isGenerating ? null : () => _generate(),
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  // ─── Portrait layout ────────────────────────────────────────────────────────

  Widget _buildPortrait(BuildContext context, CanvasState canvas,
      SettingsState? settings, L10n l10n) {
    final hasContent = canvas.hasImage || canvas.isReady;
    return Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              _buildCanvasArea(context, canvas),
              if (_hintVisible && canvas.isReady)
                Positioned(
                  top: 0, left: 0, right: 0,
                  child: _buildHintBanner(context, l10n),
                ),
              if (_isGenerating || canvas.isProcessing)
                Positioned.fill(
                  child: LalaLoadingOverlay(
                    message: l10n.t('generating',
                        {'subject': widget.args.displayLabel}),
                  ),
                ),
              if (_errorMsg != null)
                Positioned.fill(child: _buildError(context, l10n)),
            ],
          ),
        ),
        if (hasContent) _buildDrawingPanel(context, canvas, settings, l10n),
        if (hasContent) _buildActionBar(context, canvas, l10n),
        SizedBox(height: MediaQuery.paddingOf(context).bottom),
      ],
    );
  }

  // ─── Landscape layout ───────────────────────────────────────────────────────

  Widget _buildLandscape(BuildContext context, CanvasState canvas,
      SettingsState? settings, L10n l10n) {
    final hasContent = canvas.hasImage || canvas.isReady;
    return Row(
      children: [
        Expanded(
          child: Column(
            children: [
              Expanded(
                child: Stack(
                  children: [
                    _buildCanvasArea(context, canvas),
                    if (_hintVisible && canvas.isReady)
                      Positioned(
                          top: 0, left: 0, right: 0,
                          child: _buildHintBanner(context, l10n)),
                    if (_isGenerating || canvas.isProcessing)
                      Positioned.fill(
                          child: LalaLoadingOverlay(
                              message: l10n.t('generating',
                                  {'subject': widget.args.displayLabel}))),
                    if (_errorMsg != null)
                      Positioned.fill(child: _buildError(context, l10n)),
                  ],
                ),
              ),
              if (hasContent) _buildActionBar(context, canvas, l10n),
              SizedBox(height: MediaQuery.paddingOf(context).bottom),
            ],
          ),
        ),
        if (hasContent) _buildDrawingSidebar(context, canvas, settings, l10n),
      ],
    );
  }

  // ─── Canvas area ─────────────────────────────────────────────────────────────

  Widget _buildCanvasArea(BuildContext context, CanvasState canvas) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      color: cs.surfaceContainerLow,
      child: canvas.isReady
          ? _buildZoomableCanvas(context, canvas)
          : const SizedBox.expand(),
    );
  }

  Widget _buildZoomableCanvas(BuildContext context, CanvasState canvas) {
    final isPaintOrPencil =
        canvas.mode == DrawMode.paint || canvas.mode == DrawMode.pencil;
    return InteractiveViewer(
      transformationController: _transformCtrl,
      panEnabled: !isPaintOrPencil,
      scaleEnabled: true,
      minScale: 0.5,
      maxScale: 6.0,
      boundaryMargin: const EdgeInsets.all(40),
      child: _buildInteractiveCanvas(context, canvas),
    );
  }

  Widget _buildInteractiveCanvas(BuildContext context, CanvasState canvas) {
    return LayoutBuilder(builder: (ctx, constraints) {
      final size = Size(constraints.maxWidth, constraints.maxHeight);
      return GestureDetector(
        onTapUp: canvas.mode == DrawMode.tap
            ? (d) => _onTap(d.localPosition, size)
            : null,
        onPanStart: canvas.mode == DrawMode.paint
            ? (d) => _onPanUpdate(d.localPosition, size)
            : canvas.mode == DrawMode.pencil
                ? (d) =>
                    ref.read(canvasProvider.notifier).beginStroke(d.localPosition)
                : null,
        onPanUpdate: canvas.mode == DrawMode.paint
            ? (d) => _onPanUpdate(d.localPosition, size)
            : canvas.mode == DrawMode.pencil
                ? (d) => ref
                    .read(canvasProvider.notifier)
                    .continueStroke(d.localPosition)
                : null,
        onPanEnd: canvas.mode != DrawMode.tap
            ? (_) => ref.read(canvasProvider.notifier).endStroke()
            : null,
        child: RepaintBoundary(
          key: _canvasKey,
          child: CustomPaint(
            size: size,
            painter: CanvasPainter(canvas),
          ),
        ),
      );
    });
  }

  void _onTap(Offset pos, Size size) {
    final regionId =
        ref.read(canvasProvider.notifier).regionAtOffset(pos, size);
    if (regionId != null) {
      HapticFeedback.lightImpact();
      ref.read(canvasProvider.notifier).fillRegion(regionId);
    }
  }

  void _onPanUpdate(Offset pos, Size size) {
    final regionId =
        ref.read(canvasProvider.notifier).regionAtOffset(pos, size);
    if (regionId != null) {
      ref.read(canvasProvider.notifier).fillRegion(regionId);
    }
  }

  void _zoomBy(double factor) {
    final current = _transformCtrl.value;
    final currentScale = current.getMaxScaleOnAxis();
    final newScale = (currentScale * factor).clamp(0.5, 6.0);
    if ((newScale - currentScale).abs() < 0.001) return;
    final actualFactor = newScale / currentScale;
    _transformCtrl.value = current.clone()
      ..scaleByVector3(Vector3(actualFactor, actualFactor, 1.0));
  }

  void _resetZoom() => _transformCtrl.value = Matrix4.identity();

  // ─── Hint banner ─────────────────────────────────────────────────────────────

  Widget _buildHintBanner(BuildContext context, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: () => setState(() => _hintVisible = false),
      child: Container(
        margin: const EdgeInsets.all(8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: cs.primaryContainer,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                l10n.t('coloringHint'),
                style: GoogleFonts.nunito(
                    fontSize: 13, color: cs.onPrimaryContainer),
              ),
            ),
            Icon(Icons.close_rounded,
                size: 16, color: cs.onPrimaryContainer),
          ],
        ),
      ),
    );
  }

  // ─── Action bar (zoom + utilities) ──────────────────────────────────────────

  Widget _buildActionBar(BuildContext context, CanvasState canvas, L10n l10n) {
    final cs = Theme.of(context).colorScheme;

    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(top: BorderSide(color: cs.outlineVariant, width: 0.5)),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, -2)),
        ],
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            _ActionBtn(label: l10n.t('zoomIn'), onTap: () => _zoomBy(1.4)),
            const SizedBox(width: 8),
            _ActionBtn(label: l10n.t('zoomOut'), onTap: () => _zoomBy(1 / 1.4)),
            const SizedBox(width: 8),
            _ActionBtn(label: l10n.t('zoomReset'), onTap: _resetZoom),
            const SizedBox(width: 16),
            Container(width: 1, height: 28, color: cs.outlineVariant),
            const SizedBox(width: 16),
            _ActionBtn(
              label: l10n.t('printBtn'),
              onTap: canvas.isReady ? () => _printArtwork(canvas) : null,
            ),
            const SizedBox(width: 8),
            _ActionBtn(
              label: l10n.t('saveBtn'),
              onTap: canvas.isReady ? () => _saveArtwork(canvas) : null,
            ),
            const SizedBox(width: 8),
            _ActionBtn(
              label: l10n.t('shareArtBtn'),
              onTap: canvas.isReady ? () => _shareArtwork(canvas) : null,
            ),
            const SizedBox(width: 8),
            _ActionBtn(
              label: l10n.t('challengeBtn'),
              onTap: (_currentSeed != null && canvas.isReady)
                  ? _showChallengeDialog
                  : null,
            ),
          ],
        ),
      ),
    );
  }

  // ─── Drawing panel (portrait) ────────────────────────────────────────────────

  Widget _buildDrawingPanel(BuildContext context, CanvasState canvas,
      SettingsState? settings, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    final mode = canvas.mode;
    final isEraser = canvas.activeColor == Colors.transparent;

    return Container(
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(top: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Row 1: Mode buttons. A Wrap (not a Row of Expanded) so each button
          // keeps a readable natural width and the set flows onto a second line
          // when the localized labels don't all fit — instead of squeezing the
          // text until it wraps vertically inside each button.
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                _ActionBtn(
                  label: l10n.t('tapModeBtn'),
                  active: mode == DrawMode.tap && !isEraser,
                  onTap: () {
                    ref.read(canvasProvider.notifier).setMode(DrawMode.tap);
                    if (isEraser) {
                      final colors = _getPaletteColors(
                          settings?.palette ?? 'classic', settings?.colorCount ?? 12);
                      if (colors.isNotEmpty) {
                        ref.read(canvasProvider.notifier).setActiveColor(colors.first);
                      }
                    }
                  },
                ),
                _ActionBtn(
                  label: l10n.t('paintModeBtn'),
                  active: mode == DrawMode.paint && !isEraser,
                  onTap: () =>
                      ref.read(canvasProvider.notifier).setMode(DrawMode.paint),
                ),
                _ActionBtn(
                  label: l10n.t('pencilBtn'),
                  active: mode == DrawMode.pencil,
                  onTap: () => ref.read(canvasProvider.notifier).setMode(
                      mode == DrawMode.pencil ? DrawMode.tap : DrawMode.pencil),
                ),
                _ActionBtn(
                  label: l10n.t('eraserBtn'),
                  active: isEraser,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    ref.read(canvasProvider.notifier)
                        .setActiveColor(Colors.transparent);
                    ref.read(canvasProvider.notifier)
                        .setMode(DrawMode.paint);
                  },
                ),
                _ActionBtn(
                  label: l10n.t('undoBtn'),
                  onTap: canvas.undoStack.isEmpty
                      ? null
                      : () => ref.read(canvasProvider.notifier).undo(),
                ),
              ],
            ),
          ),
          // Row 2: Numbers toggle + Go free. In free mode the Numbers button
          // returns to guided coloring (reversible, mirrors the web app).
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
            child: Row(
              children: [
                _ActionBtn(
                  // In free mode this button returns to numbered coloring, so label
                  // it with the noun ("Numbers") not the ON/OFF toggle state.
                  label: canvas.isFreeMode
                      ? '🔢 ${l10n.t("numbersLabel")}'
                      : (canvas.showNumbers
                          ? '🔢 ${l10n.t("numbersOn")}'
                          : '🔡 ${l10n.t("numbersOff")}'),
                  active: !canvas.isFreeMode && canvas.showNumbers,
                  onTap: () => canvas.isFreeMode
                      ? ref.read(canvasProvider.notifier).exitFreeMode()
                      : ref.read(canvasProvider.notifier).toggleNumbers(),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: canvas.isFreeMode
                      ? const SizedBox.shrink()
                      : _ActionBtn(
                          label: l10n.t('goFreeBtn'),
                          onTap: () => _onGoFree(context, canvas, l10n),
                        ),
                ),
              ],
            ),
          ),
          // Row 3: Color section — swatches (guided) or HSV picker (free)
          if (canvas.isFreeMode)
            _buildFreeColorRow(context, canvas, l10n)
          else
            _buildColorSwatches(context, canvas, settings, swatch: 40),
        ],
      ),
    );
  }

  // ─── Drawing sidebar (landscape) ─────────────────────────────────────────────

  Widget _buildDrawingSidebar(BuildContext context, CanvasState canvas,
      SettingsState? settings, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    final mode = canvas.mode;
    final isEraser = canvas.activeColor == Colors.transparent;

    // Width scales with the screen (relative, not a fixed 128px) so the German
    // labels ("Zeichnen", "Rückgängig", …) have room instead of truncating.
    final sidebarW = (MediaQuery.sizeOf(context).width * 0.20).clamp(140.0, 184.0);

    return Container(
      width: sidebarW,
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(left: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: Column(
        children: [
          // Mode buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 10, 8, 8),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _SidebarBtn(
                        label: l10n.t('tapModeBtn'),
                        active: mode == DrawMode.tap && !isEraser,
                        onTap: () {
                          ref.read(canvasProvider.notifier).setMode(DrawMode.tap);
                          if (isEraser) {
                            final colors = _getPaletteColors(
                                settings?.palette ?? 'classic',
                                settings?.colorCount ?? 12);
                            if (colors.isNotEmpty) {
                              ref.read(canvasProvider.notifier)
                                  .setActiveColor(colors.first);
                            }
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _SidebarBtn(
                        label: l10n.t('paintModeBtn'),
                        active: mode == DrawMode.paint && !isEraser,
                        onTap: () =>
                            ref.read(canvasProvider.notifier).setMode(DrawMode.paint),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: _SidebarBtn(
                        label: l10n.t('pencilBtn'),
                        active: mode == DrawMode.pencil,
                        onTap: () => ref.read(canvasProvider.notifier).setMode(
                            mode == DrawMode.pencil ? DrawMode.tap : DrawMode.pencil),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _SidebarBtn(
                        label: l10n.t('eraserBtn'),
                        active: isEraser,
                        onTap: () {
                          HapticFeedback.selectionClick();
                          ref.read(canvasProvider.notifier)
                              .setActiveColor(Colors.transparent);
                          ref.read(canvasProvider.notifier)
                              .setMode(DrawMode.paint);
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                SizedBox(
                  width: double.infinity,
                  child: _SidebarBtn(
                    label: l10n.t('undoBtn'),
                    onTap: canvas.undoStack.isEmpty
                        ? null
                        : () => ref.read(canvasProvider.notifier).undo(),
                  ),
                ),
                // Numbers + Go free. In free mode the Numbers button returns to
                // guided coloring (reversible, mirrors the web app).
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: _SidebarBtn(
                        label: canvas.isFreeMode
                            ? '🔢'
                            : (canvas.showNumbers ? '🔢' : '🔡'),
                        active: !canvas.isFreeMode && canvas.showNumbers,
                        onTap: () => canvas.isFreeMode
                            ? ref.read(canvasProvider.notifier).exitFreeMode()
                            : ref.read(canvasProvider.notifier).toggleNumbers(),
                      ),
                    ),
                    if (!canvas.isFreeMode) ...[
                      const SizedBox(width: 6),
                      Expanded(
                        child: _SidebarBtn(
                          label: l10n.t('goFreeBtn'),
                          onTap: () => _onGoFree(context, canvas, l10n),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Divider(height: 1, thickness: 0.5, color: cs.outlineVariant),
          // Color section
          if (canvas.isFreeMode)
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 10, 8, 10),
              child: _buildSidebarColorPicker(context, canvas, l10n),
            )
          else
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(8, 10, 8, 10),
                child: _buildColorSwatches(context, canvas, settings, swatch: 44),
              ),
            ),
        ],
      ),
    );
  }

  // ─── Color swatches helper ────────────────────────────────────────────────────

  Widget _buildColorSwatches(BuildContext context, CanvasState canvas,
      SettingsState? settings, {required double swatch}) {
    final colors = _getPaletteColors(
        settings?.palette ?? 'classic', settings?.colorCount ?? 12);
    final hintColor = canvas.hintColor;
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      alignment: WrapAlignment.center,
      children: [
        for (final color in colors)
          LalaColorSwatch(
            color: color,
            size: swatch,
            active: canvas.activeColor == color,
            pulse: hintColor != null && hintColor == color,
            onTap: () =>
                ref.read(canvasProvider.notifier).setActiveColor(color),
          ),
      ],
    );
  }

  // ─── Free mode color picker (portrait row) ───────────────────────────────────

  Widget _buildFreeColorRow(BuildContext context, CanvasState canvas, L10n l10n) {
    final currentColor = canvas.activeColor == Colors.transparent
        ? const Color(0xFFFF4757)
        : canvas.activeColor;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      child: GestureDetector(
        onTap: () => _showColorPickerDialog(context, canvas, l10n),
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            color: currentColor,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: currentColor.withValues(alpha: 0.35),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('🎨', style: TextStyle(fontSize: 22)),
              const SizedBox(width: 8),
              Text(
                l10n.t('pickColorBtn'),
                style: GoogleFonts.fredoka(
                  color: _isLight(currentColor) ? Colors.black87 : Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Free mode color picker (landscape sidebar) ───────────────────────────────

  Widget _buildSidebarColorPicker(BuildContext context, CanvasState canvas, L10n l10n) {
    final currentColor = canvas.activeColor == Colors.transparent
        ? const Color(0xFFFF4757)
        : canvas.activeColor;
    return GestureDetector(
      onTap: () => _showColorPickerDialog(context, canvas, l10n),
      child: Container(
        height: 60,
        decoration: BoxDecoration(
          color: currentColor,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: currentColor.withValues(alpha: 0.35),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('🎨', style: TextStyle(fontSize: 20)),
            Text(
              l10n.t('pickColorBtn'),
              style: GoogleFonts.fredoka(
                color: _isLight(currentColor) ? Colors.black87 : Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
            ),
          ],
        ),
      ),
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────────

  Widget _buildError(BuildContext context, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      color: cs.surface,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('😔', style: TextStyle(fontSize: 48)),
              const SizedBox(height: 16),
              Text(
                _errorMsg ?? 'Something went wrong',
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(fontSize: 15),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => _generate(),
                child: Text(
                  l10n.t('regenBtn'),
                  style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Save / Share ─────────────────────────────────────────────────────────────

  Future<void> _saveArtwork(CanvasState canvas) async {
    try {
      final bytes = await _captureCanvas(canvas);
      if (bytes == null) return;
      final dir = await getApplicationDocumentsDirectory();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final file = File('${dir.path}/lalabuba_$timestamp.png');
      await file.writeAsBytes(bytes);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('💾 Saved!', style: GoogleFonts.nunito()),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Could not save: $e')));
      }
    }
  }

  Future<void> _shareArtwork(CanvasState canvas) async {
    try {
      final bytes = await _captureCanvas(canvas);
      if (bytes == null) return;
      final file = XFile.fromData(bytes,
          mimeType: 'image/png',
          name: 'lalabuba_${widget.args.displayLabel}.png');
      final l10n = ref.read(l10nProvider);
      await SharePlus.instance.share(ShareParams(
        files: [file],
        text: l10n.t('shareImageText', {'subject': widget.args.displayLabel}),
      ));
    } catch (_) {}
  }

  Future<void> _printArtwork(CanvasState canvas) async {
    try {
      final bytes = await _captureCanvas(canvas);
      if (bytes == null) return;
      final file = XFile.fromData(bytes,
          mimeType: 'image/png',
          name: 'lalabuba_${widget.args.displayLabel}.png');
      await SharePlus.instance.share(ShareParams(
        files: [file],
        subject: 'Print — Lalabuba: ${widget.args.displayLabel}',
      ));
    } catch (_) {}
  }

  // ─── Challenge → QR code dialog ──────────────────────────────────────────────

  void _showChallengeDialog() {
    final seed = _currentSeed;
    if (seed == null) return;

    final baseUrl = ref.read(appConfigProvider).valueOrNull?.apiBaseUrl
        ?? 'https://lalabuba.com';
    final encodedSubject = Uri.encodeQueryComponent(_subject);
    final challengeUrl = '$baseUrl/challenge?subject=$encodedSubject&seed=$seed';
    final l10n = ref.read(l10nProvider);
    final cs = Theme.of(context).colorScheme;

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                l10n.t('challengeBtn'),
                style: GoogleFonts.fredoka(
                    fontSize: 20, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 12,
                        offset: const Offset(0, 4)),
                  ],
                ),
                child: QrImageView(
                  data: challengeUrl,
                  version: QrVersions.auto,
                  size: 200,
                  backgroundColor: Colors.white,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                l10n.t('challengeHint'),
                style: GoogleFonts.nunito(
                    fontSize: 13,
                    color: cs.onSurface.withValues(alpha: 0.7)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: Text(l10n.t('backConfirmStay'),
                        style: GoogleFonts.nunito()),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.icon(
                    onPressed: () async {
                      Navigator.pop(ctx);
                      final text = l10n.t('challengeText',
                          {'subject': widget.args.displayLabel});
                      try {
                        await SharePlus.instance.share(ShareParams(
                          text: '$text\n$challengeUrl',
                          subject: 'Lalabuba Challenge 🏆',
                        ));
                      } catch (_) {}
                    },
                    icon: const Icon(Icons.share_rounded, size: 18),
                    label: Text(l10n.t('challengeShare'),
                        style: GoogleFonts.fredoka(
                            fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Canvas capture ───────────────────────────────────────────────────────────

  Future<Uint8List?> _captureCanvas(CanvasState canvas) async {
    try {
      final boundary = _canvasKey.currentContext?.findRenderObject()
          as RenderRepaintBoundary?;
      if (boundary != null) {
        final image = await boundary.toImage(pixelRatio: 3.0);
        final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
        image.dispose();
        return byteData?.buffer.asUint8List();
      }
    } catch (_) {}
    final img = canvas.compositeImage;
    if (img == null) return null;
    final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
    return byteData?.buffer.asUint8List();
  }

  // ─── Palette ──────────────────────────────────────────────────────────────────

  List<Color> _getPaletteColors(String palette, int count) {
    const classic = [
      Color(0xFFFF4757), Color(0xFFFF7043), Color(0xFFFFCA28), Color(0xFF26C281),
      Color(0xFF1E90FF), Color(0xFF7C4DFF), Color(0xFFE91E63), Color(0xFF00BCD4),
      Color(0xFF795548), Color(0xFF607D8B), Color(0xFF4CAF50), Color(0xFFFF5722),
      Color(0xFF9C27B0), Color(0xFF3F51B5), Color(0xFFFFC107), Color(0xFF009688),
      Color(0xFF673AB7), Color(0xFFF44336), Color(0xFF2196F3), Color(0xFF8BC34A),
      Color(0xFFCDDC39), Color(0xFF00BFA5), Color(0xFFFF6F00), Color(0xFF212121),
    ];
    const pastel = [
      Color(0xFFFFB3BA), Color(0xFFFFDFBA), Color(0xFFFFFFBA), Color(0xFFBAFFC9),
      Color(0xFFBAE1FF), Color(0xFFCDB4DB), Color(0xFFF7B2C1), Color(0xFFA8D8EA),
      Color(0xFFFDD2BF), Color(0xFFCFEACA), Color(0xFFE8C8E8), Color(0xFFB5D5C5),
      Color(0xFFFFD1DC), Color(0xFFBDE0FE), Color(0xFFC8F7C5), Color(0xFFF6C5AF),
      Color(0xFFE8D5B7), Color(0xFFD4E1F7), Color(0xFFF0E6CA), Color(0xFFDAEFDB),
      Color(0xFFE5D0F5), Color(0xFFFFE4B5), Color(0xFFB0E0E6), Color(0xFFF5DEB3),
    ];
    const nature = [
      Color(0xFF5D8233), Color(0xFF3B7A57), Color(0xFF1B4332), Color(0xFF52B788),
      Color(0xFF2D6A4F), Color(0xFF40916C), Color(0xFF74C69D), Color(0xFFB7E4C7),
      Color(0xFF8B4513), Color(0xFFA0522D), Color(0xFFCD853F), Color(0xFFDEB887),
      Color(0xFF6B4226), Color(0xFF8B6914), Color(0xFFD4A017), Color(0xFFF5DEB3),
      Color(0xFF4682B4), Color(0xFF1E90FF), Color(0xFF87CEEB), Color(0xFFB0C4DE),
      Color(0xFF708090), Color(0xFF2F4F4F), Color(0xFF696969), Color(0xFF808080),
    ];

    final src = palette == 'pastel'
        ? pastel
        : palette == 'nature'
            ? nature
            : classic;
    final effectiveCount =
        count == 99 ? src.length : count.clamp(1, src.length);
    return src.take(effectiveCount).toList();
  }
}

// ─── Helper widgets ───────────────────────────────────────────────────────────

class _ActionBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool active;

  const _ActionBtn({required this.label, this.onTap, this.active = false});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color:
              active ? cs.primaryContainer : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(22),
        ),
        // Keep the label on a single line; if a (localized) label is wider than
        // its box it scales down rather than wrapping vertically.
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            label,
            maxLines: 1,
            softWrap: false,
            style: GoogleFonts.fredoka(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: onTap == null
                  ? cs.onSurface.withValues(alpha: 0.3)
                  : active
                      ? cs.onPrimaryContainer
                      : cs.onSurface,
            ),
          ),
        ),
      ),
    );
  }
}

class _SidebarBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool active;

  const _SidebarBtn({required this.label, this.onTap, this.active = false});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 34,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(
          color: active ? cs.primaryContainer : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(10),
        ),
        // Scale the label down to fit the button width instead of truncating —
        // keeps full words readable at any sidebar width.
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            label,
            style: GoogleFonts.fredoka(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: onTap == null
                  ? cs.onSurface.withValues(alpha: 0.3)
                  : active
                      ? cs.onPrimaryContainer
                      : cs.onSurface,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
          ),
        ),
      ),
    );
  }
}
