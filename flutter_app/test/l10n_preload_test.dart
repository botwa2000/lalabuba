import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/core/l10n/l10n_service.dart';

void main() {
  test('a preloaded locale is available on the first read (no raw-key frame)', () {
    const de = L10n('de', {'heroHeading': 'Was wollen wir zeichnen?'});
    final c = ProviderContainer(overrides: [initialL10nProvider.overrideWithValue(de)]);
    addTearDown(c.dispose);
    // Read before the async notifier settles: must already be translated.
    expect(c.read(l10nProvider).t('heroHeading'), 'Was wollen wir zeichnen?');
    expect(c.read(l10nProvider).locale, 'de');
  });

  // The bottom tab bar is on every screen: each locale carries its own labels
  // instead of falling back to English.
  test('every locale translates the four tab labels', () {
    const keys = ['navDraw', 'navExplore', 'navJournal', 'navTreehouse'];
    for (final lang in supportedLocales) {
      final raw = File('assets/i18n/$lang.json').readAsStringSync();
      final map = jsonDecode(raw.replaceFirst('\uFEFF', '')) as Map<String, dynamic>;
      for (final k in keys) {
        expect(map[k], isA<String>(), reason: '$lang.json is missing $k');
      }
    }
  });
}
