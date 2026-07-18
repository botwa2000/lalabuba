// Verifies that tapping an Explore gallery image never calls _generate()
// (the AI image-generation API). The fix in commit 900e781 removed the two
// buttons in ExploreTopicScreen that routed through _generate(). This test
// confirms that CanvasScreen always takes the _renderPreloaded() path when
// preloadedBytes is provided.
//
// Approach: override generateServiceProvider with one that throws a sentinel
// exception if generate() is ever invoked. A passing test proves _generate()
// was never called.
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lalabuba/core/config/app_config.dart';
import 'package:lalabuba/core/di/providers.dart';
import 'package:lalabuba/features/canvas/canvas_screen.dart';
import 'package:lalabuba/features/generate/generate_service.dart';
import 'package:lalabuba/features/generate/generate_models.dart';

// Minimal 4-pixel white PNG (valid, decodable by Flutter's codec).
final _kMinimalPng = Uint8List.fromList([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length+type
  0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, // width=2, height=2
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x57, 0x53, // 8-bit RGB, CRC
  0xDE, 0x00, 0x00, 0x00, 0x12, 0x49, 0x44, 0x41, // IDAT chunk
  0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0xC0,
  0xC0, 0xC0, 0xC0, 0x00, 0x00, 0x00, 0x06, 0x00,
  0x01, 0x99, 0x9A, 0x5A, 0x51, 0x00, 0x00, 0x00,
  0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82, // IEND
]);

/// Fake GenerateService that records calls and fails the test if generate()
/// is invoked — proving the preloaded path is taken instead.
class _FakeGenerateService extends GenerateService {
  bool generateCalled = false;

  _FakeGenerateService() : super(_fakeConfig());

  static AppConfig _fakeConfig() => const AppConfig(
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

  @override
  Future<GenerationResult> generate({
    required String subject,
    required String difficulty,
    required int colorCount,
    int? seed,
  }) async {
    generateCalled = true;
    fail('_generate() was called from source=explore — fix not working');
  }
}

void main() {
  group('Explore → Canvas: no AI re-generation', () {
    testWidgets('CanvasScreen with preloadedBytes never calls generate()', (tester) async {
      final fake = _FakeGenerateService();
      bool generateProviderRead = false;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appConfigProvider.overrideWith((_) async => _FakeGenerateService._fakeConfig()),
            generateServiceProvider.overrideWith((ref) {
              generateProviderRead = true;
              return fake;
            }),
          ],
          child: MaterialApp.router(
            routerConfig: GoRouter(
              routes: [
                GoRoute(
                  path: '/',
                  builder: (_, __) => CanvasScreen(
                    args: CanvasScreenArgs(
                      subject: 'dragon',
                      displayLabel: 'dragon',
                      source: 'explore',
                      preloadedBytes: _kMinimalPng,
                      preloadedDifficulty: 'easy',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

      // Let the addPostFrameCallback fire (picks the _renderPreloaded vs _generate branch).
      await tester.pump();

      // Core assertion: _generate() was never invoked (checked before any timers drain).
      expect(fake.generateCalled, isFalse,
          reason: 'preloadedBytes set → must use _renderPreloaded(), not _generate()');

      // Drain pending timers (loading overlay creates 6 Future.delayed at 0,150,300,450,600,750ms).
      await tester.pump(const Duration(milliseconds: 1000));
      await tester.pump();

      // Re-confirm after timers fire.
      expect(fake.generateCalled, isFalse,
          reason: 'preloadedBytes set → must use _renderPreloaded(), not _generate()');

      if (generateProviderRead) {
        expect(fake.generateCalled, isFalse);
      }
    });
  });
}
