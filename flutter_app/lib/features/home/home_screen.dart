import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../../core/di/providers.dart';
import '../../core/router/app_router.dart';
import '../../shared/widgets/lala_card.dart';
import '../../shared/widgets/lala_chip.dart';
import '../../shared/widgets/lala_text_field.dart';
import '../../shared/widgets/lala_empty_hint.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _textCtrl = TextEditingController();
  final _focusNode = FocusNode();
  bool _canDraw = false;

  @override
  void initState() {
    super.initState();
    _textCtrl.addListener(() {
      final has = _textCtrl.text.trim().isNotEmpty;
      if (has != _canDraw) setState(() => _canDraw = has);
      ref.read(homeProvider.notifier).setSubject(_textCtrl.text.trim());
    });
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onDraw() {
    final subject = _textCtrl.text.trim();
    if (subject.isEmpty) return;
    _focusNode.unfocus();
    context.pushNamed(
      'canvas',
      extra: CanvasScreenArgs(
        subject: subject,
        displayLabel: subject,
      ),
    );
  }

  void _fillSubject(String text) {
    _textCtrl.text = text;
    _textCtrl.selection = TextSelection.collapsed(offset: text.length);
    setState(() => _canDraw = text.isNotEmpty);
    ref.read(homeProvider.notifier).setSubject(text);
  }

  String get _currentLocale =>
      ref.read(localeProvider).valueOrNull?.locale ?? 'en';

  @override
  Widget build(BuildContext context) {
    final l10n = ref.watch(l10nProvider);
    final themeMode = ref.watch(themeModeProvider);
    final homeAsync = ref.watch(homeProvider);
    final settingsAsync = ref.watch(settingsProvider);
    final sub = ref.watch(subscriptionProvider).valueOrNull;
    final isLandscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;

    return Scaffold(
      appBar: _buildAppBar(context, l10n, themeMode),
      body: SafeArea(
        top: false,
        bottom: false,
        child: isLandscape
            ? _buildLandscapeLayout(context, l10n, homeAsync, settingsAsync, sub)
            : _buildPortraitLayout(context, l10n, homeAsync, settingsAsync, sub),
      ),
    );
  }

  AppBar _buildAppBar(BuildContext context, L10n l10n, ThemeMode themeMode) {
    final cs = Theme.of(context).colorScheme;
    return AppBar(
      automaticallyImplyLeading: false,
      title: Row(
        children: [
          const Text('🎨', style: TextStyle(fontSize: 22)),
          const SizedBox(width: 6),
          Text(
            'Lalabuba',
            style: GoogleFonts.fredoka(
              fontWeight: FontWeight.w700,
              fontSize: 22,
              color: cs.primary,
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: Icon(
            themeMode == ThemeMode.dark
                ? Icons.light_mode_rounded
                : Icons.dark_mode_rounded,
            color: cs.onSurface,
          ),
          onPressed: () {
            final next = themeMode == ThemeMode.dark
                ? ThemeMode.light
                : ThemeMode.dark;
            ref.read(themeModeProvider.notifier).state = next;
          },
        ),
        PopupMenuButton<String>(
          icon: Text(
            languageMeta[ref.watch(localeProvider).valueOrNull?.locale ?? 'en']
                    ?.flag ??
                '🌐',
            style: const TextStyle(fontSize: 20),
          ),
          tooltip: 'Language',
          onSelected: (lang) =>
              ref.read(localeProvider.notifier).setLocale(lang),
          itemBuilder: (_) => languageMeta.entries
              .map((e) => PopupMenuItem(
                    value: e.key,
                    child: Row(children: [
                      Text(e.value.flag,
                          style: const TextStyle(fontSize: 18)),
                      const SizedBox(width: 8),
                      Text(e.value.name,
                          style: GoogleFonts.nunito(fontSize: 14)),
                    ]),
                  ))
              .toList(),
        ),
        IconButton(
          icon: const Icon(Icons.photo_library_rounded),
          tooltip: l10n.t('galleryBtn'),
          onPressed: () => context.pushNamed('gallery'),
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  // ─── Portrait ───────────────────────────────────────────────────────────────

  Widget _buildPortraitLayout(
    BuildContext context,
    L10n l10n,
    AsyncValue<HomeState> homeAsync,
    AsyncValue<SettingsState> settingsAsync,
    SubscriptionState? sub,
  ) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Heading
                Text(
                  l10n.t('heroHeading'),
                  style: GoogleFonts.fredoka(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: cs.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                // Tagline
                Text(
                  l10n.t('tagline'),
                  style: GoogleFonts.nunito(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: cs.onSurface.withValues(alpha: 0.55),
                  ),
                ),
                const SizedBox(height: 14),
                // Daily challenge pill
                homeAsync.whenOrNull(
                      data: (home) => home.dailyChallenge != null
                          ? _buildDailyPill(
                              context, cs, l10n, home, _currentLocale)
                          : const SizedBox.shrink(),
                    ) ??
                    const SizedBox.shrink(),
                const SizedBox(height: 14),
                // "or pick something fun" divider
                _buildPickDivider(context, l10n),
                const SizedBox(height: 12),
                // 2×2 card grid + shuffle
                homeAsync.when(
                  loading: () => const SizedBox(
                      height: 220,
                      child: Center(child: CircularProgressIndicator())),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (home) =>
                      _buildCardGrid(context, home, l10n, _currentLocale),
                ),
                const SizedBox(height: 16),
                // Canvas placeholder hint
                _buildCanvasPlaceholder(context, l10n),
              ],
            ),
          ),
        ),
        // Sticky bottom input + settings bar
        _buildBottomBar(context, l10n, settingsAsync, sub),
        SizedBox(height: MediaQuery.paddingOf(context).bottom),
      ],
    );
  }

  // ─── Landscape ──────────────────────────────────────────────────────────────

  Widget _buildLandscapeLayout(
    BuildContext context,
    L10n l10n,
    AsyncValue<HomeState> homeAsync,
    AsyncValue<SettingsState> settingsAsync,
    SubscriptionState? sub,
  ) {
    final cs = Theme.of(context).colorScheme;
    // Left panel width: fixed but generous enough for 2-col card grid
    const panelWidth = 300.0;

    return Row(
      children: [
        // Left control panel
        SizedBox(
          width: panelWidth,
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.t('heroHeading'),
                        style: GoogleFonts.fredoka(
                            fontSize: 15, fontWeight: FontWeight.w700),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      // Daily pill
                      homeAsync.whenOrNull(
                            data: (home) => home.dailyChallenge != null
                                ? _buildDailyPill(
                                    context, cs, l10n, home, _currentLocale)
                                : const SizedBox.shrink(),
                          ) ??
                          const SizedBox.shrink(),
                      const SizedBox(height: 10),
                      // Divider
                      _buildPickDivider(context, l10n),
                      const SizedBox(height: 8),
                      // Card grid (2-col, compact)
                      homeAsync.whenOrNull(
                            data: (home) => _buildCardGrid(
                                context, home, l10n, _currentLocale,
                                compact: true),
                          ) ??
                          const SizedBox.shrink(),
                    ],
                  ),
                ),
              ),
              _buildBottomBar(context, l10n, settingsAsync, sub),
              SizedBox(height: MediaQuery.paddingOf(context).bottom),
            ],
          ),
        ),
        // Right: canvas placeholder
        Expanded(
          child: Container(
            margin: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: cs.surfaceContainerLow,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
            ),
            child: LalaEmptyHint(message: l10n.t('emptyHint')),
          ),
        ),
      ],
    );
  }

  // ─── Reusable sections ──────────────────────────────────────────────────────

  Widget _buildPickDivider(BuildContext context, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      children: [
        Expanded(child: Divider(color: cs.outlineVariant, height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text(
            l10n.t('orPickSomething'),
            style: GoogleFonts.nunito(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: cs.onSurface.withValues(alpha: 0.4),
            ),
          ),
        ),
        Expanded(child: Divider(color: cs.outlineVariant, height: 1)),
      ],
    );
  }

  Widget _buildDailyPill(BuildContext context, ColorScheme cs, L10n l10n,
      HomeState home, String locale) {
    final daily = home.dailyChallenge!;
    final label = daily.translate(locale);
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        _fillSubject(daily.word);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [cs.primaryContainer, cs.secondaryContainer],
          ),
          borderRadius: BorderRadius.circular(50),
          boxShadow: [
            BoxShadow(
              color: cs.primary.withValues(alpha: 0.15),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🌟', style: TextStyle(fontSize: 14)),
            const SizedBox(width: 6),
            Text(
              '${l10n.t('dailyWord')}: $label',
              style: GoogleFonts.nunito(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: cs.onPrimaryContainer,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCardGrid(
    BuildContext context,
    HomeState home,
    L10n l10n,
    String locale, {
    bool compact = false,
  }) {
    final cs = Theme.of(context).colorScheme;
    // Vibrant gradient pairs for cards — matches web app branding
    const cardColors = [
      [Color(0xFFFF6B6B), Color(0xFFFF8E53)],
      [Color(0xFF4ECDC4), Color(0xFF45B7D1)],
      [Color(0xFFFFE66D), Color(0xFFFFA26B)],
      [Color(0xFF96E6A1), Color(0xFF4ECDC4)],
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: compact ? 1.2 : 1.1,
          ),
          itemCount: home.visibleCards.length.clamp(0, 4),
          itemBuilder: (ctx, i) {
            final card = home.visibleCards[i];
            return LalaCard(
              emoji: card.emoji,
              label: card.label(locale),
              gradient: cardColors[i % cardColors.length],
              animationIndex: i,
              onTap: () {
                HapticFeedback.lightImpact();
                _fillSubject(card.englishPrompt);
              },
            );
          },
        ),
        const SizedBox(height: 10),
        Center(
          child: GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              ref.read(homeProvider.notifier).shuffle();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(50),
                border: Border.all(color: cs.outlineVariant),
              ),
              child: Text(
                '🎲',
                style: GoogleFonts.fredoka(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: cs.onSurface),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCanvasPlaceholder(BuildContext context, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: cs.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: LalaEmptyHint(message: l10n.t('emptyHint')),
    );
  }

  Widget _buildBottomBar(
    BuildContext context,
    L10n l10n,
    AsyncValue<SettingsState> settingsAsync,
    SubscriptionState? sub,
  ) {
    final cs = Theme.of(context).colorScheme;
    final settings = settingsAsync.valueOrNull;

    return Container(
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(top: BorderSide(color: cs.outlineVariant, width: 0.5)),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, -3)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Row 1: Full-width prompt input + surprise-me ──────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: LalaTextField(
                    placeholder: l10n.t('placeholder'),
                    controller: _textCtrl,
                    focusNode: _focusNode,
                    onSubmitted: _canDraw ? _onDraw : null,
                  ),
                ),
                const SizedBox(width: 8),
                // Surprise me — lives here, never crowds the input
                _buildIconPill(
                  context,
                  '💡',
                  onTap: () {
                    HapticFeedback.lightImpact();
                    ref.read(homeProvider.notifier).surpriseMe();
                    final s =
                        ref.read(homeProvider).valueOrNull?.subject ?? '';
                    if (s.isNotEmpty) _fillSubject(s);
                  },
                ),
              ],
            ),
          ),
          // ── Row 2: Prominent full-width Draw button ───────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: double.infinity,
              height: 52,
              decoration: BoxDecoration(
                color: _canDraw
                    ? cs.primary
                    : cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(14),
                boxShadow: _canDraw
                    ? [
                        BoxShadow(
                            color: cs.primary.withValues(alpha: 0.35),
                            blurRadius: 14,
                            offset: const Offset(0, 4)),
                      ]
                    : null,
              ),
              child: Material(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: _canDraw ? _onDraw : null,
                  child: Center(
                    child: Text(
                      l10n.t('drawBtn'),
                      style: GoogleFonts.fredoka(
                        color: _canDraw
                            ? Colors.white
                            : cs.onSurface.withValues(alpha: 0.35),
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          // ── Row 3: Settings chips (tap to cycle) ─────────────────────────
          _buildSettingsChips(context, cs, l10n, settings, sub),
        ],
      ),
    );
  }

  Widget _buildSettingsChips(
    BuildContext context,
    ColorScheme cs,
    L10n l10n,
    SettingsState? settings,
    SubscriptionState? sub,
  ) {
    final ents = sub?.entitlements;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Section label
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 4),
          child: Text(
            l10n.t('diffLabel'),
            style: GoogleFonts.nunito(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: cs.onSurface.withValues(alpha: 0.38),
              letterSpacing: 0.8,
            ),
          ),
        ),
        // Scrollable chip row with fade edges to hint at scrollability
        ShaderMask(
          shaderCallback: (bounds) => LinearGradient(
            stops: const [0.0, 0.04, 0.92, 1.0],
            colors: [
              cs.surface,
              Colors.transparent,
              Colors.transparent,
              cs.surface,
            ],
          ).createShader(bounds),
          blendMode: BlendMode.dstOut,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
            child: Row(
              children: [
                // Difficulty — cycles on tap, no persistent selected state
                LalaChip(
                  label: _diffLabel(settings?.difficulty ?? 'medium', l10n),
                  onTap: () => ref
                      .read(settingsProvider.notifier)
                      .cycleDifficulty(
                          ents?.difficulties ?? ['easy', 'medium']),
                ),
                const SizedBox(width: 6),
                // Palette
                LalaChip(
                  label: _palLabel(settings?.palette ?? 'classic'),
                  onTap: () => ref
                      .read(settingsProvider.notifier)
                      .cyclePalette(ents?.palettes ?? ['classic']),
                ),
                const SizedBox(width: 6),
                // Colour count
                LalaChip(
                  label: _cntLabel(settings?.colorCount ?? 12),
                  onTap: () => ref
                      .read(settingsProvider.notifier)
                      .cycleColorCount([6, 12, 18, 24]),
                ),
                const SizedBox(width: 6),
                // Numbers toggle — this one IS a true toggle with on/off state
                LalaChip(
                  label: settings?.showNumbers == true
                      ? '🔢 ${l10n.t('numbersOn')}'
                      : '🔡 ${l10n.t('numbersOff')}',
                  selected: settings?.showNumbers ?? true,
                  onTap: () =>
                      ref.read(settingsProvider.notifier).toggleNumbers(),
                ),
                const SizedBox(width: 6),
                // Settings shortcut
                LalaChip(
                  label: l10n.t('settingsBtn'),
                  onTap: () => context.pushNamed('settings'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // Small square icon pill button used for 💡 etc.
  Widget _buildIconPill(BuildContext context, String emoji,
      {required VoidCallback onTap}) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: cs.outlineVariant),
        ),
        child: Center(
            child: Text(emoji, style: const TextStyle(fontSize: 20))),
      ),
    );
  }

  // ─── Label helpers ──────────────────────────────────────────────────────────

  String _diffLabel(String d, L10n l10n) {
    switch (d) {
      case 'easy':    return l10n.t('diffEasy');
      case 'medium':  return l10n.t('diffMedium');
      case 'hard':    return l10n.t('diffHard');
      case 'extreme': return l10n.t('diffExtreme');
      default:        return d;
    }
  }

  String _palLabel(String p) {
    switch (p) {
      case 'classic': return '🖍️ Classic';
      case 'pastel':  return '🌸 Pastel';
      case 'nature':  return '🌿 Nature';
      default:        return p;
    }
  }

  String _cntLabel(int cnt) =>
      '🎨 ${cnt == 99 ? 'Max' : cnt.toString()}';
}
