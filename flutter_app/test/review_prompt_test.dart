import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/shared/services/review_prompt_service.dart';

const _day = 24 * 3600 * 1000;
final _t0 = DateTime(2026, 10, 1, 10).millisecondsSinceEpoch;

class _MemStore implements ReviewStore {
  ReviewState s;
  _MemStore([this.s = const ReviewState()]);
  @override
  Future<ReviewState> load() async => s;
  @override
  Future<void> save(ReviewState v) async => s = v;
}

class _FakeReviewer implements StoreReviewer {
  bool available = true;
  int requests = 0;
  int listings = 0;
  @override
  Future<bool> isAvailable() async => available;
  @override
  Future<void> requestReview() async => requests++;
  @override
  Future<void> openStoreListing() async => listings++;
}

/// [n] completions, one per day starting at t0.
ReviewState _completed(int n, {int perDay = 1}) {
  var s = const ReviewState();
  for (var i = 0; i < n; i++) {
    s = s.withCompletion(_t0 + (i ~/ perDay) * _day);
  }
  return s;
}

void main() {
  group('ReviewPolicy — first ask', () {
    test('not before 3 completions', () {
      expect(ReviewPolicy.shouldAsk(_completed(2), _t0 + 10 * _day, sessionHadError: false), isFalse);
    });
    test('3 completions on one day is not enough (needs 2 distinct days)', () {
      final s = _completed(3, perDay: 3);
      expect(s.distinctDays, 1);
      expect(ReviewPolicy.shouldAsk(s, _t0 + 10 * _day, sessionHadError: false), isFalse);
    });
    test('needs 3 days since the first completion', () {
      final s = _completed(3); // days 0,1,2
      expect(ReviewPolicy.shouldAsk(s, _t0 + 2 * _day, sessionHadError: false), isFalse);
      expect(ReviewPolicy.shouldAsk(s, _t0 + 3 * _day, sessionHadError: false), isTrue);
    });
    test('an error this session blocks it', () {
      expect(ReviewPolicy.shouldAsk(_completed(3), _t0 + 5 * _day, sessionHadError: true), isFalse);
    });
  });

  group('ReviewPolicy — second ask and cap', () {
    test('needs 10 more completions AND 30 days', () {
      final asked = _completed(3).withAsk(_t0 + 5 * _day);
      var s = asked;
      for (var i = 0; i < 9; i++) {
        s = s.withCompletion(_t0 + 6 * _day);
      }
      expect(ReviewPolicy.shouldAsk(s, _t0 + 60 * _day, sessionHadError: false), isFalse, reason: '9 more');
      s = s.withCompletion(_t0 + 6 * _day);
      expect(ReviewPolicy.shouldAsk(s, _t0 + 34 * _day, sessionHadError: false), isFalse, reason: '<30 days');
      expect(ReviewPolicy.shouldAsk(s, _t0 + 35 * _day, sessionHadError: false), isTrue);
    });
    test('never a third ask', () {
      var s = _completed(3).withAsk(_t0).withAsk(_t0);
      for (var i = 0; i < 100; i++) {
        s = s.withCompletion(_t0 + i * _day);
      }
      expect(ReviewPolicy.shouldAsk(s, _t0 + 400 * _day, sessionHadError: false), isFalse);
    });
  });

  group('ReviewPromptService', () {
    test('completions only count, they never prompt', () async {
      final store = _MemStore();
      final r = _FakeReviewer();
      var now = _t0;
      final svc = ReviewPromptService(store: store, reviewer: r, clock: () => now);
      for (var i = 0; i < 5; i++) {
        await svc.recordCompletion();
        now += _day;
      }
      expect(store.s.completions, 5);
      expect(store.s.distinctDays, 5);
      expect(r.requests, 0);
    });

    test('parent action prompts once when eligible, records the ask first', () async {
      final store = _MemStore(_completed(3));
      final r = _FakeReviewer();
      final svc = ReviewPromptService(store: store, reviewer: r, clock: () => _t0 + 5 * _day);
      expect(await svc.onParentActionSucceeded(), isTrue);
      expect(r.requests, 1);
      expect(store.s.asks, 1);
      expect(store.s.completionsAtLastAsk, 3);
      expect(await svc.onParentActionSucceeded(), isFalse, reason: 'second ask needs 10 more + 30 days');
      expect(r.requests, 1);
    });

    test('session error suppresses until restart', () async {
      final store = _MemStore(_completed(3));
      final r = _FakeReviewer();
      final svc = ReviewPromptService(store: store, reviewer: r, clock: () => _t0 + 5 * _day)..recordError();
      expect(await svc.onParentActionSucceeded(), isFalse);
      expect(store.s.asks, 0, reason: 'a suppressed ask is not spent');
    });

    test('unavailable store API does not spend an ask', () async {
      final store = _MemStore(_completed(3));
      final r = _FakeReviewer()..available = false;
      final svc = ReviewPromptService(store: store, reviewer: r, clock: () => _t0 + 5 * _day);
      expect(await svc.onParentActionSucceeded(), isFalse);
      expect(store.s.asks, 0);
    });

    test('Settings store link is independent of the quota', () async {
      final store = _MemStore(_completed(3).withAsk(_t0).withAsk(_t0));
      final r = _FakeReviewer();
      final svc = ReviewPromptService(store: store, reviewer: r, clock: () => _t0);
      await svc.openStoreListing();
      await svc.openStoreListing();
      expect(r.listings, 2);
      expect(store.s.asks, 2);
    });
  });
}
