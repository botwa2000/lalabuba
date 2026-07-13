import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/config/app_config.dart';
import '../../core/di/providers.dart';
import '../../shared/services/device_id_service.dart';
import 'models/artwork_model.dart';
import 'models/profile_model.dart';
import 'models/leaderboard_model.dart';
import 'models/family_model.dart';

class CommunityService {
  final Dio _dio;
  static const String _appApiKey = String.fromEnvironment('APP_API_KEY');

  CommunityService(AppConfig config)
      : _dio = Dio(BaseOptions(
          baseUrl: config.apiBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
        ));

  Future<Map<String, String>> _headers({bool withConsent = false}) async {
    final id = await DeviceIdService.getDeviceId();
    return {
      'Content-Type': 'application/json',
      'X-Device-ID': id,
      if (_appApiKey.isNotEmpty) 'X-App-Key': _appApiKey,
      if (withConsent) 'X-Parental-Consent': 'yes',
    };
  }

  Future<Map<String, dynamic>> getConfig() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/community/config');
    return r.data ?? {};
  }

  Future<({List<String> nicknames, List<String> avatars})> getNicknames() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/community/nicknames');
    final d = r.data ?? {};
    return (
      nicknames: (d['nicknames'] as List<dynamic>? ?? []).cast<String>(),
      avatars: (d['avatars'] as List<dynamic>? ?? []).cast<String>(),
    );
  }

  Future<CommunityProfile> getProfile() async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/community/profile',
      options: Options(headers: await _headers()),
    );
    return CommunityProfile.fromJson(r.data ?? {});
  }

  Future<CommunityProfile> setupProfile({
    String? nickname,
    int? avatarIndex,
    bool withParentalConsent = false,
  }) async {
    final body = <String, dynamic>{};
    if (nickname != null) body['nickname'] = nickname;
    if (avatarIndex != null) body['avatarIndex'] = avatarIndex;

    final r = await _dio.post<Map<String, dynamic>>(
      '/api/community/profile',
      data: body,
      options: Options(headers: await _headers(withConsent: withParentalConsent)),
    );
    return CommunityProfile.fromJson(r.data ?? {});
  }

  Future<({List<CommunityArtwork> artworks, int? nextPage})> getGallery({
    int page = 0,
    String? type,
    String? difficulty,
  }) async {
    final params = <String, dynamic>{'page': page};
    if (type != null && type != 'all') params['type'] = type;
    if (difficulty != null) params['difficulty'] = difficulty;

    final r = await _dio.get<Map<String, dynamic>>(
      '/api/community/gallery',
      queryParameters: params,
    );
    final d = r.data ?? {};
    final artworks = (d['artworks'] as List<dynamic>? ?? [])
        .map((e) => CommunityArtwork.fromJson(e as Map<String, dynamic>))
        .toList();
    final nextPage = d['nextPage'] == null ? null : (d['nextPage'] as num).toInt();
    return (artworks: artworks, nextPage: nextPage);
  }

  /// Upload an artwork image (JPEG bytes from toImage()).
  Future<({int id, String imageUrl})> shareArtwork({
    required String shareType,
    required String? subject,
    required String? difficulty,
    required int? seed,
    required Uint8List jpegBytes,
    required bool withParentalConsent,
  }) async {
    final b64 = base64Encode(jpegBytes);
    final r = await _dio.post<Map<String, dynamic>>(
      '/api/community/artwork',
      data: {
        'shareType': shareType,
        'subject': subject ?? '',
        'difficulty': difficulty ?? 'medium',
        if (seed != null) 'seed': seed,
        'imageData': 'data:image/jpeg;base64,$b64',
      },
      options: Options(
        headers: await _headers(withConsent: withParentalConsent),
        // 900KB image ~1.2MB base64 in JSON — allow up to 2MB response time
        receiveTimeout: const Duration(seconds: 60),
      ),
    );
    final d = r.data ?? {};
    return (
      id: (d['id'] as num).toInt(),
      imageUrl: d['imageUrl'] as String,
    );
  }

  Future<({bool starred, int starCount})> toggleStar(int artworkId) async {
    final r = await _dio.post<Map<String, dynamic>>(
      '/api/community/star/$artworkId',
      options: Options(headers: await _headers()),
    );
    final d = r.data ?? {};
    return (
      starred: d['starred'] as bool? ?? false,
      starCount: (d['starCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<void> reportArtwork(int artworkId) async {
    await _dio.post<Map<String, dynamic>>(
      '/api/community/report/$artworkId',
      options: Options(headers: await _headers()),
    );
  }

  Future<void> deleteArtwork(int artworkId) async {
    await _dio.delete<Map<String, dynamic>>(
      '/api/community/artwork/$artworkId',
      options: Options(headers: await _headers()),
    );
  }

  Future<Leaderboard> getLeaderboard({String type = 'weekly'}) async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/community/leaderboard',
      queryParameters: {'type': type},
    );
    return Leaderboard.fromJson(r.data ?? {});
  }

  Future<void> syncProgress({
    required int totalCompleted,
    required int currentStreak,
    required int longestStreak,
    required String? lastActiveDate,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      '/api/community/progress',
      data: {
        'totalCompleted': totalCompleted,
        'currentStreak': currentStreak,
        'longestStreak': longestStreak,
        if (lastActiveDate != null) 'lastActiveDate': lastActiveDate,
      },
      options: Options(headers: await _headers()),
    );
  }

  Future<FamilyData?> getFamily() async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/community/family',
      options: Options(headers: await _headers()),
    );
    if (r.data?['inFamily'] != true) return null;
    return FamilyData.fromJson(r.data ?? {});
  }

  Future<({String familyCode, int familyId})> createFamily() async {
    final r = await _dio.post<Map<String, dynamic>>(
      '/api/community/family',
      data: {'action': 'create'},
      options: Options(headers: await _headers(withConsent: true)),
    );
    final d = r.data ?? {};
    return (
      familyCode: d['familyCode'] as String,
      familyId: (d['familyId'] as num).toInt(),
    );
  }

  Future<void> joinFamily(String code) async {
    await _dio.post<Map<String, dynamic>>(
      '/api/community/family',
      data: {'action': 'join', 'familyCode': code},
      options: Options(headers: await _headers(withConsent: true)),
    );
  }

  Future<void> leaveFamily() async {
    await _dio.post<Map<String, dynamic>>(
      '/api/community/family',
      data: {'action': 'leave'},
      options: Options(headers: await _headers()),
    );
  }
}

final communityServiceProvider = Provider<CommunityService>((ref) {
  final config = ref.watch(appConfigProvider).valueOrNull;
  if (config == null) throw StateError('AppConfig not loaded');
  return CommunityService(config);
});
