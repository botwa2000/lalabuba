// End-to-end refusal → idea → finish → home flow on a real device/simulator,
// against the REAL server (point assets/config/app_config.json at dev first —
// the codemagic.yaml "ios-refusal-flow" step does that). No fakes: the live
// safety filter refuses, a real picture is drawn for the idea.
//
// Screenshots: the test prints `FLOW_SHOT <name>` and holds the screen still
// for a few seconds; the runner (simctl / adb) captures on each marker.
// Checks print `FLOW_CHECK <name>=<value>` and are also asserted.
// ignore_for_file: deprecated_member_use — the app itself uses ShowCaseWidget (5.x).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lalabuba/features/canvas/canvas_controller.dart';
import 'package:lalabuba/features/canvas/canvas_screen.dart';
import 'package:lalabuba/main.dart' as app;
import 'package:showcaseview/showcaseview.dart';

const _refused = 'a soldier shooting people with blood';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('refusal flow: refused → idea → finish card → empty home', (tester) async {
    // The app installs its own FlutterError.onError (Crashlytics): restore the
    // test framework's before any assertion, so failures report cleanly.
    final testOnError = FlutterError.onError;
    final failures = <String>[];
    void restoreAndFail(String why) {
      FlutterError.onError = testOnError;
      fail(why);
    }

    Future<void> idle(Duration d) async {
      final end = DateTime.now().add(d);
      while (DateTime.now().isBefore(end)) {
        await tester.pump(const Duration(milliseconds: 100));
        await Future<void>.delayed(const Duration(milliseconds: 100));
      }
    }

    Future<void> waitFor(bool Function() ok, String what, {int seconds = 90}) async {
      final end = DateTime.now().add(Duration(seconds: seconds));
      while (!ok()) {
        if (DateTime.now().isAfter(end)) restoreAndFail('timed out waiting for $what; failed checks: $failures');
        await tester.pump(const Duration(milliseconds: 200));
        await Future<void>.delayed(const Duration(milliseconds: 200));
      }
    }

    // Tap through any running coach-mark tutorial, as a child would.
    Future<void> skipTutorial() async {
      for (var i = 0; i < 12; i++) {
        final running = find.byType(Showcase).evaluate().where((e) {
          try {
            return ShowCaseWidget.of(e).isShowcaseRunning;
          } catch (_) {
            return false;
          }
        }).toList();
        if (running.isEmpty) return;
        ShowCaseWidget.of(running.first).next();
        await idle(const Duration(milliseconds: 700));
      }
    }

    Future<void> shot(String name) async {
      await idle(const Duration(milliseconds: 800));
      // ignore: avoid_print
      print('FLOW_SHOT $name');
      await idle(const Duration(seconds: 5));
    }

    void check(String name, Object? value, Object? expected) {
      // ignore: avoid_print
      print('FLOW_CHECK $name=$value');
      if (value != expected) failures.add('$name=$value (expected $expected)');
    }

    double diceOpacity() => tester
        .widget<Opacity>(find.descendant(
            of: find.byKey(const ValueKey('regen-dice')), matching: find.byType(Opacity)))
        .opacity;

    ProviderContainer container() =>
        ProviderScope.containerOf(tester.element(find.byType(CanvasScreen)));

    app.main();
    await waitFor(() => find.byType(TextField).evaluate().isNotEmpty, 'home');
    await idle(const Duration(seconds: 2));
    await skipTutorial();

    // ── 1. A real refusal ──────────────────────────────────────────────────
    await tester.enterText(find.byType(TextField).first, _refused);
    await idle(const Duration(milliseconds: 500));
    FocusManager.instance.primaryFocus?.unfocus();
    await idle(const Duration(milliseconds: 500));
    await tester.tap(find.textContaining('Draw!').last);
    await waitFor(() => find.byType(ActionChip).evaluate().length == 3, 'refusal ideas');
    await idle(const Duration(seconds: 1));
    check('refused_ideas', find.byType(ActionChip).evaluate().length, 3);
    check('refused_words_on_screen', find.textContaining('soldier').evaluate().length, 0);
    check('refused_dice_opacity', diceOpacity(), 0.4);
    check('refused_dice_enabled',
        tester.widget<IconButton>(find.byKey(const ValueKey('regen-dice'))).onPressed != null, false);
    await shot('01-refused');

    // ── 2. Tap an idea → a real picture ───────────────────────────────────
    final ideaLabel = tester
        .widgetList<Text>(find.descendant(of: find.byType(ActionChip).first, matching: find.byType(Text)))
        .map((t) => t.data ?? '')
        .join(' ');
    await tester.tap(find.byType(ActionChip).first);
    await waitFor(() {
      final c = container().read(canvasProvider);
      return c.isReady && c.regionColorMap.isNotEmpty;
    }, 'idea picture', seconds: 150);
    await idle(const Duration(seconds: 2));
    await skipTutorial();
    // ignore: avoid_print
    print('FLOW_CHECK idea=$ideaLabel');
    final ideaWord = ideaLabel.split(' ').firstWhere((w) => RegExp(r'[A-Za-z]{3,}').hasMatch(w), orElse: () => ideaLabel);
    check('idea_title_shown', find.textContaining(ideaWord).evaluate().isNotEmpty, true);
    // The 🎨 n / N counter appears with the first coloured area.
    final first = container().read(canvasProvider).regionColorMap.entries.first;
    container().read(canvasProvider.notifier).setActiveColor(first.value);
    await container().read(canvasProvider.notifier).fillRegion(first.key);
    await idle(const Duration(seconds: 1));
    final total = container().read(canvasProvider).regionColorMap.length;
    check('idea_counter_shown', find.textContaining('/ $total').evaluate().isNotEmpty, true);
    check('idea_dice_opacity', diceOpacity(), 1.0);
    await shot('02-idea-drawn');

    // ── 3. Finish the picture → finish card with 🏆 Challenge! ─────────────
    final ctrl = container().read(canvasProvider.notifier);
    for (final e in container().read(canvasProvider).regionColorMap.entries) {
      ctrl.setActiveColor(e.value);
      await ctrl.fillRegion(e.key);
      await tester.pump(const Duration(milliseconds: 50));
    }
    await waitFor(() => find.byKey(const ValueKey('celebration-challenge')).evaluate().isNotEmpty,
        'finish card', seconds: 30);
    await idle(const Duration(seconds: 3)); // anything else that would pop up
    final routeCount = find.byType(Dialog).evaluate().length;
    check('finish_dialogs_open', routeCount, 1);
    check('finish_tutorial_running', find.byType(Showcase).evaluate().any((e) {
      try {
        return ShowCaseWidget.of(e).isShowcaseRunning;
      } catch (_) {
        return false;
      }
    }), false);
    await shot('03-finish-card');

    // ── 4. Back to home → the input is empty ──────────────────────────────
    await tester.tapAt(const Offset(4, 4)); // barrier: close the card
    await idle(const Duration(seconds: 1));
    if (find.byKey(const ValueKey('celebration-challenge')).evaluate().isNotEmpty) {
      Navigator.of(tester.element(find.byKey(const ValueKey('celebration-challenge')))).pop();
      await idle(const Duration(seconds: 1));
    }
    await tester.tap(find.byIcon(Icons.arrow_back_rounded).first);
    await idle(const Duration(seconds: 2));
    await waitFor(() => find.byType(CanvasScreen).evaluate().isEmpty, 'home again', seconds: 20);
    final field = tester.widget<TextField>(find.byType(TextField).first);
    check('home_input', field.controller?.text ?? '', '');
    await shot('04-home');

    FlutterError.onError = testOnError;
    expect(failures, isEmpty);
  });
}
