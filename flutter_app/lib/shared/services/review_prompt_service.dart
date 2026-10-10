import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:in_app_review/in_app_review.dart';

import 'analytics_service.dart';
import 'storage_service.dart';

/// Store-review prompting — rare, parent-facing, zero added friction.
///
/// WHY IT LOOKS LIKE THIS
/// - Neither store tells us whether a review was left, so we never "remind";
///   we offer the OS two well-timed chances and the OS decides whether to show
///   (iOS: ≤3/365 days; Play: opaque quota). After a rating the OS stops showing.
/// - No pre-prompt ("Enjoying Lalabuba?"): Google forbids any question before
///   the card, Apple requires the system prompt.
/// - Kids app: the child is usually holding the device. Completed pictures are
///   COUNTED, but the ask only happens right after a grown-up has just passed
///   the parental gate and the gated action succeeded — never at the
///   celebration, never at launch, never mid-task.
/// - "Rate Lalabuba" in Settings (behind the gate) opens the store page
///   directly — always works, never consumes the OS quota.
class ReviewPolicy {
  static const firstAskMinCompletions = 3;
  static const firstAskMinDistinctDays = 2;
  static const firstAskMinAge = Duration(days: 3);
  static const secondAskMoreCompletions = 10;
  static const secondAskMinGap = Duration(days: 30);
  static const maxAsks = 2;

  /// Pure decision. [now] in epoch ms.
  static bool shouldAsk(ReviewState s, int nowMs, {required bool sessionHadError}) {
    if (sessionHadError || s.asks >= maxAsks) return false;
    if (s.asks == 0) {
      return s.completions >= firstAskMinCompletions &&
          s.distinctDays >= firstAskMinDistinctDays &&
          s.firstCompletionMs > 0 &&
          nowMs - s.firstCompletionMs >= firstAskMinAge.inMilliseconds;
    }
    return s.completions - s.completionsAtLastAsk >= secondAskMoreCompletions &&
        nowMs - s.lastAskMs >= secondAskMinGap.inMilliseconds;
  }
}

@immutable
class ReviewState {
  final int completions;
  final int distinctDays;
  final String lastDay; // yyyy-mm-dd of the last counted completion
  final int firstCompletionMs;
  final int asks;
  final int lastAskMs;
  final int completionsAtLastAsk;

  const ReviewState({
    this.completions = 0,
    this.distinctDays = 0,
    this.lastDay = '',
    this.firstCompletionMs = 0,
    this.asks = 0,
    this.lastAskMs = 0,
    this.completionsAtLastAsk = 0,
  });

  /// Count one completed picture at [nowMs] (local calendar day).
  ReviewState withCompletion(int nowMs) {
    final d = DateTime.fromMillisecondsSinceEpoch(nowMs);
    final day = '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    return ReviewState(
      completions: completions + 1,
      distinctDays: day == lastDay ? distinctDays : distinctDays + 1,
      lastDay: day,
      firstCompletionMs: firstCompletionMs == 0 ? nowMs : firstCompletionMs,
      asks: asks,
      lastAskMs: lastAskMs,
      completionsAtLastAsk: completionsAtLastAsk,
    );
  }

  ReviewState withAsk(int nowMs) => ReviewState(
        completions: completions,
        distinctDays: distinctDays,
        lastDay: lastDay,
        firstCompletionMs: firstCompletionMs,
        asks: asks + 1,
        lastAskMs: nowMs,
        completionsAtLastAsk: completions,
      );
}

/// Seams for tests.
abstract class ReviewStore {
  Future<ReviewState> load();
  Future<void> save(ReviewState s);
}

abstract class StoreReviewer {
  Future<bool> isAvailable();
  Future<void> requestReview();
  Future<void> openStoreListing();
}

class _SecureReviewStore implements ReviewStore {
  static const _k = 'review_prompt_';

  @override
  Future<ReviewState> load() async => ReviewState(
        completions: await StorageService.readInt('${_k}completions', 0),
        distinctDays: await StorageService.readInt('${_k}days', 0),
        lastDay: await StorageService.read('${_k}last_day') ?? '',
        firstCompletionMs: await StorageService.readInt('${_k}first_ms', 0),
        asks: await StorageService.readInt('${_k}asks', 0),
        lastAskMs: await StorageService.readInt('${_k}last_ask_ms', 0),
        completionsAtLastAsk: await StorageService.readInt('${_k}at_last_ask', 0),
      );

  @override
  Future<void> save(ReviewState s) async {
    await StorageService.writeInt('${_k}completions', s.completions);
    await StorageService.writeInt('${_k}days', s.distinctDays);
    await StorageService.write('${_k}last_day', s.lastDay);
    await StorageService.writeInt('${_k}first_ms', s.firstCompletionMs);
    await StorageService.writeInt('${_k}asks', s.asks);
    await StorageService.writeInt('${_k}last_ask_ms', s.lastAskMs);
    await StorageService.writeInt('${_k}at_last_ask', s.completionsAtLastAsk);
  }
}

class _PlatformReviewer implements StoreReviewer {
  static const appStoreId = '6761691648'; // codemagic.yaml APP_STORE_APPLE_ID
  final _r = InAppReview.instance;

  @override
  Future<bool> isAvailable() => _r.isAvailable();
  @override
  Future<void> requestReview() => _r.requestReview();
  @override
  Future<void> openStoreListing() => _r.openStoreListing(appStoreId: appStoreId);
}

class ReviewPromptService {
  ReviewPromptService({ReviewStore? store, StoreReviewer? reviewer, int Function()? clock})
      : _store = store ?? _SecureReviewStore(),
        _reviewer = reviewer ?? _PlatformReviewer(),
        _clock = clock ?? (() => DateTime.now().millisecondsSinceEpoch);

  static final instance = ReviewPromptService();

  final ReviewStore _store;
  final StoreReviewer _reviewer;
  final int Function() _clock;
  bool _sessionHadError = false;
  bool _busy = false;

  /// A picture was completed. Counts only — never prompts (the child is here).
  Future<void> recordCompletion() async {
    try {
      await _store.save((await _store.load()).withCompletion(_clock()));
    } catch (_) {}
  }

  /// Something went wrong this session (e.g. a failed generation): no ask
  /// until the app restarts.
  void recordError() => _sessionHadError = true;

  /// A grown-up just passed the parental gate AND the gated action succeeded.
  /// The only place the automatic prompt can fire. Returns true if requested.
  Future<bool> onParentActionSucceeded() async {
    if (_busy) return false;
    _busy = true;
    try {
      final s = await _store.load();
      final now = _clock();
      if (!ReviewPolicy.shouldAsk(s, now, sessionHadError: _sessionHadError)) return false;
      if (!await _reviewer.isAvailable()) return false;
      // Persist BEFORE requesting: the OS may or may not show it; either way
      // this was one of our two chances.
      await _store.save(s.withAsk(now));
      await _reviewer.requestReview();
      AnalyticsService.track('review_prompt_requested', {'ask': '${s.asks + 1}'});
      return true;
    } catch (_) {
      return false;
    } finally {
      _busy = false;
    }
  }

  /// Settings → "Rate Lalabuba" (caller has already passed the parental gate).
  Future<void> openStoreListing() async {
    try {
      await _reviewer.openStoreListing();
      AnalyticsService.track('review_store_listing_opened');
    } catch (_) {}
  }
}
