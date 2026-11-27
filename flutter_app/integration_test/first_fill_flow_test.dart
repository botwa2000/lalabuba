// Growth plan L12: on a real device/simulator, a freshly drawn picture opens with
// the hinted area's colour selected and a pulsing "Tap here!" on it; ONE real tap
// on the marker colours that area, the sparkle plays and the hint is gone.
// Runs against the REAL server (codemagic.yaml "ios-first-fill" points the app at
// dev first). Screenshots: the test prints `FLOW_SHOT <name>`; the runner
// (simctl / adb) captures on each marker. Checks print `FLOW_CHECK <name>=<value>`.
// ignore_for_file: deprecated_member_use — the app itself uses ShowCaseWidget (5.x).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lalabuba/core/l10n/l10n_service.dart';
import 'package:lalabuba/features/canvas/canvas_controller.dart';
import 'package:lalabuba/features/canvas/canvas_screen.dart';
import 'package:lalabuba/features/canvas/first_fill_hint.dart';
import 'package:lalabuba/main.dart' as app;
import 'package:showcaseview/showcaseview.dart';

const _subject = 'a happy cat';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('first fill: colour pre-selected, Tap here! marker, one tap fills, sparkle, hint gone',
      (tester) async {
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

    bool tutorialRunning() => find.byType(Showcase).evaluate().any((e) {
          try {
            return ShowCaseWidget.of(e).isShowcaseRunning;
          } catch (_) {
            return false;
          }
        });

    Future<void> skipTutorial() async {
      for (var i = 0; i < 12 && tutorialRunning(); i++) {
        final running = find.byType(Showcase).evaluate().firstWhere((e) {
          try {
            return ShowCaseWidget.of(e).isShowcaseRunning;
          } catch (_) {
            return false;
          }
        });
        ShowCaseWidget.of(running).next();
        await idle(const Duration(milliseconds: 700));
      }
    }

    Future<void> shot(String name, {bool settle = true}) async {
      if (settle) await idle(const Duration(milliseconds: 800));
      // ignore: avoid_print
      print('FLOW_SHOT $name');
      await idle(Duration(seconds: settle ? 5 : 2));
    }

    void check(String name, Object? value, Object? expected) {
      // ignore: avoid_print
      print('FLOW_CHECK $name=$value');
      if (value != expected) failures.add('$name=$value (expected $expected)');
    }

    ProviderContainer container() =>
        ProviderScope.containerOf(tester.element(find.byType(CanvasScreen)));

    app.main();
    await waitFor(() => find.byType(TextField).evaluate().isNotEmpty, 'home');
    await idle(const Duration(seconds: 2));
    await skipTutorial();

    await tester.enterText(find.byType(TextField).first, _subject);
    await idle(const Duration(milliseconds: 500));
    FocusManager.instance.primaryFocus?.unfocus();
    await idle(const Duration(milliseconds: 500));
    // The device language decides the button text (English simulator, German AVD).
    final l10n = ProviderScope.containerOf(tester.element(find.byType(TextField).first)).read(l10nProvider);
    final drawWord = l10n.t('drawBtn').replaceAll('✨', '').trim();
    await tester.tap(find.textContaining(drawWord).last);
    await waitFor(() {
      if (find.byType(CanvasScreen).evaluate().isEmpty) return false;
      final c = container().read(canvasProvider);
      return c.isReady && c.regionColorMap.isNotEmpty;
    }, 'picture', seconds: 150);
    await idle(const Duration(seconds: 2));
    await skipTutorial();
    await idle(const Duration(seconds: 1));

    // ── 1. Opened: hint on the largest numbered area, its colour selected ──
    final c0 = container().read(canvasProvider);
    final target = c0.firstFillHint;
    check('hint_target_found', target != null, true);
    check('hint_shown', find.byType(TapHereHint).evaluate().length, 1);
    final label = tester
        .widgetList<Text>(find.descendant(of: find.byType(TapHereHint), matching: find.byType(Text)))
        .map((t) => t.data ?? '')
        .join();
    // ignore: avoid_print
    print('FLOW_CHECK hint_label=$label');
    // Localised (simulator: English "Tap here!"; the German AVD: "Hier tippen!").
    check('hint_label_localised', label, l10n.t('tapHere'));
    check('undo_empty_at_open', c0.undoStack.isEmpty, true);
    if (target != null) {
      check('opening_colour_matches_area',
          c0.activeColor.toARGB32() == c0.regionColorMap[target.id]?.toARGB32(), true);
      check('target_uncoloured', c0.regionColors.containsKey(target.id), false);
    }
    await shot('01-hint');
    if (target == null || find.byKey(const ValueKey('tap-here-ring')).evaluate().isEmpty) {
      restoreAndFail('no hint to tap; failed checks: $failures');
    }

    // ── 2. One real tap on the marker (as a child would) ────────────────────
    final ring = tester.getCenter(find.byKey(const ValueKey('tap-here-ring')));
    await tester.tapAt(ring);
    await tester.pump(const Duration(milliseconds: 150));
    await tester.pump(const Duration(milliseconds: 150));
    final c1 = container().read(canvasProvider);
    check('one_tap_filled', c1.undoStack.length, 1);
    check('filled_the_hinted_area',
        c1.regionColors[target!.id]?.toARGB32() == c0.regionColorMap[target.id]?.toARGB32(), true);
    check('sparkle_shown', find.byType(FirstFillSparkle).evaluate().length, 1);
    check('hint_gone', find.byType(TapHereHint).evaluate().length, 0);
    await shot('02-sparkle', settle: false);

    // ── 3. Settled: sparkle over, hint stays gone after more colouring ──────
    await idle(const Duration(seconds: 2));
    final next = container().read(canvasProvider).firstFillHint;
    if (next != null) {
      final ctrl = container().read(canvasProvider.notifier);
      ctrl.setActiveColor(container().read(canvasProvider).regionColorMap[next.id]!);
      await ctrl.fillRegion(next.id);
      await idle(const Duration(milliseconds: 500));
    }
    check('sparkle_done', find.byType(FirstFillSparkle).evaluate().length, 0);
    check('hint_still_gone', find.byType(TapHereHint).evaluate().length, 0);
    await shot('03-after');

    FlutterError.onError = testOnError;
    expect(failures, isEmpty);
  });
}
