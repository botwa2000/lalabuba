import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/l10n/l10n_service.dart';

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
          l10n.t('galleryTitle'),
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(galleryImagesProvider),
          ),
        ],
      ),
      body: imagesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (files) => files.isEmpty
            ? _buildEmpty(context, l10n)
            : _buildGrid(context, ref, files, l10n),
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
