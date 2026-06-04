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
import '../canvas/canvas_screen.dart';

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
    _textCtrl.selection =
        TextSelection.collapsed(offset: text.length);
    setState(() => _canDraw = text.isNotEmpty);
    ref.read(homeProvider.notifier).setSubject(text);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final l10n = ref.watch(l10nProvider);
    final themeMode = ref.watch(themeModeProvider);
    final homeAsync = ref.watch(homeProvider);
    final settingsAsync = ref.watch(settingsProvider);
    final sub = ref.watch(subscriptionProvider).valueOrNull;
    final isLandscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;

    return Scaffold(
      backgroundColor: cs.surface,
      resizeToAvoidBottomInset: true,
      appBar: _buildAppBar(context, cs, l10n, themeMode),
      body: isLandscape
          ? _buildLandscapeLayout(context, cs, l10n, homeAsync, settingsAsync, sub)
          : _buildPortraitLayout(context, cs, l10n, homeAsync, settingsAsync, sub),
    );
  }

  AppBar _buildAppBar(
      BuildContext context, ColorScheme cs, L10n l10n, ThemeMode themeMode) {
    return AppBar(
      automaticallyImplyLeading: false,
      title: Row(
        children: [
          Text('🎨', style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 6),
          Text(
            'Lalabuba',
            style: GoogleFonts.fredoka(
              fontWeight: FontWeight.w700,
              fontSize: 20,
              color: cs.primary,
            ),
          ),
        ],
      ),
      actions: [
        // Theme toggle
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
        // Language picker
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
        // Gallery
        IconButton(
          icon: const Icon(Icons.photo_library_rounded),
          onPressed: () => context.pushNamed('gallery'),
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  Widget _buildPortraitLayout(
    BuildContext context,
    ColorScheme cs,
    L10n l10n,
    AsyncValue<HomeState> homeAsync,
    AsyncValue<SettingsState> settingsAsync,
    SubscriptionState? sub,
  ) {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
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
                Text(
                  l10n.t('heroSub'),
                  style: GoogleFonts.nunito(
                    fontSize: 13,
                    color: cs.onSurface.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: 14),
                // Daily challenge pill
                homeAsync.whenOrNull(
                  data: (home) => home.dailyChallenge != null
                      ? _buildDailyPill(context, cs, l10n, home, ref.watch(localeProvider).valueOrNull?.locale ?? 'en')
                      : const SizedBox.shrink(),
                ) ?? const SizedBox.shrink(),
                const SizedBox(height: 12),
                // Card grid
                homeAsync.when(
                  loading: () => const SizedBox(
                      height: 200,
                      child: Center(child: CircularProgressIndicator())),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (home) => _buildCardGrid(context, home, l10n, ref.watch(localeProvider).valueOrNull?.locale ?? 'en'),
                ),
                const SizedBox(height: 12),
                // Canvas placeholder
                Container(
                  height: 160,
                  decoration: BoxDecoration(
                    color: cs.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                        color: cs.outlineVariant.withValues(alpha: 0.5)),
                  ),
                  child: LalaEmptyHint(message: l10n.t('emptyHint')),
                ),
              ],
            ),
          ),
        ),
        // Sticky bottom bar
        _buildBottomBar(context, cs, l10n, settingsAsync, sub),
        SizedBox(height: MediaQuery.paddingOf(context).bottom),
      ],
    );
  }

  Widget _buildLandscapeLayout(
    BuildContext context,
    ColorScheme cs,
    L10n l10n,
    AsyncValue<HomeState> homeAsync,
    AsyncValue<SettingsState> settingsAsync,
    SubscriptionState? sub,
  ) {
    return Row(
      children: [
        // Left: controls
        SizedBox(
          width: 280,
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.t('heroHeading'),
                        style: GoogleFonts.fredoka(
                            fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      homeAsync.whenOrNull(
                            data: (home) => home.dailyChallenge != null
                                ? _buildDailyPill(context, cs, l10n, home,
                                    ref.watch(localeProvider).valueOrNull?.locale ?? 'en')
                                : const SizedBox.shrink(),
                          ) ??
                          const SizedBox.shrink(),
                    ],
                  ),
                ),
              ),
              _buildBottomBar(context, cs, l10n, settingsAsync, sub),
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
              borderRadius: BorderRadius.circular(16),
            ),
            child: LalaEmptyHint(message: l10n.t('emptyHint')),
          ),
        ),
      ],
    );
  }

  Widget _buildDailyPill(BuildContext context, ColorScheme cs, L10n l10n,
      HomeState home, String locale) {
    final daily = home.dailyChallenge!;
    final label = daily.translate(locale);
    return GestureDetector(
      onTap: () => _fillSubject(daily.word),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [cs.primaryContainer, cs.secondaryContainer],
          ),
          borderRadius: BorderRadius.circular(50),
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

  Widget _buildCardGrid(BuildContext context, HomeState home, L10n l10n, String locale) {
    final cs = Theme.of(context).colorScheme;
    final cardColors = [
      [const Color(0xFFFF6B6B), const Color(0xFFFF8E53)],
      [const Color(0xFF4ECDC4), const Color(0xFF45B7D1)],
      [const Color(0xFFFFE66D), const Color(0xFFFFA26B)],
      [const Color(0xFF96E6A1), const Color(0xFF4ECDC4)],
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.1,
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
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(50),
                border: Border.all(color: cs.outlineVariant),
              ),
              child: Text(
                '🎲 Shuffle',
                style: GoogleFonts.fredoka(
                    fontSize: 14,
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
    ColorScheme cs,
    L10n l10n,
    AsyncValue<SettingsState> settingsAsync,
    SubscriptionState? sub,
  ) {
    final settings = settingsAsync.valueOrNull;
    final ents = sub?.entitlements;

    return Container(
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(top: BorderSide(color: cs.outlineVariant, width: 0.5)),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, -3))
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Prompt input row
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
            child: Row(
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
                // Surprise me
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    ref.read(homeProvider.notifier).surpriseMe();
                    final s = ref.read(homeProvider).valueOrNull?.subject ?? '';
                    if (s.isNotEmpty) _textCtrl.text = s;
                    setState(() => _canDraw = s.isNotEmpty);
                  },
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: cs.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(
                        child: Text('💡', style: TextStyle(fontSize: 20))),
                  ),
                ),
                const SizedBox(width: 8),
                // Draw button
                GestureDetector(
                  onTap: _canDraw ? _onDraw : null,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 10),
                    decoration: BoxDecoration(
                      color: _canDraw
                          ? cs.primary
                          : cs.primary.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(50),
                      boxShadow: _canDraw
                          ? [
                              BoxShadow(
                                  color:
                                      cs.primary.withValues(alpha: 0.4),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4))
                            ]
                          : null,
                    ),
                    child: Text(
                      l10n.t('drawBtn'),
                      style: GoogleFonts.fredoka(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Settings chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
            child: Row(
              children: [
                // Difficulty
                LalaChip(
                  label: _diffLabel(settings?.difficulty ?? 'medium', l10n),
                  selected: true,
                  onTap: () => ref
                      .read(settingsProvider.notifier)
                      .cycleDifficulty(ents?.difficulties ?? ['easy', 'medium']),
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
                // Color count
                LalaChip(
                  label: _cntLabel(settings?.colorCount ?? 12),
                  onTap: () => ref
                      .read(settingsProvider.notifier)
                      .cycleColorCount([6, 12, 18, 24]),
                ),
                const SizedBox(width: 6),
                // Numbers toggle
                LalaChip(
                  label: '${settings?.showNumbers == true ? '🔢' : '🔢'} ${settings?.showNumbers == true ? 'ON' : 'OFF'}',
                  selected: settings?.showNumbers ?? true,
                  onTap: () =>
                      ref.read(settingsProvider.notifier).toggleNumbers(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _diffLabel(String d, L10n l10n) {
    switch (d) {
      case 'easy': return l10n.t('diffEasy');
      case 'medium': return l10n.t('diffMedium');
      case 'hard': return l10n.t('diffHard');
      case 'extreme': return l10n.t('diffExtreme');
      default: return d;
    }
  }

  String _palLabel(String p) {
    switch (p) {
      case 'classic': return '🖍️ Classic';
      case 'pastel': return '🌸 Pastel';
      case 'nature': return '🌿 Nature';
      default: return p;
    }
  }

  String _cntLabel(int cnt) {
    return '🎨 ${cnt == 99 ? 'Max' : cnt.toString()}';
  }
}
