import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:lalabuba/core/l10n/l10n_service.dart';
import 'package:lalabuba/features/canvas/report_content_sheet.dart';

// Google Play AI-Generated Content policy: the coloring screen must let a user
// flag an offensive AI picture in-app. This pumps the real sheet and asserts
// all four reasons render (portrait + phone landscape) and a tap returns the
// reason id the server accepts.

const _keys = [
  'reportPictureBtn', 'reportPictureTitle', 'reportPictureBody',
  'reportReasonScary', 'reportReasonInappropriate', 'reportReasonWrong',
  'reportReasonOther', 'reportPictureThanks', 'reportPictureNewOne',
  'reportPictureError',
];

Map<String, dynamic> _load(String lang) => jsonDecode(
    File('assets/i18n/$lang.json').readAsStringSync().replaceFirst('﻿', ''))
    as Map<String, dynamic>;

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  final en = _load('en');
  final l10n = L10n('en', en, en);

  Future<String?> openAndTap(WidgetTester tester, String? reasonKey) async {
    String? result = 'unset';
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () async =>
                  result = await showReportContentSheet(context, l10n),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text(en['reportPictureTitle'] as String), findsOneWidget);
    for (final k in ['reportReasonScary', 'reportReasonInappropriate',
        'reportReasonWrong', 'reportReasonOther']) {
      expect(find.text(en[k] as String), findsOneWidget);
    }

    if (reasonKey == null) {
      await tester.tap(find.text(en['cancel'] as String));
    } else {
      final tile = find.byKey(ValueKey('report_reason_$reasonKey'));
      await tester.ensureVisible(tile);
      await tester.tap(tile);
    }
    await tester.pumpAndSettle();
    return result;
  }

  testWidgets('tapping a reason returns its id', (tester) async {
    expect(await openAndTap(tester, 'scary'), 'scary');
    expect(await openAndTap(tester, 'inappropriate'), 'inappropriate');
  });

  testWidgets('cancel returns null', (tester) async {
    expect(await openAndTap(tester, null), isNull);
  });

  testWidgets('fits phone landscape without overflow', (tester) async {
    tester.view.physicalSize = const Size(844, 390);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    expect(await openAndTap(tester, 'other'), 'other');
    expect(tester.takeException(), isNull);
  });

  test('every locale translates all report strings', () {
    for (final lang in ['en', 'de', 'fr', 'es', 'pt', 'ru', 'it', 'nl', 'pl',
        'tr', 'zh', 'hi']) {
      final m = _load(lang);
      for (final k in _keys) {
        expect((m[k] as String?)?.isNotEmpty, isTrue, reason: '$lang.$k');
      }
    }
  });
}
