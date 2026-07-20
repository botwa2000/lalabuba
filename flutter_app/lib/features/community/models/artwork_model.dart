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
  final int fireCount;
  final int heartCount;
  final int laughCount;
  final int celebrateCount;
  final int recolorCount;
  final int? parentArtworkId;
  bool starred; // legacy compat (true if any reaction)
  String? activeReaction; // mutable: 'fire'|'heart'|'laugh'|'celebrate'|null

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
    this.fireCount = 0,
    this.heartCount = 0,
    this.laughCount = 0,
    this.celebrateCount = 0,
    this.recolorCount = 0,
    this.parentArtworkId,
    this.starred = false,
    this.activeReaction,
  });

  int get totalReactions => fireCount + heartCount + laughCount + celebrateCount;

  factory CommunityArtwork.fromJson(Map<String, dynamic> j) => CommunityArtwork(
        id: int.parse(j['id'].toString()),
        shareType: j['shareType'] as String? ?? 'colored',
        subject: j['subject'] as String?,
        difficulty: j['difficulty'] as String?,
        seed: j['seed'] == null ? null : int.tryParse(j['seed'].toString()),
        imageUrl: j['imageUrl'] as String,
        starCount: (j['starCount'] as num?)?.toInt() ?? 0,
        viewCount: (j['viewCount'] as num?)?.toInt() ?? 0,
        sharedAt: j['sharedAt'] as String? ?? '',
        nickname: j['nickname'] as String? ?? 'Artist',
        avatarIndex: (j['avatarIndex'] as num?)?.toInt() ?? 0,
        fireCount: (j['fireCount'] as num?)?.toInt() ?? 0,
        heartCount: (j['heartCount'] as num?)?.toInt() ?? 0,
        laughCount: (j['laughCount'] as num?)?.toInt() ?? 0,
        celebrateCount: (j['celebrateCount'] as num?)?.toInt() ?? 0,
        recolorCount: (j['recolorCount'] as num?)?.toInt() ?? 0,
        parentArtworkId: j['parentArtworkId'] == null ? null : int.parse(j['parentArtworkId'].toString()),
      );
}
