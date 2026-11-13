import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lalabuba/features/canvas/challenge_strip.dart';

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Widget host(Widget child, {double width = 360}) => MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: SizedBox(width: width, child: child),
          ),
        ),
      );

  const longHint =
      '🏆 Fordere einen Freund heraus — teile das Bild und wer ist schneller! '
      '🏆 Fordere einen Freund heraus — teile das Bild und wer ist schneller!';

  testWidgets('renders hint + Share and Share opens the challenge',
      (tester) async {
    var taps = 0;
    await tester.pumpWidget(host(ChallengeStrip(
      hint: '🏆 Challenge a friend — share this picture and race to finish first!',
      shareLabel: 'Share →',
      onShare: () => taps++,
    )));
    expect(find.text('Share →'), findsOneWidget);
    expect(find.textContaining('Challenge a friend'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('challenge-strip-share')));
    expect(taps, 1);
  });

  testWidgets('2× long text at 320px: ≤2 lines, Share fully visible, no overflow',
      (tester) async {
    await tester.pumpWidget(host(
      ChallengeStrip(hint: longHint, shareLabel: 'Teilen →', onShare: () {}),
      width: 320,
    ));
    expect(tester.takeException(), isNull);
    final hint = tester.widget<Text>(find.text(longHint));
    expect(hint.maxLines, 2);
    expect(hint.overflow, TextOverflow.ellipsis);
    final strip = tester.getRect(find.byKey(const ValueKey('challenge-strip')));
    final share =
        tester.getRect(find.byKey(const ValueKey('challenge-strip-share')));
    expect(strip.contains(share.topLeft) && strip.contains(share.bottomRight - const Offset(1, 1)), isTrue);
    expect(strip.height, lessThan(64));
  });

  testWidgets('compact (landscape) is one line and slimmer', (tester) async {
    await tester.pumpWidget(host(
      ChallengeStrip(
          hint: longHint, shareLabel: 'Teilen →', onShare: () {}, compact: true),
      width: 500,
    ));
    expect(tester.takeException(), isNull);
    expect(tester.widget<Text>(find.text(longHint)).maxLines, 1);
    expect(tester.getSize(find.byKey(const ValueKey('challenge-strip'))).height,
        lessThan(46));
  });
}
