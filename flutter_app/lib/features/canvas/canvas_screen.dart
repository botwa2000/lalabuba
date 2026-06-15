// showcaseview 5.0.2's ShowCaseWidget/of/startShowCase are marked deprecated
// (slated for removal in v6) but are the documented, self-contained per-screen
// API for this pinned version; the v6 register() replacement adds global scope
// lifecycle we don't need. Intentional until we bump the package major.
// ignore_for_file: deprecated_member_use
import 'dart:async';
import 'dart:io';
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
import 'package:gal/gal.dart';
import 'package:path_provider/path_provider.dart';
import 'package:showcaseview/showcaseview.dart';
import '../../core/l10n/l10n_service.dart';
import '../../core/di/providers.dart';
import '../../features/generate/generate_service.dart';
import '../../features/gallery/gallery_screen.dart';
import '../../shared/services/storage_service.dart';
import '../../shared/widgets/lala_color_swatch.dart';
import '../../shared/widgets/lala_loading_overlay.dart';
import '../../shared/widgets/lala_showcase.dart';
import 'canvas_models.dart';
import 'canvas_painter.dart';
import 'completion_celebration.dart';

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
  // One-shot guard so the completion celebration fires once per finished image.
  bool _celebrationShown = false;
  String _subject = '';
  int? _currentSeed;
  // Colour currently under the finger while dragging the eyedropper (null when
  // not sampling). Shown as a floating preview pill.
  Color? _eyedropperPreview;
  final _canvasKey = GlobalKey();
  final _transformCtrl = TransformationController();

  // Whole-screen eyedropper. When the dropper is armed we snapshot the entire
  // page into a bitmap once, then sample that bitmap under the finger — so the
  // child can pick ANY colour visible anywhere on screen (the artwork, a fill
  // they already placed, a palette swatch, the line art), not only regions that
  // happen to be coloured. Captured once on arm (before the preview pill paints)
  // and reused for every sample, so the pill never contaminates the snapshot.
  final _pageKey = GlobalKey();
  ui.Image? _screenSnap;
  ByteData? _screenSnapBytes;
  double _snapRatio = 1;
  int _snapW = 0;
  int _snapH = 0;

  // Coach-mark tutorial targets (colours, canvas, modes, save). Runs once the
  // first time a page is ready, and again when replayed from home's How-to-play.
  final _scColors = GlobalKey();
  final _scCanvas = GlobalKey();
  final _scModes = GlobalKey();
  final _scSave = GlobalKey();
  bool _canvasTutorialSeen = true;
  bool _canvasTutorialScheduled = false;

  @override
  void initState() {
    super.initState();
    _subject = widget.args.subject;
    StorageService.readBool(StorageService.kTutorialCanvas, false).then((seen) {
      if (mounted && !seen) setState(() => _canvasTutorialSeen = false);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _generate());
  }

  @override
  void dispose() {
    _transformCtrl.dispose();
    _disposeScreenSnap();
    super.dispose();
  }

  Future<void> _generate({int? seed}) async {
    // FIX 3: re-entrancy guard. The celebration "Again" callback and the
    // error-retry button can both fire _generate while one is already running,
    // racing the detection isolate (fix 2). Bail out if a generation is already
    // in flight; _isGenerating is set before the first await below and cleared
    // in finally, so the guard can never get stuck.
    if (_isGenerating) return;

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
      _showDailyLimitReached();
      return;
    }

    setState(() {
      _isGenerating = true;
      _errorMsg = null;
      _celebrationShown = false; // arm the celebration for the new image
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
      unawaited(ref.read(progressProvider.notifier).recordGeneration());

      if (mounted) {
        setState(() {
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
          _errorMsg = e.toString();
        });
      }
    } finally {
      // FIX 3: always clear the in-flight flag so the guard can't get stuck,
      // regardless of success or error path.
      if (mounted) {
        setState(() => _isGenerating = false);
      } else {
        _isGenerating = false;
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

  void _showDailyLimitReached() {
    if (!mounted) return;
    final l10n = ref.read(l10nProvider);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('🌙 ${l10n.t('dailyLimitTitle')}',
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        content: Text(l10n.t('dailyLimitBody'),
            style: GoogleFonts.nunito(fontSize: 14)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.t('ok'),
                style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
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

  // A broad grid of kid-friendly colours — the default picker, mirroring the web
  // app's swatch grid (far more intuitive for children than dragging an HSV
  // spectrum). The rainbow spectrum is still available behind a toggle for
  // mixing a custom shade.
  static const _gridColors = <Color>[
    Color(0xFFFF4757), Color(0xFFFF6B6B), Color(0xFFFF7043), Color(0xFFFF8E53),
    Color(0xFFFFA726), Color(0xFFFFCA28), Color(0xFFFFEB3B), Color(0xFFD4E157),
    Color(0xFF9CCC65), Color(0xFF66BB6A), Color(0xFF26C281), Color(0xFF00BFA5),
    Color(0xFF26C6DA), Color(0xFF29B6F6), Color(0xFF1E90FF), Color(0xFF42A5F5),
    Color(0xFF5C6BC0), Color(0xFF7C4DFF), Color(0xFF9C27B0), Color(0xFFAB47BC),
    Color(0xFFEC407A), Color(0xFFE91E63), Color(0xFFF06292), Color(0xFFFFB3BA),
    Color(0xFF8D6E63), Color(0xFF795548), Color(0xFFA1887F), Color(0xFFFFCC80),
    Color(0xFF000000), Color(0xFF616161), Color(0xFF9E9E9E), Color(0xFFFFFFFF),
  ];

  void _showColorPickerDialog(BuildContext context, CanvasState canvas, L10n l10n) {
    final initial = canvas.activeColor == Colors.transparent
        ? const Color(0xFFFF4757)
        : canvas.activeColor;
    Color picked = initial;
    bool gridMode = true; // grid by default; toggle to the spectrum

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
                const SizedBox(height: 12),
                // Grid ⇄ Spectrum toggle
                _PickerModeToggle(
                  gridMode: gridMode,
                  gridLabel: l10n.t('pickerGrid'),
                  spectrumLabel: l10n.t('pickerSpectrum'),
                  onChanged: (g) => setS(() => gridMode = g),
                ),
                const SizedBox(height: 14),
                if (gridMode)
                  SizedBox(
                    width: 300,
                    child: Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      alignment: WrapAlignment.center,
                      children: [
                        for (final c in _gridColors)
                          GestureDetector(
                            onTap: () => setS(() => picked = c),
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: c,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: picked.toARGB32() == c.toARGB32()
                                      ? Theme.of(ctx2).colorScheme.primary
                                      : Colors.black12,
                                  width: picked.toARGB32() == c.toARGB32() ? 4 : 1,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.08),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2)),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  )
                else
                  ColorPicker(
                    pickerColor: picked,
                    onColorChanged: (c) => setS(() => picked = c),
                    pickerAreaHeightPercent: 0.7,
                    enableAlpha: false,
                    displayThumbColor: true,
                  ),
                const SizedBox(height: 14),
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

    // Fire the completion celebration once when the last guided region is filled.
    ref.listen<CanvasState>(canvasProvider, (prev, next) {
      if (!_celebrationShown &&
          next.isReady &&
          next.isComplete &&
          !_isGenerating) {
        _celebrationShown = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _onColoringComplete(next);
        });
      }
    });

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
        body: RepaintBoundary(
          key: _pageKey,
          child: Stack(children: [
            SafeArea(
          top: false,
          bottom: false,
          child: ShowCaseWidget(
            onFinish: _onCanvasTutorialFinish,
            disableMovingAnimation: true,
            builder: (sctx) {
              if (canvas.isReady &&
                  !_isGenerating &&
                  !_canvasTutorialSeen &&
                  !_canvasTutorialScheduled) {
                _canvasTutorialScheduled = true;
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) {
                    ShowCaseWidget.of(sctx).startShowCase(
                        [_scColors, _scCanvas, _scModes, _scSave]);
                  }
                });
              }
              return isLandscape
                  ? _buildLandscape(context, canvas, settings, l10n)
                  : _buildPortrait(context, canvas, settings, l10n);
            },
          ),
            ),
            // Full-screen sampling layer — only present while the dropper is
            // armed. It intercepts touches anywhere on the page so the child can
            // lift a colour from ANY pixel, then returns to tap-to-fill.
            if (canvas.mode == DrawMode.eyedropper)
              Positioned.fill(child: _buildEyedropperOverlay(context, l10n)),
          ]),
        ),
      ),
    );
  }

  // Transparent gesture layer covering the whole page while the eyedropper is
  // armed. A tap lifts the colour under the finger; a drag live-previews and
  // commits on release. Samples the page snapshot taken when the dropper armed.
  Widget _buildEyedropperOverlay(BuildContext context, L10n l10n) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapUp: (d) {
        final c = _sampleScreenAt(d.globalPosition);
        if (c != null) {
          HapticFeedback.selectionClick();
          ref.read(canvasProvider.notifier).setActiveColor(c);
        }
        _endEyedropper();
      },
      onPanStart: (d) => _onScreenEyedropperSample(d.globalPosition),
      onPanUpdate: (d) => _onScreenEyedropperSample(d.globalPosition),
      onPanEnd: (_) {
        final c = _eyedropperPreview;
        if (c != null) ref.read(canvasProvider.notifier).setActiveColor(c);
        _endEyedropper();
      },
      child: const SizedBox.expand(),
    );
  }

  void _onScreenEyedropperSample(Offset globalPos) {
    final c = _sampleScreenAt(globalPos);
    if (c == null) return;
    if (_eyedropperPreview?.toARGB32() != c.toARGB32()) {
      HapticFeedback.selectionClick();
      setState(() => _eyedropperPreview = c);
    }
  }

  void _endEyedropper() {
    ref.read(canvasProvider.notifier).setMode(DrawMode.tap);
    _disposeScreenSnap();
    if (_eyedropperPreview != null) {
      setState(() => _eyedropperPreview = null);
    }
  }

  // Snapshot the whole page into a bitmap so the eyedropper can read any pixel.
  Future<void> _captureScreen() async {
    try {
      final boundary =
          _pageKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return;
      final ratio = MediaQuery.devicePixelRatioOf(context);
      final img = await boundary.toImage(pixelRatio: ratio);
      final bytes = await img.toByteData(format: ui.ImageByteFormat.rawRgba);
      _screenSnap?.dispose();
      _screenSnap = img;
      _screenSnapBytes = bytes;
      _snapRatio = ratio;
      _snapW = img.width;
      _snapH = img.height;
    } catch (_) {
      // Boundary not painted yet / platform refused — sampling will no-op until
      // the next arm. Never throw into the gesture path.
    }
  }

  void _disposeScreenSnap() {
    _screenSnap?.dispose();
    _screenSnap = null;
    _screenSnapBytes = null;
  }

  // Reads the page snapshot at a GLOBAL screen position. Converts to the page
  // boundary's local space, scales by the capture pixel ratio, and returns the
  // pixel colour. null if outside the snapshot or before it was captured.
  Color? _sampleScreenAt(Offset globalPos) {
    final bytes = _screenSnapBytes;
    final boundary =
        _pageKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (bytes == null || boundary == null) return null;
    final local = boundary.globalToLocal(globalPos);
    final px = (local.dx * _snapRatio).round();
    final py = (local.dy * _snapRatio).round();
    if (px < 0 || py < 0 || px >= _snapW || py >= _snapH) return null;
    final idx = (py * _snapW + px) * 4;
    if (idx < 0 || idx + 2 >= bytes.lengthInBytes) return null;
    return Color.fromARGB(
        255, bytes.getUint8(idx), bytes.getUint8(idx + 1), bytes.getUint8(idx + 2));
  }

  void _onCanvasTutorialFinish() {
    StorageService.writeBool(StorageService.kTutorialCanvas, true);
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
              if (_eyedropperPreview != null)
                Positioned(
                  top: 12, left: 0, right: 0,
                  child: _buildEyedropperPreview(context, l10n),
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
                    if (_eyedropperPreview != null)
                      Positioned(
                          top: 12, left: 0, right: 0,
                          child: _buildEyedropperPreview(context, l10n)),
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
    final l10n = ref.read(l10nProvider);
    return LalaShowcase(
      showcaseKey: _scCanvas,
      title: l10n.t('tipCanvasTitle'),
      description: l10n.t('tipCanvasBody'),
      child: Container(
        color: cs.surfaceContainerLow,
        child: canvas.isReady
            ? _buildZoomableCanvas(context, canvas)
            : const SizedBox.expand(),
      ),
    );
  }

  Widget _buildZoomableCanvas(BuildContext context, CanvasState canvas) {
    // Lock pan/zoom while painting, drawing OR eyedropping. Leaving scale on lets
    // the InteractiveViewer's scale recognizer contend with the one-finger
    // gesture, so the first movement is swallowed by the gesture arena and the
    // stroke "jumps" — and for the eyedropper the tap was swallowed entirely, so
    // sampling never fired ("wherever I touch, nothing is picked"). With it off,
    // taps/strokes/samples register immediately. Zooming is still available via
    // the zoom buttons.
    final lockGestures = canvas.mode == DrawMode.paint ||
        canvas.mode == DrawMode.pencil ||
        canvas.mode == DrawMode.eyedropper;
    return InteractiveViewer(
      transformationController: _transformCtrl,
      panEnabled: !lockGestures,
      scaleEnabled: !lockGestures,
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
        // A tap fills in BOTH tap and paint modes (and samples in eyedropper).
        // Paint mode used to react only to drags, so after the eraser forced
        // paint mode a single tap did nothing — users reported "it takes several
        // taps to colour". Treating a tap as a zero-length paint makes a single
        // tap always fill the region under the finger.
        onTapUp: (canvas.mode == DrawMode.tap ||
                canvas.mode == DrawMode.paint ||
                canvas.mode == DrawMode.eyedropper)
            ? (d) => _onCanvasTap(d.localPosition, size)
            : null,
        onPanStart: canvas.mode == DrawMode.paint
            ? (d) => _onPanUpdate(d.localPosition, size)
            : canvas.mode == DrawMode.pencil
                ? (d) =>
                    ref.read(canvasProvider.notifier).beginStroke(d.localPosition)
                : canvas.mode == DrawMode.eyedropper
                    ? (d) => _onEyedropperSample(d.localPosition, size)
                    : null,
        onPanUpdate: canvas.mode == DrawMode.paint
            ? (d) => _onPanUpdate(d.localPosition, size)
            : canvas.mode == DrawMode.pencil
                ? (d) => ref
                    .read(canvasProvider.notifier)
                    .continueStroke(d.localPosition)
                : canvas.mode == DrawMode.eyedropper
                    ? (d) => _onEyedropperSample(d.localPosition, size)
                    : null,
        onPanEnd: canvas.mode == DrawMode.eyedropper
            ? (_) => _commitEyedropper()
            : canvas.mode != DrawMode.tap
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

  void _onCanvasTap(Offset pos, Size size) {
    final canvas = ref.read(canvasProvider);
    if (canvas.mode == DrawMode.eyedropper) {
      final c = ref.read(canvasProvider.notifier).colorAtOffset(pos, size);
      if (c != null) {
        HapticFeedback.selectionClick();
        ref.read(canvasProvider.notifier).setActiveColor(c);
      }
      // Sample once, then return to TAP mode so the very next tap applies the
      // picked colour to a region (paint mode would need a drag).
      ref.read(canvasProvider.notifier).setMode(DrawMode.tap);
      if (_eyedropperPreview != null) setState(() => _eyedropperPreview = null);
      return;
    }
    _onTap(pos, size);
  }

  // Eyedropper drag: live-sample the colour under the finger and show it in a
  // floating preview pill so the child can SEE the colour before committing.
  void _onEyedropperSample(Offset pos, Size size) {
    final c = ref.read(canvasProvider.notifier).colorAtOffset(pos, size);
    if (c == null) return;
    if (_eyedropperPreview?.toARGB32() != c.toARGB32()) {
      HapticFeedback.selectionClick();
      setState(() => _eyedropperPreview = c);
    }
  }

  // Release after dragging the eyedropper: adopt the previewed colour and return
  // to tap-to-fill so the next tap paints with it.
  void _commitEyedropper() {
    final c = _eyedropperPreview;
    if (c != null) {
      ref.read(canvasProvider.notifier).setActiveColor(c);
    }
    ref.read(canvasProvider.notifier).setMode(DrawMode.tap);
    setState(() => _eyedropperPreview = null);
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

  // ─── Eyedropper live preview pill ────────────────────────────────────────────

  Widget _buildEyedropperPreview(BuildContext context, L10n l10n) {
    final c = _eyedropperPreview!;
    final hex = '#${c.toARGB32().toRadixString(16).substring(2).toUpperCase()}';
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.78),
          borderRadius: BorderRadius.circular(50),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 10,
                offset: const Offset(0, 3)),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.colorize_rounded, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: c,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              hex,
              style: GoogleFonts.nunito(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 13,
              ),
            ),
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
            LalaShowcase(
              showcaseKey: _scSave,
              title: l10n.t('tipSaveTitle'),
              description: l10n.t('tipSaveBody'),
              child: _ActionBtn(
                label: l10n.t('saveBtn'),
                onTap: canvas.isReady ? () => _saveArtwork(canvas) : null,
              ),
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
          LalaShowcase(
            showcaseKey: _scModes,
            title: l10n.t('tipModesTitle'),
            description: l10n.t('tipModesBody'),
            child: Padding(
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
          LalaShowcase(
            showcaseKey: _scColors,
            title: l10n.t('tipColorsTitle'),
            description: l10n.t('tipColorsBody'),
            child: canvas.isFreeMode
                ? _buildFreeColorRow(context, canvas, l10n)
                : _buildColorSwatches(context, canvas, settings, swatch: 40),
          ),
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
    // labels ("Freihand", "Rückgängig", …) have room instead of truncating.
    // Tablets get a wider sidebar so the palette isn't a cramped speck-grid.
    final isTablet = MediaQuery.sizeOf(context).shortestSide >= 600;
    final sidebarW = isTablet
        ? 252.0
        : (MediaQuery.sizeOf(context).width * 0.20).clamp(140.0, 184.0);

    return Container(
      width: sidebarW,
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(left: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: Column(
        children: [
          // Mode buttons
          LalaShowcase(
            showcaseKey: _scModes,
            title: l10n.t('tipModesTitle'),
            description: l10n.t('tipModesBody'),
            child: Padding(
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
          ),
          Divider(height: 1, thickness: 0.5, color: cs.outlineVariant),
          // Color section
          if (canvas.isFreeMode)
            LalaShowcase(
              showcaseKey: _scColors,
              title: l10n.t('tipColorsTitle'),
              description: l10n.t('tipColorsBody'),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 10, 8, 10),
                child: Column(
                  children: [
                    _buildSidebarColorPicker(context, canvas, l10n),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child:
                          _buildEyedropperBtn(context, canvas, l10n, size: 48),
                    ),
                  ],
                ),
              ),
            )
          else
            Expanded(
              child: LalaShowcase(
                showcaseKey: _scColors,
                title: l10n.t('tipColorsTitle'),
                description: l10n.t('tipColorsBody'),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(8, 10, 8, 10),
                  child: _buildColorSwatches(context, canvas, settings,
                      swatch: isTablet ? 56 : 44),
                ),
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
            onTap: () {
              final n = ref.read(canvasProvider.notifier);
              n.setActiveColor(color);
              // Picking a swatch while the eyedropper is armed cancels it back
              // to tap-to-fill so the next tap colours a region.
              if (ref.read(canvasProvider).mode == DrawMode.eyedropper) {
                n.setMode(DrawMode.tap);
              }
            },
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
      child: Row(
        children: [
          Expanded(
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
                    Flexible(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          l10n.t('pickColorBtn'),
                          maxLines: 1,
                          style: GoogleFonts.fredoka(
                            color: _isLight(currentColor)
                                ? Colors.black87
                                : Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          _buildEyedropperBtn(context, canvas, l10n, size: 52),
        ],
      ),
    );
  }

  // Eyedropper: arms sample-from-canvas mode. Active until the next canvas tap,
  // which sets the picked colour and returns to painting.
  Widget _buildEyedropperBtn(
      BuildContext context, CanvasState canvas, L10n l10n,
      {required double size}) {
    final cs = Theme.of(context).colorScheme;
    final active = canvas.mode == DrawMode.eyedropper;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        ref.read(canvasProvider.notifier).setMode(DrawMode.eyedropper);
        // Snapshot the page on the NEXT frame (after the overlay mounts but
        // before the preview pill paints) so the dropper can read any pixel.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _captureScreen();
        });
        ScaffoldMessenger.of(context)
          ..clearSnackBars()
          ..showSnackBar(SnackBar(
            content: Text(l10n.t('eyedropperHint'), style: GoogleFonts.nunito()),
            duration: const Duration(seconds: 2),
          ));
      },
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: active ? cs.primaryContainer : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: active ? cs.primary : cs.outlineVariant,
            width: active ? 2 : 1,
          ),
        ),
        child: Icon(
          Icons.colorize_rounded,
          color: active ? cs.onPrimaryContainer : cs.onSurface,
          size: size * 0.5,
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

  // ─── Completion celebration ─────────────────────────────────────────────────

  Future<void> _onColoringComplete(CanvasState canvas) async {
    final l10n = ref.read(l10nProvider);
    final settings = ref.read(settingsProvider).valueOrNull;

    // 1. Persist the finished artwork to the in-app Journal. We write to the app
    //    documents dir (silent, no permission prompt) — this is the dir the
    //    gallery grid reads. Mirrors the web app's auto-save-on-complete.
    try {
      final bytes = await _captureCanvas(canvas);
      if (bytes != null) {
        final dir = await getApplicationDocumentsDirectory();
        final file = File(
            '${dir.path}/lalabuba_${DateTime.now().millisecondsSinceEpoch}.png');
        await file.writeAsBytes(bytes);
        ref.invalidate(galleryImagesProvider);
      }
    } catch (_) {
      // Saving is best-effort; never block the celebration on it.
    }

    // 2. Record progress + award any new stickers.
    List<StickerBadge> newBadges = const [];
    try {
      newBadges = await ref.read(progressProvider.notifier).recordCompletion(
            subject: _subject,
            difficulty: settings?.difficulty,
          );
    } catch (_) {}
    final progress =
        ref.read(progressProvider).valueOrNull ?? const Progress();

    if (!mounted) return;

    // 3. Celebrate → reveal sticker → what-next loop back to creation.
    await showCompletionCelebration(
      context,
      l10n: l10n,
      progress: progress,
      newBadges: newBadges,
      onAgain: () {
        if (mounted) _generate();
      },
      onNew: () {
        if (mounted && context.mounted) context.pop();
      },
      onShare: () => _shareArtwork(ref.read(canvasProvider)),
    );
  }

  // ─── Save / Share ─────────────────────────────────────────────────────────────

  Future<void> _saveArtwork(CanvasState canvas) async {
    final l10n = ref.read(l10nProvider);
    try {
      final bytes = await _captureCanvas(canvas);
      if (bytes == null) return;
      // Save to the device PHOTO GALLERY (not the app's private documents dir,
      // which is invisible to the user — the old behaviour looked like "Save
      // does nothing"). gal handles MediaStore on Android and prompts for
      // add-only Photos access on iOS.
      if (!await Gal.hasAccess()) {
        await Gal.requestAccess();
      }
      // Save into a dedicated "Lalabuba" album so the artwork is easy to FIND.
      // Without an album, gal drops the file into the Photos/Pictures root where
      // it's buried among everything else — users reported "Save did nothing"
      // because they couldn't locate it. An album surfaces it as its own group
      // in the gallery (Android) / Photos (iOS).
      await Gal.putImageBytes(bytes,
          album: 'Lalabuba',
          name: 'lalabuba_${DateTime.now().millisecondsSinceEpoch}');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(l10n.t('savedToGallery'), style: GoogleFonts.nunito()),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.t('saveFailed'), style: GoogleFonts.nunito())),
        );
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
    // Each palette is ordered so that ANY prefix (the user picks 6/12/18/24) is
    // maximally distinct: the first 12 walk the full hue wheel (red→orange→
    // yellow→lime→green→teal→cyan→blue→indigo→purple→pink→brown/neutral) with no
    // two near-identical shades, then 13–24 add a second tier + neutrals. This
    // replaces the old lists where slots 7–12 repeated the hues of 1–6 and the
    // nature set was eight near-identical greens in a row.
    const classic = [
      Color(0xFFE53935), Color(0xFFFB8C00), Color(0xFFFDD835), Color(0xFFC0CA33),
      Color(0xFF43A047), Color(0xFF00897B), Color(0xFF00ACC1), Color(0xFF1E88E5),
      Color(0xFF3949AB), Color(0xFF8E24AA), Color(0xFFD81B60), Color(0xFF6D4C41),
      Color(0xFFB71C1C), Color(0xFFFFB300), Color(0xFF7CB342), Color(0xFF00695C),
      Color(0xFF4FC3F7), Color(0xFF5E35B1), Color(0xFFF06292), Color(0xFFA1887F),
      Color(0xFF212121), Color(0xFF757575), Color(0xFFBDBDBD), Color(0xFF0D47A1),
    ];
    const pastel = [
      Color(0xFFFFADAD), Color(0xFFFFD6A5), Color(0xFFFDFFB6), Color(0xFFD0F4A0),
      Color(0xFFB9FBC0), Color(0xFFA0F0E0), Color(0xFFA0E7E5), Color(0xFFA8D0FF),
      Color(0xFFBDB2FF), Color(0xFFD4B8FF), Color(0xFFFFC6FF), Color(0xFFE7D3B3),
      Color(0xFFFFB5A7), Color(0xFFFCD5CE), Color(0xFFFAE588), Color(0xFFC7E9B0),
      Color(0xFFB5EAD7), Color(0xFFBDE0FE), Color(0xFFCAB8FF), Color(0xFFE0C3FC),
      Color(0xFFFFD1DC), Color(0xFFEAD9C4), Color(0xFFE2E2E2), Color(0xFFC9CCD3),
    ];
    const nature = [
      Color(0xFF5BA82F), Color(0xFF1B5E20), Color(0xFF2A9D8F), Color(0xFF5BC0EB),
      Color(0xFF1D6FA3), Color(0xFFE07A5F), Color(0xFFBC4B2F), Color(0xFFE9C46A),
      Color(0xFFD4A373), Color(0xFF7F5539), Color(0xFF6C757D), Color(0xFFF4A261),
      Color(0xFF8FB339), Color(0xFFA7C957), Color(0xFF40916C), Color(0xFF14532D),
      Color(0xFF277DA1), Color(0xFF9D4EDD), Color(0xFFE5989B), Color(0xFF6B4226),
      Color(0xFF495057), Color(0xFF2B2D42), Color(0xFFADB5BD), Color(0xFFF2E8CF),
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

// Segmented Grid ⇄ Spectrum toggle for the free-mode colour dialog.
class _PickerModeToggle extends StatelessWidget {
  final bool gridMode;
  final String gridLabel;
  final String spectrumLabel;
  final ValueChanged<bool> onChanged;

  const _PickerModeToggle({
    required this.gridMode,
    required this.gridLabel,
    required this.spectrumLabel,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    Widget seg(String label, IconData icon, bool selected, VoidCallback onTap) {
      return Expanded(
        child: GestureDetector(
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: selected ? cs.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(50),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon,
                    size: 16,
                    color: selected ? Colors.white : cs.onSurfaceVariant),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: GoogleFonts.fredoka(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : cs.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(50),
      ),
      child: Row(
        children: [
          seg(gridLabel, Icons.grid_view_rounded, gridMode, () => onChanged(true)),
          seg(spectrumLabel, Icons.gradient_rounded, !gridMode,
              () => onChanged(false)),
        ],
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
