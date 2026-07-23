import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/di/providers.dart';
import '../../../core/l10n/l10n_service.dart';
import '../community_service.dart';
import '../models/artwork_model.dart';
import '../widgets/community_artwork_card.dart';
import 'leaderboard_screen.dart';

// ─── Accent colours ─────────────────────────────────────────────────────────
const _kGradientStart = Color(0xFFFF8C69); // warm coral
const _kGradientEnd   = Color(0xFFFF5BA7); // vivid pink

class CommunityGalleryScreen extends ConsumerStatefulWidget {
  const CommunityGalleryScreen({super.key});

  @override
  ConsumerState<CommunityGalleryScreen> createState() =>
      _CommunityGalleryScreenState();
}

class _CommunityGalleryScreenState
    extends ConsumerState<CommunityGalleryScreen>
    with AutomaticKeepAliveClientMixin {
  final _scroll = ScrollController();
  final _artworks = <CommunityArtwork>[];
  String _filterType = 'all';
  bool _loading = false;
  bool _hasMore = true;
  int _page = 0;
  String? _error;
  String _baseUrl = 'https://lalabuba.com';
  int _newReactions = 0;
  bool _notificationsChecked = false;
  bool? _weeklyThemeActive;
  String? _weeklyThemeWord;
  String? _weeklyThemeEmoji;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _load();
      _checkNotifications();
      _loadWeeklyTheme();
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 300 &&
        !_loading && _hasMore) {
      _load();
    }
  }

  Future<void> _checkNotifications() async {
    if (_notificationsChecked) return;
    _notificationsChecked = true;
    try {
      final svc = ref.read(communityServiceProvider);
      final r = await svc.getNotifications();
      if (r.newReactions > 0 && mounted) {
        setState(() => _newReactions = r.newReactions);
      }
    } catch (_) {}
  }

  Future<void> _loadWeeklyTheme() async {
    if (_weeklyThemeActive != null) return;
    try {
      final svc = ref.read(communityServiceProvider);
      final t = await svc.getWeeklyTheme();
      if (mounted) {
        setState(() {
          _weeklyThemeActive = t.active;
          _weeklyThemeWord = t.themeWord;
          _weeklyThemeEmoji = t.themeEmoji;
        });
      }
    } catch (_) {}
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    final svc = ref.read(communityServiceProvider);
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _artworks.clear();
        _page = 0;
        _hasMore = true;
      }
    });

    try {
      final config = ref.read(appConfigProvider).value;
      if (config != null) _baseUrl = config.apiBaseUrl;

      final result = await svc.getGallery(
        page: _page,
        type: (_filterType == 'all' || _filterType == 'daily' || _filterType == 'theme') ? null : _filterType,
        daily: _filterType == 'daily',
        theme: _filterType == 'theme',
      );
      if (mounted) {
        setState(() {
          _artworks.addAll(result.artworks);
          _hasMore = result.nextPage != null;
          _page++;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  void _setFilter(String type) {
    if (_filterType == type) return;
    HapticFeedback.selectionClick();
    setState(() => _filterType = type);
    _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final cs = Theme.of(context).colorScheme;
    final brightness = Theme.of(context).brightness;
    final l10n = ref.watch(l10nProvider);

    final filters = <(String, String)>[
      ('all', l10n.t('communityFilterAll')),
      ('colored', l10n.t('communityFilterColorings')),
      ('template', l10n.t('communityFilterTemplates')),
      ('freehand', l10n.t('communityFilterDrawings')),
      ('daily', l10n.t('communityFilterDaily')),
      if (_weeklyThemeActive == true && _weeklyThemeWord != null)
        ('theme', '${_weeklyThemeEmoji ?? '🎨'} $_weeklyThemeWord'),
    ];

    return ColoredBox(
      color: brightness == Brightness.dark
          ? const Color(0xFF1A1A2E)
          : const Color(0xFFFAF5FF),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _buildHeader(cs, brightness, l10n),
            if (_newReactions > 0) _buildReactionBanner(cs, l10n),
            if (_weeklyThemeActive == true && _weeklyThemeWord != null)
              _buildThemeBanner(cs, l10n),
            _buildFilterRow(filters),
            Expanded(child: _buildBody(cs, l10n)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(ColorScheme cs, Brightness brightness, L10n l10n) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_kGradientStart, _kGradientEnd],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: _kGradientEnd.withValues(alpha: 0.30),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.t('galleryTabCommunity'),
                  style: GoogleFonts.fredoka(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.t('communitySubtitle'),
                  style: GoogleFonts.nunito(
                    fontSize: 13,
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          // Action buttons: Share my art + Top Artists
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Share my art — goes to home so user can draw and share from canvas
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  context.pushNamed('home');
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.28),
                    borderRadius: BorderRadius.circular(50),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.50)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('📤', style: TextStyle(fontSize: 13)),
                      const SizedBox(width: 5),
                      Text(
                        l10n.t('communityShareBtn'),
                        style: GoogleFonts.fredoka(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),
              // Top Artists leaderboard
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LeaderboardScreen()),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(50),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.40)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('🏆', style: TextStyle(fontSize: 13)),
                      const SizedBox(width: 5),
                      Text(
                        l10n.t('communityTopArtists'),
                        style: GoogleFonts.fredoka(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildReactionBanner(ColorScheme cs, L10n l10n) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 2, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: cs.primaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Text('💖', style: TextStyle(fontSize: 15)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '$_newReactions new reaction${_newReactions > 1 ? 's' : ''} on your art!',
              style: GoogleFonts.nunito(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: cs.onPrimaryContainer,
              ),
            ),
          ),
          GestureDetector(
            onTap: () => setState(() => _newReactions = 0),
            child: Icon(Icons.close_rounded, size: 16, color: cs.onPrimaryContainer),
          ),
        ],
      ),
    );
  }

  Widget _buildThemeBanner(ColorScheme cs, L10n l10n) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 4, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: cs.tertiaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Text(_weeklyThemeEmoji ?? '🎨', style: const TextStyle(fontSize: 15)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'This week: $_weeklyThemeWord',
              style: GoogleFonts.nunito(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: cs.onTertiaryContainer,
              ),
            ),
          ),
          GestureDetector(
            onTap: () => _setFilter('theme'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: cs.onTertiaryContainer.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'See all →',
                style: GoogleFonts.fredoka(
                  fontSize: 11,
                  color: cs.onTertiaryContainer,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterRow(List<(String, String)> filters) {
    return SizedBox(
      height: 42,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        children: [
          for (final f in filters)
            Padding(
              padding: const EdgeInsets.only(right: 7),
              child: _FilterPill(
                label: f.$2,
                selected: _filterType == f.$1,
                onTap: () => _setFilter(f.$1),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBody(ColorScheme cs, L10n l10n) {
    if (_artworks.isEmpty && _loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_artworks.isEmpty && _error != null) {
      return _buildError(cs, l10n);
    }
    if (_artworks.isEmpty) {
      return _buildEmpty(cs, l10n);
    }
    return GridView.builder(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 0.82,
      ),
      itemCount: _artworks.length + (_hasMore ? 1 : 0),
      itemBuilder: (ctx, i) {
        if (i == _artworks.length) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          );
        }
        return CommunityArtworkCard(
          artwork: _artworks[i],
          baseUrl: _baseUrl,
          onTap: () => _openLightbox(ctx, _artworks[i]),
        );
      },
    );
  }

  Widget _buildError(ColorScheme cs, L10n l10n) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('😕', style: TextStyle(fontSize: 44)),
          const SizedBox(height: 12),
          Text(l10n.t('communityGalleryLoadError'),
              style: GoogleFonts.nunito(fontSize: 15, color: cs.onSurface.withValues(alpha: 0.6)),
              textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton.tonal(
            onPressed: () => _load(reset: true),
            child: Text(l10n.t('tryAgain')),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty(ColorScheme cs, L10n l10n) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 24),
          // Big star animation placeholder
          Container(
            width: 100, height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [_kGradientStart, _kGradientEnd],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: _kGradientEnd.withValues(alpha: 0.35),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: const Center(
              child: Text('🌟', style: TextStyle(fontSize: 48)),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            l10n.t('communityGalleryEmpty'),
            textAlign: TextAlign.center,
            style: GoogleFonts.fredoka(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: cs.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.t('communityEmptyHint'),
            textAlign: TextAlign.center,
            style: GoogleFonts.nunito(
              fontSize: 14,
              color: cs.onSurface.withValues(alpha: 0.6),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 28),
          // Placeholder artwork skeletons to make the screen feel alive
          _buildSkeletonGrid(cs),
        ],
      ),
    );
  }

  Widget _buildSkeletonGrid(ColorScheme cs) {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 0.82,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: List.generate(4, (i) => Container(
        decoration: BoxDecoration(
          color: cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Center(
          child: Text(
            ['🦄', '🐉', '🦋', '🚀'][i],
            style: TextStyle(fontSize: 36, color: cs.onSurface.withValues(alpha: 0.35)),
          ),
        ),
      )),
    );
  }

  void _openLightbox(BuildContext context, CommunityArtwork artwork) {
    final l10n = ref.read(l10nProvider);
    HapticFeedback.lightImpact();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _ArtworkLightbox(
          artwork: artwork,
          baseUrl: _baseUrl,
          svc: ref.read(communityServiceProvider),
          l10n: l10n,
          onReacted: (updated) {
            if (!mounted) return;
            setState(() {
              final idx = _artworks.indexWhere((a) => a.id == artwork.id);
              if (idx >= 0) _artworks[idx] = updated;
            });
          },
          onReported: () {
            setState(() => _artworks.removeWhere((a) => a.id == artwork.id));
          },
        ),
      ),
    );
  }
}

// ─── Filter pill ─────────────────────────────────────────────────────────────

class _FilterPill extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FilterPill({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected
              ? const LinearGradient(
                  colors: [_kGradientStart, _kGradientEnd],
                ).colors.first
              : cs.surfaceContainerHighest,
          gradient: selected
              ? const LinearGradient(colors: [_kGradientStart, _kGradientEnd])
              : null,
          borderRadius: BorderRadius.circular(50),
          border: Border.all(
            color: selected
                ? Colors.transparent
                : cs.outlineVariant.withValues(alpha: 0.5),
          ),
          boxShadow: selected
              ? [BoxShadow(color: _kGradientEnd.withValues(alpha: 0.25), blurRadius: 6, offset: const Offset(0, 2))]
              : [],
        ),
        child: Text(
          label,
          style: GoogleFonts.nunito(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : cs.onSurface.withValues(alpha: 0.85),
          ),
        ),
      ),
    );
  }
}

// ─── Artwork lightbox ────────────────────────────────────────────────────────

class _ArtworkLightbox extends StatefulWidget {
  final CommunityArtwork artwork;
  final String baseUrl;
  final CommunityService svc;
  final L10n l10n;
  final void Function(CommunityArtwork updated) onReacted;
  final VoidCallback onReported;

  const _ArtworkLightbox({
    required this.artwork,
    required this.baseUrl,
    required this.svc,
    required this.l10n,
    required this.onReacted,
    required this.onReported,
  });

  @override
  State<_ArtworkLightbox> createState() => _ArtworkLightboxState();
}

class _ArtworkLightboxState extends State<_ArtworkLightbox> {
  String? _activeReaction;
  late int _fireCount;
  late int _heartCount;
  late int _laughCount;
  late int _celebrateCount;
  bool _acting = false;

  static const _reactions = [
    ('fire', '🔥'),
    ('heart', '❤️'),
    ('laugh', '😂'),
    ('celebrate', '🎉'),
  ];

  @override
  void initState() {
    super.initState();
    _activeReaction = widget.artwork.activeReaction;
    _fireCount = widget.artwork.fireCount;
    _heartCount = widget.artwork.heartCount;
    _laughCount = widget.artwork.laughCount;
    _celebrateCount = widget.artwork.celebrateCount;
  }

  Future<void> _react(String reaction) async {
    if (_acting) return;
    setState(() => _acting = true);
    HapticFeedback.lightImpact();
    try {
      final result = await widget.svc.react(widget.artwork.id, reaction);
      if (mounted) {
        setState(() {
          _activeReaction = result.reacted ? result.reaction : null;
          _fireCount = result.fireCount;
          _heartCount = result.heartCount;
          _laughCount = result.laughCount;
          _celebrateCount = result.celebrateCount;
        });
        // Propagate back to grid
        widget.onReacted(CommunityArtwork(
          id: widget.artwork.id,
          shareType: widget.artwork.shareType,
          subject: widget.artwork.subject,
          difficulty: widget.artwork.difficulty,
          seed: widget.artwork.seed,
          imageUrl: widget.artwork.imageUrl,
          starCount: widget.artwork.starCount,
          viewCount: widget.artwork.viewCount,
          sharedAt: widget.artwork.sharedAt,
          nickname: widget.artwork.nickname,
          avatarIndex: widget.artwork.avatarIndex,
          fireCount: _fireCount,
          heartCount: _heartCount,
          laughCount: _laughCount,
          celebrateCount: _celebrateCount,
          recolorCount: widget.artwork.recolorCount,
          parentArtworkId: widget.artwork.parentArtworkId,
          activeReaction: _activeReaction,
        ));
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  int _countFor(String reaction) => switch (reaction) {
    'fire'      => _fireCount,
    'heart'     => _heartCount,
    'laugh'     => _laughCount,
    'celebrate' => _celebrateCount,
    _ => 0,
  };

  Future<void> _report() async {
    final l10n = widget.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.t('communityReportTitle')),
        content: Text(l10n.t('communityReportBody')),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(l10n.t('cancel'))),
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(l10n.t('communityReportBtn'),
                  style: const TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await widget.svc.reportArtwork(widget.artwork.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(widget.l10n.t('communityReportedToast'))),
        );
        widget.onReported();
        Navigator.of(context).pop();
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final url = widget.artwork.imageUrl.startsWith('/')
        ? '${widget.baseUrl}${widget.artwork.imageUrl}'
        : widget.artwork.imageUrl;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Row(
          children: [
            Text(avatarEmoji(widget.artwork.avatarIndex),
                style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                widget.artwork.nickname,
                style: GoogleFonts.fredoka(
                    color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.flag_outlined, color: Colors.white70),
            tooltip: widget.l10n.t('communityReportBtn'),
            onPressed: _report,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: InteractiveViewer(
              child: Center(
                child: Image.network(
                  url,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Center(
                    child: Text('🎨', style: TextStyle(fontSize: 64)),
                  ),
                ),
              ),
            ),
          ),
          // Subject label
          if (widget.artwork.subject != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.artwork.subject ?? '',
                      style: GoogleFonts.fredoka(
                          color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (widget.artwork.difficulty != null)
                    Container(
                      margin: const EdgeInsets.only(left: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white12,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        widget.artwork.difficulty!,
                        style: GoogleFonts.nunito(color: Colors.white70, fontSize: 11),
                      ),
                    ),
                ],
              ),
            ),
          // Reaction bar
          SafeArea(
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              color: Colors.black,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  for (final (key, emoji) in _reactions)
                    _ReactionButton(
                      emoji: emoji,
                      count: _countFor(key),
                      active: _activeReaction == key,
                      onTap: () => _react(key),
                      cs: cs,
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReactionButton extends StatelessWidget {
  final String emoji;
  final int count;
  final bool active;
  final VoidCallback onTap;
  final ColorScheme cs;

  const _ReactionButton({
    required this.emoji,
    required this.count,
    required this.active,
    required this.onTap,
    required this.cs,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          gradient: active
              ? const LinearGradient(colors: [_kGradientStart, _kGradientEnd])
              : null,
          color: active ? null : Colors.white12,
          borderRadius: BorderRadius.circular(50),
          border: active ? null : Border.all(color: Colors.white24),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 22)),
            if (count > 0) ...[
              const SizedBox(width: 5),
              Text(
                '$count',
                style: GoogleFonts.fredoka(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
