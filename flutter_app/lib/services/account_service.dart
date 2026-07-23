import 'package:flutter_riverpod/legacy.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import '../shared/services/device_id_service.dart';
import '../core/config/app_config.dart';
import '../core/di/providers.dart';

// ── Keys ─────────────────────────────────────────────────────────────────────
const _kAccess      = 'lalabuba_access_token';
const _kRefresh     = 'lalabuba_refresh_token';
const _kEmail       = 'lalabuba_account_email';
const _kAccount     = 'lalabuba_account_id';
const _kActiveChild = 'lalabuba_active_child_id';

// ── Models ────────────────────────────────────────────────────────────────────
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

class ChildProfile {
  final int id;
  final String nickname;
  final int avatarIndex;
  final String? ageGroup;
  final bool hasPin;

  const ChildProfile({
    required this.id,
    required this.nickname,
    this.avatarIndex = 0,
    this.ageGroup,
    this.hasPin = false,
  });

  factory ChildProfile.fromJson(Map<String, dynamic> j) => ChildProfile(
    id:          (j['id'] as num).toInt(),
    nickname:    j['nickname'] as String,
    avatarIndex: (j['avatar_index'] as num?)?.toInt() ?? 0,
    ageGroup:    j['age_group'] as String?,
    hasPin:      (j['access_pin_hash'] as String?)?.isNotEmpty ?? false,
  );
}

// ── State ─────────────────────────────────────────────────────────────────────
class AccountState {
  final bool isSignedIn;
  final String? email;
  final int? accountId;
  final String? accessToken;
  final List<DeviceProfile> devices;
  final List<ChildProfile> children;
  final int? activeChildId;
  final String? pendingOtpEmail; // set during OTP flow, cleared on verify

  const AccountState({
    this.isSignedIn = false,
    this.email,
    this.accountId,
    this.accessToken,
    this.devices = const [],
    this.children = const [],
    this.activeChildId,
    this.pendingOtpEmail,
  });

  ChildProfile? get activeChild =>
      children.where((c) => c.id == activeChildId).firstOrNull;

  AccountState copyWith({
    bool? isSignedIn,
    String? email,
    int? accountId,
    String? accessToken,
    List<DeviceProfile>? devices,
    List<ChildProfile>? children,
    Object? activeChildId = _sentinel,
    Object? pendingOtpEmail = _sentinel,
  }) => AccountState(
    isSignedIn:      isSignedIn      ?? this.isSignedIn,
    email:           email           ?? this.email,
    accountId:       accountId       ?? this.accountId,
    accessToken:     accessToken     ?? this.accessToken,
    devices:         devices         ?? this.devices,
    children:        children        ?? this.children,
    activeChildId:   activeChildId   == _sentinel
        ? this.activeChildId   : activeChildId as int?,
    pendingOtpEmail: pendingOtpEmail == _sentinel
        ? this.pendingOtpEmail : pendingOtpEmail as String?,
  );
}

const _sentinel = Object();

// ── Typed exception ───────────────────────────────────────────────────────────
class AccountException implements Exception {
  const AccountException(this.code);
  final String code; // RATE_LIMIT | EMAIL_FAILED | INVALID_CODE | EXPIRED | NETWORK | UNKNOWN
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

  Future<String> get _deviceId => DeviceIdService.getDeviceId();

  AccountException _fromDio(DioException e) {
    final t = e.type;
    if (t == DioExceptionType.connectionTimeout ||
        t == DioExceptionType.receiveTimeout ||
        t == DioExceptionType.connectionError) {
      return const AccountException('NETWORK');
    }
    final status = e.response?.statusCode;
    String serverCode = '';
    try {
      final data = e.response?.data;
      if (data is Map) serverCode = (data['code'] as String?) ?? '';
    } catch (_) {}
    if (status == 429 || serverCode == 'RATE_LIMIT') return const AccountException('RATE_LIMIT');
    if (status == 503 || serverCode == 'EMAIL_FAILED') return const AccountException('EMAIL_FAILED');
    if (serverCode == 'INVALID_CODE') return const AccountException('INVALID_CODE');
    if (serverCode == 'EXPIRED') return const AccountException('EXPIRED');
    return const AccountException('UNKNOWN');
  }

  Options get _authHeaders {
    final token = state.accessToken;
    if (token == null) return Options();
    return Options(headers: {'Authorization': 'Bearer $token'});
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  Future<void> init() async {
    final access    = await _storage.read(key: _kAccess);
    final refresh   = await _storage.read(key: _kRefresh);
    final email     = await _storage.read(key: _kEmail);
    final idStr     = await _storage.read(key: _kAccount);
    final childStr  = await _storage.read(key: _kActiveChild);

    if (access == null || email == null) return;

    state = AccountState(
      isSignedIn:    true,
      email:         email,
      accountId:     idStr != null ? int.tryParse(idStr) : null,
      accessToken:   access,
      activeChildId: childStr != null ? int.tryParse(childStr) : null,
    );

    if (refresh != null) _silentRefresh(refresh);
    fetchChildren();
  }

  // ── OTP auth flow (passwordless) ──────────────────────────────────────────
  Future<void> sendOtp(String email, String lang) async {
    try {
      await _dio.post('/api/auth/send-otp', data: {
        'email': email.trim().toLowerCase(),
        'lang':  lang,
      });
      state = state.copyWith(pendingOtpEmail: email.trim().toLowerCase());
    } on DioException catch (e) {
      throw _fromDio(e);
    }
  }

  Future<void> verifyOtp(String email, String code) async {
    try {
      final deviceUuid = await _deviceId;
      final res = await _dio.post('/api/auth/verify-email', data: {
        'email':      email.trim().toLowerCase(),
        'code':       code,
        'deviceUuid': deviceUuid,
      });
      final data = res.data as Map<String, dynamic>;
      await _persistTokens(
        accessToken:  data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
        email:        data['email'] as String,
        accountId:    (data['accountId'] as num).toInt(),
      );
      state = state.copyWith(pendingOtpEmail: null);
      await fetchChildren();
    } on DioException catch (e) {
      throw _fromDio(e);
    }
  }

  Future<void> resendOtp(String email, String lang) async {
    try {
      await _dio.post('/api/auth/resend-otp', data: {
        'email': email.trim().toLowerCase(),
        'lang':  lang,
      });
    } on DioException catch (e) {
      throw _fromDio(e);
    }
  }

  // ── Children ───────────────────────────────────────────────────────────────
  Future<void> fetchChildren() async {
    try {
      final res = await _dio.get('/api/auth/children', options: _authHeaders);
      final list = ((res.data as Map<String, dynamic>)['children'] as List? ?? [])
          .map((c) => ChildProfile.fromJson(c as Map<String, dynamic>))
          .toList();
      state = state.copyWith(children: list);
    } catch (_) {}
  }

  Future<ChildProfile> addChild(String nickname, int avatarIndex, String? ageGroup) async {
    final res = await _dio.post(
      '/api/auth/children',
      options: _authHeaders,
      data: {
        'nickname':    nickname,
        'avatarIndex': avatarIndex,
        if (ageGroup != null) 'ageGroup': ageGroup,
      },
    );
    final child = ChildProfile.fromJson(
        (res.data as Map<String, dynamic>)['child'] as Map<String, dynamic>);
    state = state.copyWith(children: [...state.children, child]);
    return child;
  }

  Future<void> setActiveChild(int? childId) async {
    if (childId != null) {
      await _storage.write(key: _kActiveChild, value: childId.toString());
    } else {
      await _storage.delete(key: _kActiveChild);
    }
    state = state.copyWith(activeChildId: childId);
  }

  // ── Fetch me ───────────────────────────────────────────────────────────────
  Future<void> fetchMe() async {
    try {
      final res = await _dio.get('/api/auth/me', options: _authHeaders);
      final data = res.data as Map<String, dynamic>;
      final devicesJson = (data['devices'] as List?) ?? [];
      final devices = devicesJson
          .map((d) => DeviceProfile.fromJson(d as Map<String, dynamic>))
          .toList();
      state = state.copyWith(devices: devices);
    } catch (_) {}
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  Future<void> logout() async {
    final refresh = await _storage.read(key: _kRefresh);
    try {
      await _dio.post('/api/auth/logout', data: {'refreshToken': refresh},
          options: _authHeaders);
    } catch (_) {}
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kEmail);
    await _storage.delete(key: _kAccount);
    await _storage.delete(key: _kActiveChild);
    state = const AccountState();
  }

  // ── Token persistence ──────────────────────────────────────────────────────
  Future<void> _persistTokens({
    required String accessToken,
    required String refreshToken,
    required String email,
    required int accountId,
  }) async {
    await _storage.write(key: _kAccess,  value: accessToken);
    await _storage.write(key: _kRefresh, value: refreshToken);
    await _storage.write(key: _kEmail,   value: email);
    await _storage.write(key: _kAccount, value: accountId.toString());
    state = state.copyWith(
      isSignedIn:  true,
      email:       email,
      accountId:   accountId,
      accessToken: accessToken,
    );
  }

  Future<void> _silentRefresh(String refreshToken) async {
    try {
      final res = await _dio.post('/api/auth/refresh',
          data: {'refreshToken': refreshToken});
      if (res.statusCode == 200) {
        final data = res.data as Map<String, dynamic>;
        await _persistTokens(
          accessToken:  data['accessToken'] as String,
          refreshToken: data['refreshToken'] as String,
          email:        state.email!,
          accountId:    state.accountId ?? 0,
        );
      }
    } catch (_) {}
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
final accountProvider = StateNotifierProvider<AccountNotifier, AccountState>((ref) {
  final config = ref.watch(appConfigProvider).value;
  if (config == null) throw StateError('AppConfig not loaded');
  return AccountNotifier(const FlutterSecureStorage(), config);
});
