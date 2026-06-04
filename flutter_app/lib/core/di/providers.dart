import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_config.dart';
import '../theme/app_theme.dart';
export '../l10n/l10n_service.dart' show localeProvider, l10nProvider, LocaleNotifier;

// ─── AppConfig provider ───────────────────────────────────────────────────────
final appConfigProvider = FutureProvider<AppConfig>((ref) => AppConfig.load());

// ─── Theme providers ──────────────────────────────────────────────────────────
final appThemesProvider = FutureProvider<({AppTheme light, AppTheme dark})>(
  (_) => AppTheme.load(),
);

// ─── Theme mode (Light / Dark / System) ──────────────────────────────────────
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);
