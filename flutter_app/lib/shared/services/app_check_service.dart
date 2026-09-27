import 'dart:async';

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:flutter/foundation.dart';

/// Firebase App Check — proves requests come from a genuine, unmodified
/// Lalabuba install (Play Integrity on Android, App Attest with DeviceCheck
/// fallback on iOS). The server's /api/generate-image verifies the token sent in
/// the `X-Firebase-AppCheck` header; see lib/app-check.js in the server repo.
///
/// Debug builds use the debug provider. Pass a debug token that is registered in
/// Firebase Console → App Check → Manage debug tokens:
///   `flutter run --dart-define=APP_CHECK_DEBUG_TOKEN=YOUR-DEBUG-TOKEN`
/// Without it the SDK logs a generated token to register once.
class AppCheckService {
  AppCheckService._();

  static const String _debugToken = String.fromEnvironment('APP_CHECK_DEBUG_TOKEN');
  static const Duration _tokenTimeout = Duration(seconds: 6);

  static bool _active = false;

  /// Call once, right after Firebase.initializeApp. Never throws.
  static Future<void> activate() async {
    if (kIsWeb || _active) return;
    try {
      final debugToken = _debugToken.isEmpty ? null : _debugToken;
      await FirebaseAppCheck.instance.activate(
        providerAndroid: kDebugMode
            ? AndroidDebugProvider(debugToken: debugToken)
            : const AndroidPlayIntegrityProvider(),
        providerApple: kDebugMode
            ? AppleDebugProvider(debugToken: debugToken)
            : const AppleAppAttestWithDeviceCheckFallbackProvider(),
      );
      await FirebaseAppCheck.instance.setTokenAutoRefreshEnabled(true);
      _active = true;
    } catch (e) {
      debugPrint('[AppCheck] activation failed: $e');
    }
  }

  /// The current App Check token, or null if one cannot be obtained in time.
  /// Never throws — the caller sends the request either way and the server
  /// decides (monitor mode allows, enforce mode rejects with an update prompt).
  static Future<String?> token() async {
    if (!_active) return null;
    try {
      return await FirebaseAppCheck.instance.getToken().timeout(_tokenTimeout);
    } catch (e) {
      debugPrint('[AppCheck] token unavailable: $e');
      return null;
    }
  }
}
