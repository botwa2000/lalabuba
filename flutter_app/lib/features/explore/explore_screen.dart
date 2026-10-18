import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/di/providers.dart';
import '../../core/l10n/l10n_service.dart';
import '../../core/router/app_router.dart';
import '../canvas/canvas_screen.dart';

// ── Data models ────────────────────────────────────────────────────────────────

class GalleryEntry {
  final String id;
  final String subject; // English generation subject (used for "again" prompts)
  final String label; // localised caption from ?lang=, falls back to subject
  final String url; // absolute https://lalabuba.com/img/g/...
  final String date;
  const GalleryEntry(
      {required this.id,
      required this.subject,
      required this.label,
      required this.url,
      required this.date});

  factory GalleryEntry.fromJson(Map<String, dynamic> j, String baseUrl) {
    final raw = j['url'] as String? ?? '';
    final url =
        raw.startsWith('/') ? '$baseUrl$raw' : raw;
    final subject = j['subject'] as String? ?? '';
    final label = (j['label'] as String?)?.trim() ?? '';
    return GalleryEntry(
      id: j['id'] as String? ?? '',
      subject: subject,
      label: label.isNotEmpty ? label : subject,
      url: url,
      date: j['date'] as String? ?? '',
    );
  }
}

class TopicImages {
  final List<GalleryEntry> easy;
  final List<GalleryEntry> medium;
  final List<GalleryEntry> hard;
  const TopicImages(
      {required this.easy, required this.medium, required this.hard});
}

class ExploreTopic {
  final String id;
  final String emoji;
  final String name; // already localised
  const ExploreTopic(this.id, this.emoji, this.name);
}

// ── Topic metadata ─────────────────────────────────────────────────────────────

// Offline fallback only — the live list (and any topic added later) comes from
// /api/gallery/topics, so a new topic needs no app release. Names via l10n.
const _bundledTopics = [
  ('dragon', '🐉'),
  ('unicorn', '🦄'),
  ('butterfly', '🦋'),
  ('dinosaur', '🦕'),
  ('cat', '🐱'),
  ('princess', '👸'),
  ('mermaid', '🧜'),
  ('rocket', '🚀'),
  ('car', '🚗'),
];

// ── Providers ──────────────────────────────────────────────────────────────────

Future<(Dio, String)> _galleryDio(Ref ref) async {
  final config = await ref.read(appConfigProvider.future);
  final baseUrl = config.apiBaseUrl.replaceFirst(RegExp(r'/$'), '');
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));
  return (dio, baseUrl);
}

/// Topic list in the app language. Falls back to the bundled list when offline.
final exploreTopicsProvider =
    FutureProvider.family<List<ExploreTopic>, String>((ref, lang) async {
  final l10n = ref.read(l10nProvider);
  final bundled = [
    for (final (id, emoji) in _bundledTopics)
      ExploreTopic(id, emoji, l10n.t('topic_$id')),
  ];
  try {
    final (dio, _) = await _galleryDio(ref);
    final resp =
        await dio.get('/api/gallery/topics', queryParameters: {'lang': lang});
    final list = ((resp.data as Map<String, dynamic>)['topics'] as List?)
            ?.cast<Map<String, dynamic>>() ??
        const <Map<String, dynamic>>[];
    final topics = [
      for (final j in list)
        if ((j['id'] as String?)?.isNotEmpty == true)
          ExploreTopic(j['id'] as String, j['emoji'] as String? ?? '🎨',
              j['name'] as String? ?? l10n.t('topic_${j['id']}')),
    ];
    return topics.isEmpty ? bundled : topics;
  } catch (_) {
    return bundled;
  }
});

/// Pre-drawn pictures for one topic, captioned in the given language.
final exploreTopicImagesProvider =
    FutureProvider.family<TopicImages, (String, String)>((ref, args) async {
  final (topic, lang) = args;
  final (dio, baseUrl) = await _galleryDio(ref);
  final resp = await dio
      .get('/api/gallery', queryParameters: {'topic': topic, 'lang': lang});
  final data = resp.data as Map<String, dynamic>;
  List<GalleryEntry> parse(String key) =>
      ((data[key] as List<dynamic>?) ?? [])
          .cast<Map<String, dynamic>>()
          .map((j) => GalleryEntry.fromJson(j, baseUrl))
          .toList();
  return TopicImages(
      easy: parse('easy'), medium: parse('medium'), hard: parse('hard'));
});

// Colour per topic — gives each card a distinct warm accent.
const _topicColors = {
  'dragon': Color(0xFFFF6B6B), // coral red
  'unicorn': Color(0xFF7C6DFF), // purple
  'butterfly': Color(0xFF4ECDC4), // teal
  'dinosaur': Color(0xFF45B7D1), // sky blue
  'cat': Color(0xFFFF9F43), // amber
  'princess': Color(0xFFFF78AC), // pink
  'mermaid': Color(0xFF26de81), // sea green
  'rocket': Color(0xFF778CA3), // slate
  'car': Color(0xFFE84393), // raspberry
};
const _fallbackColors = [
  Color(0xFFFF6B6B),
  Color(0xFF7C6DFF),
  Color(0xFF4ECDC4),
  Color(0xFFFF9F43),
];

// ── Hub screen ─────────────────────────────────────────────────────────────────

class ExploreScreen extends ConsumerWidget {
  const ExploreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final l10n = ref.watch(l10nProvider);
    final topics = ref.watch(exploreTopicsProvider(l10n.locale)).value ??
        const <ExploreTopic>[];
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 900
        ? 4
        : width >= 600
            ? 3
            : 2;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('navExplore'),
            style: GoogleFonts.fredoka(
                fontSize: 22, fontWeight: FontWeight.w700)),
        backgroundColor: cs.surface,
        elevation: 0,
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: _ExploreHeader(cs: cs, l10n: l10n),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            sliver: SliverGrid(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) {
                  final t = topics[i];
                  return _TopicCard(
                    slug: t.id,
                    emoji: t.emoji,
                    name: t.name,
                    cta: l10n.t('exploreColorNow'),
                    accent: _topicColors[t.id] ??
                        _fallbackColors[i % _fallbackColors.length],
                  );
                },
                childCount: topics.length,
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
  final L10n l10n;
  const _ExploreHeader({required this.cs, required this.l10n});

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
                  l10n.t('exploreHeaderTitle'),
                  style: GoogleFonts.fredoka(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: cs.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  l10n.t('exploreHeaderBody'),
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
  final String cta;
  final Color accent;
  const _TopicCard(
      {required this.slug,
      required this.emoji,
      required this.name,
      required this.cta,
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
              cta,
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
    final l10n = ref.watch(l10nProvider);
    final imagesAsync =
        ref.watch(exploreTopicImagesProvider((topic, l10n.locale)));
    return Scaffold(
      appBar: AppBar(
        title: Text('$emoji ${l10n.t('exploreTopicTitle', {'name': name})}',
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
            child: Text(l10n.t('exploreLoadError'),
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
                    Text(l10n.t('exploreEmpty'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.nunito(
                            fontSize: 16, color: cs.onSurfaceVariant)),
                    const SizedBox(height: 12),
                    Text(l10n.t('exploreEmptyHint'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.nunito(
                            fontSize: 13, color: cs.onSurfaceVariant.withValues(alpha: 0.7))),
                  ],
                ),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (images.easy.isNotEmpty) ...[
                _DiffHeading(l10n.t('diffEasy')),
                _ImageGrid(entries: images.easy, difficulty: 'easy'),
                const SizedBox(height: 16),
              ],
              if (images.medium.isNotEmpty) ...[
                _DiffHeading(l10n.t('diffMedium')),
                _ImageGrid(entries: images.medium, difficulty: 'medium'),
                const SizedBox(height: 16),
              ],
              if (images.hard.isNotEmpty) ...[
                _DiffHeading(l10n.t('diffHard')),
                _ImageGrid(entries: images.hard, difficulty: 'hard'),
                const SizedBox(height: 8),
              ],
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
  final List<GalleryEntry> entries;
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

class _GalleryCard extends StatelessWidget {
  final GalleryEntry entry;
  final String difficulty;
  const _GalleryCard({required this.entry, required this.difficulty});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _openCanvas(context),
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
                  entry.label,
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

  // Navigate immediately — CanvasScreen fetches the image via Flutter's own
  // HttpClient (same TLS/redirect stack as Image.network), so it works reliably
  // wherever the thumbnail already displays.
  void _openCanvas(BuildContext context) {
    context.pushNamed('canvas',
        extra: CanvasScreenArgs(
          subject: entry.subject,
          displayLabel: entry.label,
          source: 'explore',
          preloadedUrl: entry.url,
          preloadedDifficulty: difficulty,
        ));
  }
}
