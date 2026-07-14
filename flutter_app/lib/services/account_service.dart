import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import '../shared/services/device_id_service.dart';
import '../core/config/app_config.dart';
import '../core/di/providers.dart';

// ── Keys ─────────────────────────────────────────────────────────────────────
const _kAccess   = 'lalabuba_access_token';
const _kRefresh  = 'lalabuba_refresh_token';
const _kEmail    = 'lalabuba_account_email';
const _kAccount  = 'lalabuba_account_id';

// ── Model ─────────────────────────────────────────────────────────────────────
class AccountState {
  final bool isSignedIn;
  final String? email;
  final int? accountId;
  final String? accessToken;
  final List<DeviceProfile> devices;

  const AccountState({
    this.isSignedIn = false,
    this.email,
    this.accountId,
    this.accessToken,
    this.devices = const [],
  });

  AccountState copyWith({
    bool? isSignedIn,
    String? email,
    int? accountId,
    String? accessToken,
    List<DeviceProfile>? devices,
  }) => AccountState(
    isSignedIn:  isSignedIn  ?? this.isSignedIn,
    email:       email       ?? this.email,
    accountId:   accountId   ?? this.accountId,
    accessToken: accessToken ?? this.accessToken,
    devices:     devices     ?? this.devices,
  );
}

class DeviceProfile {
  final String deviceUuid;
  final String? nickname;
  final int avatarIndex;
  final int totalCompleted;
  final int currentStreak;
  final bool sharingEnabled;

  const DeviceProfile({
    required this.deviceUuid,
    this.nickname,
    this.avatarIndex = 0,
    this.totalCompleted = 0,
    this.currentStreak = 0,
    this.sharingEnabled = false,
  });

  factory DeviceProfile.fromJson(Map<String, dynamic> j) => DeviceProfile(
    deviceUuid:     j['deviceUuid'] as String,
    nickname:       j['nickname'] as String?,
    avatarIndex:    (j['avatarIndex'] as num?)?.toInt() ?? 0,
    totalCompleted: (j['totalCompleted'] as num?)?.toInt() ?? 0,
    currentStreak:  (j['currentStreak'] as num?)?.toInt() ?? 0,
    sharingEnabled: (j['sharingEnabled'] as bool?) ?? false,
  );
}

// ── Notifier ──────────────────────────────────────────────────────────────────
class AccountNotifier extends StateNotifier<AccountState> {
  AccountNotifier(this._storage, AppConfig config)
    : _dio = Dio(BaseOptions(
        baseUrl: config.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
      )),
      super(const AccountState());

  final FlutterSecureStorage _storage;
  final Dio _dio;

  // Fetched lazily per-call — same pattern as CommunityService.
  Future<String> get _deviceId => DeviceIdService.getDeviceId();

  // Call once at app startup.
  Future<void> init() async {
    final access  = await _storage.read(key: _kAccess);
    final refresh = await _storage.read(key: _kRefresh);
    final email   = await _storage.read(key: _kEmail);
    final idStr   = await _storage.read(key: _kAccount);

    if (access == null || email == null) return;

    state = AccountState(
      isSignedIn:  true,
      email:       email,
      accountId:   idStr != null ? int.tryParse(idStr) : null,
      accessToken: access,
    );

    // Silently refresh in background.
    if (refresh != null) {
      _silentRefresh(refresh);
    }
  }

  Future<void> _silentRefresh(String refreshToken) async {
    try {
      final res = await _dio.post(
        '/api/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      if (res.statusCode == 200) {
        final data = res.data as Map<String, dynamic>;
        await _persistTokens(
          accessToken:  data['accessToken'] as String,
          refreshToken: data['refreshToken'] as String,
          email:        state.email!,
          accountId:    state.accountId ?? 0,
        );
      }
    } catch (_) {
      // Ignore silent refresh errors — user stays signed in with old token.
    }
  }

  Future<void> register(String email, String password) async {
    final deviceUuid = await _deviceId;
    final res = await _dio.post(
      '/api/auth/register',
      data: {
        'email':      email.trim().toLowerCase(),
        'password':   password,
        'deviceUuid': deviceUuid,
      },
    );
    final data = res.data as Map<String, dynamic>;
    await _persistTokens(
      accessToken:  data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      email:        data['email'] as String,
      accountId:    (data['accountId'] as num).toInt(),
    );
  }

  Future<void> login(String email, String password) async {
    final deviceUuid = await _deviceId;
    final res = await _dio.post(
      '/api/auth/login',
      data: {
        'email':      email.trim().toLowerCase(),
        'password':   password,
        'deviceUuid': deviceUuid,
      },
    );
    final data = res.data as Map<String, dynamic>;
    await _persistTokens(
      accessToken:  data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      email:        data['email'] as String,
      accountId:    (data['accountId'] as num).toInt(),
    );
    await fetchMe();
  }

  Future<void> fetchMe() async {
    try {
      final token = state.accessToken;
      if (token == null) return;
      final res = await _dio.get(
        '/api/auth/me',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      final data = res.data as Map<String, dynamic>;
      final devicesJson = (data['devices'] as List?) ?? [];
      final devices = devicesJson
          .map((d) => DeviceProfile.fromJson(d as Map<String, dynamic>))
          .toList();
      state = state.copyWith(devices: devices);
    } catch (_) {
      // Non-fatal: profile data just won't refresh.
    }
  }

  Future<void> logout() async {
    final refresh = await _storage.read(key: _kRefresh);
    final token   = state.accessToken;
    try {
      await _dio.post(
        '/api/auth/logout',
        data: {'refreshToken': refresh},
        options: token != null
            ? Options(headers: {'Authorization': 'Bearer $token'})
            : null,
      );
    } catch (_) {}

    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kEmail);
    await _storage.delete(key: _kAccount);
    state = const AccountState();
  }

  Future<void> _persistTokens({
    required String accessToken,
    required String refreshToken,
    required String email,
    required int accountId,
  }) async {
    await _storage.write(key: _kAccess,   value: accessToken);
    await _storage.write(key: _kRefresh,  value: refreshToken);
    await _storage.write(key: _kEmail,    value: email);
    await _storage.write(key: _kAccount,  value: accountId.toString());
    state = state.copyWith(
      isSignedIn:  true,
      email:       email,
      accountId:   accountId,
      accessToken: accessToken,
    );
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
final accountProvider = StateNotifierProvider<AccountNotifier, AccountState>((ref) {
  final config = ref.watch(appConfigProvider).valueOrNull;
  if (config == null) throw StateError('AppConfig not loaded');
  return AccountNotifier(const FlutterSecureStorage(), config);
});
