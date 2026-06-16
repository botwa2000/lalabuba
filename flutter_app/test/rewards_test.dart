import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lalabuba/features/progress/progress_service.dart';
import 'package:lalabuba/features/rewards/crayon_packs.dart';
import 'package:lalabuba/features/rewards/daily_mission.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // ── Theme classifier (pure) ────────────────────────────────────────────────
  group('themesOf', () {
    test('animals', () {
      expect(themesOf('dog'), contains('animal'));
      expect(themesOf('a cute penguin'), contains('animal'));
    });
    test('vehicles / food / nature / people', () {
      expect(themesOf('fire truck'), contains('vehicle'));
      expect(themesOf('strawberry cake'), contains('food'));
      expect(themesOf('a big tree'), contains('nature'));
      expect(themesOf('princess'), contains('people'));
    });
    test('dragon counts as animal AND fantasy', () {
      final t = themesOf('dragon');
      expect(t.containsAll({'animal', 'fantasy'}), true);
    });
    test('empty / unmatched returns nothing', () {
      expect(themesOf(''), isEmpty);
      expect(themesOf('xyzzy'), isEmpty);
    });
  });

  // ── New badge predicates (pure) ─────────────────────────────────────────────
  group('expanded badge catalogue', () {
    Set<String> earnedFor(Progress p) =>
        kBadges.where((b) => b.test(p)).map((b) => b.id).toSet();

    test('every badge has a unique id and a group', () {
      final ids = kBadges.map((b) => b.id).toList();
      expect(ids.toSet().length, ids.length); // no duplicate ids
      for (final b in kBadges) {
        expect(BadgeGroup.values.contains(b.group), true);
      }
    });

    test('explorer theme stickers', () {
      expect(earnedFor(const Progress(themesColored: ['animal'])),
          contains('animalPal'));
      expect(earnedFor(const Progress(themesColored: ['vehicle'])),
          contains('onTheMove'));
      expect(earnedFor(const Progress(themesColored: ['fantasy'])),
          contains('fantasyFan'));
    });

    test('creativity stickers', () {
      expect(earnedFor(const Progress(maxColorUses: 1)), contains('maxColors'));
      expect(
          earnedFor(const Progress(freeTextCreations: 1)), contains('inventor'));
      expect(earnedFor(const Progress(drawPenUses: 1)), contains('penArtist'));
      expect(
          earnedFor(const Progress(extremeCompleted: 1)), contains('champion'));
      expect(
          earnedFor(const Progress(
              palettesUsed: ['classic', 'pastel', 'nature'])),
          contains('paletteMaster'));
    });

    test('sharing & saving thresholds', () {
      expect(earnedFor(const Progress(saves: 1)), contains('saver'));
      final five = earnedFor(const Progress(saves: 5));
      expect(five.containsAll({'saver', 'collector'}), true);
      expect(five.contains('curator'), false);
      expect(earnedFor(const Progress(saves: 25)), contains('curator'));
      expect(earnedFor(const Progress(shares: 5)).containsAll({'sharer', 'superSharer'}),
          true);
      expect(earnedFor(const Progress(challengesCreated: 1)),
          contains('challenger'));
      expect(earnedFor(const Progress(dailyWordsCompleted: 1)),
          contains('dailyStar'));
    });

    test('milestone hundred + streak14', () {
      expect(earnedFor(const Progress(totalCompleted: 100)), contains('hundred'));
      expect(earnedFor(const Progress(streak: 14)), contains('streak14'));
    });
  });

  // ── Crayon packs (pure) ─────────────────────────────────────────────────────
  group('crayon packs', () {
    test('free packs always unlocked, earned packs gated', () {
      const p0 = Progress();
      expect(isPackUnlocked(p0, 'classic'), true);
      expect(isPackUnlocked(p0, 'pastel'), true);
      expect(isPackUnlocked(p0, 'nature'), true);
      expect(isPackUnlocked(p0, 'neon'), false);
      expect(isPackUnlocked(const Progress(totalCompleted: 5), 'neon'), true);
      expect(isPackUnlocked(const Progress(totalCompleted: 14), 'candy'), false);
      expect(isPackUnlocked(const Progress(totalCompleted: 15), 'candy'), true);
    });

    test('unlockedPaletteIds grows with progress', () {
      expect(unlockedPaletteIds(const Progress()),
          ['classic', 'pastel', 'nature']);
      expect(unlockedPaletteIds(const Progress(totalCompleted: 30)),
          ['classic', 'pastel', 'nature', 'neon', 'candy', 'galaxy']);
    });

    test('packsUnlockedAt fires exactly on the threshold', () {
      expect(packsUnlockedAt(5).map((p) => p.id), ['neon']);
      expect(packsUnlockedAt(15).map((p) => p.id), ['candy']);
      expect(packsUnlockedAt(7), isEmpty); // no pack at 7
    });

    test('colorsFor honours count and never exceeds the pack', () {
      expect(colorsFor('classic', 6).length, 6);
      expect(colorsFor('neon', 99).length, 24);
      expect(colorsFor('galaxy', 1000).length, 24); // clamped
    });
  });

  // ── Daily mission (pure delta logic) ────────────────────────────────────────
  group('daily mission', () {
    MissionDef defById(String id) => kMissions.firstWhere((m) => m.id == id);

    test('single-step mission done after one matching event', () {
      final s = MissionState(
          def: defById('colorAny'), baseline: const Progress(totalCompleted: 2));
      expect(s.isDone(const Progress(totalCompleted: 2)), false);
      expect(s.isDone(const Progress(totalCompleted: 3)), true);
    });

    test('two-step mission needs the full amount', () {
      final s = MissionState(
          def: defById('colorTwo'), baseline: const Progress(totalCompleted: 0));
      expect(s.progressCount(const Progress(totalCompleted: 1)), 1);
      expect(s.isDone(const Progress(totalCompleted: 1)), false);
      expect(s.isDone(const Progress(totalCompleted: 2)), true);
    });

    test('share mission tracks the shares counter', () {
      final s =
          MissionState(def: defById('share'), baseline: const Progress(shares: 4));
      expect(s.isDone(const Progress(shares: 5)), true);
    });
  });

  // ── ProgressNotifier event recording (mocked storage) ───────────────────────
  group('ProgressNotifier events', () {
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

    test('completion records palette/colorCount/custom/daily + themes', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      await c.read(progressProvider.future);

      final newBadges = await c.read(progressProvider.notifier).recordCompletion(
            subject: 'dragon',
            difficulty: 'extreme',
            palette: 'pastel',
            colorCount: 99,
            isCustom: true,
            isDaily: false,
          );
      final p = c.read(progressProvider).valueOrNull!;
      expect(p.maxColorUses, 1);
      expect(p.freeTextCreations, 1);
      expect(p.extremeCompleted, 1);
      expect(p.hardCompleted, 1); // extreme also counts as hard
      expect(p.palettesUsed, contains('pastel'));
      expect(p.themesColored.contains('animal'), true);
      final ids = newBadges.map((b) => b.id).toSet();
      expect(ids.containsAll({'first', 'maxColors', 'inventor', 'champion'}),
          true);
    });

    test('save five times unlocks saver then collector', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      await c.read(progressProvider.future);
      final n = c.read(progressProvider.notifier);

      final firstSave = await n.recordSave();
      expect(firstSave.map((b) => b.id), contains('saver'));
      for (var i = 0; i < 3; i++) {
        await n.recordSave();
      }
      final fifth = await n.recordSave();
      expect(fifth.map((b) => b.id), contains('collector'));
      expect(c.read(progressProvider).valueOrNull!.saves, 5);
    });

    test('draw-pen badge awarded once, second call is a no-op', () async {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      await c.read(progressProvider.future);
      final n = c.read(progressProvider.notifier);

      final first = await n.recordDrawPenUse();
      expect(first.map((b) => b.id), contains('penArtist'));
      final second = await n.recordDrawPenUse();
      expect(second, isEmpty);
      expect(c.read(progressProvider).valueOrNull!.drawPenUses, 1);
    });

    test('old saved progress (no new fields) loads with safe defaults', () {
      final back = Progress.fromJson({
        'totalCompleted': 4,
        'badges': ['first'],
      });
      expect(back.totalCompleted, 4);
      expect(back.shares, 0);
      expect(back.saves, 0);
      expect(back.themesColored, isEmpty);
      expect(back.palettesUsed, isEmpty);
      expect(back.badges, ['first']);
    });
  });
}
