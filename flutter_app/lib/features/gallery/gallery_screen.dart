import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/l10n/l10n_service.dart';
import '../progress/progress_service.dart';

final galleryImagesProvider = FutureProvider<List<File>>((ref) async {
  final dir = await getApplicationDocumentsDirectory();
  final files = dir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.png') && f.path.contains('lalabuba_'))
      .toList()
    ..sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));
  return files;
});

class GalleryScreen extends ConsumerWidget {
  const GalleryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = ref.watch(l10nProvider);
    final imagesAsync = ref.watch(galleryImagesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          l10n.t('journalTitle'),
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(galleryImagesProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildJournalHeader(context, ref, l10n),
          Expanded(
            child: imagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (files) => files.isEmpty
                  ? _buildEmpty(context, l10n)
                  : _buildGrid(context, ref, files, l10n),
            ),
          ),
        ],
      ),
    );
  }

  // Masterpiece count + streak, and the sticker shelf (earned in colour, locked
  // greyed) — the collection that pulls the child back.
  Widget _buildJournalHeader(BuildContext context, WidgetRef ref, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    final progress = ref.watch(progressProvider).valueOrNull ?? const Progress();
    final earned = progress.badges.toSet();

    final isEmpty = progress.totalCompleted == 0;
    final statsText = () {
      // Brand-new child (no completions): show an encouraging line instead of a
      // blank header, so the Journal explains what it's for (parity with web).
      if (isEmpty) return l10n.t('journalEmpty');
      final base =
          l10n.t('celebMasterpieces', {'count': '${progress.totalCompleted}'});
      final streak = progress.streak > 1
          ? l10n.t('celebStreakSuffix', {'streak': '${progress.streak}'})
          : '';
      return '$base$streak';
    }();

    // "Next sticker" hint: closest unreached count milestone (parity with web).
    // Milestones mirror kBadges' count thresholds 1/5/10/25/50; hidden past 50.
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
          SizedBox(
            height: 86,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: kBadges.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final b = kBadges[i];
                final has = earned.contains(b.id);
                final cap = '${b.id[0].toUpperCase()}${b.id.substring(1)}';
                return Container(
                  width: 74,
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                  decoration: BoxDecoration(
                    gradient: has
                        ? const LinearGradient(
                            colors: [Color(0xFFFFF7E0), Color(0xFFFFE6F2)])
                        : null,
                    color: has ? null : cs.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: has ? const Color(0xFFFFD166) : cs.outlineVariant,
                      width: has ? 2 : 1,
                    ),
                  ),
                  child: Opacity(
                    opacity: has ? 1 : 0.5,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(has ? b.emoji : '🔒',
                            style: const TextStyle(fontSize: 26)),
                        const SizedBox(height: 4),
                        Flexible(
                          child: Text(
                            l10n.t('badge${cap}Title'),
                            maxLines: 2,
                            textAlign: TextAlign.center,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.nunito(
                                fontSize: 9, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          if (nextHint != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                nextHint,
                style: GoogleFonts.nunito(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: cs.onSurface.withValues(alpha: 0.65),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildEmpty(BuildContext context, L10n l10n) {
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

  Widget _buildGrid(
      BuildContext context, WidgetRef ref, List<File> files, L10n l10n) {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.0,
      ),
      itemCount: files.length,
      itemBuilder: (ctx, i) => _buildTile(context, ref, files[i], l10n),
    );
  }

  Widget _buildTile(
      BuildContext context, WidgetRef ref, File file, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: () => _openFullScreen(context, ref, file, l10n),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.file(
          file,
          fit: BoxFit.cover,
          // Decode at thumbnail resolution instead of full size. Saved artwork
          // is up to ~3072px wide; decoding that into a 2-column grid cell
          // wastes memory and can jank the gallery. 400px covers retina tiles.
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

  void _openFullScreen(
      BuildContext context, WidgetRef ref, File file, L10n l10n) {
    showDialog(
      context: context,
      builder: (_) => _GalleryFullScreen(file: file, l10n: l10n, ref: ref),
    );
  }
}

class _GalleryFullScreen extends StatelessWidget {
  final File file;
  final L10n l10n;
  final WidgetRef ref;

  const _GalleryFullScreen(
      {required this.file, required this.l10n, required this.ref});

  @override
  Widget build(BuildContext context) {
    return Dialog.fullscreen(
      child: Scaffold(
        appBar: AppBar(
          actions: [
            IconButton(
              icon: const Icon(Icons.share_rounded),
              onPressed: () => _share(),
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded),
              onPressed: () => _confirmDelete(context),
            ),
          ],
        ),
        body: Center(
          child: InteractiveViewer(
            child: Image.file(file),
          ),
        ),
      ),
    );
  }

  Future<void> _share() async {
    final xFile = XFile(file.path, mimeType: 'image/png');
    await SharePlus.instance.share(ShareParams(
      files: [xFile],
      text: 'My Lalabuba artwork! 🎨',
    ));
  }

  void _confirmDelete(BuildContext context) {
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
              Navigator.pop(ctx);
              await file.delete();
              ref.invalidate(galleryImagesProvider);
              if (context.mounted) Navigator.pop(context);
            },
            child: Text(l10n.t('galleryDeleteYes'),
                style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
