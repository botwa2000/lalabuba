import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
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
  int? _currentSeed;       // seed returned by the API — used to build challenge URL
  String? _currentBlobUrl; // blob URL from API — optional direct-image link

  @override
  void initState() {
    super.initState();
    _subject = widget.args.subject;
    WidgetsBinding.instance.addPostFrameCallback((_) => _generate());
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
      await ref
          .read(canvasProvider.notifier)
          .loadImage(result.imageBytes, minArea);

      await ref.read(subscriptionProvider.notifier).recordGeneration();

      if (mounted) {
        setState(() {
          _isGenerating = false;
          _hintVisible = true;
          _currentSeed = result.seed;
          _currentBlobUrl = result.blobUrl;
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
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () async {
              final ok = await _confirmLeave(context, l10n);
              if (ok && context.mounted) context.pop();
            },
          ),
          title: Text(
            widget.args.displayLabel,
            style:
                GoogleFonts.fredoka(fontWeight: FontWeight.w700, fontSize: 18),
            overflow: TextOverflow.ellipsis,
          ),
          actions: [
            IconButton(
              icon: const Text('🎲', style: TextStyle(fontSize: 20)),
              tooltip: l10n.t('regenBtn'),
              onPressed: _isGenerating ? null : () => _generate(),
            ),
            const SizedBox(width: 4),
          ],
        ),
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

  // ─── Portrait layout ────────────────────────────────────────────────────────

  Widget _buildPortrait(BuildContext context, CanvasState canvas,
      SettingsState? settings, L10n l10n) {
    final hasContent = canvas.hasImage || canvas.isReady;
    return Column(
      children: [
        // Canvas – fills all remaining space
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
        // Action bar + color strip: only shown once an image exists
        if (hasContent) _buildActionBar(context, canvas, settings, l10n),
        if (hasContent) _buildColorStrip(context, canvas, settings),
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
        // Canvas column (action bar below canvas, NOT overlaid)
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
              if (hasContent)
                _buildActionBar(context, canvas, settings, l10n),
              SizedBox(height: MediaQuery.paddingOf(context).bottom),
            ],
          ),
        ),
        // Color sidebar – visible only after image loads
        if (hasContent) _buildColorSidebar(context, canvas, settings),
      ],
    );
  }

  // ─── Canvas area ─────────────────────────────────────────────────────────────

  Widget _buildCanvasArea(BuildContext context, CanvasState canvas) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      color: cs.surfaceContainerLow,
      child: canvas.isReady
          ? _buildInteractiveCanvas(context, canvas)
          : const SizedBox.expand(),
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
        child: CustomPaint(
          size: size,
          painter: CanvasPainter(canvas),
        ),
      );
    });
  }

  void _onTap(Offset pos, Size size) {
    final nx = pos.dx / size.width;
    final ny = pos.dy / size.height;
    final regionId =
        ref.read(canvasProvider.notifier).regionAtNormalized(nx, ny);
    if (regionId != null) {
      HapticFeedback.lightImpact();
      ref.read(canvasProvider.notifier).fillRegion(regionId);
    }
  }

  void _onPanUpdate(Offset pos, Size size) {
    final nx = pos.dx / size.width;
    final ny = pos.dy / size.height;
    final regionId =
        ref.read(canvasProvider.notifier).regionAtNormalized(nx, ny);
    if (regionId != null) {
      ref.read(canvasProvider.notifier).fillRegion(regionId);
    }
  }

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

  // ─── Action bar ──────────────────────────────────────────────────────────────
  // Scrollable row so it never overflows on small screens.

  Widget _buildActionBar(BuildContext context, CanvasState canvas,
      SettingsState? settings, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    final mode = canvas.mode;

    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(
            top: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Row(
          children: [
            // Undo
            _ActionBtn(
              label: l10n.t('undoBtn'),
              onTap: canvas.undoStack.isEmpty
                  ? null
                  : () => ref.read(canvasProvider.notifier).undo(),
            ),
            const SizedBox(width: 6),
            // Tap / Paint mode toggle
            _ModeToggle(
              mode: mode,
              onTap: () => ref.read(canvasProvider.notifier).setMode(
                  mode == DrawMode.tap ? DrawMode.paint : DrawMode.tap),
              tapLabel: l10n.t('tapModeBtn'),
              paintLabel: l10n.t('paintModeBtn'),
            ),
            const SizedBox(width: 6),
            // Pencil / freehand
            _ActionBtn(
              label: l10n.t('pencilBtn'),
              active: mode == DrawMode.pencil,
              onTap: () => ref.read(canvasProvider.notifier).setMode(
                  mode == DrawMode.pencil ? DrawMode.tap : DrawMode.pencil),
            ),
            const SizedBox(width: 6),
            // Print — on mobile, printing goes through the system share sheet
            _ActionBtn(
              label: l10n.t('printBtn'),
              onTap: canvas.isReady ? () => _printArtwork(canvas) : null,
            ),
            const SizedBox(width: 6),
            // Save to gallery
            _ActionBtn(
              label: l10n.t('saveBtn'),
              onTap: canvas.isReady ? () => _saveArtwork(canvas) : null,
            ),
            const SizedBox(width: 6),
            // Share artwork image
            _ActionBtn(
              label: l10n.t('shareArtBtn'),
              onTap: canvas.isReady ? () => _shareArtwork(canvas) : null,
            ),
            const SizedBox(width: 6),
            // Challenge — share the coloring page URL so anyone can play along
            _ActionBtn(
              label: l10n.t('challengeBtn'),
              onTap: (_currentSeed != null && canvas.isReady)
                  ? () => _shareChallenge()
                  : null,
            ),
          ],
        ),
      ),
    );
  }

  // ─── Color strip (portrait) ──────────────────────────────────────────────────

  Widget _buildColorStrip(
      BuildContext context, CanvasState canvas, SettingsState? settings) {
    final cs = Theme.of(context).colorScheme;
    final colors =
        _getPaletteColors(settings?.palette ?? 'classic', settings?.colorCount ?? 12);

    return Container(
      height: 64,
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(
            top: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        itemCount: colors.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (ctx, i) => LalaColorSwatch(
          color: colors[i],
          size: 40,
          active: canvas.activeColor == colors[i],
          onTap: () =>
              ref.read(canvasProvider.notifier).setActiveColor(colors[i]),
        ),
      ),
    );
  }

  // ─── Color sidebar (landscape) ───────────────────────────────────────────────

  Widget _buildColorSidebar(BuildContext context, CanvasState canvas,
      SettingsState? settings) {
    final cs = Theme.of(context).colorScheme;
    final colors =
        _getPaletteColors(settings?.palette ?? 'classic', settings?.colorCount ?? 12);

    return Container(
      width: 68,
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(
            left: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 10),
        itemCount: colors.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (ctx, i) => Center(
          child: LalaColorSwatch(
            color: colors[i],
            size: 44,
            active: canvas.activeColor == colors[i],
            onTap: () =>
                ref.read(canvasProvider.notifier).setActiveColor(colors[i]),
          ),
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
                  '🎲 ${l10n.t('regenBtn')}',
                  style:
                      GoogleFonts.fredoka(fontWeight: FontWeight.w700),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not save: $e')),
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
      await Share.shareXFiles(
        [file],
        text: l10n.t('shareImageText', {'subject': widget.args.displayLabel}),
      );
    } catch (_) {
      // Ignore share cancel
    }
  }

  // On mobile, printing is done via the system share sheet (share → Print).
  // This opens the same sheet but signals print intent via subject line.
  Future<void> _printArtwork(CanvasState canvas) async {
    try {
      final bytes = await _captureCanvas(canvas);
      if (bytes == null) return;
      final file = XFile.fromData(bytes,
          mimeType: 'image/png',
          name: 'lalabuba_${widget.args.displayLabel}.png');
      await Share.shareXFiles(
        [file],
        subject: 'Print — Lalabuba: ${widget.args.displayLabel}',
      );
    } catch (_) {
      // Ignore share cancel
    }
  }

  // Builds a proper https://lalabuba.com/challenge?subject=...&seed=... URL
  // so the recipient opens the exact same coloring page in browser or app.
  Future<void> _shareChallenge() async {
    final seed = _currentSeed;
    if (seed == null) return;

    // Always use the config base URL — never localhost
    final baseUrl = ref.read(appConfigProvider).valueOrNull?.apiBaseUrl
        ?? 'https://lalabuba.com';
    final encodedSubject = Uri.encodeQueryComponent(_subject);
    final challengeUrl = '$baseUrl/challenge?subject=$encodedSubject&seed=$seed';

    final l10n = ref.read(l10nProvider);
    final text =
        l10n.t('challengeText', {'subject': widget.args.displayLabel});

    try {
      // Share the challenge URL — opens in browser or triggers app deep link
      await Share.share('$text\n$challengeUrl', subject: 'Lalabuba Challenge 🏆');
    } catch (_) {
      // Ignore share cancel
    }
  }

  Future<Uint8List?> _captureCanvas(CanvasState canvas) async {
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: active ? cs.primaryContainer : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: GoogleFonts.fredoka(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: onTap == null
                ? cs.onSurface.withValues(alpha: 0.3)
                : active
                    ? cs.onPrimaryContainer
                    : cs.onSurface,
          ),
        ),
      ),
    );
  }
}

class _ModeToggle extends StatelessWidget {
  final DrawMode mode;
  final VoidCallback onTap;
  final String tapLabel;
  final String paintLabel;

  const _ModeToggle({
    required this.mode,
    required this.onTap,
    required this.tapLabel,
    required this.paintLabel,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isTap = mode == DrawMode.tap;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: cs.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: cs.primary.withValues(alpha: 0.35)),
        ),
        child: Text(
          isTap ? tapLabel : paintLabel,
          style: GoogleFonts.fredoka(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: cs.primary),
        ),
      ),
    );
  }
}
