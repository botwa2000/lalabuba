import 'dart:developer';
import 'package:dio/dio.dart';
import 'drawing_config.dart';

/// Singleton that holds the active [DrawingConfig].
///
/// Call [DrawingConfigService.initialize] once at startup (before [runApp]).
/// On success the fetched config replaces the hard-coded defaults; on any
/// network/parse error the defaults are kept and a warning is logged.
///
/// Read the live config anywhere via [DrawingConfigService.instance].
class DrawingConfigService {
  DrawingConfigService._();

  static DrawingConfig _config = DrawingConfig.defaults;

  /// The current drawing configuration (defaults until [initialize] resolves).
  static DrawingConfig get instance => _config;

  /// Fetch `/api/drawing-config` from [baseUrl] and populate [instance].
  ///
  /// Safe to call with any [baseUrl] — network failures keep the defaults.
  static Future<void> initialize(String baseUrl) async {
    try {
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
      ));
      final url = '${baseUrl.replaceFirst(RegExp(r'/$'), '')}/api/drawing-config';
      final response = await dio.get<Map<String, dynamic>>(url);
      final data = response.data;
      if (data is Map<String, dynamic>) {
        _config = DrawingConfig.fromJson(data);
      }
    } catch (e) {
      log(
        'DrawingConfigService: failed to fetch config, using defaults. Error: $e',
        name: 'DrawingConfigService',
      );
    }
  }
}
