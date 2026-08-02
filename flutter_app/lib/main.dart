import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app.dart';
import 'core/config/app_config.dart';
import 'core/drawing_config_service.dart';
import 'shared/services/analytics_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Fonts are bundled under google_fonts/ — never reach out to the network.
  // This guarantees Fredoka/Nunito render offline, on first launch, and in
  // regions where fonts.gstatic.com is blocked (notably China / zh users).
  GoogleFonts.config.allowRuntimeFetching = false;

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    systemNavigationBarColor: Colors.transparent,
  ));

  // Load the bundle config once so we can pass the API base URL to both
  // DrawingConfigService and analytics. rootBundle reads are fast (no ANR risk).
  AppConfig? appConfig;
  try {
    appConfig = await AppConfig.load();
  } catch (_) {}

  // Fetch remote drawing parameters before the first screen renders.
  // Falls back silently to hard-coded defaults on any network / parse error,
  // so this never blocks startup on offline devices.
  await DrawingConfigService.initialize(
      appConfig?.apiBaseUrl ?? 'https://lalabuba.com');

  // Fire-and-forget: analytics (Firebase + PostHog) init is heavy on first
  // launch and blocks the main thread long enough to ANR on slower devices.
  // runApp must not be gated on it. Dart errors before Crashlytics is ready
  // are an acceptable tradeoff vs a black-screen ANR on every cold start.
  unawaited(() async {
    try {
      await AnalyticsService.init(enabled: appConfig?.analyticsEnabled ?? true);
    } catch (_) {
      await AnalyticsService.init();
    }
  }());

  runApp(const ProviderScope(child: LalabubaApp()));
}
