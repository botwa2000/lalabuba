import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StorageService {
  static const _storage = FlutterSecureStorage();

  // Keys
  static const kDifficulty = 'setting_difficulty';
  static const kPalette = 'setting_palette';
  static const kColorCount = 'setting_color_count';
  static const kShowNumbers = 'setting_show_numbers';
  static const kThemeMode = 'setting_theme_mode';
  static const kLocale = 'lalabuba_lang';
  static const kDeviceId = 'device_id';
  static const kDailyCount = 'daily_gen_count';
  static const kDailyDate = 'daily_gen_date';
  // Tutorial / onboarding "seen" flags (coach-marks auto-run once each).
  static const kTutorialHome = 'tutorial_home_seen';
  static const kTutorialCanvas = 'tutorial_canvas_seen';

  static Future<String?> read(String key) => _storage.read(key: key);
  static Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);
  static Future<void> delete(String key) => _storage.delete(key: key);

  static Future<int> readInt(String key, int defaultVal) async {
    final s = await _storage.read(key: key);
    return s == null ? defaultVal : (int.tryParse(s) ?? defaultVal);
  }

  static Future<void> writeInt(String key, int value) =>
      _storage.write(key: key, value: value.toString());

  static Future<bool> readBool(String key, bool defaultVal) async {
    final s = await _storage.read(key: key);
    if (s == null) return defaultVal;
    return s == 'true';
  }

  static Future<void> writeBool(String key, bool value) =>
      _storage.write(key: key, value: value.toString());
}
