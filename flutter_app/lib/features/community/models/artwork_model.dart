class CommunityArtwork {
  final int id;
  final String shareType; // 'colored' | 'template' | 'freehand'
  final String? subject;
  final String? difficulty;
  final int? seed;
  final String imageUrl;
  final int starCount;
  final int viewCount;
  final String sharedAt;
  final String nickname;
  final int avatarIndex;
  bool starred; // mutable: toggled locally after star action

  CommunityArtwork({
    required this.id,
    required this.shareType,
    this.subject,
    this.difficulty,
    this.seed,
    required this.imageUrl,
    required this.starCount,
    required this.viewCount,
    required this.sharedAt,
    required this.nickname,
    required this.avatarIndex,
    this.starred = false,
  });

  factory CommunityArtwork.fromJson(Map<String, dynamic> j) => CommunityArtwork(
        id: (j['id'] as num).toInt(),
        shareType: j['shareType'] as String? ?? 'colored',
        subject: j['subject'] as String?,
        difficulty: j['difficulty'] as String?,
        seed: j['seed'] == null ? null : (j['seed'] as num).toInt(),
        imageUrl: j['imageUrl'] as String,
        starCount: (j['starCount'] as num?)?.toInt() ?? 0,
        viewCount: (j['viewCount'] as num?)?.toInt() ?? 0,
        sharedAt: j['sharedAt'] as String? ?? '',
        nickname: j['nickname'] as String? ?? 'Artist',
        avatarIndex: (j['avatarIndex'] as num?)?.toInt() ?? 0,
      );
}
