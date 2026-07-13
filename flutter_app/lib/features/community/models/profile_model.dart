class CommunityProfile {
  final String? nickname;
  final int avatarIndex;
  final bool sharingEnabled;
  final bool hasNickname;
  final int? familyId;
  final int totalCompleted;
  final int currentStreak;
  final int longestStreak;

  const CommunityProfile({
    this.nickname,
    this.avatarIndex = 0,
    this.sharingEnabled = false,
    this.hasNickname = false,
    this.familyId,
    this.totalCompleted = 0,
    this.currentStreak = 0,
    this.longestStreak = 0,
  });

  factory CommunityProfile.fromJson(Map<String, dynamic> j) => CommunityProfile(
        nickname: j['nickname'] as String?,
        avatarIndex: (j['avatarIndex'] as num?)?.toInt() ?? 0,
        sharingEnabled: j['sharingEnabled'] as bool? ?? false,
        hasNickname: j['hasNickname'] as bool? ?? false,
        familyId: j['familyId'] == null ? null : (j['familyId'] as num).toInt(),
        totalCompleted: (j['totalCompleted'] as num?)?.toInt() ?? 0,
        currentStreak: (j['currentStreak'] as num?)?.toInt() ?? 0,
        longestStreak: (j['longestStreak'] as num?)?.toInt() ?? 0,
      );
}
