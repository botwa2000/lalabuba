import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lalabuba/core/l10n/l10n_service.dart';
import 'package:lalabuba/features/progress/progress_service.dart';
import 'package:lalabuba/features/rewards/scenes.dart';
import 'package:lalabuba/features/rewards/scenes_screen.dart';

// Real-render check of the sticker-scene editor: a placed decoration that
// carries a custom scale + rotation must actually render scaled (bigger emoji)
// and rotated (a Transform.rotate by exactly that angle). This drives the live
// widget tree, not just the model math, so the pinch/twist feature is verified
// end-to-end at the rendering layer.

const _strings = {
  'scenesTitle': 'Sticker Scenes',
  'sceneClear': 'Clear',
  'sceneMeadowName': 'Meadow',
  'sceneIcebergName': 'Iceberg',
  'sceneOceanName': 'Ocean',
  'sceneCityName': 'City',
  'sceneSpaceName': 'Space',
  'sceneLockedShort': '+{n}',
  'sceneHint': 'drag · pinch · twist',
  'sceneEarnHint': 'Color to earn',
  'sceneTrayHead': '{n}/{total}',
  'sceneTrayEmpty': 'none yet',
  'sceneTrayMyArt': 'My Art',
};

class _FakeScenesNotifier extends ScenesNotifier {
  _FakeScenesNotifier(this.seed);
  final ScenesState seed;
  @override
  Future<ScenesState> build() async => seed;
}

class _FakeProgressNotifier extends ProgressNotifier {
  @override
  Future<Progress> build() async => const Progress(totalCompleted: 0);
}

void main() {
  testWidgets('a placed sticker renders with its scale and rotation',
      (tester) async {
    tester.view.physicalSize = const Size(1280, 800); // tablet — big targets
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const angle = 0.5;
    const scale = 2.0;
    final seed = const ScenesState(
      unlocked: ['m_tree'],
      placed: {
        'meadow': [
          Placement(deco: 'm_tree', x: 0.5, y: 0.5, scale: scale, rotation: angle),
        ],
      },
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          l10nProvider.overrideWithValue(const L10n('en', _strings)),
          progressProvider.overrideWith(_FakeProgressNotifier.new),
          scenesProvider.overrideWith(() => _FakeScenesNotifier(seed)),
        ],
        child: const MaterialApp(home: ScenesScreen()),
      ),
    );
    await tester.pumpAndSettle();

    // Rotation: a Transform built by Transform.rotate(angle: 0.5) — its
    // `transform` field is exactly Matrix4.rotationZ(angle), alignment centre.
    final rotated = tester.widgetList<Transform>(find.byType(Transform)).where(
        (t) => t.alignment == Alignment.center && t.transform == Matrix4.rotationZ(angle));
    expect(rotated, isNotEmpty,
        reason: 'placed sticker must be wrapped in a Transform.rotate(0.5)');

    // Scale: the PLACED tree emoji renders at base(44) * scale(2) * 0.78 font
    // size (the meadow tab also shows 🌳 at fontSize 22, so match by size).
    const expected = 44.0 * scale * 0.78;
    final placedEmoji = tester
        .widgetList<Text>(find.byType(Text))
        .where((w) => w.data == '🌳')
        .map((w) => w.style?.fontSize);
    expect(placedEmoji.any((fs) => fs != null && (fs - expected).abs() < 0.001),
        isTrue,
        reason: 'placed sticker emoji must be scaled to $expected, got $placedEmoji');
  });
}
