// A refused subject (HTTP 400 → GenerateError('contentSafetyError')) must not be
// a dead end: the canvas shows three one-tap ideas from the app's own card list,
// and tapping one draws that card's English prompt with source 'refused_idea'.
// Also pins AnalyticsService.errorClass: error events carry a class, never text.
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lalabuba/core/config/app_config.dart';
import 'package:lalabuba/core/di/providers.dart';
import 'package:lalabuba/features/canvas/canvas_screen.dart';
import 'package:lalabuba/features/generate/generate_models.dart';
import 'package:lalabuba/features/generate/generate_service.dart';
import 'package:lalabuba/shared/services/analytics_service.dart';

const _config = AppConfig(
  dailyChallenge: false,
  galleryEnabled: true,
  challengeMode: false,
  maxPalette: false,
  pencilMode: true,
  analyticsEnabled: false,
  iapEnabled: false,
  blobSharing: false,
  apiBaseUrl: 'https://lalabuba.com/',
  generatePath: '/api/generate-image',
  timeoutSeconds: 30,
  subjectMaxLength: 80,
  undoStackDepth: 20,
  dailyFreeGenerations: 3,
);

/// Refuses every subject, recording what was asked for.
class _RefusingService extends GenerateService {
  final calls = <({String subject, String? source})>[];
  _RefusingService() : super(_config);

  @override
  Future<GenerationResult> generate({
    required String subject,
    required String difficulty,
    required int colorCount,
    int? seed,
    String? source,
  }) async {
    calls.add((subject: subject, source: source));
    throw const GenerateError('contentSafetyError', 400);
  }
}

void main() {
  setUp(() {
    // Secure storage (tutorial flags, progress) → in-memory, like progress_test.
    final store = <String, String>{};
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'), (call) async {
      final args = (call.arguments as Map?) ?? const {};
      switch (call.method) {
        case 'write': store[args['key'] as String] = args['value'] as String; return null;
        case 'read': return store[args['key'] as String];
        case 'readAll': return store;
        case 'containsKey': return store.containsKey(args['key']);
        default: return null;
      }
    });
  });

  test('errorClass maps errors to stable classes, never their message', () {
    expect(AnalyticsService.errorClass(const GenerateError('contentSafetyError', 400)), 'contentSafetyError');
    expect(AnalyticsService.errorClass(TimeoutException('secret url')), 'timeout');
    expect(AnalyticsService.errorClass(const FormatException('child typed this')), 'format');
    expect(
        AnalyticsService.errorClass(DioException(
            requestOptions: RequestOptions(path: '/x'),
            type: DioExceptionType.receiveTimeout)),
        'dio_receiveTimeout');
    expect(AnalyticsService.errorClass(Exception('anything')), 'other');
  });

  testWidgets('refused subject shows 3 one-tap ideas; a tap draws that idea', (tester) async {
    final svc = _RefusingService();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        appConfigProvider.overrideWith((_) async => _config),
        generateServiceProvider.overrideWith((_) => svc),
      ],
      child: MaterialApp.router(
        routerConfig: GoRouter(routes: [
          GoRoute(
            path: '/',
            builder: (_, __) => const CanvasScreen(
              args: CanvasScreenArgs(
                  subject: 'something not for kids', displayLabel: 'something not for kids', source: 'custom'),
            ),
          ),
        ]),
      ),
    ));

    // Generation is refused; the card list loads from assets/data/subjects.json.
    for (var i = 0; i < 20 && find.byType(ActionChip).evaluate().isEmpty; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(svc.calls, hasLength(1));
    expect(svc.calls.first.subject, 'something not for kids');
    final chips = find.byType(ActionChip);
    expect(chips, findsNWidgets(3), reason: 'three safe ideas under the refusal message');
    // The refused words are gone from the screen (title bar), 🎲 can't resend
    // them, and the home input is told to clear itself.
    expect(find.textContaining('something not for kids'), findsNothing);
    final container = ProviderScope.containerOf(tester.element(find.byType(CanvasScreen)));
    expect(container.read(subjectRefusedProvider), 1);
    final dice = tester.widget<IconButton>(find.ancestor(of: find.text('🎲'), matching: find.byType(IconButton)));
    expect(dice.onPressed, isNull);
    // The retry button would just send the refused subject again — it is replaced.
    expect(find.byType(ElevatedButton), findsNothing);

    // Same three ideas across rebuilds (not reshuffled every frame).
    final before = tester.widgetList<ActionChip>(chips).map((c) => c.key).toList();
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.widgetList<ActionChip>(chips).map((c) => c.key).toList(), before);

    final ideaKey = (before.first as ValueKey<String>).value.replaceFirst('refusal-idea-', '');
    await tester.tap(chips.first);
    for (var i = 0; i < 10 && svc.calls.length < 2; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(svc.calls, hasLength(2));
    expect(svc.calls[1].subject, ideaKey, reason: 'the idea’s English prompt is drawn');
    expect(svc.calls[1].source, 'refused_idea');

    // Drain the loading overlay's timers.
    await tester.pump(const Duration(seconds: 1));
  });
}
