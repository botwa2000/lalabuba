import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'app_check_service.dart';
import 'package:flutter/foundation.dart';
import '../../firebase_options.dart';
import 'usage_service.dart';

/// Product events → first-party [UsageService] (our own server, no third-party
/// analytics SDK). Crash reports → Firebase Crashlytics. Safe to call track()
/// at any time, even before init() completes.
///
/// Firebase is skipped gracefully when firebase_options.dart is still the stub.
class AnalyticsService {
  static bool _firebaseReady = false;
  static bool _enabled = true;

  /// App event name → usage event (server whitelist in lib/usage.js).
  /// Generations are logged server-side by /api/generate-image, so the
  /// generate events and settings toggles are intentionally not sent.
  static const _usageEvents = {
    'coloring_completed': 'complete',
    'draw_saved': 'save',
    'draw_shared': 'share_art',
    'draw_printed': 'print',
    'challenge_created': 'challenge_create',
    'community_shared': 'community_share',
    'content_reported': 'report_content',
    'review_prompt_requested': 'review_prompt',
    'review_store_listing_opened': 'review_store_open',
    'app_error': 'error',
    'region_detection_failed': 'error',
  };

  /// Props forwarded with an event — small enums/numbers only, never the subject.
  static const _allowedProps = {'difficulty', 'source', 'fatal', 'reason'};

  static Future<void> init({bool enabled = true}) async {
    _enabled = enabled;
    if (!enabled) return;
    await _initFirebase();
  }

  static Future<void> _initFirebase() async {
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      // Attestation first: generate requests need an App Check token.
      await AppCheckService.activate();
      if (!kIsWeb) {
        await FirebaseCrashlytics.instance
            .setCrashlyticsCollectionEnabled(!kDebugMode);
        FlutterError.onError =
            FirebaseCrashlytics.instance.recordFlutterFatalError;
        PlatformDispatcher.instance.onError = (error, stack) {
          FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
          return true;
        };
        _firebaseReady = true;
        debugPrint('[Analytics] Firebase Crashlytics active.');
      }
    } catch (_) {
      // firebase_options.dart is still the stub — Crashlytics inactive.
    }
  }

  /// Record a product event. Fire-and-forget; never throws.
  static Future<void> track(String event, [Map<String, Object>? props]) async {
    if (!_enabled) return;
    final name = _usageEvents[event];
    if (name == null) return;
    final safe = <String, Object>{
      for (final e in (props ?? const <String, Object>{}).entries)
        if (_allowedProps.contains(e.key)) e.key: e.value,
      if (event == 'region_detection_failed') 'reason': 'region_detection',
    };
    UsageService.track(name, props: safe.isEmpty ? null : safe);
  }

  /// Report a caught error to Crashlytics (if active) and count it.
  static Future<void> recordError(
    Object error,
    StackTrace? stack, {
    bool fatal = false,
  }) async {
    if (_firebaseReady && !kIsWeb) {
      try {
        await FirebaseCrashlytics.instance.recordError(error, stack, fatal: fatal);
      } catch (_) {}
    }
    await track('app_error', {'fatal': fatal});
  }
}
