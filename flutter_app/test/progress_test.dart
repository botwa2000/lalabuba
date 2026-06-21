import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lalabuba/features/canvas/canvas_models.dart';
import 'package:lalabuba/features/progress/progress_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // ── CanvasState.isComplete (pure, no storage) ──────────────────────────────
  group('CanvasState.isComplete', () {
    const red = Color(0xFFFF0000);
    const blue = Color(0xFF0000FF);

    test('empty regionColorMap is never complete', () {
      expect(const CanvasState().isComplete, false);
    });

    test('partially filled is not complete', () {
      final s = const CanvasState().copyWith(
        regionColorMap: {1: red, 2: blue},
        regionColors: {1: red},
      );
      expect(s.isComplete, false);
    });

    test('wrong colour in a region is not complete', () {
      final s = const CanvasState().copyWith(
        regionColorMap: {1: red, 2: blue},
        regionColors: {1: red, 2: red}, // 2 should be blue
      );
      expect(s.isComplete, false);
    });

    test('all regions filled with assigned colour is complete', () {
      final s = const CanvasState().copyWith(
        regionColorMap: {1: red, 2: blue},
        regionColors: {1: red, 2: blue},
      );
      expect(s.isComplete, true);
    });
  });

  // ── Badge predicates + Progress model (pure) ───────────────────────────────
  group('Badge catalogue + Progress', () {
    test('first + five earned at 5 completions; ten not yet', () {
      const p = Progress(totalCompleted: 5);
      final earned = kBadges.where((b) => b.test(p)).map((b) => b.id).toSet();
      expect(earned.contains('first'), true);
      expect(earned.contains('five'), true);
      expect(earned.contains('ten'), false);
    });

    test('streak + hard + explorer predicates', () {
      const p = Progress(
        totalCompleted: 12,
        streak: 7,
        hardCompleted: 1,
        subjects: {
          'a': 1, 'b': 1, 'c': 1, 'd': 1, 'e': 1,
          'f': 1, 'g': 1, 'h': 1, 'i': 1, 'j': 1,
        },
      );
      final earned = kBadges.where((b) => b.test(p)).map((b) => b.id).toSet();
      expect(earned.containsAll({'streak3', 'streak7', 'rainbow', 'explorer'}),
          true);
      expect(earned.contains('streak30'), false);
    });

    test('byNumbers + freeColor predicates fire on their own counters', () {
      Set<String> earned(Progress p) =>
          kBadges.where((b) => b.test(p)).map((b) => b.id).toSet();

      expect(earned(const Progress()).contains('byNumbers'), false);
      expect(earned(const Progress()).contains('freeColor'), false);

      final numbered = earned(const Progress(numbersCompleted: 1));
      expect(numbered.contains('byNumbers'), true);
      expect(numbered.contains('freeColor'), false);

      final free = earned(const Progress(freeColorCompleted: 1));
      expect(free.contains('freeColor'), true);
      expect(free.contains('byNumbers'), false);
    });

    test('toJson/fromJson round-trips (incl. new mode counters)', () {
      const p = Progress(
        totalCompleted: 3,
        streak: 2,
        daysColored: 2,
        lastColoredDay: '2026-06-14',
        numbersCompleted: 2,
        freeColorCompleted: 1,
        subjects: {'cat': 2, 'dog': 1},
        badges: ['first'],
      );
      final back = Progress.fromJson(p.toJson());
      expect(back.totalCompleted, 3);
      expect(back.streak, 2);
      expect(back.subjects['cat'], 2);
      expect(back.badges, ['first']);
      expect(back.uniqueSubjects, 2);
      expect(back.numbersCompleted, 2);
      expect(back.freeColorCompleted, 1);
    });
  });

  // ── ProgressNotifier with a mocked secure-storage channel ──────────────────
  group('ProgressNotifier', () {
    final store = <String, String>{};
    setUp(() {
      store.clear();
      const channel =
          MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
        final args = (call.arguments as Map?) ?? const {};
        switch (call.method) {
          case 'write':
            store[args['key'] as String] = args['value'] as String;
            return null;
          case 'read':
            return store[args['key'] as String];
          case 'readAll':
            return store;
          case 'delete':
            store.remove(args['key'] as String);
            return null;
          case 'deleteAll':
            store.clear();
            return null;
          case 'containsKey':
            return store.containsKey(args['key'] as String);
          default:
            return null;
        }
      });
    });

    test('first completion sets streak/day=1 and awards the first sticker',
        () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      await c.read(progressProvider.future);

      final newBadges = await c
          .read(progressProvider.notifier)
          .recordCompletion(subject: 'cat', difficulty: 'easy');

      final p = c.read(progressProvider).valueOrNull!;
      expect(p.totalCompleted, 1);
      expect(p.streak, 1);
      expect(p.daysColored, 1);
      expect(newBadges.map((b) => b.id), contains('first'));
    });

    test('recordGeneration increments totalGenerated', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      await c.read(progressProvider.future);

      await c.read(progressProvider.notifier).recordGeneration();
      await c.read(progressProvider.notifier).recordGeneration();
      expect(c.read(progressProvider).valueOrNull!.totalGenerated, 2);
    });

    test('withNumbers true awards byNumbers; false awards freeColor', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      await c.read(progressProvider.future);
      final n = c.read(progressProvider.notifier);

      final b1 = await n.recordCompletion(subject: 'cat', withNumbers: true);
      expect(b1.map((b) => b.id), contains('byNumbers'));
      expect(b1.map((b) => b.id), isNot(contains('freeColor')));

      final b2 = await n.recordCompletion(subject: 'dog', withNumbers: false);
      expect(b2.map((b) => b.id), contains('freeColor'));

      final p = c.read(progressProvider).valueOrNull!;
      expect(p.numbersCompleted, 1);
      expect(p.freeColorCompleted, 1);
    });

    test('same-day completions do not double-count the day or streak', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      await c.read(progressProvider.future);

      final n = c.read(progressProvider.notifier);
      await n.recordCompletion(subject: 'cat');
      await n.recordCompletion(subject: 'dog');

      final p = c.read(progressProvider).valueOrNull!;
      expect(p.totalCompleted, 2);
      expect(p.daysColored, 1); // still one day
      expect(p.streak, 1);
      expect(p.uniqueSubjects, 2);
    });
  });
}
