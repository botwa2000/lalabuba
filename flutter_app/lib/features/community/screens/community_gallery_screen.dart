import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/di/providers.dart';
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

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
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
      // Resolve base URL from config
      final config = ref.read(appConfigProvider).valueOrNull;
      if (config != null) _baseUrl = config.apiBaseUrl;

      final result = await svc.getGallery(
        page: _page,
        type: _filterType == 'all' ? null : _filterType,
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

    return Column(
      children: [
        // Filter chips
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            children: [
              for (final f in const [
                ('all', 'All'),
                ('colored', '🎨 Colorings'),
                ('template', '📋 Templates'),
                ('freehand', '✏️ Drawings'),
              ])
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
        // Leaderboard shortcut
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Text('🏆', style: TextStyle(fontSize: 16)),
                  label: Text('Top Artists',
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
        // Gallery grid or states
        Expanded(
          child: _buildBody(cs),
        ),
      ],
    );
  }

  Widget _buildBody(ColorScheme cs) {
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
            Text('Could not load gallery',
                style: GoogleFonts.nunito(fontSize: 15)),
            const SizedBox(height: 8),
            TextButton(
                onPressed: () => _load(reset: true),
                child: const Text('Try again')),
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
              'No artworks yet!\nBe the first to share 🎨',
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
    HapticFeedback.lightImpact();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _ArtworkLightbox(
          artwork: artwork,
          baseUrl: _baseUrl,
          svc: ref.read(communityServiceProvider),
          onStarChanged: (newCount, starred) {
            final idx = _artworks.indexWhere((a) => a.id == artwork.id);
            if (idx >= 0 && mounted) {
              setState(() {
                _artworks[idx].starred = starred;
              });
            }
          },
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
  final void Function(int newCount, bool starred) onStarChanged;
  final VoidCallback onReported;

  const _ArtworkLightbox({
    required this.artwork,
    required this.baseUrl,
    required this.svc,
    required this.onStarChanged,
    required this.onReported,
  });

  @override
  State<_ArtworkLightbox> createState() => _ArtworkLightboxState();
}

class _ArtworkLightboxState extends State<_ArtworkLightbox> {
  late bool _starred;
  late int _starCount;
  bool _acting = false;

  @override
  void initState() {
    super.initState();
    _starred = widget.artwork.starred;
    _starCount = widget.artwork.starCount;
  }

  Future<void> _toggleStar() async {
    if (_acting) return;
    setState(() => _acting = true);
    HapticFeedback.lightImpact();
    try {
      final result = await widget.svc.toggleStar(widget.artwork.id);
      if (mounted) {
        setState(() {
          _starred = result.starred;
          _starCount = result.starCount;
        });
        widget.onStarChanged(_starCount, _starred);
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _report() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Report this artwork?'),
        content: const Text(
            'This will flag the artwork for review. Thank you for keeping the community safe!'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Report',
                  style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await widget.svc.reportArtwork(widget.artwork.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Thanks — we\'ll review this.')),
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
            tooltip: 'Report',
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
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              color: Colors.black,
              child: Row(
                children: [
                  if (widget.artwork.subject != null) ...[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
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
                        ],
                      ),
                    ),
                  ] else
                    const Spacer(),
                  GestureDetector(
                    onTap: _toggleStar,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 10),
                      decoration: BoxDecoration(
                        color: _starred
                            ? const Color(0xFFFFB300)
                            : cs.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(50),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _starred ? '⭐' : '☆',
                            style: const TextStyle(fontSize: 20),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '$_starCount',
                            style: GoogleFonts.fredoka(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: _starred ? Colors.white : null,
                            ),
                          ),
                        ],
                      ),
                    ),
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
