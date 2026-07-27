import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/l10n/l10n_service.dart';
import '../../core/di/providers.dart';
import '../community/community_service.dart';
import '../community/screens/community_gallery_screen.dart';
import '../community/widgets/nickname_picker.dart';
import 'print_book.dart';
import '../../services/account_service.dart';
import '../../shared/widgets/parental_gate.dart';

final galleryImagesProvider = FutureProvider<List<File>>((ref) async {
  final childId = ref.watch(accountProvider.select((s) => s.activeChildId));
  final prefix = childId != null ? 'lalabuba_child${childId}_' : 'lalabuba_';
  final dir = await getApplicationDocumentsDirectory();
  final files = dir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.png') && f.uri.pathSegments.last.startsWith(prefix))
      .toList()
    ..sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));
  return files;
});

class GalleryScreen extends ConsumerStatefulWidget {
  const GalleryScreen({super.key});

  @override
  ConsumerState<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends ConsumerState<GalleryScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    final initialTab = ref.read(journalTabIndexProvider);
    if (initialTab > 0) {
      _tabController.index = initialTab;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ref.read(journalTabIndexProvider.notifier).state = 0;
      });
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ref.watch(l10nProvider);
    final imagesAsync = ref.watch(galleryImagesProvider);

    ref.listen<int>(journalTabIndexProvider, (prev, next) {
      if (next > 0 && mounted) {
        _tabController.animateTo(next);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) ref.read(journalTabIndexProvider.notifier).state = 0;
        });
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: Text(
          l10n.t('journalTitle'),
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.menu_book_rounded),
            tooltip: l10n.t('printBookBtn'),
            onPressed: () async {
              final files = imagesAsync.value ?? const <File>[];
              if (files.isEmpty) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(l10n.t('printBookEmpty'))),
                );
                return;
              }
              HapticFeedback.lightImpact();
              try {
                await printColoringBook(
                  title: l10n.t('printBookTitle'),
                  files: files,
                );
              } catch (_) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(l10n.t('printBookEmpty'))),
                );
              }
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(galleryImagesProvider),
          ),
          IconButton(
            icon: const Icon(Icons.settings_rounded),
            tooltip: 'Settings',
            onPressed: () => context.push('/settings'),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('📓', style: TextStyle(fontSize: 16)),
                  const SizedBox(width: 6),
                  Text(l10n.t('journalTabMyArt'),
                      style: GoogleFonts.fredoka(fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('🌟', style: TextStyle(fontSize: 16)),
                  const SizedBox(width: 6),
                  Text(l10n.t('journalTabCommunity'),
                      style: GoogleFonts.fredoka(fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _MyArtTab(imagesAsync: imagesAsync, l10n: l10n),
          const CommunityGalleryScreen(),
        ],
      ),
    );
  }
}

// ─── My Art tab ───────────────────────────────────────────────────────────────

class _MyArtTab extends ConsumerWidget {
  final AsyncValue<List<File>> imagesAsync;
  final L10n l10n;

  const _MyArtTab({required this.imagesAsync, required this.l10n});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(progressProvider).value ?? const Progress();
    final earned = progress.badges.toSet();

    return Column(
      children: [
        _buildJournalHeader(context, ref, progress, earned),
        Expanded(
          child: imagesAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
            data: (files) => files.isEmpty
                ? _buildEmpty(context)
                : _buildGrid(context, ref, files),
          ),
        ),
      ],
    );
  }

  Widget _buildJournalHeader(BuildContext context, WidgetRef ref,
      Progress progress, Set<String> earned) {
    final cs = Theme.of(context).colorScheme;
    final isEmpty = progress.totalCompleted == 0;
    final statsText = () {
      if (isEmpty) return l10n.t('journalEmpty');
      final base =
          l10n.t('celebMasterpieces', {'count': '${progress.totalCompleted}'});
      final streak = progress.streak > 1
          ? l10n.t('celebStreakSuffix', {'streak': '${progress.streak}'})
          : '';
      return '$base$streak';
    }();

    const milestones = <(int, String)>[
      (1, '🌟'),
      (5, '🖐️'),
      (10, '🔟'),
      (25, '🎨'),
      (50, '🏆'),
    ];
    String? nextHint;
    for (final m in milestones) {
      if (progress.totalCompleted < m.$1) {
        nextHint = l10n.t('journalNext', {
          'count': '${m.$1 - progress.totalCompleted}',
          'emoji': m.$2,
        });
        break;
      }
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(bottom: BorderSide(color: cs.outlineVariant, width: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (statsText.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                statsText,
                style: GoogleFonts.fredoka(
                  fontSize: isEmpty ? 14 : 15,
                  fontWeight: FontWeight.w700,
                  color: isEmpty
                      ? cs.onSurface.withValues(alpha: 0.7)
                      : cs.onSurface,
                ),
              ),
            ),
          if (earned.isEmpty)
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                context.goNamed('treehouse');
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: cs.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                      color: cs.outlineVariant.withValues(alpha: 0.5)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('🌟', style: TextStyle(fontSize: 22)),
                    const SizedBox(width: 8),
                    Text(
                      l10n.t('badgeUnlockHint'),
                      style: GoogleFonts.nunito(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: cs.onSurface.withValues(alpha: 0.7)),
                    ),
                    const SizedBox(width: 4),
                    Icon(Icons.chevron_right_rounded,
                        size: 16, color: cs.onSurface.withValues(alpha: 0.5)),
                  ],
                ),
              ),
            )
          else
            Builder(builder: (ctx) {
              final earnedList = kBadges.where((b) => earned.contains(b.id)).toList();
              return SizedBox(
                height: 86,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: earnedList.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final b = earnedList[i];
                    final cap = '${b.id[0].toUpperCase()}${b.id.substring(1)}';
                    return GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        context.goNamed('treehouse');
                      },
                      child: Container(
                        width: 74,
                        padding: const EdgeInsets.symmetric(
                            vertical: 8, horizontal: 4),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                              colors: [Color(0xFFFFF7E0), Color(0xFFFFE6F2)]),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                              color: const Color(0xFFFFD166), width: 2),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(b.emoji,
                                style: const TextStyle(fontSize: 26)),
                            const SizedBox(height: 4),
                            Flexible(
                              child: Text(
                                l10n.t('badge${cap}Title'),
                                maxLines: 2,
                                textAlign: TextAlign.center,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.nunito(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              );
            }),
          if (nextHint != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                nextHint,
                style: GoogleFonts.nunito(
                  fontSize: 13,
                  color: cs.onSurface.withValues(alpha: 0.55),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🎨', style: TextStyle(fontSize: 64)),
            const SizedBox(height: 16),
            Text(
              l10n.t('galleryEmpty'),
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(
                fontSize: 16,
                color: cs.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGrid(BuildContext context, WidgetRef ref, List<File> files) {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.0,
      ),
      itemCount: files.length,
      itemBuilder: (ctx, i) => _buildTile(context, ref, files[i]),
    );
  }

  Widget _buildTile(BuildContext context, WidgetRef ref, File file) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: () => showDialog(
        context: context,
        builder: (_) => _GalleryFullScreen(file: file, l10n: l10n),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.file(
          file,
          fit: BoxFit.cover,
          cacheWidth: 400,
          filterQuality: FilterQuality.low,
          errorBuilder: (_, __, ___) => Container(
            color: cs.surfaceContainerHighest,
            child: const Icon(Icons.broken_image_rounded),
          ),
        ),
      ),
    );
  }
}

// ─── Full-screen viewer ───────────────────────────────────────────────────────

class _GalleryFullScreen extends ConsumerStatefulWidget {
  final File file;
  final L10n l10n;

  const _GalleryFullScreen({required this.file, required this.l10n});

  @override
  ConsumerState<_GalleryFullScreen> createState() => _GalleryFullScreenState();
}

class _GalleryFullScreenState extends ConsumerState<_GalleryFullScreen> {
  bool _sharingToCommunity = false;

  @override
  Widget build(BuildContext context) {
    final l10n = widget.l10n;
    return Dialog.fullscreen(
      child: Scaffold(
        appBar: AppBar(
          actions: [
            if (_sharingToCommunity)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            else
              IconButton(
                icon: const Text('🌟', style: TextStyle(fontSize: 20)),
                tooltip: l10n.t('communityShareBtn'),
                onPressed: _shareToCommunity,
              ),
            IconButton(
              icon: const Icon(Icons.share_rounded),
              onPressed: _shareOS,
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded),
              onPressed: _confirmDelete,
            ),
          ],
        ),
        body: Center(
          child: InteractiveViewer(
            child: Image.file(widget.file),
          ),
        ),
      ),
    );
  }

  Future<void> _shareOS() async {
    final xFile = XFile(widget.file.path, mimeType: 'image/png');
    await SharePlus.instance.share(ShareParams(
      files: [xFile],
      text: 'My Lalabuba artwork! 🎨',
    ));
  }

  Future<void> _shareToCommunity() async {
    final l10n = widget.l10n;
    CommunityService svc;
    try {
      svc = ref.read(communityServiceProvider);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.t('communityShareError'))),
      );
      return;
    }

    bool withConsent = false;
    bool hasNickname = false;
    try {
      final profile = await svc.getProfile();
      withConsent = !profile.sharingEnabled;
      hasNickname = profile.hasNickname;
    } catch (_) {}

    if (!mounted) return;
    if (withConsent) {
      final ok = await showParentalGate(context, l10n);
      if (!ok || !mounted) return;
    }
    if (!hasNickname) {
      final nickname = await showNicknamePicker(context, svc, l10n);
      if (nickname == null || !mounted) return;
      try {
        await svc.setupProfile(
          nickname: nickname,
          withParentalConsent: withConsent,
        );
        withConsent = false;
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.t('communityShareError'))),
        );
        return;
      }
    }

    if (!mounted) return;
    setState(() => _sharingToCommunity = true);

    try {
      final bytes = await widget.file.readAsBytes();
      await svc.shareArtwork(
        shareType: 'colored',
        subject: null,
        difficulty: null,
        seed: null,
        jpegBytes: bytes,
        withParentalConsent: withConsent,
      );
      if (!mounted) return;
      ref.read(communityGalleryRefreshProvider.notifier).state++;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.t('communitySharedToast')),
          duration: const Duration(seconds: 3),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.t('communityShareError'))),
      );
    } finally {
      if (mounted) setState(() => _sharingToCommunity = false);
    }
  }

  void _confirmDelete() {
    final l10n = widget.l10n;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.t('galleryDeleteConfirm'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(l10n.t('galleryDeleteNo')),
          ),
          TextButton(
            onPressed: () async {
              // Capture navigator before async gap to avoid BuildContext lint.
              final outerNav = Navigator.of(context);
              Navigator.pop(ctx);
              await widget.file.delete();
              outerNav.pop();
            },
            child: Text(l10n.t('galleryDeleteYes'),
                style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
