import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/di/providers.dart';
import '../../core/router/app_router.dart';
import '../canvas/canvas_screen.dart';

// ── Data models ────────────────────────────────────────────────────────────────

class _GalleryEntry {
  final String id;
  final String subject;
  final String url; // absolute https://lalabuba.com/img/g/...
  final String date;
  const _GalleryEntry(
      {required this.id,
      required this.subject,
      required this.url,
      required this.date});

  factory _GalleryEntry.fromJson(Map<String, dynamic> j, String baseUrl) {
    final raw = j['url'] as String? ?? '';
    final url =
        raw.startsWith('/') ? '$baseUrl$raw' : raw;
    return _GalleryEntry(
      id: j['id'] as String? ?? '',
      subject: j['subject'] as String? ?? '',
      url: url,
      date: j['date'] as String? ?? '',
    );
  }
}

class _TopicImages {
  final List<_GalleryEntry> easy;
  final List<_GalleryEntry> medium;
  final List<_GalleryEntry> hard;
  const _TopicImages(
      {required this.easy, required this.medium, required this.hard});
}

// ── Topic metadata ─────────────────────────────────────────────────────────────

const _topics = [
  ('dragon', '🐉', 'Dragon'),
  ('unicorn', '🦄', 'Unicorn'),
  ('butterfly', '🦋', 'Butterfly'),
  ('dinosaur', '🦕', 'Dinosaur'),
  ('cat', '🐱', 'Cat'),
  ('princess', '👸', 'Princess'),
  ('mermaid', '🧜', 'Mermaid'),
  ('rocket', '🚀', 'Rocket'),
];

// ── Provider ───────────────────────────────────────────────────────────────────

final _topicImagesProvider =
    FutureProvider.family<_TopicImages, String>((ref, topic) async {
  final config = await ref.read(appConfigProvider.future);
  final baseUrl = config.apiBaseUrl.replaceFirst(RegExp(r'/$'), '');
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));
  final resp = await dio.get('/api/gallery', queryParameters: {'topic': topic});
  final data = resp.data as Map<String, dynamic>;
  List<_GalleryEntry> parse(String key) =>
      ((data[key] as List<dynamic>?) ?? [])
          .cast<Map<String, dynamic>>()
          .map((j) => _GalleryEntry.fromJson(j, baseUrl))
          .toList();
  return _TopicImages(
      easy: parse('easy'), medium: parse('medium'), hard: parse('hard'));
});

// Colour per topic — gives each card a distinct warm accent.
const _topicColors = [
  Color(0xFFFF6B6B), // dragon — coral red
  Color(0xFF7C6DFF), // unicorn — purple
  Color(0xFF4ECDC4), // butterfly — teal
  Color(0xFF45B7D1), // dinosaur — sky blue
  Color(0xFFFF9F43), // cat — amber
  Color(0xFFFF78AC), // princess — pink
  Color(0xFF26de81), // mermaid — sea green
  Color(0xFF778CA3), // rocket — slate
];

// ── Hub screen ─────────────────────────────────────────────────────────────────

class ExploreScreen extends ConsumerWidget {
  const ExploreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 900
        ? 4
        : width >= 600
            ? 3
            : 2;
    return Scaffold(
      appBar: AppBar(
        title: Text('Explore',
            style: GoogleFonts.fredoka(
                fontSize: 22, fontWeight: FontWeight.w700)),
        backgroundColor: cs.surface,
        elevation: 0,
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: _ExploreHeader(cs: cs),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            sliver: SliverGrid(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) {
                  final (slug, emoji, name) = _topics[i];
                  return _TopicCard(
                    slug: slug,
                    emoji: emoji,
                    name: name,
                    accent: _topicColors[i % _topicColors.length],
                  );
                },
                childCount: _topics.length,
              ),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: columns,
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
                childAspectRatio: 0.9,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ExploreHeader extends StatelessWidget {
  final ColorScheme cs;
  const _ExploreHeader({required this.cs});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            cs.primaryContainer,
            cs.secondaryContainer,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '🎨 Ready-to-Color Pictures!',
                  style: GoogleFonts.fredoka(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: cs.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Pick a topic, tap a picture, and start coloring right away — no waiting, just fun!',
                  style: GoogleFonts.nunito(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: cs.onPrimaryContainer.withValues(alpha: 0.8),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text('🖌️', style: TextStyle(fontSize: 42)),
        ],
      ),
    );
  }
}

class _TopicCard extends StatelessWidget {
  final String slug;
  final String emoji;
  final String name;
  final Color accent;
  const _TopicCard(
      {required this.slug,
      required this.emoji,
      required this.name,
      required this.accent});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark
        ? accent.withValues(alpha: 0.18)
        : accent.withValues(alpha: 0.12);
    final borderColor = accent.withValues(alpha: isDark ? 0.4 : 0.3);
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () => context.pushNamed('exploreTopic',
          pathParameters: {'topic': slug}, extra: (emoji, name)),
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: borderColor, width: 1.5),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: isDark ? 0.25 : 0.18),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(emoji, style: const TextStyle(fontSize: 36)),
            ),
            const SizedBox(height: 12),
            Text(
              name,
              textAlign: TextAlign.center,
              style: GoogleFonts.fredoka(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: cs.onSurface),
            ),
            const SizedBox(height: 4),
            Text(
              'Color now →',
              style: GoogleFonts.nunito(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: accent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Topic screen ───────────────────────────────────────────────────────────────

class ExploreTopicScreen extends ConsumerWidget {
  final String topic;
  final String emoji;
  final String name;
  const ExploreTopicScreen(
      {super.key,
      required this.topic,
      required this.emoji,
      required this.name});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final imagesAsync = ref.watch(_topicImagesProvider(topic));
    return Scaffold(
      appBar: AppBar(
        title: Text('$emoji $name Coloring Pages',
            style: GoogleFonts.fredoka(
                fontSize: 20, fontWeight: FontWeight.w700)),
        backgroundColor: cs.surface,
        elevation: 0,
      ),
      body: imagesAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator.adaptive()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load gallery — check your connection.',
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(
                    fontSize: 16, color: cs.onSurfaceVariant)),
          ),
        ),
        data: (images) {
          final allEmpty = images.easy.isEmpty &&
              images.medium.isEmpty &&
              images.hard.isEmpty;
          if (allEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(emoji, style: const TextStyle(fontSize: 56)),
                    const SizedBox(height: 16),
                    Text('No pre-made pages yet — generate your own!',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.nunito(
                            fontSize: 16, color: cs.onSurfaceVariant)),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: () {
                        context.pop();
                        context.pop();
                        // Navigate home and pre-fill subject
                        context.pushNamed('canvas',
                            extra: CanvasScreenArgs(
                              subject: name.toLowerCase(),
                              displayLabel: name,
                              source: 'explore',
                            ));
                      },
                      child: Text('Draw a $name now →',
                          style: GoogleFonts.fredoka(fontSize: 16)),
                    ),
                  ],
                ),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (images.easy.isNotEmpty) ...[
                _DiffHeading('Easy 🌟'),
                _ImageGrid(entries: images.easy, difficulty: 'easy'),
                const SizedBox(height: 16),
              ],
              if (images.medium.isNotEmpty) ...[
                _DiffHeading('Medium 🌟🌟'),
                _ImageGrid(entries: images.medium, difficulty: 'medium'),
                const SizedBox(height: 16),
              ],
              if (images.hard.isNotEmpty) ...[
                _DiffHeading('Hard 🌟🌟🌟'),
                _ImageGrid(entries: images.hard, difficulty: 'hard'),
                const SizedBox(height: 8),
              ],
              const SizedBox(height: 24),
              Center(
                child: OutlinedButton(
                  onPressed: () {
                    context.pop();
                    context.pop();
                    context.pushNamed('canvas',
                        extra: CanvasScreenArgs(
                          subject: name.toLowerCase(),
                          displayLabel: name,
                          source: 'explore',
                        ));
                  },
                  child: Text('Generate a new $name page →',
                      style: GoogleFonts.fredoka(fontSize: 15)),
                ),
              ),
              const SizedBox(height: 32),
            ],
          );
        },
      ),
    );
  }
}

class _DiffHeading extends StatelessWidget {
  final String label;
  const _DiffHeading(this.label);
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(label,
          style: GoogleFonts.fredoka(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: cs.onSurfaceVariant)),
    );
  }
}

class _ImageGrid extends StatelessWidget {
  final List<_GalleryEntry> entries;
  final String difficulty;
  const _ImageGrid({required this.entries, required this.difficulty});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 1,
      ),
      itemCount: entries.length,
      itemBuilder: (ctx, i) =>
          _GalleryCard(entry: entries[i], difficulty: difficulty),
    );
  }
}

class _GalleryCard extends ConsumerWidget {
  final _GalleryEntry entry;
  final String difficulty;
  const _GalleryCard({required this.entry, required this.difficulty});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _openCanvas(context, ref),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(
              entry.url,
              fit: BoxFit.cover,
              loadingBuilder: (ctx, child, progress) => progress == null
                  ? child
                  : Container(
                      color: cs.surfaceContainerHighest,
                      child: const Center(
                          child: CircularProgressIndicator.adaptive()),
                    ),
              errorBuilder: (ctx, _, __) => Container(
                color: cs.surfaceContainerHighest,
                child: Icon(Icons.broken_image_rounded,
                    color: cs.onSurfaceVariant),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.55)
                    ],
                  ),
                ),
                child: Text(
                  entry.subject,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.nunito(
                      fontSize: 10,
                      color: Colors.white,
                      fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openCanvas(BuildContext context, WidgetRef ref) async {
    // Fetch image bytes so the canvas can render without re-generating.
    try {
      final config = await ref.read(appConfigProvider.future);
      final baseUrl = config.apiBaseUrl.replaceFirst(RegExp(r'/$'), '');
      final url = entry.url.startsWith('/')
          ? '$baseUrl${entry.url}'
          : entry.url;
      final resp = await Dio().get<List<int>>(url,
          options: Options(
            responseType: ResponseType.bytes,
            sendTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 20),
          ));
      final bytes = Uint8List.fromList(resp.data ?? []);
      if (bytes.isEmpty) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not load image — please try again')),
          );
        }
        return;
      }
      if (!context.mounted) return;
      context.pushNamed('canvas',
          extra: CanvasScreenArgs(
            subject: entry.subject,
            displayLabel: entry.subject,
            source: 'explore',
            preloadedBytes: bytes,
            preloadedDifficulty: difficulty,
          ));
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not load image — please try again')),
        );
      }
    }
  }
}
