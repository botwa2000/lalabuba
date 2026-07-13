class LeaderboardEntry {
  final int rank;
  final String nickname;
  final int avatarIndex;
  final int score;
  final int? weeklyCompleted;
  final int? weeklyStars;

  const LeaderboardEntry({
    required this.rank,
    required this.nickname,
    required this.avatarIndex,
    required this.score,
    this.weeklyCompleted,
    this.weeklyStars,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> j) => LeaderboardEntry(
        rank: (j['rank'] as num).toInt(),
        nickname: j['nickname'] as String? ?? 'Artist',
        avatarIndex: (j['avatarIndex'] as num?)?.toInt() ?? 0,
        score: (j['score'] as num?)?.toInt() ?? 0,
        weeklyCompleted: j['weeklyCompleted'] == null
            ? null
            : (j['weeklyCompleted'] as num).toInt(),
        weeklyStars: j['weeklyStars'] == null
            ? null
            : (j['weeklyStars'] as num).toInt(),
      );
}

class Leaderboard {
  final String type; // 'weekly' | 'alltime'
  final String? weekStart;
  final List<LeaderboardEntry> entries;
  final String? refreshedAt;

  const Leaderboard({
    required this.type,
    this.weekStart,
    required this.entries,
    this.refreshedAt,
  });

  factory Leaderboard.fromJson(Map<String, dynamic> j) => Leaderboard(
        type: j['type'] as String? ?? 'weekly',
        weekStart: j['weekStart'] as String?,
        entries: (j['entries'] as List<dynamic>? ?? [])
            .map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        refreshedAt: j['refreshedAt'] as String?,
      );
}
