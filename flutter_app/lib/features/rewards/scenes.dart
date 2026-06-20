import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import '../../shared/services/storage_service.dart';
import '../progress/progress_service.dart' show themesOf;

/// "Sticker Scenes" — collectible fill-able scenes that replace the single
/// penguin. A scene is a big backdrop the child fills with themed decorations
/// (earned by coloring, theme-matched) plus their OWN finished pages ("My Art").
///
/// MUST stay in lock-step with the web twin `public/js/scenes.js`: identical
/// scene ids, decoration ids, themes and unlock thresholds. Never rename an id —
/// it would orphan what a child has unlocked/placed.
///
/// Platform note: web stores art thumbnails as data-URLs in localStorage; here
/// they are small PNG FILES in the app documents dir, referenced by path (secure
/// storage is for small secrets, not image blobs). The scene/deco model is
/// otherwise identical. Art stickers are device-local and never synced.

// ── Scene catalogue ──────────────────────────────────────────────────────────
class Scene {
  final String id;
  final String emoji;
  final int unlockAt; // totalCompleted threshold; 0 = available from the start
  final List<int> bg; // [topColor, bottomColor] as 0xFFRRGGBB
  const Scene(this.id, this.emoji, this.unlockAt, this.bg);
}

const kScenes = <Scene>[
  Scene('meadow', '🌳', 0, [0xFFBFE3FF, 0xFFCDEEB0]),
  Scene('iceberg', '🐧', 0, [0xFFD6F0FF, 0xFFEEF9FF]),
  Scene('ocean', '🌊', 10, [0xFFAEE6F2, 0xFF4FB3D4]),
  Scene('city', '🏙️', 25, [0xFFFFE0A8, 0xFFFFC0CF]),
  Scene('space', '🚀', 50, [0xFF241A52, 0xFF4A356F]),
];

// ── Decoration catalogue ─────────────────────────────────────────────────────
// theme ∈ {animal,vehicle,food,nature,people,fantasy} or '' (generic — always
// eligible for the drip). IDENTICAL to scenes.js.
class SceneDeco {
  final String id;
  final String emoji;
  final String scene;
  final String theme;
  const SceneDeco(this.id, this.emoji, this.scene, this.theme);
}

const kDecorations = <SceneDeco>[
  // Meadow
  SceneDeco('m_tree', '🌳', 'meadow', 'nature'),
  SceneDeco('m_pine', '🌲', 'meadow', 'nature'),
  SceneDeco('m_tulip', '🌷', 'meadow', 'nature'),
  SceneDeco('m_sunflower', '🌻', 'meadow', 'nature'),
  SceneDeco('m_blossom', '🌸', 'meadow', 'nature'),
  SceneDeco('m_mushroom', '🍄', 'meadow', 'nature'),
  SceneDeco('m_rainbow', '🌈', 'meadow', 'nature'),
  SceneDeco('m_sun', '☀️', 'meadow', 'nature'),
  SceneDeco('m_butterfly', '🦋', 'meadow', 'animal'),
  SceneDeco('m_bee', '🐝', 'meadow', 'animal'),
  SceneDeco('m_ladybug', '🐞', 'meadow', 'animal'),
  SceneDeco('m_bunny', '🐰', 'meadow', 'animal'),
  SceneDeco('m_fox', '🦊', 'meadow', 'animal'),
  SceneDeco('m_bird', '🐦', 'meadow', 'animal'),
  // Iceberg
  SceneDeco('i_penguin', '🐧', 'iceberg', 'animal'),
  SceneDeco('i_fish', '🐟', 'iceberg', 'animal'),
  SceneDeco('i_whale', '🐳', 'iceberg', 'animal'),
  SceneDeco('i_polarbear', '🐻‍❄️', 'iceberg', 'animal'),
  SceneDeco('i_seal', '🦭', 'iceberg', 'animal'),
  SceneDeco('i_snowman', '⛄', 'iceberg', ''),
  SceneDeco('i_snowflake', '❄️', 'iceberg', 'nature'),
  SceneDeco('i_ice', '🧊', 'iceberg', ''),
  SceneDeco('i_snow', '🌨️', 'iceberg', 'nature'),
  SceneDeco('i_star', '⭐', 'iceberg', ''),
  // Ocean
  SceneDeco('o_fish', '🐠', 'ocean', 'animal'),
  SceneDeco('o_tropfish', '🐟', 'ocean', 'animal'),
  SceneDeco('o_octopus', '🐙', 'ocean', 'animal'),
  SceneDeco('o_crab', '🦀', 'ocean', 'animal'),
  SceneDeco('o_turtle', '🐢', 'ocean', 'animal'),
  SceneDeco('o_dolphin', '🐬', 'ocean', 'animal'),
  SceneDeco('o_whale', '🐳', 'ocean', 'animal'),
  SceneDeco('o_shark', '🦈', 'ocean', 'animal'),
  SceneDeco('o_shell', '🐚', 'ocean', 'nature'),
  SceneDeco('o_coral', '🪸', 'ocean', 'nature'),
  SceneDeco('o_star', '🌟', 'ocean', ''),
  SceneDeco('o_wave', '🌊', 'ocean', 'nature'),
  // City
  SceneDeco('c_building', '🏢', 'city', ''),
  SceneDeco('c_house', '🏠', 'city', ''),
  SceneDeco('c_shop', '🏪', 'city', ''),
  SceneDeco('c_car', '🚗', 'city', 'vehicle'),
  SceneDeco('c_taxi', '🚕', 'city', 'vehicle'),
  SceneDeco('c_bus', '🚌', 'city', 'vehicle'),
  SceneDeco('c_bike', '🚲', 'city', 'vehicle'),
  SceneDeco('c_police', '🚓', 'city', 'vehicle'),
  SceneDeco('c_light', '🚦', 'city', ''),
  SceneDeco('c_person', '🧍', 'city', 'people'),
  SceneDeco('c_dog', '🐕', 'city', 'animal'),
  SceneDeco('c_tree', '🌳', 'city', 'nature'),
  // Space
  SceneDeco('s_rocket', '🚀', 'space', 'vehicle'),
  SceneDeco('s_planet', '🪐', 'space', ''),
  SceneDeco('s_moon', '🌙', 'space', ''),
  SceneDeco('s_star', '⭐', 'space', ''),
  SceneDeco('s_comet', '☄️', 'space', ''),
  SceneDeco('s_ufo', '🛸', 'space', 'vehicle'),
  SceneDeco('s_alien', '👽', 'space', 'fantasy'),
  SceneDeco('s_astronaut', '👨‍🚀', 'space', 'people'),
  SceneDeco('s_galaxy', '🌌', 'space', ''),
  SceneDeco('s_sparkle', '✨', 'space', ''),
  SceneDeco('s_satellite', '🛰️', 'space', 'vehicle'),
];

final _decoById = {for (final d in kDecorations) d.id: d};
SceneDeco?decoById(String id) => _decoById[id];
Scene? sceneById(String id) {
  for (final s in kScenes) {
    if (s.id == id) return s;
  }
  return null;
}

List<SceneDeco> decosForScene(String sceneId) =>
    kDecorations.where((d) => d.scene == sceneId).toList();

List<Scene> scenesUnlocked(int totalCompleted) =>
    kScenes.where((s) => totalCompleted >= s.unlockAt).toList();
bool isSceneUnlocked(int totalCompleted, String id) {
  final s = sceneById(id);
  return s != null && totalCompleted >= s.unlockAt;
}

List<Scene> scenesUnlockedAt(int totalCompleted) =>
    kScenes.where((s) => s.unlockAt > 0 && s.unlockAt == totalCompleted).toList();

// ── Scene of the week ─────────────────────────────────────────────────────────
// Rotates weekly; grants a bonus decoration. Matches scenes.js weekScene().
Scene weekScene([int? ts]) {
  final time = ts ?? DateTime.now().millisecondsSinceEpoch;
  final week = time ~/ (7 * 24 * 60 * 60 * 1000);
  final i = ((week % kScenes.length) + kScenes.length) % kScenes.length;
  return kScenes[i];
}

// English subject hints per scene (parity with scenes.js SCENE_SUBJECTS).
const kSceneSubjects = <String, List<String>>{
  'meadow': ['butterfly', 'flower', 'rabbit', 'fox', 'tree', 'bee', 'ladybug'],
  'iceberg': ['penguin', 'polar bear', 'seal', 'snowman', 'whale', 'snowflake'],
  'ocean': ['fish', 'octopus', 'dolphin', 'turtle', 'crab', 'shark', 'seahorse'],
  'city': ['car', 'bus', 'house', 'dog', 'bicycle', 'fire truck', 'train'],
  'space': ['rocket', 'planet', 'astronaut', 'alien', 'star', 'moon', 'comet'],
};

// ── State model ───────────────────────────────────────────────────────────────
class ArtSticker {
  final String id;
  final String file; // absolute path to the thumbnail PNG in documents dir
  final String theme;
  final int ts;
  const ArtSticker(this.id, this.file, this.theme, this.ts);

  Map<String, dynamic> toJson() =>
      {'id': id, 'file': file, 'theme': theme, 'ts': ts};
  static ArtSticker? fromJson(Map<String, dynamic> j) {
    final id = j['id'], file = j['file'];
    if (id is! String || file is! String) return null;
    return ArtSticker(id, file, (j['theme'] as String?) ?? '',
        (j['ts'] as num?)?.toInt() ?? 0);
  }
}

/// One placed item: an emoji decoration (deco != null) OR an art sticker
/// (art != null), at normalized position (x, y).
class Placement {
  final String? deco;
  final String? art;
  final double x;
  final double y;
  const Placement({this.deco, this.art, required this.x, required this.y});

  Map<String, dynamic> toJson() => {
        if (deco != null) 'd': deco,
        if (art != null) 'a': art,
        'x': x,
        'y': y,
      };
  static Placement fromJson(Map<String, dynamic> j) => Placement(
        deco: j['d'] as String?,
        art: j['a'] as String?,
        x: (j['x'] as num?)?.toDouble() ?? 0.5,
        y: (j['y'] as num?)?.toDouble() ?? 0.5,
      );
}

class ScenesState {
  final List<String> unlocked;
  final Map<String, List<Placement>> placed;
  final List<ArtSticker> art;
  const ScenesState(
      {this.unlocked = const [],
      this.placed = const {},
      this.art = const []});

  bool isDecoUnlocked(String id) => unlocked.contains(id);
  List<SceneDeco> unlockedDecosForScene(String sceneId) {
    final have = unlocked.toSet();
    return decosForScene(sceneId).where((d) => have.contains(d.id)).toList();
  }

  List<Placement> placedIn(String sceneId) => placed[sceneId] ?? const [];
  /// Newest first, so the tray shows the latest masterpiece at the front.
  List<ArtSticker> get artNewestFirst => art.reversed.toList();
  ArtSticker? artById(String id) {
    for (final a in art) {
      if (a.id == id) return a;
    }
    return null;
  }

  ScenesState copyWith({
    List<String>? unlocked,
    Map<String, List<Placement>>? placed,
    List<ArtSticker>? art,
  }) =>
      ScenesState(
        unlocked: unlocked ?? this.unlocked,
        placed: placed ?? this.placed,
        art: art ?? this.art,
      );
}

class AwardResult {
  final List<SceneDeco> newDecos;
  final List<Scene> newScenes;
  const AwardResult(this.newDecos, this.newScenes);
}

// ── Provider ──────────────────────────────────────────────────────────────────
class ScenesNotifier extends AsyncNotifier<ScenesState> {
  static const _key = 'scenes_v1';
  static const _artCap = 24;
  final _rng = Random();

  @override
  Future<ScenesState> build() async {
    final raw = await StorageService.read(_key);
    if (raw == null || raw.isEmpty) return const ScenesState();
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      final unlocked =
          (j['unlocked'] as List?)?.whereType<String>().toList() ?? <String>[];
      final placed = <String, List<Placement>>{};
      (j['placed'] as Map?)?.forEach((k, v) {
        if (v is List) {
          placed[k as String] = v
              .whereType<Map>()
              .map((m) => Placement.fromJson(m.cast<String, dynamic>()))
              .toList();
        }
      });
      final art = (j['art'] as List?)
              ?.whereType<Map>()
              .map((m) => ArtSticker.fromJson(m.cast<String, dynamic>()))
              .whereType<ArtSticker>()
              .toList() ??
          <ArtSticker>[];
      return ScenesState(unlocked: unlocked, placed: placed, art: art);
    } catch (_) {
      return const ScenesState();
    }
  }

  Future<void> _persist(ScenesState s) async {
    final j = {
      'v': 1,
      'unlocked': s.unlocked,
      'placed': s.placed
          .map((k, v) => MapEntry(k, v.map((p) => p.toJson()).toList())),
      'art': s.art.map((a) => a.toJson()).toList(),
    };
    await StorageService.write(_key, jsonEncode(j));
  }

  ScenesState get _s => state.valueOrNull ?? const ScenesState();

  Map<String, List<Placement>> _clonePlaced([ScenesState? from]) {
    final src = (from ?? _s).placed;
    return {for (final e in src.entries) e.key: List<Placement>.from(e.value)};
  }

  Offset2 _defaultPos(int n) {
    final x = (0.22 + (n % 4) * 0.18).clamp(0.1, 0.9);
    final y = (0.25 + ((n ~/ 4) % 3) * 0.22).clamp(0.1, 0.9);
    return Offset2(x.toDouble(), y.toDouble());
  }

  void placeDeco(String sceneId, String decoId) {
    final s = _s;
    if (!s.unlocked.contains(decoId)) return;
    final placed = _clonePlaced(s);
    final arr = placed[sceneId] ?? <Placement>[];
    final p = _defaultPos(arr.length);
    arr.add(Placement(deco: decoId, x: p.x, y: p.y));
    placed[sceneId] = arr;
    final next = s.copyWith(placed: placed);
    state = AsyncData(next);
    _persist(next);
  }

  void placeArt(String sceneId, String artId) {
    final s = _s;
    if (!s.art.any((a) => a.id == artId)) return;
    final placed = _clonePlaced(s);
    final arr = placed[sceneId] ?? <Placement>[];
    final p = _defaultPos(arr.length);
    arr.add(Placement(art: artId, x: p.x, y: p.y));
    placed[sceneId] = arr;
    final next = s.copyWith(placed: placed);
    state = AsyncData(next);
    _persist(next);
  }

  /// Live position update during a drag (no write).
  void setLocal(String sceneId, int index, double nx, double ny) {
    final s = _s;
    final arr = s.placed[sceneId];
    if (arr == null || index < 0 || index >= arr.length) return;
    final placed = _clonePlaced(s);
    final old = placed[sceneId]![index];
    placed[sceneId]![index] = Placement(
      deco: old.deco,
      art: old.art,
      x: nx.clamp(0.04, 0.96),
      y: ny.clamp(0.04, 0.96),
    );
    state = AsyncData(s.copyWith(placed: placed));
  }

  Future<void> commit() => _persist(_s);

  void removeAt(String sceneId, int index) {
    final s = _s;
    final arr = s.placed[sceneId];
    if (arr == null || index < 0 || index >= arr.length) return;
    final placed = _clonePlaced(s);
    placed[sceneId]!.removeAt(index);
    final next = s.copyWith(placed: placed);
    state = AsyncData(next);
    _persist(next);
  }

  void clearScene(String sceneId) {
    final s = _s;
    final placed = _clonePlaced(s);
    placed[sceneId] = <Placement>[];
    final next = s.copyWith(placed: placed);
    state = AsyncData(next);
    _persist(next);
  }

  SceneDeco?_pick(List<SceneDeco> list) =>
      list.isEmpty ? null : list[_rng.nextInt(list.length)];

  /// Theme-matched decoration drip + scene seeding + scene-of-week bonus.
  /// Mirrors scenes.js awardForCompletion. Returns what was newly unlocked.
  Future<AwardResult> awardForCompletion(
      String subject, int totalCompleted) async {
    final s = _s;
    final have = s.unlocked.toSet();
    final unlocked = List<String>.from(s.unlocked);
    final newDecos = <SceneDeco>[];
    void add(SceneDeco?d) {
      if (d != null && !have.contains(d.id)) {
        have.add(d.id);
        unlocked.add(d.id);
        newDecos.add(d);
      }
    }

    // 1) Seed any scene that JUST crossed its threshold with its first 3 decos.
    final newScenes = scenesUnlockedAt(totalCompleted);
    for (final sc in newScenes) {
      decosForScene(sc.id).take(3).forEach(add);
    }

    // 2) Theme-matched drip from currently-open scenes.
    final openScenes = scenesUnlocked(totalCompleted).map((s) => s.id).toSet();
    final pool = kDecorations
        .where((d) => openScenes.contains(d.scene) && !have.contains(d.id))
        .toList();
    final themes = themesOf(subject);
    final want = totalCompleted <= 1 ? 3 : 2;

    if (themes.isNotEmpty) {
      add(_pick(pool
          .where((d) => themes.contains(d.theme) && !have.contains(d.id))
          .toList()));
    }
    var guard = 0;
    while (newDecos.length < want && guard++ < 20) {
      final rest = pool.where((d) => !have.contains(d.id)).toList();
      if (rest.isEmpty) break;
      add(_pick(rest));
    }

    // 3) Scene-of-the-week bonus.
    final wk = weekScene();
    if (openScenes.contains(wk.id)) {
      add(_pick(kDecorations
          .where((d) => d.scene == wk.id && !have.contains(d.id))
          .toList()));
    }

    final next = s.copyWith(unlocked: unlocked);
    state = AsyncData(next);
    await _persist(next);
    return AwardResult(newDecos, newScenes);
  }

  /// Capture a just-finished page as a reusable art sticker. Writes a small PNG
  /// to the documents dir and stores its path; caps to the most recent 24,
  /// pruning placements + files of dropped stickers. Returns the new id or null.
  Future<String?> addArtSticker({
    required String subject,
    required Uint8List thumbBytes,
    required int ts,
  }) async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final id = 'art_${ts}_${_rng.nextInt(1 << 32).toRadixString(36)}';
      final file = File('${dir.path}/scene_$id.png');
      await file.writeAsBytes(thumbBytes);
      final theme = themesOf(subject).isNotEmpty ? themesOf(subject).first : '';

      final s = _s;
      final art = List<ArtSticker>.from(s.art)
        ..add(ArtSticker(id, file.path, theme, ts));
      var placed = s.placed;
      if (art.length > _artCap) {
        final dropped = art.sublist(0, art.length - _artCap);
        art.removeRange(0, art.length - _artCap);
        final droppedIds = dropped.map((a) => a.id).toSet();
        for (final a in dropped) {
          try {
            final f = File(a.file);
            if (await f.exists()) await f.delete();
          } catch (_) {}
        }
        placed = {
          for (final e in s.placed.entries)
            e.key: e.value
                .where((p) => p.art == null || !droppedIds.contains(p.art))
                .toList()
        };
      }
      final next = s.copyWith(art: art, placed: placed);
      state = AsyncData(next);
      await _persist(next);
      return id;
    } catch (_) {
      return null;
    }
  }
}

/// Tiny value holder to avoid importing dart:ui into the model just for Offset.
class Offset2 {
  final double x;
  final double y;
  const Offset2(this.x, this.y);
}

final scenesProvider =
    AsyncNotifierProvider<ScenesNotifier, ScenesState>(ScenesNotifier.new);
