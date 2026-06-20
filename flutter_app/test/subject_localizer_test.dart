import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/rewards/scenes.dart';

/// Coverage guard for the standardized subject-localization procedure.
///
/// Any subject a feature drops into the prompt must show in the child's language
/// (the API still gets English — see SubjectLocalizer). This test fails when a
/// registered subject is missing a translation, so the "prompt shows English in a
/// non-English UI" bug can't slip back in as features are added. When you add a
/// feature with new prompt subjects, add their translations to a data file the
/// localizer loads and (if it's a new pool) extend this test.
void main() {
  const locales = ['de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'tr', 'zh', 'hi'];

  test('every Sticker-Scenes subject is translated for all locales', () {
    final raw = File('assets/data/scene_subjects.json').readAsStringSync();
    final map = jsonDecode(raw) as Map<String, dynamic>;

    final missing = <String>[];
    for (final list in kSceneSubjects.values) {
      for (final en in list) {
        final row = map[en] as Map<String, dynamic>?;
        if (row == null) {
          missing.add('$en (no entry)');
          continue;
        }
        for (final loc in locales) {
          final v = row[loc];
          if (v is! String || v.trim().isEmpty) missing.add('$en/$loc');
        }
      }
    }

    expect(missing, isEmpty,
        reason: 'Untranslated scene subjects — add them to '
            'assets/data/scene_subjects.json: ${missing.join(', ')}');
  });
}
