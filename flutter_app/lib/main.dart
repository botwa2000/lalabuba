import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app.dart';
import 'core/config/app_config.dart';
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

  // Analytics must init before runApp so the Crashlytics FlutterError handler
  // is in place before any widget tree errors can occur.
  try {
    final config = await AppConfig.load();
    await AnalyticsService.init(enabled: config.analyticsEnabled);
  } catch (_) {
    // If config fails to load, start analytics enabled (safe default).
    await AnalyticsService.init();
  }

  runApp(const ProviderScope(child: LalabubaApp()));
}
