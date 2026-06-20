import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// THE standard for putting a prompt subject on screen in the child's language.
///
/// Rule (applies to every feature that drops a subject into the prompt box):
///   • the API/generation ALWAYS receives the English form;
///   • the text SHOWN in the prompt is the localized form from [localize].
/// Never insert a raw English subject into the visible prompt — route it through
/// here. Cards and the daily word already follow this (Subject.translate /
/// englishPrompt); this service is the single shared lookup so newer features
/// (scene-of-week, voice, …) and future ones do the same without re-implementing
/// it.
///
/// It aggregates every subject translation table the app ships, so covering a new
/// feature is just "add your subjects to a data file the loader reads, and extend
/// the coverage test". See test/subject_localizer_test.dart — that test fails when
/// a registered subject is missing a translation, which is what stops this class
/// of bug ("prompt shows English in a non-English UI") from coming back.
class SubjectLocalizer {
  /// enLower -> { locale -> translated }
  final Map<String, Map<String, String>> _map;
  const SubjectLocalizer(this._map);

  /// Localized display form of [english] for [locale]; falls back to [english]
  /// when there is no translation (so a missing entry degrades, never crashes).
  String localize(String english, String locale) =>
      _map[_key(english)]?[locale] ?? english;

  /// Whether [english] has any translation entry at all (used by the test guard).
  bool covers(String english) => _map.containsKey(_key(english));

  static String _key(String s) => s.trim().toLowerCase();

  static Future<SubjectLocalizer> load() async {
    final map = <String, Map<String, String>>{};
    void put(String en, String loc, String val) {
      if (val.trim().isEmpty) return;
      (map[_key(en)] ??= <String, String>{})[loc] = val;
    }

    // 1) subjects.json — each entry is `en` + flat per-locale fields.
    try {
      final j = jsonDecode(await rootBundle.loadString('assets/data/subjects.json'))
          as Map<String, dynamic>;
      for (final e in (j['subjects'] as List)) {
        final m = e as Map<String, dynamic>;
        final en = m['en'];
        if (en is! String) continue;
        m.forEach((k, v) {
          if (k != 'en' && k != 'emoji' && v is String) put(en, k, v);
        });
      }
    } catch (_) {/* asset optional — degrade to fewer entries */}

    // 2) daily_words.json — translations keyed locale -> { en -> translated }.
    try {
      final j = jsonDecode(await rootBundle.loadString('assets/data/daily_words.json'))
          as Map<String, dynamic>;
      ((j['translations'] as Map?) ?? const {}).forEach((loc, entries) {
        (entries as Map).forEach((en, val) {
          if (val is String) put(en as String, loc as String, val);
        });
      });
    } catch (_) {/* optional */}

    // 3) scene_subjects.json — en -> { locale -> translated }.
    try {
      final j = jsonDecode(await rootBundle.loadString('assets/data/scene_subjects.json'))
          as Map<String, dynamic>;
      j.forEach((en, row) {
        (row as Map).forEach((loc, val) {
          if (val is String) put(en, loc as String, val);
        });
      });
    } catch (_) {/* optional */}

    return SubjectLocalizer(map);
  }
}

/// Loads once and caches for the session.
final subjectLocalizerProvider =
    FutureProvider<SubjectLocalizer>((ref) => SubjectLocalizer.load());
