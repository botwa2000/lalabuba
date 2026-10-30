import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lalabuba/core/l10n/l10n_service.dart';
import 'package:lalabuba/features/canvas/completion_celebration.dart';
import 'package:lalabuba/features/progress/progress_service.dart';
import 'package:lalabuba/features/settings/settings_screen.dart';

const _l10n = L10n('en', {
  'celebTitle': 'Well done! 🎉',
  'celebMsg': 'You colored the whole picture!',
  'celebJournalSaved': '✨ Added to your Journal!',
  'celebMasterpiecesOne': '🎨 {count} masterpiece so far!',
  'celebAgain': '🎲 Again',
  'celebNew': '✨ New',
  'celebShare': '🖼️ Share',
  'celebKeep': 'Keep coloring',
  'rateQuestion': 'Did you like this picture?',
  'rateThanks': 'Thanks for telling us! 💜',
  'rateLoved': 'Loved it',
  'rateOk': 'It was okay',
  'rateMeh': 'Not really',
  'feedbackTitle': 'How do you like Lalabuba?',
  'feedbackHint': 'For grown-ups — your rating and ideas help us make Lalabuba better.',
  'feedbackPlaceholder': 'What could we do better? (optional)',
  'feedbackSend': 'Send',
  'feedbackPickStars': 'Please choose 1–5 stars.',
});

Future<void> _openCelebration(WidgetTester tester, {ValueChanged<int>? onRate}) async {
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: Builder(
        builder: (ctx) => Center(
          child: ElevatedButton(
            onPressed: () => showCompletionCelebration(ctx,
                l10n: _l10n,
                progress: const Progress(totalCompleted: 1, streak: 1),
                newBadges: const [],
                onAgain: () {},
                onNew: () {},
                onShare: () {},
                onRate: onRate),
            child: const Text('open'),
          ),
        ),
      ),
    ),
  ));
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('picture rating reports the tapped face and thanks the child', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final ratings = <int>[];
    await _openCelebration(tester, onRate: ratings.add);

    expect(find.text('Did you like this picture?'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('rate-3')));
    await tester.pumpAndSettle();
    expect(ratings, [3]);
    expect(find.text('Thanks for telling us! 💜'), findsOneWidget);

    // Changing your mind sends the new value.
    await tester.tap(find.byKey(const ValueKey('rate-1')));
    await tester.pumpAndSettle();
    expect(ratings, [3, 1]);
    expect(tester.takeException(), isNull);
  });

  testWidgets('no rating row when the picture has no server image', (tester) async {
    await _openCelebration(tester);
    expect(find.text('Did you like this picture?'), findsNothing);
    expect(find.byKey(const ValueKey('rate-3')), findsNothing);
  });

  testWidgets('site feedback sheet asks for stars before sending', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: SiteFeedbackSheet(l10n: _l10n)),
    ));
    expect(find.text('How do you like Lalabuba?'), findsOneWidget);
    expect(find.byKey(const ValueKey('feedback-star-5')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('feedback-send')));
    await tester.pump();
    expect(find.text('Please choose 1–5 stars.'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('feedback-star-4')));
    await tester.pump();
    expect(find.byIcon(Icons.star_rounded), findsNWidgets(4));
    expect(find.text('Please choose 1–5 stars.'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
