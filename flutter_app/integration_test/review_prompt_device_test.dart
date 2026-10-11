// On-device check of the REAL store-review plugin (no fakes for the store):
// the system review card appears for an eligible user, and the Settings link
// opens the correct store listing. Run on a simulator/emulator; the CI step
// (codemagic.yaml → ios-review-check) screenshots the screen while it runs.
// The app's own trigger wiring (canvas share → gate → onParentActionSucceeded)
// is shared Dart code, exercised end-to-end on Android.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lalabuba/shared/services/review_prompt_service.dart';

class _MemStore implements ReviewStore {
  ReviewState s;
  _MemStore(this.s);
  @override
  Future<ReviewState> load() async => s;
  @override
  Future<void> save(ReviewState v) async => s = v;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('system review card, then the store listing', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: Center(child: Text('Lalabuba review check'))),
    ));
    await tester.pumpAndSettle();

    // Two finished pictures → eligible for the first ask.
    final store = _MemStore(const ReviewState().withCompletion().withCompletion());
    final svc = ReviewPromptService(store: store);

    await tester.runAsync(() async {
      final asked = await svc.onParentActionSucceeded();
      // ignore: avoid_print
      print('REVIEW_CHECK requested=$asked asks=${store.s.asks}');
      expect(asked, isTrue);
      await Future<void>.delayed(const Duration(seconds: 12)); // card on screen
      await svc.openStoreListing();
      // ignore: avoid_print
      print('REVIEW_CHECK listing_opened');
      await Future<void>.delayed(const Duration(seconds: 20)); // listing loads
    });
  });
}
