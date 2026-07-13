import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/artwork_model.dart';

const _kAvatars = [
  '🐉','🐧','🐻','🦄','🐯','🦊','🐰','🐬','🦅','🐺',
  '🐼','🐨','🐆','🦉','🦜','🐹','🦔','🦦','🐿️','🦘',
];

String avatarEmoji(int idx) =>
    (idx >= 0 && idx < _kAvatars.length) ? _kAvatars[idx] : '🐻';

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

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: cs.surfaceContainerHighest,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.hardEdge,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Image.network(
                url,
                fit: BoxFit.cover,
                width: double.infinity,
                errorBuilder: (_, __, ___) => const Center(
                  child: Text('🎨', style: TextStyle(fontSize: 40)),
                ),
                loadingBuilder: (_, child, progress) => progress == null
                    ? child
                    : const Center(
                        child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(
                children: [
                  Text(avatarEmoji(artwork.avatarIndex),
                      style: const TextStyle(fontSize: 14)),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      artwork.nickname,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.nunito(
                          fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ),
                  Text(
                    '⭐ ${artwork.starCount}',
                    style: GoogleFonts.nunito(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: cs.onSurface.withValues(alpha: 0.6)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
