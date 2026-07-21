import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/artwork_model.dart';

const _kAvatars = [
  '🐉','🐧','🐻','🦄','🐯','🦊','🐰','🐬','🦅','🐺',
  '🐼','🐨','🐆','🦉','🦜','🐹','🦔','🦦','🐿️','🦘',
];

String avatarEmoji(int idx) =>
    (idx >= 0 && idx < _kAvatars.length) ? _kAvatars[idx] : '🐻';

String _typeEmoji(String shareType) => switch (shareType) {
  'template' => '📋',
  'freehand' => '✏️',
  _ => '🎨',
};

String _topReaction(CommunityArtwork artwork) {
  final pairs = <(String, int)>[
    ('🔥', artwork.fireCount),
    ('❤️', artwork.heartCount),
    ('😂', artwork.laughCount),
    ('🎉', artwork.celebrateCount),
  ].where((p) => p.$2 > 0).toList()
    ..sort((a, b) => b.$2.compareTo(a.$2));
  if (pairs.isEmpty) return '';
  return pairs.take(2).map((p) => '${p.$1}${p.$2}').join(' ');
}

class CommunityArtworkCard extends StatelessWidget {
  final CommunityArtwork artwork;
  final VoidCallback onTap;
  final String baseUrl;

  const CommunityArtworkCard({
    super.key,
    required this.artwork,
    required this.onTap,
    required this.baseUrl,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final url = artwork.imageUrl.startsWith('/')
        ? '$baseUrl${artwork.imageUrl}'
        : artwork.imageUrl;
    final reactions = _topReaction(artwork);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: cs.surfaceContainerHighest,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.10),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        clipBehavior: Clip.hardEdge,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Image
            Image.network(
              url,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Center(
                child: Text('🎨', style: TextStyle(fontSize: 40, color: cs.onSurfaceVariant)),
              ),
              loadingBuilder: (_, child, progress) {
                if (progress == null) return child;
                return Container(
                  color: cs.surfaceContainerHighest,
                  child: Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      value: progress.expectedTotalBytes != null
                          ? progress.cumulativeBytesLoaded / progress.expectedTotalBytes!
                          : null,
                    ),
                  ),
                );
              },
            ),
            // Bottom gradient + info overlay
            Positioned(
              bottom: 0, left: 0, right: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(8, 20, 8, 7),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [Color(0xCC000000), Color(0x00000000)],
                  ),
                ),
                child: Row(
                  children: [
                    Text(avatarEmoji(artwork.avatarIndex),
                        style: const TextStyle(fontSize: 13)),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        artwork.nickname,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.nunito(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    if (reactions.isNotEmpty)
                      Text(
                        reactions,
                        style: const TextStyle(fontSize: 10),
                      ),
                  ],
                ),
              ),
            ),
            // Type badge (top-right)
            Positioned(
              top: 6, right: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  _typeEmoji(artwork.shareType),
                  style: const TextStyle(fontSize: 11),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
