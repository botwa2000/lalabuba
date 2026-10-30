import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:play_install_referrer/play_install_referrer.dart';

import 'device_id_service.dart';
import 'storage_service.dart';

/// First-party usage statistics → `POST /api/t` on our own server (stored in
/// our database, shown on the private /admin/stats dashboard). No third-party
/// SDK, no advertising ID, no IP or device fingerprint: each event carries the
/// random per-install UUID the app already sends with drawing requests.
///
/// Events queue in memory, flush every 30 s / at 20 events / when the app goes
/// to the background, and survive offline periods in a small JSON file. All
/// calls are fire-and-forget and never throw — statistics must never affect
/// the child's experience.
///
/// The event names are a contract with `lib/usage.js` (EVENTS) on the server;
/// unknown names are dropped there.
class UsageService {
  UsageService._();

  static const _flushInterval = Duration(seconds: 30);
  static const _batchSize = 50;
  static const _flushAt = 20;
  static const _maxQueued = 500;
  static const _queueFile = 'usage_queue.json';
  static const _kAcqSent = 'usage_acq_sent';

  static final List<Map<String, Object?>> _queue = [];
  static Dio? _dio;
  static Timer? _timer;
  static bool _flushing = false;
  static int _inFlight = 0;
  static Map<String, String>? _acq;
  static String? _lastScreen;
  static AppLifecycleListener? _lifecycle;

  /// `ios` | `android` (anything else is reported as `app`).
  static final String platform = kIsWeb
      ? 'web'
      : Platform.isIOS
          ? 'ios'
          : Platform.isAndroid
              ? 'android'
              : 'app';

  /// e.g. `1.0.24+10084`; null until [prepare] ran.
  static String? appVersion;

  /// Current UI language (2 letters), kept in sync by the locale notifier.
  static String? lang;

  /// Our API origin (from the bundle config, set by [start]).
  static String apiBaseUrl = 'https://lalabuba.com';

  /// Headers every API call to our server should carry, so the server can
  /// attribute requests to a platform and app version.
  static Map<String, String> get clientHeaders => {
        'X-Platform': platform,
        if (appVersion != null) 'X-App-Version': appVersion!,
      };

  /// Cheap, call before the first API request (reads the app version).
  static Future<void> prepare() async {
    try {
      final info = await PackageInfo.fromPlatform()
          .timeout(const Duration(seconds: 2));
      appVersion = '${info.version}+${info.buildNumber}';
    } catch (_) {}
  }

  /// Starts the queue: restores unsent events, records `app_open`, reads the
  /// Android install referrer once, and flushes on a timer and on background.
  static Future<void> start(String apiBaseUrl) async {
    if (_dio != null) return;
    UsageService.apiBaseUrl = apiBaseUrl;
    _dio = Dio(BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 10),
    ));
    await _restore();
    track('app_open');
    unawaited(_loadInstallReferrer());
    _timer = Timer.periodic(_flushInterval, (_) => unawaited(flush()));
    _lifecycle = AppLifecycleListener(
      onResume: () => track('app_open'),
      // Persist first: the OS may kill a backgrounded app before the POST lands.
      onHide: () => unawaited(_persist().then((_) => flush())),
    );
  }

  /// Records a screen view whenever the router settles on a new route
  /// template (e.g. `/explore/:topic`, never the concrete topic).
  static void attachRouter(GoRouter router) {
    void onChange() {
      try {
        final path = router.routerDelegate.currentConfiguration.fullPath;
        if (path.isEmpty || path == _lastScreen) return;
        _lastScreen = path;
        track('screen_view', screen: path);
      } catch (_) {}
    }

    router.routerDelegate.addListener(onChange);
    onChange();
  }

  /// Queue one event. [props] must be small scalar values — never what the
  /// child typed (the server also strips anything else).
  static void track(String event,
      {String? screen, Map<String, Object>? props}) {
    if (_queue.length >= _maxQueued) _queue.removeAt(0);
    _queue.add({
      'e': event,
      if (screen != null) 's': screen,
      if (props != null && props.isNotEmpty) 'p': props,
      't': DateTime.now().millisecondsSinceEpoch,
    });
    if (_queue.length >= _flushAt) unawaited(flush());
  }

  /// Sends queued events. Safe to call any time; concurrent calls coalesce.
  static Future<void> flush() async {
    final dio = _dio;
    if (dio == null || _flushing || _queue.isEmpty) return;
    _flushing = true;
    try {
      while (_queue.isNotEmpty) {
        final batch = _queue.take(_batchSize).toList();
        final acq = _acq;
        final deviceId = await DeviceIdService.getDeviceId();
        _inFlight = batch.length;
        await dio.post('/api/t',
            data: {
              'iid': deviceId,
              'v': appVersion,
              'lang': lang,
              if (acq != null) 'acq': acq,
              'events': batch,
            },
            options: Options(headers: {
              ...clientHeaders,
              'X-Device-ID': deviceId,
              'Content-Type': 'application/json',
            }));
        _queue.removeRange(0, batch.length);
        _inFlight = 0;
        if (acq != null) {
          _acq = null;
          unawaited(StorageService.writeBool(_kAcqSent, true)
              .catchError((_) {}));
        }
      }
      await _deleteFile();
    } catch (_) {
      _inFlight = 0;
      await _persist();
    } finally {
      _flushing = false;
    }
  }

  // ── Android Play Install Referrer (first open only) ────────────────────────
  static Future<void> _loadInstallReferrer() async {
    if (platform != 'android') return;
    try {
      if (await StorageService.readBool(_kAcqSent, false)) return;
      final details = await PlayInstallReferrer.installReferrer
          .timeout(const Duration(seconds: 5));
      final params = parseReferrer(details.installReferrer);
      // Organic installs report utm_source=google-play&utm_medium=organic.
      _acq = params.isEmpty ? {'source': 'google-play'} : params;
    } catch (_) {
      // Referrer service unavailable (no Play Store, emulator) — retried on
      // the next cold start until one batch carrying it was accepted.
    }
  }

  /// `utm_source=a&utm_medium=b&utm_campaign=c` → the utm_* keys we keep.
  @visibleForTesting
  static Map<String, String> parseReferrer(String? referrer) {
    if (referrer == null || referrer.isEmpty) return {};
    try {
      final q = Uri.splitQueryString(referrer);
      return {
        for (final k in const ['utm_source', 'utm_medium', 'utm_campaign'])
          if ((q[k] ?? '').isNotEmpty) k: q[k]!.substring(0, q[k]!.length.clamp(0, 40)),
      };
    } catch (_) {
      return {};
    }
  }

  // ── Offline persistence ────────────────────────────────────────────────────
  static Future<File?> _file() async {
    try {
      final dir = await getApplicationSupportDirectory();
      return File('${dir.path}/$_queueFile');
    } catch (_) {
      return null;
    }
  }

  static Future<void> _persist() async {
    try {
      final f = await _file();
      // Skip the batch currently being sent so a restore can't duplicate it.
      final pending = _queue.sublist(_inFlight.clamp(0, _queue.length));
      if (pending.isEmpty) return;
      await f?.writeAsString(jsonEncode(pending));
    } catch (_) {}
  }

  static Future<void> _restore() async {
    try {
      final f = await _file();
      if (f == null || !await f.exists()) return;
      final list = jsonDecode(await f.readAsString());
      if (list is List) {
        for (final e in list.take(_maxQueued)) {
          if (e is Map) _queue.add(Map<String, Object?>.from(e));
        }
      }
      await f.delete();
    } catch (_) {}
  }

  static Future<void> _deleteFile() async {
    try {
      final f = await _file();
      if (f != null && await f.exists()) await f.delete();
    } catch (_) {}
  }

  /// Test hook: queued events (read-only copy).
  @visibleForTesting
  static List<Map<String, Object?>> get queued => List.unmodifiable(_queue);

  @visibleForTesting
  static void resetForTest() {
    _queue.clear();
    _timer?.cancel();
    _timer = null;
    _lifecycle?.dispose();
    _lifecycle = null;
    _dio = null;
    _acq = null;
    _lastScreen = null;
  }
}
