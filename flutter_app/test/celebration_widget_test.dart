import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/core/l10n/l10n_service.dart';
import 'package:lalabuba/features/canvas/completion_celebration.dart';
import 'package:lalabuba/features/progress/progress_service.dart';

// Minimal English strings the celebration uses, so the dialog lays out with
// real-length text (not key placeholders).
const _strings = {
  'celebTitle': 'Well done! 🎉',
  'celebMsg': 'You colored the whole picture!',
  'celebJournalSaved': '✨ Added to your Journal!',
  'celebMasterpieces': '🎨 {count} masterpieces',
  'celebMasterpiecesOne': '🎨 {count} masterpiece so far!',
  'celebStreakSuffix': ' · 🔥 {streak}-day streak!',
  'celebNewSticker': 'New sticker unlocked!',
  'celebAgain': '🎲 Again',
  'celebNew': '✨ New',
  'celebShare': '🖼️ Share',
  'celebKeep': 'Keep coloring',
  'badgeFiveTitle': 'High Five',
  'badgeFiveDesc': '5 pictures colored!',
};

const _l10n = L10n('en', _strings);

// The five-completions sticker, for the reveal.
final _fiveBadge = kBadges.firstWhere((b) => b.id == 'five');

Future<void> _setSize(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void main() {
  final sizes = <String, Size>{
    'phone-portrait': const Size(390, 844),
    'phone-landscape': const Size(844, 390),
    'tablet-portrait': const Size(800, 1280),
    'tablet-landscape': const Size(1280, 800),
  };

  for (final entry in sizes.entries) {
    testWidgets('celebration renders with sticker at ${entry.key}',
        (tester) async {
      await _setSize(tester, entry.value);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => Center(
                child: ElevatedButton(
                  onPressed: () => showCompletionCelebration(
                    ctx,
                    l10n: _l10n,
                    progress: const Progress(totalCompleted: 5, streak: 3),
                    newBadges: [_fiveBadge],
                    onAgain: () {},
                    onNew: () {},
                    onShare: () {},
                  ),
                  child: const Text('go'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('go'));
      await tester.pumpAndSettle();

      // No layout overflow / build error at this size.
      expect(tester.takeException(), isNull);

      // Core celebration content present.
      expect(find.text('Well done! 🎉'), findsOneWidget);
      expect(find.text('✨ Added to your Journal!'), findsOneWidget);
      // Sticker reveal.
      expect(find.text('High Five'), findsOneWidget);
      // What-next loop.
      expect(find.text('🎲 Again'), findsOneWidget);
      expect(find.text('✨ New'), findsOneWidget);
      expect(find.text('🖼️ Share'), findsOneWidget);
    });
  }

  testWidgets('celebration without a new badge omits the sticker reveal',
      (tester) async {
    await _setSize(tester, const Size(390, 844));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (ctx) => Center(
              child: ElevatedButton(
                onPressed: () => showCompletionCelebration(
                  ctx,
                  l10n: _l10n,
                  progress: const Progress(totalCompleted: 2),
                  newBadges: const [],
                  onAgain: () {},
                  onNew: () {},
                  onShare: () {},
                ),
                child: const Text('go'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('go'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('High Five'), findsNothing);
    expect(find.text('New sticker unlocked!'.toUpperCase()), findsNothing);
  });
}
