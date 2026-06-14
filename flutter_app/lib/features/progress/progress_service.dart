import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/storage_service.dart';

/// A sticker/badge the child can earn. [test] runs against a [Progress]
/// snapshot AFTER a completion is recorded. Title/description are resolved at
/// display time via l10n keys `badge<Id>Title` / `badge<Id>Desc`.
class StickerBadge {
  final String id;
  final String emoji;
  final bool Function(Progress p) test;
  const StickerBadge(this.id, this.emoji, this.test);
}

/// Anonymous, local-only progress — the Flutter twin of the web app's
/// `progress.js`. Drives the completion celebration, the days-colored pill and
/// the Journal sticker shelf. No network, no identifiers.
const kBadges = <StickerBadge>[
  StickerBadge('first', '🌟', _first),
  StickerBadge('five', '🖐️', _five),
  StickerBadge('ten', '🔟', _ten),
  StickerBadge('twentyfive', '🎨', _twentyfive),
  StickerBadge('fifty', '🏆', _fifty),
  StickerBadge('streak3', '🔥', _streak3),
  StickerBadge('streak7', '⚡', _streak7),
  StickerBadge('streak30', '👑', _streak30),
  StickerBadge('explorer', '🧭', _explorer),
  StickerBadge('rainbow', '🌈', _rainbow),
];

bool _first(Progress p) => p.totalCompleted >= 1;
bool _five(Progress p) => p.totalCompleted >= 5;
bool _ten(Progress p) => p.totalCompleted >= 10;
bool _twentyfive(Progress p) => p.totalCompleted >= 25;
bool _fifty(Progress p) => p.totalCompleted >= 50;
bool _streak3(Progress p) => p.streak >= 3;
bool _streak7(Progress p) => p.streak >= 7;
bool _streak30(Progress p) => p.streak >= 30;
bool _explorer(Progress p) => p.uniqueSubjects >= 10;
bool _rainbow(Progress p) => p.hardCompleted >= 1;

class Progress {
  final int totalCompleted;
  final int totalGenerated;
  final int streak;
  final int longestStreak;
  final String? lastColoredDay; // YYYY-MM-DD
  final int daysColored;
  final int hardCompleted;
  final Map<String, int> subjects;
  final List<String> badges;

  const Progress({
    this.totalCompleted = 0,
    this.totalGenerated = 0,
    this.streak = 0,
    this.longestStreak = 0,
    this.lastColoredDay,
    this.daysColored = 0,
    this.hardCompleted = 0,
    this.subjects = const {},
    this.badges = const [],
  });

  int get uniqueSubjects => subjects.length;

  Map<String, dynamic> toJson() => {
        'totalCompleted': totalCompleted,
        'totalGenerated': totalGenerated,
        'streak': streak,
        'longestStreak': longestStreak,
        'lastColoredDay': lastColoredDay,
        'daysColored': daysColored,
        'hardCompleted': hardCompleted,
        'subjects': subjects,
        'badges': badges,
      };

  factory Progress.fromJson(Map<String, dynamic> j) => Progress(
        totalCompleted: (j['totalCompleted'] ?? 0) as int,
        totalGenerated: (j['totalGenerated'] ?? 0) as int,
        streak: (j['streak'] ?? 0) as int,
        longestStreak: (j['longestStreak'] ?? 0) as int,
        lastColoredDay: j['lastColoredDay'] as String?,
        daysColored: (j['daysColored'] ?? 0) as int,
        hardCompleted: (j['hardCompleted'] ?? 0) as int,
        subjects: (j['subjects'] as Map?)?.map(
                (k, v) => MapEntry(k as String, (v as num).toInt())) ??
            const {},
        badges:
            (j['badges'] as List?)?.map((e) => e as String).toList() ?? const [],
      );

  Progress copyWith({
    int? totalCompleted,
    int? totalGenerated,
    int? streak,
    int? longestStreak,
    String? lastColoredDay,
    int? daysColored,
    int? hardCompleted,
    Map<String, int>? subjects,
    List<String>? badges,
  }) =>
      Progress(
        totalCompleted: totalCompleted ?? this.totalCompleted,
        totalGenerated: totalGenerated ?? this.totalGenerated,
        streak: streak ?? this.streak,
        longestStreak: longestStreak ?? this.longestStreak,
        lastColoredDay: lastColoredDay ?? this.lastColoredDay,
        daysColored: daysColored ?? this.daysColored,
        hardCompleted: hardCompleted ?? this.hardCompleted,
        subjects: subjects ?? this.subjects,
        badges: badges ?? this.badges,
      );

  /// Earned badge objects, in catalogue order.
  List<StickerBadge> get earnedBadges {
    final have = badges.toSet();
    return kBadges.where((b) => have.contains(b.id)).toList();
  }
}

String _todayKey() {
  final n = DateTime.now();
  return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
}

int _dayDiff(String a, String b) {
  final pa = a.split('-').map(int.parse).toList();
  final pb = b.split('-').map(int.parse).toList();
  final da = DateTime.utc(pa[0], pa[1], pa[2]);
  final db = DateTime.utc(pb[0], pb[1], pb[2]);
  return db.difference(da).inDays;
}

class ProgressNotifier extends AsyncNotifier<Progress> {
  static const _key = 'progress_v1';

  @override
  Future<Progress> build() => _load();

  Future<Progress> _load() async {
    final raw = await StorageService.read(_key);
    if (raw == null || raw.isEmpty) return const Progress();
    try {
      return Progress.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const Progress();
    }
  }

  Future<void> _save(Progress p) async {
    await StorageService.write(_key, jsonEncode(p.toJson()));
    state = AsyncData(p);
  }

  /// Counts a generation (drives the parent-facing daily counter context).
  Future<void> recordGeneration() async {
    final p = state.valueOrNull ?? await _load();
    await _save(p.copyWith(totalGenerated: p.totalGenerated + 1));
  }

  /// Records a finished coloring. Returns the badges newly earned by this
  /// completion so the celebration can reveal them.
  Future<List<StickerBadge>> recordCompletion({
    String? subject,
    String? difficulty,
  }) async {
    var p = state.valueOrNull ?? await _load();
    final tk = _todayKey();

    var streak = p.streak;
    var daysColored = p.daysColored;
    var lastDay = p.lastColoredDay;
    if (p.lastColoredDay != tk) {
      if (p.lastColoredDay != null && _dayDiff(p.lastColoredDay!, tk) == 1) {
        streak += 1; // consecutive day
      } else {
        streak = 1; // first ever, or streak broken
      }
      lastDay = tk;
      daysColored += 1;
    }

    final subjects = Map<String, int>.from(p.subjects);
    final subj = (subject ?? '').trim().toLowerCase();
    if (subj.isNotEmpty && subj != '?') {
      subjects[subj] = (subjects[subj] ?? 0) + 1;
    }

    final hard = (difficulty == 'hard' || difficulty == 'extreme')
        ? p.hardCompleted + 1
        : p.hardCompleted;

    p = p.copyWith(
      totalCompleted: p.totalCompleted + 1,
      streak: streak,
      longestStreak: streak > p.longestStreak ? streak : p.longestStreak,
      lastColoredDay: lastDay,
      daysColored: daysColored,
      hardCompleted: hard,
      subjects: subjects,
    );

    // Award newly-qualified badges.
    final have = p.badges.toSet();
    final newBadges = <StickerBadge>[];
    final badges = List<String>.from(p.badges);
    for (final b in kBadges) {
      if (!have.contains(b.id) && b.test(p)) {
        badges.add(b.id);
        newBadges.add(b);
      }
    }
    p = p.copyWith(badges: badges);

    await _save(p);
    return newBadges;
  }
}

final progressProvider =
    AsyncNotifierProvider<ProgressNotifier, Progress>(ProgressNotifier.new);
