import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/shared/services/analytics_service.dart';
import 'package:lalabuba/shared/services/usage_service.dart';

// Contract with the server whitelist (lib/usage.js EVENTS). Keep in sync.
const serverEvents = {
  'app_open', 'page_view', 'screen_view', 'complete', 'save', 'print', 'share',
  'share_art', 'community_share', 'challenge_create', 'challenge_open',
  'gallery_open', 'scene_open', 'journal_open', 'report_content',
  'review_prompt', 'review_store_open', 'error',
};

void main() {
  setUp(UsageService.resetForTest);

  test('app events map to server-whitelisted usage events', () async {
    for (final e in [
      'coloring_completed', 'draw_saved', 'draw_shared', 'draw_printed',
      'challenge_created', 'community_shared', 'content_reported',
      'review_prompt_requested', 'review_store_listing_opened', 'app_error',
      'region_detection_failed',
    ]) {
      await AnalyticsService.track(e);
    }
    final names = UsageService.queued.map((q) => q['e']).toSet();
    expect(names.difference(serverEvents), isEmpty);
    expect(UsageService.queued.length, 11);
  });

  test('generate events and settings toggles are not sent (server logs them)', () async {
    await AnalyticsService.track('image_generate_started', {'subject': 'Emma'});
    await AnalyticsService.track('difficulty_changed', {'from': 'easy', 'to': 'hard'});
    expect(UsageService.queued, isEmpty);
  });

  test('never forwards what the child typed', () async {
    await AnalyticsService.track('coloring_completed',
        {'subject': 'Emma Müller', 'difficulty': 'easy', 'source': 'custom'});
    final p = UsageService.queued.single['p'] as Map;
    expect(p.containsKey('subject'), isFalse);
    expect(p, {'difficulty': 'easy', 'source': 'custom'});
  });

  test('queue is bounded and keeps the newest events', () {
    for (var i = 0; i < 520; i++) {
      UsageService.track('screen_view', screen: '/s$i');
    }
    expect(UsageService.queued.length, 500);
    expect(UsageService.queued.last['s'], '/s519');
  });

  test('Play install referrer keeps utm_* only', () {
    expect(
      UsageService.parseReferrer(
          'utm_source=pinterest&utm_medium=social&utm_campaign=xmas_de&gclid=abc'),
      {'utm_source': 'pinterest', 'utm_medium': 'social', 'utm_campaign': 'xmas_de'},
    );
    expect(UsageService.parseReferrer('utm_source=google-play&utm_medium=organic'),
        {'utm_source': 'google-play', 'utm_medium': 'organic'});
    expect(UsageService.parseReferrer(null), isEmpty);
    expect(UsageService.parseReferrer(''), isEmpty);
  });

  test('client headers carry platform', () {
    expect(UsageService.clientHeaders['X-Platform'], isNotEmpty);
  });
}
