import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/di/providers.dart';
import '../../../core/l10n/l10n_service.dart';
import '../community_service.dart';
import '../models/artwork_model.dart';
import '../widgets/community_artwork_card.dart';
import 'leaderboard_screen.dart';

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
        !_loading &&
        _hasMore) {
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
      final config = ref.read(appConfigProvider).valueOrNull;
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
    setState(() => _filterType = type);
    _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final cs = Theme.of(context).colorScheme;
    final l10n = ref.watch(l10nProvider);

    final filters = [
      ('all', l10n.t('communityFilterAll')),
      ('colored', l10n.t('communityFilterColorings')),
      ('template', l10n.t('communityFilterTemplates')),
      ('freehand', l10n.t('communityFilterDrawings')),
      ('daily', l10n.t('communityFilterDaily')),
      if (_weeklyThemeActive == true && _weeklyThemeWord != null)
        ('theme', '${_weeklyThemeEmoji ?? '🎨'} $_weeklyThemeWord'),
    ];

    return Column(
      children: [
        if (_newReactions > 0)
          Container(
            margin: const EdgeInsets.fromLTRB(12, 6, 12, 0),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: cs.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Text('💖', style: TextStyle(fontSize: 16)),
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
                  child: Icon(Icons.close, size: 16, color: cs.onPrimaryContainer),
                ),
              ],
            ),
          ),
        if (_weeklyThemeActive == true && _weeklyThemeWord != null)
          Container(
            margin: const EdgeInsets.fromLTRB(12, 6, 12, 0),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: cs.tertiaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Text(_weeklyThemeEmoji ?? '🎨', style: const TextStyle(fontSize: 16)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'This week\'s theme: $_weeklyThemeWord',
                    style: GoogleFonts.nunito(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: cs.onTertiaryContainer,
                    ),
                  ),
                ),
                TextButton(
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  onPressed: () => _setFilter('theme'),
                  child: Text('See all',
                    style: GoogleFonts.fredoka(
                      fontSize: 12,
                      color: cs.onTertiaryContainer,
                      fontWeight: FontWeight.w700,
                    )),
                ),
              ],
            ),
          ),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            children: [
              for (final f in filters)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(f.$2, style: GoogleFonts.nunito(fontSize: 12)),
                    selected: _filterType == f.$1,
                    onSelected: (_) => _setFilter(f.$1),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Text('🏆', style: TextStyle(fontSize: 16)),
                  label: Text(l10n.t('communityTopArtists'),
                      style: GoogleFonts.fredoka(
                          fontSize: 14, fontWeight: FontWeight.w700)),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => const LeaderboardScreen()),
                  ),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(50)),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _buildBody(cs, l10n),
        ),
      ],
    );
  }

  Widget _buildBody(ColorScheme cs, L10n l10n) {
    if (_artworks.isEmpty && _loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_artworks.isEmpty && _error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('😕', style: TextStyle(fontSize: 40)),
            const SizedBox(height: 12),
            Text(l10n.t('communityGalleryLoadError'),
                style: GoogleFonts.nunito(fontSize: 15)),
            const SizedBox(height: 8),
            TextButton(
                onPressed: () => _load(reset: true),
                child: Text(l10n.t('tryAgain'))),
          ],
        ),
      );
    }
    if (_artworks.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🌟', style: TextStyle(fontSize: 56)),
            const SizedBox(height: 16),
            Text(
              l10n.t('communityGalleryEmpty'),
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(
                  fontSize: 16,
                  color: cs.onSurface.withValues(alpha: 0.6)),
            ),
          ],
        ),
      );
    }
    return GridView.builder(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 0.85,
      ),
      itemCount: _artworks.length + (_hasMore ? 1 : 0),
      itemBuilder: (ctx, i) {
        if (i == _artworks.length) {
          return const Center(
              child: Padding(
            padding: EdgeInsets.all(16),
            child: CircularProgressIndicator(strokeWidth: 2),
          ));
        }
        return CommunityArtworkCard(
          artwork: _artworks[i],
          baseUrl: _baseUrl,
          onTap: () => _openLightbox(ctx, _artworks[i]),
        );
      },
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
          onReported: () {
            setState(() => _artworks.removeWhere((a) => a.id == artwork.id));
          },
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
  final VoidCallback onReported;

  const _ArtworkLightbox({
    required this.artwork,
    required this.baseUrl,
    required this.svc,
    required this.l10n,
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
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  int _countFor(String reaction) => switch (reaction) {
    'fire' => _fireCount,
    'heart' => _heartCount,
    'laugh' => _laughCount,
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
          SnackBar(content: Text(l10n.t('communityReportedToast'))),
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
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700),
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
          SafeArea(
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              color: Colors.black,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.artwork.subject != null) ...[
                    Text(
                      widget.artwork.subject ?? '',
                      style: GoogleFonts.fredoka(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (widget.artwork.difficulty != null)
                      Text(
                        widget.artwork.difficulty!,
                        style: GoogleFonts.nunito(
                          color: Colors.white60,
                          fontSize: 12,
                        ),
                      ),
                    const SizedBox(height: 8),
                  ],
                  Row(
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
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? cs.primaryContainer : Colors.white12,
          borderRadius: BorderRadius.circular(50),
          border: active ? Border.all(color: cs.primary, width: 1.5) : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 20)),
            if (count > 0) ...[
              const SizedBox(width: 4),
              Text(
                '$count',
                style: GoogleFonts.fredoka(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: active ? cs.onPrimaryContainer : Colors.white,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
