// showcaseview 5.0.2's ShowCaseWidget/of/startShowCase are marked deprecated
// (slated for removal in v6) but are the documented, self-contained per-screen
// API for this pinned version; the v6 register() replacement adds global scope
// lifecycle we don't need. Intentional until we bump the package major.
// ignore_for_file: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:showcaseview/showcaseview.dart';
import '../../core/l10n/l10n_service.dart';
import '../../core/di/providers.dart';
import '../../core/router/app_router.dart';
import '../../shared/services/storage_service.dart';
import '../../shared/widgets/lala_card.dart';
import '../../shared/widgets/lala_chip.dart';
import '../../shared/widgets/lala_text_field.dart';
import '../../shared/widgets/lala_empty_hint.dart';
import '../../shared/widgets/lala_bottom_sheet.dart';
import '../../shared/widgets/lala_showcase.dart';
import '../rewards/daily_mission.dart';
import '../rewards/crayon_packs.dart';

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
  // Where the current subject came from — propagated to the canvas so completion
  // can credit the "own idea" (custom) and "daily word" stickers.
  String _subjectSource = 'custom';

  // Coach-mark tutorial: highlight the prompt + Draw button on first launch and
  // when replayed via "How to play". Default seen=true so nothing flashes before
  // the persisted flag loads.
  final _scPrompt = GlobalKey();
  final _scDraw = GlobalKey();
  bool _homeTutorialSeen = true;
  bool _tutorialScheduled = false;
  // A context BELOW the ShowCaseWidget, captured in its builder, so chip
  // callbacks (which receive the Scaffold-level context above ShowCaseWidget)
  // can still resolve ShowCaseWidget.of(...).
  BuildContext? _showcaseCtx;

  @override
  void initState() {
    super.initState();
    StorageService.readBool(StorageService.kTutorialHome, false).then((seen) {
      if (mounted && !seen) setState(() => _homeTutorialSeen = false);
    });
    _textCtrl.addListener(() {
      if (_programmaticFill) return;
      // User typed manually — clear the card-tap override; the subject is now
      // the child's own idea.
      if (_englishSubjectOverride != null) {
        setState(() => _englishSubjectOverride = null);
      }
      _subjectSource = 'custom';
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
        source: _subjectSource,
      ),
    );
  }

  void _fillSubject(String text,
      {String? englishOverride, String source = 'custom'}) {
    _programmaticFill = true;
    _englishSubjectOverride = englishOverride;
    _subjectSource = source;
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
    final homeAsync = ref.watch(homeProvider);
    final settingsAsync = ref.watch(settingsProvider);
    final sub = ref.watch(subscriptionProvider).valueOrNull;
    // Assign today's mission and snapshot its baseline at app start, so a
    // mission like "color a picture" still counts a picture finished before the
    // child opens the Rewards screen.
    ref.watch(missionProvider);

    // Choose the layout by actual available SIZE, not orientation alone:
    //  • Tablet (shortest side ≥ 600dp) → roomy centered hero in BOTH
    //    orientations (a tablet has space either way; serving it the
    //    phone-landscape sidebar made everything tiny in a sea of whitespace).
    //  • Phone landscape (short height) → compact two-pane sidebar, which keeps
    //    the prompt + Draw visible without burning the scarce vertical space.
    //  • Phone portrait → single-column hero.
    final size = MediaQuery.sizeOf(context);
    final isTablet = size.shortestSide >= 600;
    final isLandscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;

    final Widget body;
    if (isTablet) {
      body = _buildTabletHero(context, l10n, homeAsync, settingsAsync, sub);
    } else if (isLandscape) {
      body =
          _buildLandscapeLayout(context, l10n, homeAsync, settingsAsync, sub);
    } else {
      body =
          _buildPortraitLayout(context, l10n, homeAsync, settingsAsync, sub);
    }

    return Scaffold(
      appBar: _buildAppBar(context, l10n),
      body: ShowCaseWidget(
        onFinish: _onHomeTutorialFinish,
        disableMovingAnimation: true,
        builder: (showcaseCtx) {
          _showcaseCtx = showcaseCtx;
          // Auto-run the coach-marks once, after the first frame, if unseen.
          if (!_homeTutorialSeen && !_tutorialScheduled) {
            _tutorialScheduled = true;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                ShowCaseWidget.of(showcaseCtx)
                    .startShowCase([_scPrompt, _scDraw]);
              }
            });
          }
          return SafeArea(top: false, bottom: false, child: body);
        },
      ),
    );
  }

  // Replay the coloring walkthrough too: clear the canvas-tutorial flag so the
  // in-canvas coach-marks run again next time a page is opened.
  void _startHowToPlay(BuildContext showcaseCtx) {
    HapticFeedback.lightImpact();
    StorageService.writeBool(StorageService.kTutorialCanvas, false);
    ShowCaseWidget.of(showcaseCtx).startShowCase([_scPrompt, _scDraw]);
  }

  void _onHomeTutorialFinish() {
    StorageService.writeBool(StorageService.kTutorialHome, true);
  }

  // ─── Consolidated settings bottom sheet ──────────────────────────────────────
  // Single entry point for all *app* settings (appearance, language, tutorial,
  // about). Reachable from the app-bar gear (portrait/tablet) and the landscape
  // gear row. Per-drawing gameplay chips stay on the home surface, not here.
  void _openSettingsSheet(BuildContext context, L10n l10n) {
    HapticFeedback.lightImpact();
    // Capture the showcase context now, while it is guaranteed mounted; the sheet
    // route sits above it, so ShowCaseWidget.of(sheetCtx) would not resolve.
    final showcaseCtx = _showcaseCtx;
    showLalaBottomSheet(
      context: context,
      title: '⚙️ ${l10n.t('settingsTitle')}',
      initialChildSize: 0.62,
      child: _SettingsSheetBody(
        onHowToPlay: (ctx) {
          // Close the sheet first, then run the coach-marks on the next frame so
          // the showcase overlay isn't fighting the dismissing sheet route.
          Navigator.of(ctx).pop();
          final c = showcaseCtx;
          if (c != null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _startHowToPlay(c);
            });
          }
        },
        onAbout: (ctx) {
          Navigator.of(ctx).pop();
          context.pushNamed('settings');
        },
      ),
    );
  }

  // ─── Tablet hero (centered single column, both orientations) ─────────────────
  // One responsive hero: content capped to a comfortable max-width and centered,
  // type/cards scaled up, 4 cards in one row when wide enough else 2×2. Replaces
  // the two-pane split on the home screen, where the second pane had no content
  // (the image only exists after Draw, on the canvas screen).

  Widget _buildTabletHero(
    BuildContext context,
    L10n l10n,
    AsyncValue<HomeState> homeAsync,
    AsyncValue<SettingsState> settingsAsync,
    SubscriptionState? sub,
  ) {
    final cs = Theme.of(context).colorScheme;
    final settings = settingsAsync.valueOrNull;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(32, 28, 32, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.t('heroHeading'),
                textAlign: TextAlign.center,
                style: GoogleFonts.fredoka(
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  color: cs.onSurface,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                l10n.t('tagline'),
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: cs.onSurface.withValues(alpha: 0.55),
                ),
              ),
              const SizedBox(height: 22),
              homeAsync.whenOrNull(
                    data: (home) => home.dailyChallenge != null
                        ? Center(
                            child: _buildDailyPill(
                                context, cs, l10n, home, _currentLocale))
                        : const SizedBox.shrink(),
                  ) ??
                  const SizedBox.shrink(),
              const SizedBox(height: 22),
              _buildPickDivider(context, l10n),
              const SizedBox(height: 18),
              homeAsync.when(
                loading: () => const SizedBox(
                    height: 240,
                    child: Center(child: CircularProgressIndicator())),
                error: (_, __) => const SizedBox.shrink(),
                data: (home) => _buildCardGrid(
                  context, home, l10n, _currentLocale,
                  columns: 4,
                  cardScale: 1.25,
                ),
              ),
              const SizedBox(height: 24),
              // Prompt + surprise-me
              Row(
                children: [
                  Expanded(
                    child: LalaShowcase(
                      showcaseKey: _scPrompt,
                      title: l10n.t('tipPromptTitle'),
                      description: l10n.t('tipPromptBody'),
                      targetBorderRadius: BorderRadius.circular(14),
                      child: LalaTextField(
                        placeholder: l10n.t('placeholder'),
                        controller: _textCtrl,
                        focusNode: _focusNode,
                        onSubmitted: _canDraw ? _onDraw : null,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  _buildSurprisePill(
                    context,
                    l10n,
                    onTap: () {
                      HapticFeedback.lightImpact();
                      final card = ref.read(homeProvider.notifier).surpriseMe();
                      if (card != null) {
                        _fillSubject(
                          card.label(_currentLocale),
                          englishOverride: card.englishPrompt,
                        );
                      }
                    },
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _buildDrawButton(context, l10n, height: 58, fontSize: 20),
              const SizedBox(height: 18),
              Center(
                child: _buildSettingsChips(context, cs, l10n, settings, sub),
              ),
            ],
          ),
        ),
      ),
    );
  }

  AppBar _buildAppBar(BuildContext context, L10n l10n) {
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
        // Theme toggle and language picker were standalone actions here; both are
        // now consolidated into the gear's settings bottom sheet (below).
        // 🌱 days-colored streak pill — only once the child has colored a day.
        Builder(builder: (_) {
          final p = ref.watch(progressProvider).valueOrNull;
          if (p == null || p.daysColored <= 0) return const SizedBox.shrink();
          return Center(
            child: Container(
              margin: const EdgeInsets.only(right: 2),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                    colors: [Color(0xFFD4FC79), Color(0xFF96E6A1)]),
                borderRadius: BorderRadius.circular(50),
              ),
              child: Text(
                l10n.t('daysColoredPill', {'days': '${p.daysColored}'}),
                style: GoogleFonts.fredoka(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF1F6F43)),
              ),
            ),
          );
        }),
        // Pulsing 🏆 Rewards entry — always present so the sticker album,
        // missions, crayon packs and mascot are one tap away (this is the fix
        // for "tapping a sticker did nothing — I had to open the gallery"). It
        // gently pulses to invite kids, and shows the earned-sticker count once
        // any are unlocked.
        Builder(builder: (_) {
          final p = ref.watch(progressProvider).valueOrNull ?? const Progress();
          final earnedCount =
              kBadges.where((b) => p.badges.contains(b.id)).length;
          return _PulsingRewardsIcon(
            count: earnedCount,
            tooltip: l10n.t('rewardsBtn'),
            onTap: () {
              HapticFeedback.lightImpact();
              context.pushNamed('rewards');
            },
          );
        }),
        // Journal/Gallery icon with a masterpiece-count badge (parity with web):
        // shows totalCompleted once > 0, hidden at 0 (teaser above covers that).
        Builder(builder: (_) {
          final p = ref.watch(progressProvider).valueOrNull;
          final done = p?.totalCompleted ?? 0;
          final btn = IconButton(
            icon: const Icon(Icons.photo_library_rounded),
            tooltip: l10n.t('galleryBtn'),
            onPressed: () => context.pushNamed('gallery'),
          );
          if (done <= 0) return btn;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              btn,
              Positioned(
                right: 4,
                top: 6,
                child: Container(
                  constraints:
                      const BoxConstraints(minWidth: 18, minHeight: 18),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: cs.primary,
                    borderRadius: BorderRadius.circular(50),
                    border: Border.all(color: cs.surface, width: 1.5),
                  ),
                  child: Center(
                    child: Text(
                      done > 99 ? '99+' : '$done',
                      style: GoogleFonts.fredoka(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: cs.onPrimary,
                          height: 1.1),
                    ),
                  ),
                ),
              ),
            ],
          );
        }),
        IconButton(
          icon: const Icon(Icons.settings_rounded),
          tooltip: l10n.t('settingsTitle'),
          onPressed: () => _openSettingsSheet(context, l10n),
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
            // All 4 difficulties are selectable for everyone (mirrors the web app
            // and the palette chip above) — tier gating, if any, is applied at
            // generation time, not by hiding levels here.
            ref.read(settingsProvider.notifier).cycleDifficulty(
                  const ['easy', 'medium', 'hard', 'extreme'],
                );
          },
        ),
        const SizedBox(height: 4),
        _SettingRow(
          icon: '🖍️',
          label: l10n.t('paletteLabel'),
          value: _palLabelShort(settings?.palette ?? 'classic', l10n),
          onTap: () {
            HapticFeedback.selectionClick();
            // Cycle only the crayon packs the child has unlocked.
            final p = ref.read(progressProvider).valueOrNull ?? const Progress();
            ref.read(settingsProvider.notifier)
                .cyclePalette(unlockedPaletteIds(p));
          },
        ),
        const SizedBox(height: 4),
        _SettingRow(
          icon: '🎨',
          label: l10n.t('colorsLabel'),
          value: _cntLabelShort(settings?.colorCount ?? 12),
          onTap: () {
            HapticFeedback.selectionClick();
            ref.read(settingsProvider.notifier).cycleColorCount([6, 12, 18, 24, 99]);
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
        // Single gear row → opens the consolidated settings sheet (appearance,
        // language, how-to-play, about). Replaces the former separate
        // "How to play" + "Settings" rows so landscape has no duplicates.
        _SettingRow(
          icon: '⚙️',
          label: l10n.t('settingsTitle'),
          value: '›',
          onTap: () => _openSettingsSheet(context, l10n),
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
        // Show the localized word in the input; send the English word to the API
        // (same display-vs-prompt split the suggestion cards use).
        _fillSubject(label, englishOverride: daily.word, source: 'daily');
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
    int columns = 2,
    double cardScale = 1.0,
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
            crossAxisCount: columns,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
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
              scale: cardScale,
              onTap: () {
                HapticFeedback.lightImpact();
                // Show localized label in the text field; send English to API
                _fillSubject(
                  card.label(locale),
                  englishOverride: card.englishPrompt,
                  source: 'card',
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
                  child: LalaShowcase(
                    showcaseKey: _scPrompt,
                    title: l10n.t('tipPromptTitle'),
                    description: l10n.t('tipPromptBody'),
                    targetBorderRadius: BorderRadius.circular(14),
                    child: LalaTextField(
                      placeholder: l10n.t('placeholder'),
                      controller: _textCtrl,
                      focusNode: _focusNode,
                      onSubmitted: _canDraw ? _onDraw : null,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _buildSurprisePill(
                  context,
                  l10n,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    final card = ref.read(homeProvider.notifier).surpriseMe();
                    if (card != null) {
                      // Show the localized label; send the English prompt to the API.
                      _fillSubject(
                        card.label(_currentLocale),
                        englishOverride: card.englishPrompt,
                        source: 'surprise',
                      );
                    }
                  },
                ),
              ],
            ),
          ),
          // Row 2: Draw! button
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: _buildDrawButton(context, l10n),
          ),
          // Row 3: Settings chips (portrait only — landscape has inline settings)
          if (showChips)
            _buildSettingsChips(context, cs, l10n, settings, sub),
        ],
      ),
    );
  }

  // Shared Draw! button — used by the portrait bottom bar and the tablet hero.
  Widget _buildDrawButton(BuildContext context, L10n l10n,
      {double height = 52, double fontSize = 18}) {
    final cs = Theme.of(context).colorScheme;
    return LalaShowcase(
      showcaseKey: _scDraw,
      title: l10n.t('tipDrawTitle'),
      description: l10n.t('tipDrawBody'),
      targetBorderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: double.infinity,
      height: height,
      decoration: BoxDecoration(
        color: _canDraw ? cs.primary : cs.surfaceContainerHighest,
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
                fontSize: fontSize,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
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
                    const ['easy', 'medium', 'hard', 'extreme']),
          ),
          LalaChip(
            label: _palLabel(settings?.palette ?? 'classic', l10n),
            // Cycle only the crayon packs the child has unlocked.
            onTap: () {
              final p =
                  ref.read(progressProvider).valueOrNull ?? const Progress();
              ref
                  .read(settingsProvider.notifier)
                  .cyclePalette(unlockedPaletteIds(p));
            },
          ),
          LalaChip(
            label: _cntLabel(settings?.colorCount ?? 12),
            onTap: () => ref
                .read(settingsProvider.notifier)
                .cycleColorCount([6, 12, 18, 24, 99]),
          ),
          LalaChip(
            label: settings?.showNumbers == true
                ? '🔢 ${l10n.t('numbersOn')}'
                : '🔡 ${l10n.t('numbersOff')}',
            selected: settings?.showNumbers ?? true,
            onTap: () =>
                ref.read(settingsProvider.notifier).toggleNumbers(),
          ),
          // "How to play" moved into the consolidated gear settings sheet.
        ],
      ),
    );
  }

  // Labeled "💡 Surprise me" pill (the i18n string already includes the emoji).
  // Labeled rather than a bare lamp icon so its purpose is clear; scales down to
  // fit so it never crowds the prompt field on narrow screens.
  Widget _buildSurprisePill(BuildContext context, L10n l10n,
      {required VoidCallback onTap}) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 42,
        constraints: const BoxConstraints(maxWidth: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: cs.secondaryContainer,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: cs.outlineVariant),
        ),
        child: Center(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              l10n.t('surpriseMe'),
              maxLines: 1,
              softWrap: false,
              style: GoogleFonts.fredoka(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: cs.onSecondaryContainer,
              ),
            ),
          ),
        ),
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

  String _packNameKey(String p) =>
      'pack${p[0].toUpperCase()}${p.substring(1)}Name';

  String _palLabel(String p, L10n l10n) =>
      '${packById(p).emoji} ${l10n.t(_packNameKey(p))}';

  String _palLabelShort(String p, L10n l10n) => l10n.t(_packNameKey(p));

  String _cntLabel(int cnt) =>
      '🎨 ${cnt == 99 ? 'Max' : cnt.toString()}';

  String _cntLabelShort(int cnt) =>
      cnt == 99 ? 'Max' : cnt.toString();
}

// ─── Consolidated settings sheet body ────────────────────────────────────────
// Appearance (Light/Dark/System), Language (12 chips), How to play, About.
// A ConsumerWidget so it can read/watch theme + locale providers live; reuses the
// app's fredoka (titles) / nunito (body) type scale and colorScheme.

class _SettingsSheetBody extends ConsumerWidget {
  final void Function(BuildContext sheetCtx) onHowToPlay;
  final void Function(BuildContext sheetCtx) onAbout;

  const _SettingsSheetBody({
    required this.onHowToPlay,
    required this.onAbout,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = ref.watch(l10nProvider);
    final themeMode = ref.watch(themeModeProvider);
    final currentLocale = ref.watch(localeProvider).valueOrNull?.locale ?? 'en';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // ── APPEARANCE ──
        _SheetSectionLabel(l10n.t('settingsTheme')),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _ThemeChoiceChip(
              label: l10n.t('settingsThemeLight'),
              icon: Icons.light_mode_rounded,
              selected: themeMode == ThemeMode.light,
              onTap: () {
                HapticFeedback.selectionClick();
                ref.read(themeModeProvider.notifier).state = ThemeMode.light;
              },
            ),
            _ThemeChoiceChip(
              label: l10n.t('settingsThemeDark'),
              icon: Icons.dark_mode_rounded,
              selected: themeMode == ThemeMode.dark,
              onTap: () {
                HapticFeedback.selectionClick();
                ref.read(themeModeProvider.notifier).state = ThemeMode.dark;
              },
            ),
            _ThemeChoiceChip(
              label: l10n.t('settingsThemeSystem'),
              icon: Icons.brightness_auto_rounded,
              selected: themeMode == ThemeMode.system,
              onTap: () {
                HapticFeedback.selectionClick();
                ref.read(themeModeProvider.notifier).state = ThemeMode.system;
              },
            ),
          ],
        ),
        const SizedBox(height: 20),

        // ── LANGUAGE ──
        _SheetSectionLabel(l10n.t('settingsLanguage')),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: languageMeta.entries.map((e) {
            final selected = e.key == currentLocale;
            return _LangChoiceChip(
              flag: e.value.flag,
              name: e.value.name,
              selected: selected,
              onTap: () {
                HapticFeedback.selectionClick();
                ref.read(localeProvider.notifier).setLocale(e.key);
              },
            );
          }).toList(),
        ),
        const SizedBox(height: 20),

        // ── HOW TO PLAY ──
        _SheetActionTile(
          icon: Icons.school_rounded,
          // howToPlayBtn already carries a ❓ emoji; strip it so the leading icon
          // isn't doubled up.
          label: l10n.t('howToPlayBtn').replaceFirst('❓', '').trim(),
          onTap: () => onHowToPlay(context),
        ),
        const SizedBox(height: 8),

        // ── ABOUT ──
        _SheetActionTile(
          icon: Icons.info_outline_rounded,
          label: l10n.t('settingsAbout'),
          onTap: () => onAbout(context),
        ),
      ],
    );
  }
}

class _SheetSectionLabel extends StatelessWidget {
  final String text;
  const _SheetSectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Text(
      text,
      style: GoogleFonts.fredoka(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: cs.onSurface.withValues(alpha: 0.7),
      ),
    );
  }
}

class _ThemeChoiceChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _ThemeChoiceChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? cs.primaryContainer : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? cs.primary.withValues(alpha: 0.55)
                : cs.outlineVariant.withValues(alpha: 0.5),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 18,
              color: selected ? cs.onPrimaryContainer : cs.onSurface,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.nunito(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: selected ? cs.onPrimaryContainer : cs.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LangChoiceChip extends StatelessWidget {
  final String flag;
  final String name;
  final bool selected;
  final VoidCallback onTap;

  const _LangChoiceChip({
    required this.flag,
    required this.name,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? cs.primaryContainer : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? cs.primary.withValues(alpha: 0.55)
                : cs.outlineVariant.withValues(alpha: 0.5),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(flag, style: const TextStyle(fontSize: 16)),
            const SizedBox(width: 6),
            Text(
              name,
              style: GoogleFonts.nunito(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: selected ? cs.onPrimaryContainer : cs.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SheetActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _SheetActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: cs.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 20, color: cs.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: GoogleFonts.nunito(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: cs.onSurface,
                  ),
                ),
              ),
              Icon(Icons.chevron_right_rounded,
                  size: 20, color: cs.onSurface.withValues(alpha: 0.4)),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Pulsing rewards entry icon ──────────────────────────────────────────────

class _PulsingRewardsIcon extends StatefulWidget {
  final int count;
  final String tooltip;
  final VoidCallback onTap;
  const _PulsingRewardsIcon({
    required this.count,
    required this.tooltip,
    required this.onTap,
  });

  @override
  State<_PulsingRewardsIcon> createState() => _PulsingRewardsIconState();
}

class _PulsingRewardsIconState extends State<_PulsingRewardsIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 950))
      ..repeat(reverse: true);
    _scale = Tween(begin: 1.0, end: 1.14)
        .animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Center(
      child: GestureDetector(
        onTap: widget.onTap,
        child: Tooltip(
          message: widget.tooltip,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                ScaleTransition(
                  scale: _scale,
                  child: const Text('🏆', style: TextStyle(fontSize: 22)),
                ),
                if (widget.count > 0)
                  Positioned(
                    right: -6,
                    top: -6,
                    child: Container(
                      constraints:
                          const BoxConstraints(minWidth: 16, minHeight: 16),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: cs.primary,
                        borderRadius: BorderRadius.circular(50),
                        border: Border.all(color: cs.surface, width: 1.5),
                      ),
                      child: Center(
                        child: Text(
                          widget.count > 99 ? '99+' : '${widget.count}',
                          style: GoogleFonts.fredoka(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              color: cs.onPrimary,
                              height: 1.1),
                        ),
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
