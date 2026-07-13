import 'artwork_model.dart';

class FamilyMember {
  final String nickname;
  final int avatarIndex;
  final int totalCompleted;
  final int currentStreak;
  final List<CommunityArtwork> recentArtworks;

  const FamilyMember({
    required this.nickname,
    required this.avatarIndex,
    required this.totalCompleted,
    required this.currentStreak,
    required this.recentArtworks,
  });

  factory FamilyMember.fromJson(Map<String, dynamic> j) => FamilyMember(
        nickname: j['nickname'] as String? ?? 'Artist',
        avatarIndex: (j['avatarIndex'] as num?)?.toInt() ?? 0,
        totalCompleted: (j['totalCompleted'] as num?)?.toInt() ?? 0,
        currentStreak: (j['currentStreak'] as num?)?.toInt() ?? 0,
        recentArtworks: (j['recentArtworks'] as List<dynamic>? ?? [])
            .map((e) => CommunityArtwork.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class FamilyData {
  final String familyCode;
  final int memberCount;
  final List<FamilyMember> members;

  const FamilyData({
    required this.familyCode,
    required this.memberCount,
    required this.members,
  });

  factory FamilyData.fromJson(Map<String, dynamic> j) => FamilyData(
        familyCode: j['familyCode'] as String? ?? '',
        memberCount: (j['memberCount'] as num?)?.toInt() ?? 0,
        members: (j['members'] as List<dynamic>? ?? [])
            .map((e) => FamilyMember.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
