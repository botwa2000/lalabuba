import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _kLangKey = 'lalabuba_lang';
const _supportedLocales = ['en','de','ru','fr','es','pt','it','nl','pl','tr','zh','hi'];

class L10n {
  final String locale;
  final Map<String, dynamic> _strings;
  final Map<String, dynamic> _fallback; // English fallback for missing keys

  const L10n(this.locale, this._strings, [this._fallback = const {}]);

  /// Translate a key. Missing keys fall back to English, then to the key name.
  String t(String key, [Map<String, String>? args]) {
    String result = (_strings[key] as String?)
        ?? (_fallback[key] as String?)
        ?? key;
    args?.forEach((k, v) => result = result.replaceAll('{$k}', v));
    return result;
  }

  /// Translate with positional substitution.
  String tr(String key, Map<String, String> args) => t(key, args);

  /// Get a string list (e.g. loadingMessages). Falls back to English list.
  List<String> tList(String key) {
    final val = _strings[key] ?? _fallback[key];
    if (val is List) return val.cast<String>();
    return [key];
  }

  static Future<L10n> load(String locale) async {
    final effective = _supportedLocales.contains(locale) ? locale : 'en';
    // Always load English as the fallback for missing keys in other locales
    Map<String, dynamic> enStrings = const {};
    try {
      final enRaw = await rootBundle.loadString('assets/i18n/en.json');
      enStrings = jsonDecode(enRaw) as Map<String, dynamic>;
    } catch (_) {}

    if (effective == 'en') return L10n('en', enStrings);

    try {
      final raw = await rootBundle.loadString('assets/i18n/$effective.json');
      return L10n(effective, jsonDecode(raw) as Map<String, dynamic>, enStrings);
    } catch (_) {
      return L10n('en', enStrings);
    }
  }
}

// ─── Riverpod providers ──────────────────────────────────────────────────────

class LocaleNotifier extends AsyncNotifier<L10n> {
  static const _storage = FlutterSecureStorage();

  @override
  Future<L10n> build() async {
    final saved = await _storage.read(key: _kLangKey) ?? _deviceLocale();
    return L10n.load(saved);
  }

  Future<void> setLocale(String locale) async {
    await _storage.write(key: _kLangKey, value: locale);
    state = AsyncData(await L10n.load(locale));
  }

  String _deviceLocale() {
    // WidgetsBinding.instance.platformDispatcher.locale returns the device locale
    // This is safe to call after runApp
    try {
      final tag = WidgetsBinding.instance.platformDispatcher.locale.languageCode;
      return _supportedLocales.contains(tag) ? tag : 'en';
    } catch (_) {
      return 'en';
    }
  }
}

final localeProvider = AsyncNotifierProvider<LocaleNotifier, L10n>(LocaleNotifier.new);

// Convenience: synchronous access once loaded, falls back to key if not ready
final l10nProvider = Provider<L10n>((ref) {
  return ref.watch(localeProvider).value ?? L10n('en', const {});
});

const supportedLocales = _supportedLocales;

final languageMeta = {
  'en': (code: 'EN', flag: '🇺🇸', name: 'English'),
  'de': (code: 'DE', flag: '🇩🇪', name: 'Deutsch'),
  'ru': (code: 'RU', flag: '🇷🇺', name: 'Русский'),
  'fr': (code: 'FR', flag: '🇫🇷', name: 'Français'),
  'es': (code: 'ES', flag: '🇪🇸', name: 'Español'),
  'pt': (code: 'PT', flag: '🇧🇷', name: 'Português'),
  'it': (code: 'IT', flag: '🇮🇹', name: 'Italiano'),
  'nl': (code: 'NL', flag: '🇳🇱', name: 'Nederlands'),
  'pl': (code: 'PL', flag: '🇵🇱', name: 'Polski'),
  'tr': (code: 'TR', flag: '🇹🇷', name: 'Türkçe'),
  'zh': (code: 'ZH', flag: '🇨🇳', name: '中文'),
  'hi': (code: 'HI', flag: '🇮🇳', name: 'हिन्दी'),
};
