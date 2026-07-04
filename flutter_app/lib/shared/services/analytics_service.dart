import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:posthog_flutter/posthog_flutter.dart';
import '../../firebase_options.dart';

/// Thin wrapper around PostHog (product analytics) and Firebase Crashlytics
/// (crash reporting). Both are no-op until initialised — safe to call track()
/// at any time, even before init() completes.
///
/// Firebase is skipped gracefully when firebase_options.dart is still the stub.
/// Run `flutterfire configure` once to activate crash reporting.
class AnalyticsService {
  static const _phKey = 'phc_miWnhE5M3nnJZkqTuD9pxcRwFKSbkHZnaGSyU4nnWhLW';
  static const _phHost = 'https://eu.i.posthog.com';

  static bool _firebaseReady = false;
  static bool _posthogReady = false;

  static Future<void> init({bool enabled = true}) async {
    if (!enabled) return;
    _initPostHog();
    await _initFirebase();
  }

  static void _initPostHog() {
    try {
      final config = PostHogConfig(_phKey)
        ..host = _phHost
        ..captureApplicationLifecycleEvents = true
        ..debug = false;
      Posthog().setup(config);
      _posthogReady = true;
    } catch (e) {
      debugPrint('[Analytics] PostHog init failed: $e');
    }
  }

  static Future<void> _initFirebase() async {
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
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
      // PostHog still works independently.
    }
  }

  /// Capture a product event to PostHog. Fire-and-forget; never throws.
  static Future<void> track(String event, [Map<String, Object>? props]) async {
    if (!_posthogReady) return;
    try {
      await Posthog().capture(eventName: event, properties: props);
    } catch (_) {}
  }

  /// Report a caught error to Crashlytics (if active) and PostHog.
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
    await track('app_error', {
      'error': error.toString().substring(0, error.toString().length.clamp(0, 200)),
      'fatal': fatal,
    });
  }
}
