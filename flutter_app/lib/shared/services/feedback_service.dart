import 'package:dio/dio.dart';

import 'device_id_service.dart';
import 'usage_service.dart';

/// Ratings → `POST /api/feedback` on our own server (shown on /admin/stats).
///   * [ratePicture] — the child's 😕/🙂/😍 (1..3) for one coloring page.
///   * [rateSite] — a grown-up's 1..5 ★ rating of Lalabuba + optional comment.
/// Sent with the same anonymous install ID and headers as [UsageService].
class FeedbackService {
  FeedbackService._();

  static Dio? _dio;

  static Dio get _client => _dio ??= Dio(BaseOptions(
        baseUrl: UsageService.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        sendTimeout: const Duration(seconds: 10),
      ));

  static Future<void> _post(Map<String, Object?> body) async {
    final deviceId = await DeviceIdService.getDeviceId();
    await _client.post('/api/feedback',
        data: {
          ...body,
          'iid': deviceId,
          'lang': UsageService.lang,
        },
        options: Options(headers: {
          ...UsageService.clientHeaders,
          'X-Device-ID': deviceId,
          'Content-Type': 'application/json',
        }));
  }

  /// Fire-and-forget: a lost picture rating must never bother the child.
  static Future<void> ratePicture(
      {required String imageUrl, required int rating}) async {
    try {
      await _post({'kind': 'picture', 'rating': rating, 'image': imageUrl});
    } catch (_) {}
  }

  /// Throws on failure so the form can tell the grown-up to retry.
  static Future<void> rateSite({required int rating, String? comment}) =>
      _post({
        'kind': 'site',
        'rating': rating,
        if (comment != null && comment.trim().isNotEmpty)
          'comment': comment.trim(),
      });
}
