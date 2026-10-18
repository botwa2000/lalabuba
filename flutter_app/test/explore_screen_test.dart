// Explore renders the API topic list (incl. topics newer than the app build,
// e.g. "car") and every string in the app language — titles, CTA, difficulty
// headings and picture captions — never the English generation prompt.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/core/l10n/l10n_service.dart';
import 'package:lalabuba/features/explore/explore_screen.dart';

Map<String, dynamic> _strings(String lang) => jsonDecode(
        File('assets/i18n/$lang.json').readAsStringSync().replaceFirst('\uFEFF', ''))
    as Map<String, dynamic>;

L10n _l10n(String lang) => L10n(lang, _strings(lang), _strings('en'));

Widget _app(L10n l10n, Widget child, List<Override> overrides) => ProviderScope(
      overrides: [initialL10nProvider.overrideWithValue(l10n), ...overrides],
      child: MaterialApp(home: child),
    );

void main() {
  testWidgets('hub shows API topics in German, incl. the car topic', (tester) async {
    final de = _l10n('de');
    await tester.pumpWidget(_app(de, const ExploreScreen(), [
      exploreTopicsProvider('de').overrideWith((_) async => const [
            ExploreTopic('rocket', '🚀', 'Rakete'),
            ExploreTopic('car', '🚗', 'Auto'),
          ]),
    ]));
    await tester.pumpAndSettle();

    expect(find.text('Auto'), findsOneWidget);
    expect(find.text('Rakete'), findsOneWidget);
    expect(find.text('Entdecken'), findsOneWidget); // app bar
    expect(find.text(de.t('exploreHeaderTitle')), findsOneWidget);
    expect(find.text('Jetzt ausmalen →'), findsNWidgets(2));
    expect(find.textContaining('Ready-to-Color'), findsNothing);
  });

  testWidgets('topic screen captions pictures with the localised label', (tester) async {
    final de = _l10n('de');
    const entry = GalleryEntry(
      id: 'car-easy-1',
      subject: 'monster truck with giant tires',
      label: 'Monstertruck mit Riesenreifen',
      url: 'https://lalabuba.invalid/x.png',
      date: '2026-10-18',
    );
    await tester.pumpWidget(_app(
        de,
        const ExploreTopicScreen(topic: 'car', emoji: '🚗', name: 'Auto'),
        [
          exploreTopicImagesProvider(('car', 'de')).overrideWith((_) async =>
              const TopicImages(easy: [entry], medium: [], hard: [])),
        ]));
    await tester.pump();
    await tester.pump();

    expect(find.text('🚗 Auto Ausmalbilder'), findsOneWidget);
    expect(find.text(de.t('diffEasy')), findsOneWidget);
    expect(find.text('Monstertruck mit Riesenreifen'), findsOneWidget);
    expect(find.text('monster truck with giant tires'), findsNothing);
  });

  test('a gallery entry without a label falls back to its subject', () {
    final e = GalleryEntry.fromJson(
        {'id': 'a', 'subject': 'cute rocket ship', 'url': '/img/g/a.png'},
        'https://lalabuba.com');
    expect(e.label, 'cute rocket ship');
    expect(e.url, 'https://lalabuba.com/img/g/a.png');
  });

  test('every locale translates every Explore string and topic name', () {
    const keys = [
      'exploreHeaderTitle', 'exploreHeaderBody', 'exploreColorNow',
      'exploreTopicTitle', 'exploreLoadError', 'exploreEmpty', 'exploreEmptyHint',
      'topic_dragon', 'topic_unicorn', 'topic_butterfly', 'topic_dinosaur',
      'topic_cat', 'topic_princess', 'topic_mermaid', 'topic_rocket', 'topic_car',
    ];
    final en = _strings('en');
    for (final lang in supportedLocales) {
      final map = _strings(lang);
      for (final k in keys) {
        expect(map[k], isA<String>(), reason: '$lang.json is missing $k');
      }
      // No locale may silently lag behind English.
      expect(en.keys.where((k) => !map.containsKey(k)), isEmpty,
          reason: '$lang.json is missing keys that en.json has');
      expect(map['exploreTopicTitle'], contains('{name}'), reason: lang);
    }
  });
}
