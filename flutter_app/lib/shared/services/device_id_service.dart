import 'dart:math';
import 'storage_service.dart';

class DeviceIdService {
  static String? _cachedId;

  static Future<String> getDeviceId() async {
    if (_cachedId != null) return _cachedId!;
    // FlutterSecureStorage accesses the Android Keystore which can hang on
    // emulators (Keystore init is slow/broken in SLIRP). Time out after 2s
    // and fall back to a session UUID so generation is never blocked.
    String? id;
    try {
      id = await StorageService.read(StorageService.kDeviceId)
          .timeout(const Duration(seconds: 2));
    } catch (_) {
      // Keystore timeout or error — use in-memory fallback for this session.
    }
    if (id == null) {
      id = _generateUuid();
      // Best-effort persist; ignore if Keystore is still unavailable.
      StorageService.write(StorageService.kDeviceId, id).ignore();
    }
    _cachedId = id;
    return id;
  }

  static String _generateUuid() {
    final rng = Random.secure();
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int b) => b.toRadixString(16).padLeft(2, '0');
    return '${hex(bytes[0])}${hex(bytes[1])}${hex(bytes[2])}${hex(bytes[3])}-'
        '${hex(bytes[4])}${hex(bytes[5])}-'
        '${hex(bytes[6])}${hex(bytes[7])}-'
        '${hex(bytes[8])}${hex(bytes[9])}-'
        '${hex(bytes[10])}${hex(bytes[11])}${hex(bytes[12])}${hex(bytes[13])}${hex(bytes[14])}${hex(bytes[15])}';
  }
}
