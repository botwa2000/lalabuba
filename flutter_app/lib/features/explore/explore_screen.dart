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

// ── Hub screen ─────────────────────────────────────────────────────────────────

class ExploreScreen extends ConsumerWidget {
  const ExploreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text('Explore',
            style: GoogleFonts.fredoka(
                fontSize: 22, fontWeight: FontWeight.w700)),
        backgroundColor: cs.surface,
        elevation: 0,
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.1,
        ),
        itemCount: _topics.length,
        itemBuilder: (ctx, i) {
          final (slug, emoji, name) = _topics[i];
          return _TopicCard(
            slug: slug,
            emoji: emoji,
            name: name,
          );
        },
      ),
    );
  }
}

class _TopicCard extends StatelessWidget {
  final String slug;
  final String emoji;
  final String name;
  const _TopicCard(
      {required this.slug, required this.emoji, required this.name});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => context.pushNamed('exploreTopic',
          pathParameters: {'topic': slug}, extra: (emoji, name)),
      child: Container(
        decoration: BoxDecoration(
          color: cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
          border:
              Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 40)),
            const SizedBox(height: 8),
            Text(
              name,
              style: GoogleFonts.fredoka(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: cs.onSurface),
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
              fontWeight: FontWeight.w600,
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
          options: Options(responseType: ResponseType.bytes));
      final bytes = Uint8List.fromList(resp.data ?? []);
      if (bytes.isEmpty || !context.mounted) return;
      context.pushNamed('canvas',
          extra: CanvasScreenArgs(
            subject: entry.subject,
            displayLabel: entry.subject,
            source: 'explore',
            preloadedBytes: bytes,
            preloadedDifficulty: difficulty,
          ));
    } catch (_) {
      // Fallback: generate fresh from subject if fetch fails.
      if (context.mounted) {
        context.pushNamed('canvas',
            extra: CanvasScreenArgs(
              subject: entry.subject,
              displayLabel: entry.subject,
              source: 'explore',
            ));
      }
    }
  }
}
