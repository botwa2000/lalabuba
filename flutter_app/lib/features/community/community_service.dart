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
    bool daily = false,
    bool theme = false,
  }) async {
    final params = <String, dynamic>{'page': page};
    if (daily) {
      params['daily'] = '1';
    } else if (theme) {
      params['theme'] = '1';
    } else if (type != null && type != 'all') {
      params['type'] = type;
    }
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
    int? parentArtworkId,
  }) async {
    final b64 = base64Encode(jpegBytes);
    final data = <String, dynamic>{
      'shareType': shareType,
      'subject': subject ?? '',
      'difficulty': difficulty ?? 'medium',
      if (seed != null) 'seed': seed,
      'imageData': 'data:image/jpeg;base64,$b64',
      if (parentArtworkId != null) 'parentArtworkId': parentArtworkId,
    };
    final r = await _dio.post<Map<String, dynamic>>(
      '/api/community/artwork',
      data: data,
      options: Options(
        headers: await _headers(withConsent: withParentalConsent),
        receiveTimeout: const Duration(seconds: 60),
      ),
    );
    final d = r.data ?? {};
    return (
      id: int.tryParse(d['id'].toString()) ?? 0,
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

  /// React to an artwork with an emoji. Returns updated counts.
  Future<({bool reacted, String? reaction, int fireCount, int heartCount, int laughCount, int celebrateCount, int totalCount})>
      react(int artworkId, String reaction) async {
    final r = await _dio.post<Map<String, dynamic>>(
      '/api/community/react/$artworkId',
      data: {'reaction': reaction},
      options: Options(headers: await _headers()),
    );
    final d = r.data ?? {};
    return (
      reacted: d['reacted'] as bool? ?? false,
      reaction: d['reaction'] as String?,
      fireCount: (d['fireCount'] as num?)?.toInt() ?? 0,
      heartCount: (d['heartCount'] as num?)?.toInt() ?? 0,
      laughCount: (d['laughCount'] as num?)?.toInt() ?? 0,
      celebrateCount: (d['celebrateCount'] as num?)?.toInt() ?? 0,
      totalCount: (d['totalCount'] as num?)?.toInt() ?? 0,
    );
  }

  /// Get new reactions on user's artworks since last check.
  Future<({int newReactions, List<Map<String, dynamic>> details})> getNotifications() async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/community/notifications',
      options: Options(headers: await _headers()),
    );
    final d = r.data ?? {};
    return (
      newReactions: (d['newReactions'] as num?)?.toInt() ?? 0,
      details: (d['details'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
    );
  }

  /// Get colorings of a template artwork.
  Future<({List<CommunityArtwork> variations, int recolorCount, int? nextPage})>
      getVariations(int artworkId, {int page = 0}) async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/community/artwork/$artworkId/variations',
      queryParameters: {'page': page},
    );
    final d = r.data ?? {};
    final items = (d['variations'] as List<dynamic>? ?? [])
        .map((e) => CommunityArtwork.fromJson(e as Map<String, dynamic>))
        .toList();
    return (
      variations: items,
      recolorCount: (d['recolorCount'] as num?)?.toInt() ?? 0,
      nextPage: d['nextPage'] == null ? null : (d['nextPage'] as num).toInt(),
    );
  }

  /// Get current weekly theme (if active).
  Future<({bool active, String? themeWord, String? themeEmoji})> getWeeklyTheme() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/community/weekly-theme');
    final d = r.data ?? {};
    return (
      active: d['active'] as bool? ?? false,
      themeWord: d['themeWord'] as String?,
      themeEmoji: d['themeEmoji'] as String?,
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
    required int totalGenerated,
    required int currentStreak,
    required int longestStreak,
    required String? lastActiveDate,
    int daysColored = 0,
    int easyCompleted = 0,
    int mediumCompleted = 0,
    int hardCompleted = 0,
    int extremeCompleted = 0,
    int drawPenUses = 0,
    int saves = 0,
    int shares = 0,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      '/api/community/progress',
      data: {
        'totalCompleted':  totalCompleted,
        'totalGenerated':  totalGenerated,
        'currentStreak':   currentStreak,
        'longestStreak':   longestStreak,
        'daysColored':     daysColored,
        'easyCompleted':   easyCompleted,
        'mediumCompleted': mediumCompleted,
        'hardCompleted':   hardCompleted,
        'extremeCompleted': extremeCompleted,
        'drawPenUses':     drawPenUses,
        'saves':           saves,
        'shares':          shares,
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
  final config = ref.watch(appConfigProvider).value;
  if (config == null) throw StateError('AppConfig not loaded');
  return CommunityService(config);
});
