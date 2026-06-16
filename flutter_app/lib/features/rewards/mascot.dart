import 'dart:convert';
import 'dart:ui' show Offset;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/storage_service.dart';

/// Local-only mascot decoration: which earned stickers the child has placed on
/// the penguin, and where (normalized 0..1 within the stage). Persisted as
/// `{ "<badgeId>": [x, y] }`.
class MascotNotifier extends AsyncNotifier<Map<String, Offset>> {
  static const _key = 'mascot_decor_v1';

  @override
  Future<Map<String, Offset>> build() async {
    final raw = await StorageService.read(_key);
    if (raw == null || raw.isEmpty) return {};
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return j.map((k, v) {
        final l = (v as List).map((e) => (e as num).toDouble()).toList();
        return MapEntry(k, Offset(l[0], l[1]));
      });
    } catch (_) {
      return {};
    }
  }

  Future<void> _persist(Map<String, Offset> m) async {
    await StorageService.write(
      _key,
      jsonEncode(m.map((k, v) => MapEntry(k, [v.dx, v.dy]))),
    );
  }

  /// Add the sticker (centered-ish) if absent, else remove it.
  void toggle(String id) {
    final m = Map<String, Offset>.from(state.valueOrNull ?? {});
    if (m.containsKey(id)) {
      m.remove(id);
    } else {
      // Stagger new stickers a little so they don't stack exactly.
      final n = m.length;
      final dx = 0.30 + (n % 3) * 0.18;
      final dy = 0.22 + ((n ~/ 3) % 3) * 0.20;
      m[id] = Offset(dx.clamp(0.05, 0.95), dy.clamp(0.05, 0.95));
    }
    state = AsyncData(m);
    _persist(m);
  }

  /// Update a placed sticker's position live during a drag (no write).
  void setLocal(String id, Offset normalized) {
    final m = Map<String, Offset>.from(state.valueOrNull ?? {});
    if (!m.containsKey(id)) return;
    m[id] = Offset(
      normalized.dx.clamp(0.04, 0.96),
      normalized.dy.clamp(0.04, 0.96),
    );
    state = AsyncData(m);
  }

  /// Persist after a drag ends.
  Future<void> commit() => _persist(state.valueOrNull ?? {});

  void clear() {
    state = const AsyncData({});
    _persist({});
  }
}

final mascotProvider =
    AsyncNotifierProvider<MascotNotifier, Map<String, Offset>>(
        MascotNotifier.new);
