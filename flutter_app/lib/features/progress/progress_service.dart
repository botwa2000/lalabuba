import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/storage_service.dart';
import '../../shared/services/device_id_service.dart';
import '../../core/di/providers.dart';
import '../../services/account_service.dart';

/// Sticker collections — the meaningful grouping shown in the Rewards album.
enum BadgeGroup { milestones, streaks, explorer, creativity, sharing }

/// A sticker/badge the child can earn. [test] runs against a [Progress]
/// snapshot AFTER an event is recorded. Title/description are resolved at
/// display time via l10n keys `badge<Id>Title` / `badge<Id>Desc`.
class StickerBadge {
  final String id;
  final String emoji;
  final BadgeGroup group;
  final bool Function(Progress p) test;
  const StickerBadge(this.id, this.emoji, this.group, this.test);
}

/// Anonymous, local-only progress — the Flutter twin of the web app's
/// `progress.js`. Drives the completion celebration, the days-colored pill, the
/// Rewards album, daily missions and crayon-pack unlocks. No network, no
/// identifiers.
///
/// IMPORTANT: badge IDs below are PERSISTED in user data. Never rename or
/// repurpose an existing id — that would orphan stickers children already
/// earned. Only ADD new ids.
const kBadges = <StickerBadge>[
  // ── Milestones (total pictures finished) ──
  StickerBadge('first', '🌟', BadgeGroup.milestones, _first),
  StickerBadge('five', '🖐️', BadgeGroup.milestones, _five),
  StickerBadge('ten', '🔟', BadgeGroup.milestones, _ten),
  StickerBadge('twentyfive', '🎨', BadgeGroup.milestones, _twentyfive),
  StickerBadge('fifty', '🏆', BadgeGroup.milestones, _fifty),
  StickerBadge('hundred', '💯', BadgeGroup.milestones, _hundred),

  // ── Streaks (consecutive days) ──
  StickerBadge('streak3', '🔥', BadgeGroup.streaks, _streak3),
  StickerBadge('streak7', '⚡', BadgeGroup.streaks, _streak7),
  StickerBadge('streak14', '🌠', BadgeGroup.streaks, _streak14),
  StickerBadge('streak30', '👑', BadgeGroup.streaks, _streak30),

  // ── Explorer (variety + themes) ──
  StickerBadge('explorer', '🧭', BadgeGroup.explorer, _explorer),
  StickerBadge('animalPal', '🐾', BadgeGroup.explorer, _animalPal),
  StickerBadge('onTheMove', '🚗', BadgeGroup.explorer, _onTheMove),
  StickerBadge('foodie', '🍓', BadgeGroup.explorer, _foodie),
  StickerBadge('natureFan', '🌳', BadgeGroup.explorer, _natureFan),
  StickerBadge('peoplePal', '🙂', BadgeGroup.explorer, _peoplePal),
  StickerBadge('fantasyFan', '🐉', BadgeGroup.explorer, _fantasyFan),

  // ── Creativity (how they colour) ──
  StickerBadge('extremeUnlock', '🔓', BadgeGroup.creativity, _extremeUnlock), // unlocked Extreme
  StickerBadge('rainbow', '🌈', BadgeGroup.creativity, _rainbow), // finished a Hard
  StickerBadge('champion', '🥇', BadgeGroup.creativity, _champion), // finished an Extreme
  StickerBadge('paletteMaster', '🎭', BadgeGroup.creativity, _paletteMaster),
  StickerBadge('inventor', '✍️', BadgeGroup.creativity, _inventor), // own idea
  StickerBadge('penArtist', '✏️', BadgeGroup.creativity, _penArtist), // draw pen
  StickerBadge('byNumbers', '🔢', BadgeGroup.creativity, _byNumbers), // finished a colour-by-number page
  StickerBadge('freeColor', '🖌️', BadgeGroup.creativity, _freeColor), // finished a free-colour page

  // ── Sharing & saving ──
  StickerBadge('saver', '💾', BadgeGroup.sharing, _saver),
  StickerBadge('collector', '📚', BadgeGroup.sharing, _collector),
  StickerBadge('curator', '🖼️', BadgeGroup.sharing, _curator),
  StickerBadge('sharer', '📤', BadgeGroup.sharing, _sharer),
  StickerBadge('superSharer', '🎁', BadgeGroup.sharing, _superSharer),
  StickerBadge('challenger', '🎯', BadgeGroup.sharing, _challenger),
  StickerBadge('dailyStar', '📅', BadgeGroup.sharing, _dailyStar),
];

// Milestones
bool _first(Progress p) => p.totalCompleted >= 1;
bool _five(Progress p) => p.totalCompleted >= 5;
bool _ten(Progress p) => p.totalCompleted >= 10;
bool _twentyfive(Progress p) => p.totalCompleted >= 25;
bool _fifty(Progress p) => p.totalCompleted >= 50;
bool _hundred(Progress p) => p.totalCompleted >= 100;
// Streaks
bool _streak3(Progress p) => p.streak >= 3;
bool _streak7(Progress p) => p.streak >= 7;
bool _streak14(Progress p) => p.streak >= 14;
bool _streak30(Progress p) => p.streak >= 30;
// Explorer
bool _explorer(Progress p) => p.uniqueSubjects >= 10;
bool _animalPal(Progress p) => p.themesColored.contains('animal');
bool _onTheMove(Progress p) => p.themesColored.contains('vehicle');
bool _foodie(Progress p) => p.themesColored.contains('food');
bool _natureFan(Progress p) => p.themesColored.contains('nature');
bool _peoplePal(Progress p) => p.themesColored.contains('people');
bool _fantasyFan(Progress p) => p.themesColored.contains('fantasy');
// Creativity
bool _extremeUnlock(Progress p) => isExtremeUnlocked(p);
bool _rainbow(Progress p) => p.hardCompleted >= 1; // finished a Hard (or Extreme)
bool _champion(Progress p) => p.extremeCompleted >= 1;

/// True when the player has completed at least one Easy, one Medium, and one
/// pure Hard (i.e. hard that was not an Extreme) — all three pre-requisites.
bool isExtremeUnlocked(Progress p) =>
    p.easyCompleted >= 1 &&
    p.mediumCompleted >= 1 &&
    (p.hardCompleted - p.extremeCompleted) >= 1;
bool _paletteMaster(Progress p) =>
    p.palettesUsed.toSet().containsAll(const {'classic', 'pastel', 'nature'});
bool _inventor(Progress p) => p.freeTextCreations >= 1;
bool _penArtist(Progress p) => p.drawPenUses >= 1;
bool _byNumbers(Progress p) => p.numbersCompleted >= 1;
bool _freeColor(Progress p) => p.freeColorCompleted >= 1;
// Sharing
bool _saver(Progress p) => p.saves >= 1;
bool _collector(Progress p) => p.saves >= 5;
bool _curator(Progress p) => p.saves >= 25;
bool _sharer(Progress p) => p.shares >= 1;
bool _superSharer(Progress p) => p.shares >= 5;
bool _challenger(Progress p) => p.challengesCreated >= 1;
bool _dailyStar(Progress p) => p.dailyWordsCompleted >= 1;

/// Keyword → theme classifier for Explorer stickers. Runs on the ENGLISH
/// subject (the prompt actually sent to the generator), so it is locale-stable.
/// Returns null when nothing matches (no theme credited — that's fine).
const _themeKeywords = <String, List<String>>{
  'animal': [
    'cat','dog','puppy','kitten','lion','tiger','bear','panda','elephant','horse',
    'pony','unicorn','rabbit','bunny','fox','wolf','monkey','giraffe','zebra',
    'penguin','owl','bird','duck','chicken','cow','pig','sheep','frog','turtle',
    'fish','shark','whale','dolphin','octopus','crab','snake','dinosaur','dino',
    'butterfly','bee','ladybug','spider','dragon','animal','deer','koala','hedgehog',
  ],
  'vehicle': [
    'car','truck','bus','train','plane','airplane','jet','rocket','ship','boat',
    'submarine','helicopter','tractor','digger','excavator','bike','bicycle',
    'motorcycle','scooter','ambulance','fire truck','police car','spaceship','vehicle',
  ],
  'food': [
    'cake','cupcake','cookie','candy','ice cream','icecream','pizza','burger',
    'donut','doughnut','fruit','apple','banana','strawberry','watermelon','cherry',
    'lollipop','chocolate','pie','sandwich','popcorn','food','sushi','pancake',
  ],
  'nature': [
    'tree','flower','rose','sunflower','plant','garden','forest','mountain','river',
    'sun','moon','star','rainbow','cloud','leaf','mushroom','cactus','ocean','sea',
    'beach','snowflake','nature','volcano','waterfall','sky',
  ],
  'people': [
    'girl','boy','baby','princess','prince','king','queen','knight','pirate',
    'superhero','hero','astronaut','doctor','nurse','teacher','clown','ballerina',
    'mermaid','fairy','witch','wizard','person','family','friend','people','child',
  ],
  'fantasy': [
    'dragon','unicorn','fairy','mermaid','wizard','witch','castle','magic','monster',
    'robot','alien','ghost','genie','phoenix','elf','troll','fantasy','knight','crown',
  ],
};

/// Returns every theme matched by [subject] (a subject can hit more than one,
/// e.g. "dragon" → animal + fantasy). Lowercased substring match on whole words.
Set<String> themesOf(String subject) {
  final s = subject.trim().toLowerCase();
  if (s.isEmpty) return const {};
  final hit = <String>{};
  _themeKeywords.forEach((theme, words) {
    for (final w in words) {
      if (s == w || s.contains(w)) {
        hit.add(theme);
        break;
      }
    }
  });
  return hit;
}

class Progress {
  final int totalCompleted;
  final int totalGenerated;
  final int streak;
  final int longestStreak;
  final String? lastColoredDay; // YYYY-MM-DD
  final int daysColored;
  final int easyCompleted; // Easy only
  final int mediumCompleted; // Medium only
  final int hardCompleted; // Hard OR Extreme finished
  final int extremeCompleted; // Extreme only
  final int numbersCompleted; // finished a colour-by-number page (numbers shown)
  final int freeColorCompleted; // finished a free-colour page (no numbers)
  final int freeTextCreations; // finished a picture from a typed idea
  final int drawPenUses; // used the freehand draw pen
  final int shares; // artwork shared
  final int saves; // saved to the device gallery
  final int challengesCreated; // challenges created
  final int dailyWordsCompleted; // daily-word pictures finished
  final Map<String, int> subjects;
  final List<String> palettesUsed; // distinct palettes used in finished pics
  final List<String> themesColored; // distinct themes finished
  final List<String> badges;

  const Progress({
    this.totalCompleted = 0,
    this.totalGenerated = 0,
    this.streak = 0,
    this.longestStreak = 0,
    this.lastColoredDay,
    this.daysColored = 0,
    this.easyCompleted = 0,
    this.mediumCompleted = 0,
    this.hardCompleted = 0,
    this.extremeCompleted = 0,
    this.numbersCompleted = 0,
    this.freeColorCompleted = 0,
    this.freeTextCreations = 0,
    this.drawPenUses = 0,
    this.shares = 0,
    this.saves = 0,
    this.challengesCreated = 0,
    this.dailyWordsCompleted = 0,
    this.subjects = const {},
    this.palettesUsed = const [],
    this.themesColored = const [],
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
        'easyCompleted': easyCompleted,
        'mediumCompleted': mediumCompleted,
        'hardCompleted': hardCompleted,
        'extremeCompleted': extremeCompleted,
        'numbersCompleted': numbersCompleted,
        'freeColorCompleted': freeColorCompleted,
        'freeTextCreations': freeTextCreations,
        'drawPenUses': drawPenUses,
        'shares': shares,
        'saves': saves,
        'challengesCreated': challengesCreated,
        'dailyWordsCompleted': dailyWordsCompleted,
        'subjects': subjects,
        'palettesUsed': palettesUsed,
        'themesColored': themesColored,
        'badges': badges,
      };

  static List<String> _strList(dynamic v) =>
      (v as List?)?.map((e) => e as String).toList() ?? const [];

  factory Progress.fromJson(Map<String, dynamic> j) => Progress(
        totalCompleted: (j['totalCompleted'] ?? 0) as int,
        totalGenerated: (j['totalGenerated'] ?? 0) as int,
        streak: (j['streak'] ?? 0) as int,
        longestStreak: (j['longestStreak'] ?? 0) as int,
        lastColoredDay: j['lastColoredDay'] as String?,
        daysColored: (j['daysColored'] ?? 0) as int,
        easyCompleted: (j['easyCompleted'] ?? 0) as int,
        mediumCompleted: (j['mediumCompleted'] ?? 0) as int,
        hardCompleted: (j['hardCompleted'] ?? 0) as int,
        extremeCompleted: (j['extremeCompleted'] ?? 0) as int,
        numbersCompleted: (j['numbersCompleted'] ?? 0) as int,
        freeColorCompleted: (j['freeColorCompleted'] ?? 0) as int,
        freeTextCreations: (j['freeTextCreations'] ?? 0) as int,
        drawPenUses: (j['drawPenUses'] ?? 0) as int,
        shares: (j['shares'] ?? 0) as int,
        saves: (j['saves'] ?? 0) as int,
        challengesCreated: (j['challengesCreated'] ?? 0) as int,
        dailyWordsCompleted: (j['dailyWordsCompleted'] ?? 0) as int,
        subjects: (j['subjects'] as Map?)?.map(
                (k, v) => MapEntry(k as String, (v as num).toInt())) ??
            const {},
        palettesUsed: _strList(j['palettesUsed']),
        themesColored: _strList(j['themesColored']),
        badges: _strList(j['badges']),
      );

  Progress copyWith({
    int? totalCompleted,
    int? totalGenerated,
    int? streak,
    int? longestStreak,
    String? lastColoredDay,
    int? daysColored,
    int? easyCompleted,
    int? mediumCompleted,
    int? hardCompleted,
    int? extremeCompleted,
    int? numbersCompleted,
    int? freeColorCompleted,
    int? freeTextCreations,
    int? drawPenUses,
    int? shares,
    int? saves,
    int? challengesCreated,
    int? dailyWordsCompleted,
    Map<String, int>? subjects,
    List<String>? palettesUsed,
    List<String>? themesColored,
    List<String>? badges,
  }) =>
      Progress(
        totalCompleted: totalCompleted ?? this.totalCompleted,
        totalGenerated: totalGenerated ?? this.totalGenerated,
        streak: streak ?? this.streak,
        longestStreak: longestStreak ?? this.longestStreak,
        lastColoredDay: lastColoredDay ?? this.lastColoredDay,
        daysColored: daysColored ?? this.daysColored,
        easyCompleted: easyCompleted ?? this.easyCompleted,
        mediumCompleted: mediumCompleted ?? this.mediumCompleted,
        hardCompleted: hardCompleted ?? this.hardCompleted,
        extremeCompleted: extremeCompleted ?? this.extremeCompleted,
        numbersCompleted: numbersCompleted ?? this.numbersCompleted,
        freeColorCompleted: freeColorCompleted ?? this.freeColorCompleted,
        freeTextCreations: freeTextCreations ?? this.freeTextCreations,
        drawPenUses: drawPenUses ?? this.drawPenUses,
        shares: shares ?? this.shares,
        saves: saves ?? this.saves,
        challengesCreated: challengesCreated ?? this.challengesCreated,
        dailyWordsCompleted: dailyWordsCompleted ?? this.dailyWordsCompleted,
        subjects: subjects ?? this.subjects,
        palettesUsed: palettesUsed ?? this.palettesUsed,
        themesColored: themesColored ?? this.themesColored,
        badges: badges ?? this.badges,
      );

  /// Earned badge objects, in catalogue order.
  List<StickerBadge> get earnedBadges {
    final have = badges.toSet();
    return kBadges.where((b) => have.contains(b.id)).toList();
  }

  /// Badges of [group], in catalogue order.
  static List<StickerBadge> badgesIn(BadgeGroup group) =>
      kBadges.where((b) => b.group == group).toList();
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

// Wraps accountProvider.activeChildId with a safe fallback so consumers
// (e.g. ProgressNotifier) don't require AppConfig to be loaded in tests.
final _activeChildIdProvider = Provider<int?>((ref) {
  try {
    return ref.watch(accountProvider).activeChildId;
  } catch (_) {
    return null;
  }
});

class ProgressNotifier extends AsyncNotifier<Progress> {
  String get _key {
    final childId = ref.read(_activeChildIdProvider);
    return childId != null ? 'progress_v1_child_$childId' : 'progress_v1';
  }

  @override
  Future<Progress> build() async {
    ref.watch(_activeChildIdProvider); // rebuilds when active child changes; never throws
    final p = await _load();
    // Kick off server load in background to pick up cross-device progress.
    Future.microtask(() => loadFromServer().ignore());
    return p;
  }

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

  /// Awards any newly-qualified badges against [p]. Returns the updated
  /// progress and the list of freshly-earned stickers (catalogue order).
  (Progress, List<StickerBadge>) _award(Progress p) {
    final have = p.badges.toSet();
    final newBadges = <StickerBadge>[];
    final badges = List<String>.from(p.badges);
    for (final b in kBadges) {
      if (!have.contains(b.id) && b.test(p)) {
        badges.add(b.id);
        newBadges.add(b);
      }
    }
    return (p.copyWith(badges: badges), newBadges);
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
    String? palette,
    int? colorCount,
    bool isCustom = false, // child typed their own idea
    bool isDaily = false, // came from the daily word
    bool withNumbers = true, // colour-by-number mode (vs free colour)
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

    final easy =
        difficulty == 'easy' ? p.easyCompleted + 1 : p.easyCompleted;
    final medium =
        difficulty == 'medium' ? p.mediumCompleted + 1 : p.mediumCompleted;
    final hard = (difficulty == 'hard' || difficulty == 'extreme')
        ? p.hardCompleted + 1
        : p.hardCompleted;
    final extreme =
        difficulty == 'extreme' ? p.extremeCompleted + 1 : p.extremeCompleted;

    // Themes credited from the English subject (locale-stable).
    final themes = p.themesColored.toSet()..addAll(themesOf(subject ?? ''));

    // Palettes used (only the 3 known palette ids are meaningful for badges).
    final palettes = p.palettesUsed.toSet();
    if (palette != null && palette.isNotEmpty) palettes.add(palette);

    p = p.copyWith(
      totalCompleted: p.totalCompleted + 1,
      streak: streak,
      longestStreak: streak > p.longestStreak ? streak : p.longestStreak,
      lastColoredDay: lastDay,
      daysColored: daysColored,
      easyCompleted: easy,
      mediumCompleted: medium,
      hardCompleted: hard,
      extremeCompleted: extreme,
      numbersCompleted:
          withNumbers ? p.numbersCompleted + 1 : p.numbersCompleted,
      freeColorCompleted:
          withNumbers ? p.freeColorCompleted : p.freeColorCompleted + 1,
      freeTextCreations:
          isCustom ? p.freeTextCreations + 1 : p.freeTextCreations,
      dailyWordsCompleted:
          isDaily ? p.dailyWordsCompleted + 1 : p.dailyWordsCompleted,
      subjects: subjects,
      palettesUsed: palettes.toList(),
      themesColored: themes.toList(),
    );

    final (awarded, newBadges) = _award(p);
    await _save(awarded);
    _syncToServer(awarded).ignore(); // fire-and-forget; never blocks the UI
    return newBadges;
  }

  /// One-shot counter bumps for non-completion events. Each returns any badges
  /// the bump newly unlocked so the caller can show a tiny toast.
  Future<List<StickerBadge>> recordShare() =>
      _bump((p) => p.copyWith(shares: p.shares + 1));
  Future<List<StickerBadge>> recordSave() =>
      _bump((p) => p.copyWith(saves: p.saves + 1));
  Future<List<StickerBadge>> recordChallengeCreated() =>
      _bump((p) => p.copyWith(challengesCreated: p.challengesCreated + 1));
  Future<List<StickerBadge>> recordDrawPenUse() {
    // Cheap idempotency: the badge only needs the first use; skip the write once
    // already counted so toggling the pen doesn't churn storage.
    final p = state.valueOrNull;
    if (p != null && p.drawPenUses >= 1) return Future.value(const []);
    return _bump((p) => p.copyWith(drawPenUses: p.drawPenUses + 1));
  }

  Future<List<StickerBadge>> _bump(Progress Function(Progress) f) async {
    final p = state.valueOrNull ?? await _load();
    final (awarded, newBadges) = _award(f(p));
    await _save(awarded);
    return newBadges;
  }

  // ── Server sync ─────────────────────────────────────────────────────────────

  // Access token key must match account_service.dart _kAccess.
  static const _kAccessToken = 'lalabuba_access_token';

  /// POST this device's full progress to the server. Returns the account
  /// aggregate from the response and merges it into local state.
  /// Fire-and-forget: all errors are swallowed.
  Future<void> _syncToServer(Progress p) async {
    try {
      final config   = await ref.read(appConfigProvider.future);
      final deviceId = await DeviceIdService.getDeviceId();
      final token    = await StorageService.read(_kAccessToken);

      final headers = <String, dynamic>{
        'Content-Type': 'application/json',
        'X-Device-ID':  deviceId,
      };
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }

      final body = <String, dynamic>{
        'totalCompleted':      p.totalCompleted,
        'totalGenerated':      p.totalGenerated,
        'currentStreak':       p.streak,
        'longestStreak':       p.longestStreak,
        'lastActiveDate':      p.lastColoredDay,
        'daysColored':         p.daysColored,
        'easyCompleted':       p.easyCompleted,
        'mediumCompleted':     p.mediumCompleted,
        'hardCompleted':       p.hardCompleted,
        'extremeCompleted':    p.extremeCompleted,
        'numbersCompleted':    p.numbersCompleted,
        'freeColorCompleted':  p.freeColorCompleted,
        'freeTextCreations':   p.freeTextCreations,
        'drawPenUses':         p.drawPenUses,
        'saves':               p.saves,
        'shares':              p.shares,
        'challengesCreated':   p.challengesCreated,
        'dailyWordsCompleted': p.dailyWordsCompleted,
        'uniqueSubjects':      p.uniqueSubjects,
        'badges':              p.badges,
        'palettesUsed':        p.palettesUsed,
        'themesColored':       p.themesColored,
        'subjects':            p.subjects,
      };

      final dio = Dio(BaseOptions(
        baseUrl: config.apiBaseUrl,
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 10),
      ));
      final resp = await dio.post<Map<String, dynamic>>(
        '/api/community/progress',
        data: body,
        options: Options(headers: headers),
      );
      if (resp.data != null && resp.data!['progress'] != null) {
        await _mergeFromServer(resp.data!['progress'] as Map<String, dynamic>);
      }
    } catch (_) {
      // Fire-and-forget: never break the coloring experience.
    }
  }

  /// GET the account aggregate from the server and merge into local state.
  /// Called at app start when the user is signed in.
  Future<void> loadFromServer() async {
    try {
      final config   = await ref.read(appConfigProvider.future);
      final deviceId = await DeviceIdService.getDeviceId();
      final token    = await StorageService.read(_kAccessToken);

      final headers = <String, dynamic>{'X-Device-ID': deviceId};
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }

      final dio = Dio(BaseOptions(
        baseUrl: config.apiBaseUrl,
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 10),
      ));
      final resp = await dio.get<Map<String, dynamic>>(
        '/api/community/progress',
        options: Options(headers: headers),
      );
      if (resp.data != null && resp.data!['progress'] != null) {
        await _mergeFromServer(resp.data!['progress'] as Map<String, dynamic>);
      }
    } catch (_) {
      // Best-effort.
    }
  }

  /// Merge a server progress map into local state using MAX strategy for
  /// integers and UNION for list/map fields. Saves and updates state if changed.
  Future<void> _mergeFromServer(Map<String, dynamic> srv) async {
    final local = state.valueOrNull ?? await _load();

    int maxInt(int a, dynamic b) {
      final bInt = b is num ? b.toInt() : 0;
      return a > bInt ? a : bInt;
    }

    final easy    = maxInt(local.easyCompleted,       srv['easyCompleted']);
    final medium  = maxInt(local.mediumCompleted,     srv['mediumCompleted']);
    final hard    = maxInt(local.hardCompleted,       srv['hardCompleted']);
    final extreme = maxInt(local.extremeCompleted,    srv['extremeCompleted']);

    // If the aggregate gives us no new data, skip the write.
    if (easy <= local.easyCompleted &&
        medium <= local.mediumCompleted &&
        hard <= local.hardCompleted &&
        extreme <= local.extremeCompleted &&
        maxInt(local.totalCompleted, srv['totalCompleted']) <= local.totalCompleted) {
      return;
    }

    List<String> unionList(List<String> a, dynamic b) {
      final set = {...a, ...((b as List?)?.map((e) => e as String) ?? const [])};
      return set.toList();
    }

    final mergedSubjects = Map<String, int>.from(local.subjects);
    final srvSubj = (srv['subjects'] as Map?)?.map((k, v) => MapEntry(k as String, (v as num).toInt())) ?? {};
    for (final e in srvSubj.entries) {
      mergedSubjects[e.key] = (mergedSubjects[e.key] ?? 0) > e.value
          ? mergedSubjects[e.key]!
          : e.value;
    }

    String? laterDay(String? a, String? b) {
      if (a == null) return b;
      if (b == null) return a;
      return a.compareTo(b) >= 0 ? a : b;
    }

    final merged = local.copyWith(
      totalCompleted:      maxInt(local.totalCompleted,      srv['totalCompleted']),
      totalGenerated:      maxInt(local.totalGenerated,      srv['totalGenerated']),
      streak:              maxInt(local.streak,              srv['currentStreak']),
      longestStreak:       maxInt(local.longestStreak,       srv['longestStreak']),
      lastColoredDay:      laterDay(local.lastColoredDay,    srv['lastColoredDay'] as String?),
      daysColored:         maxInt(local.daysColored,         srv['daysColored']),
      easyCompleted:       easy,
      mediumCompleted:     medium,
      hardCompleted:       hard,
      extremeCompleted:    extreme,
      numbersCompleted:    maxInt(local.numbersCompleted,    srv['numbersCompleted']),
      freeColorCompleted:  maxInt(local.freeColorCompleted,  srv['freeColorCompleted']),
      freeTextCreations:   maxInt(local.freeTextCreations,   srv['freeTextCreations']),
      drawPenUses:         maxInt(local.drawPenUses,         srv['drawPenUses']),
      saves:               maxInt(local.saves,               srv['saves']),
      shares:              maxInt(local.shares,              srv['shares']),
      challengesCreated:   maxInt(local.challengesCreated,   srv['challengesCreated']),
      dailyWordsCompleted: maxInt(local.dailyWordsCompleted, srv['dailyWordsCompleted']),
      badges:              unionList(local.badges,           srv['badges']),
      palettesUsed:        unionList(local.palettesUsed,     srv['palettesUsed']),
      themesColored:       unionList(local.themesColored,    srv['themesColored']),
      subjects:            mergedSubjects,
    );
    await _save(merged);
  }
}

final progressProvider =
    AsyncNotifierProvider<ProgressNotifier, Progress>(ProgressNotifier.new);
