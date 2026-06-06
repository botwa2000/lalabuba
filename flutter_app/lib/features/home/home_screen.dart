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
  // Holds the English prompt when a card is tapped (display shows localized label,
  // but the API call uses the English prompt for consistent generation quality).
  String? _englishSubjectOverride;
  bool _programmaticFill = false;

  @override
  void initState() {
    super.initState();
    _textCtrl.addListener(() {
      if (_programmaticFill) return;
      // User typed manually — clear the card-tap override
      if (_englishSubjectOverride != null) {
        setState(() => _englishSubjectOverride = null);
      }
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
    final displayLabel = _textCtrl.text.trim();
    if (displayLabel.isEmpty) return;
    // Use the English prompt for generation if a card was tapped; otherwise
    // send whatever the user typed (handles manual input + daily word).
    final apiSubject = _englishSubjectOverride ?? displayLabel;
    _focusNode.unfocus();
    context.pushNamed(
      'canvas',
      extra: CanvasScreenArgs(
        subject: apiSubject,
        displayLabel: displayLabel,
      ),
    );
  }

  void _fillSubject(String text, {String? englishOverride}) {
    _programmaticFill = true;
    _englishSubjectOverride = englishOverride;
    _textCtrl.text = text;
    _textCtrl.selection = TextSelection.collapsed(offset: text.length);
    _programmaticFill = false;
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
    final sysBrightness = MediaQuery.platformBrightnessOf(context);
    final effectivelyDark = themeMode == ThemeMode.dark ||
        (themeMode == ThemeMode.system && sysBrightness == Brightness.dark);
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
            effectivelyDark
                ? Icons.light_mode_rounded
                : Icons.dark_mode_rounded,
            color: cs.onSurface,
          ),
          onPressed: () {
            ref.read(themeModeProvider.notifier).state =
                effectivelyDark ? ThemeMode.light : ThemeMode.dark;
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
                Text(
                  l10n.t('heroHeading'),
                  style: GoogleFonts.fredoka(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: cs.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.t('tagline'),
                  style: GoogleFonts.nunito(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: cs.onSurface.withValues(alpha: 0.55),
                  ),
                ),
                const SizedBox(height: 14),
                homeAsync.whenOrNull(
                      data: (home) => home.dailyChallenge != null
                          ? _buildDailyPill(
                              context, cs, l10n, home, _currentLocale)
                          : const SizedBox.shrink(),
                    ) ??
                    const SizedBox.shrink(),
                const SizedBox(height: 14),
                _buildPickDivider(context, l10n),
                const SizedBox(height: 12),
                homeAsync.when(
                  loading: () => const SizedBox(
                      height: 220,
                      child: Center(child: CircularProgressIndicator())),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (home) =>
                      _buildCardGrid(context, home, l10n, _currentLocale),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
        // Portrait: sticky bottom bar with input + draw + settings chips
        _buildBottomBar(context, l10n, settingsAsync, sub, showChips: true),
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
    final settings = settingsAsync.valueOrNull;
    final panelWidth =
        (MediaQuery.sizeOf(context).width * 0.32).clamp(260.0, 340.0);

    return Row(
      children: [
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
                      homeAsync.whenOrNull(
                            data: (home) => home.dailyChallenge != null
                                ? _buildDailyPill(
                                    context, cs, l10n, home, _currentLocale)
                                : const SizedBox.shrink(),
                          ) ??
                          const SizedBox.shrink(),
                      const SizedBox(height: 10),
                      _buildPickDivider(context, l10n),
                      const SizedBox(height: 8),
                      homeAsync.whenOrNull(
                            data: (home) => _buildCardGrid(
                                context, home, l10n, _currentLocale,
                                compact: true),
                          ) ??
                          const SizedBox.shrink(),
                      // ── Inline settings section — fills dead space ──
                      const SizedBox(height: 12),
                      _buildLandscapeSettings(
                          context, cs, l10n, settings, sub),
                    ],
                  ),
                ),
              ),
              // Landscape: no chips (settings are inline above)
              _buildBottomBar(context, l10n, settingsAsync, sub,
                  showChips: false),
              SizedBox(height: MediaQuery.paddingOf(context).bottom),
            ],
          ),
        ),
        Expanded(
          child: Container(
            margin: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: cs.surfaceContainerLow,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                  color: cs.outlineVariant.withValues(alpha: 0.5)),
            ),
            child: LalaEmptyHint(message: l10n.t('emptyHint')),
          ),
        ),
      ],
    );
  }

  // ─── Landscape settings section ─────────────────────────────────────────────

  Widget _buildLandscapeSettings(
    BuildContext context,
    ColorScheme cs,
    L10n l10n,
    SettingsState? settings,
    SubscriptionState? sub,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header divider
        Row(children: [
          Expanded(child: Divider(color: cs.outlineVariant, height: 1)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              '⚙️ ${l10n.t('settingsTitle')}',
              style: GoogleFonts.nunito(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: cs.onSurface.withValues(alpha: 0.45)),
            ),
          ),
          Expanded(child: Divider(color: cs.outlineVariant, height: 1)),
        ]),
        const SizedBox(height: 8),
        _SettingRow(
          icon: '🌟',
          label: l10n.t('diffLabel'),
          value: _diffLabelShort(settings?.difficulty ?? 'medium'),
          onTap: () {
            HapticFeedback.selectionClick();
            ref.read(settingsProvider.notifier).cycleDifficulty(
                  sub?.entitlements.difficulties ?? ['easy', 'medium'],
                );
          },
        ),
        const SizedBox(height: 4),
        _SettingRow(
          icon: '🖍️',
          label: l10n.t('paletteLabel'),
          value: _palLabelShort(settings?.palette ?? 'classic'),
          onTap: () {
            HapticFeedback.selectionClick();
            // All 3 palettes — free users can try them all
            ref.read(settingsProvider.notifier)
                .cyclePalette(['classic', 'pastel', 'nature']);
          },
        ),
        const SizedBox(height: 4),
        _SettingRow(
          icon: '🎨',
          label: l10n.t('colorsLabel'),
          value: _cntLabelShort(settings?.colorCount ?? 12),
          onTap: () {
            HapticFeedback.selectionClick();
            ref.read(settingsProvider.notifier).cycleColorCount([6, 12, 18, 24]);
          },
        ),
        const SizedBox(height: 4),
        _SettingRow(
          icon: '🔢',
          label: l10n.t('numbersLabel'),
          value: settings?.showNumbers == true
              ? l10n.t('numbersOn')
              : l10n.t('numbersOff'),
          selected: settings?.showNumbers ?? true,
          onTap: () {
            HapticFeedback.selectionClick();
            ref.read(settingsProvider.notifier).toggleNumbers();
          },
        ),
        const SizedBox(height: 4),
        _SettingRow(
          icon: '⚙️',
          label: l10n.t('settingsTitle'),
          value: '›',
          onTap: () => context.pushNamed('settings'),
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
            childAspectRatio: compact ? 1.1 : 0.95,
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
                // Show localized label in the text field; send English to API
                _fillSubject(
                  card.label(locale),
                  englishOverride: card.englishPrompt,
                );
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

  Widget _buildBottomBar(
    BuildContext context,
    L10n l10n,
    AsyncValue<SettingsState> settingsAsync,
    SubscriptionState? sub, {
    required bool showChips,
  }) {
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
          // Row 1: prompt input + surprise-me
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
          // Row 2: Draw! button
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
          // Row 3: Settings chips (portrait only — landscape has inline settings)
          if (showChips)
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          LalaChip(
            label: _diffLabel(settings?.difficulty ?? 'medium', l10n),
            onTap: () => ref
                .read(settingsProvider.notifier)
                .cycleDifficulty(
                    sub?.entitlements.difficulties ?? ['easy', 'medium']),
          ),
          LalaChip(
            label: _palLabel(settings?.palette ?? 'classic'),
            // Always cycle all 3 palettes — gating handled at generation time
            onTap: () => ref
                .read(settingsProvider.notifier)
                .cyclePalette(['classic', 'pastel', 'nature']),
          ),
          LalaChip(
            label: _cntLabel(settings?.colorCount ?? 12),
            onTap: () => ref
                .read(settingsProvider.notifier)
                .cycleColorCount([6, 12, 18, 24]),
          ),
          LalaChip(
            label: settings?.showNumbers == true
                ? '🔢 ${l10n.t('numbersOn')}'
                : '🔡 ${l10n.t('numbersOff')}',
            selected: settings?.showNumbers ?? true,
            onTap: () =>
                ref.read(settingsProvider.notifier).toggleNumbers(),
          ),
          LalaChip(
            label: l10n.t('settingsBtn'),
            onTap: () => context.pushNamed('settings'),
          ),
        ],
      ),
    );
  }

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

  String _diffLabelShort(String d) {
    switch (d) {
      case 'easy':    return 'Easy 🌟';
      case 'medium':  return 'Medium 🌟🌟';
      case 'hard':    return 'Hard 🌟🌟🌟';
      case 'extreme': return 'Extreme 🔥';
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

  String _palLabelShort(String p) {
    switch (p) {
      case 'classic': return 'Classic';
      case 'pastel':  return 'Pastel';
      case 'nature':  return 'Nature';
      default:        return p;
    }
  }

  String _cntLabel(int cnt) =>
      '🎨 ${cnt == 99 ? 'Max' : cnt.toString()}';

  String _cntLabelShort(int cnt) =>
      cnt == 99 ? 'Max' : cnt.toString();
}

// ─── Landscape setting row ───────────────────────────────────────────────────

class _SettingRow extends StatelessWidget {
  final String icon;
  final String label;
  final String value;
  final VoidCallback onTap;
  final bool selected;

  const _SettingRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
    this.selected = false,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? cs.primaryContainer.withValues(alpha: 0.5)
              : cs.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected
                ? cs.primary.withValues(alpha: 0.35)
                : cs.outlineVariant.withValues(alpha: 0.5),
          ),
        ),
        child: Row(
          children: [
            Text(icon, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.nunito(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: cs.onSurface.withValues(alpha: 0.75),
                ),
              ),
            ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: cs.primaryContainer,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                value,
                style: GoogleFonts.nunito(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: cs.onPrimaryContainer,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
