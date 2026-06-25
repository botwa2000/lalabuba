import 'dart:math';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/config/app_config.dart';
import '../../core/di/providers.dart';
import '../../shared/services/device_id_service.dart';
import 'generate_models.dart';

class GenerateService {
  final Dio _dio;

  // Optional shared key gating the native API path. Injected at build time via
  // --dart-define=APP_API_KEY=... and matched server-side against APP_API_KEY.
  // Empty by default, so the X-App-Key header is simply omitted until both
  // sides are configured (the server gate is inactive when its env is unset).
  static const String _appApiKey = String.fromEnvironment('APP_API_KEY');

  GenerateService(AppConfig config)
      : _dio = Dio(BaseOptions(
          baseUrl: config.generateUrl.replaceFirst('/api/generate-image', ''),
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: Duration(seconds: config.timeoutSeconds + 30),
          responseType: ResponseType.bytes,
        ));

  Future<GenerationResult> generate({
    required String subject,
    required String difficulty,
    required int colorCount,
    int? seed,
  }) async {
    final deviceId = await DeviceIdService.getDeviceId();
    final effectiveSeed = seed ?? _newSeed();
    const width = 768;
    const height = 768;
    // Wall-clock guard: Dio receiveTimeout only fires after the first byte
    // arrives, so a server that hangs before sending headers can block forever.
    // This Future.timeout wraps the ENTIRE request including server wait time.
    const totalTimeout = Duration(seconds: 120);

    final req = GenerationRequest(
      subject: subject,
      difficulty: difficulty,
      width: width,
      height: height,
      seed: effectiveSeed,
      deviceId: deviceId,
    );

    try {
      final response = await _dio.post(
        '/api/generate-image',
        data: req.toJson(),
        options: Options(
          headers: {
            'Content-Type': 'application/json',
            'X-Device-ID': deviceId,
            if (_appApiKey.isNotEmpty) 'X-App-Key': _appApiKey,
          },
        ),
      ).timeout(totalTimeout, onTimeout: () => throw DioException(
        requestOptions: RequestOptions(path: '/api/generate-image'),
        type: DioExceptionType.receiveTimeout,
      ));

      final bytes = response.data as Uint8List;
      final returnedSeed =
          int.tryParse(response.headers.value('x-image-seed') ?? '') ??
              effectiveSeed;
      final blobUrl = response.headers.value('x-image-url');

      return GenerationResult(
        imageBytes: bytes,
        seed: returnedSeed,
        subject: subject,
        blobUrl: blobUrl,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  int _newSeed() => Random().nextInt(2147483647);

  String _mapError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Drawing took too long — please try again';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'No internet connection — please check your network';
    }
    final status = e.response?.statusCode;
    if (status == 400) return 'Please choose a fun topic for kids — animals, vehicles, fantasy creatures, food…';
    if (status == 403) return 'Request blocked — please update the app and try again';
    if (status == 429) return 'Too many requests — please wait a moment and try again';
    return 'Something went wrong — please try again${status != null ? ' (HTTP $status)' : ''}';
  }
}

final generateServiceProvider = Provider<GenerateService>((ref) {
  final config = ref.watch(appConfigProvider).valueOrNull;
  if (config == null) throw StateError('AppConfig not loaded');
  return GenerateService(config);
});
