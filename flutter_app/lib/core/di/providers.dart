import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_config.dart';
import '../theme/app_theme.dart';

// Re-export all providers so screens can import from one place
export '../l10n/l10n_service.dart' show localeProvider, l10nProvider, LocaleNotifier, languageMeta, supportedLocales;
export '../../features/settings/settings_controller.dart';
export '../../features/subscription/subscription_service.dart';
export '../../features/home/home_controller.dart';
export '../../features/canvas/canvas_controller.dart';

// ─── AppConfig ───────────────────────────────────────────────────────────────
final appConfigProvider = FutureProvider<AppConfig>((ref) => AppConfig.load());

// ─── Themes ──────────────────────────────────────────────────────────────────
final appThemesProvider = FutureProvider<({AppTheme light, AppTheme dark})>(
  (_) => AppTheme.load(),
);

// ─── Theme mode ──────────────────────────────────────────────────────────────
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);
