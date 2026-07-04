import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/analytics_service.dart';
import '../../shared/services/storage_service.dart';
import '../rewards/crayon_packs.dart';

class SettingsState {
  final String difficulty; // easy | medium | hard | extreme
  final String palette;    // classic | pastel | nature
  final int colorCount;    // 6 | 12 | 18 | 24 | 99 (max)
  final bool showNumbers;

  const SettingsState({
    this.difficulty = 'medium',
    this.palette = 'classic',
    this.colorCount = 12,
    this.showNumbers = false,
  });

  SettingsState copyWith({
    String? difficulty,
    String? palette,
    int? colorCount,
    bool? showNumbers,
  }) => SettingsState(
        difficulty: difficulty ?? this.difficulty,
        palette: palette ?? this.palette,
        colorCount: colorCount ?? this.colorCount,
        showNumbers: showNumbers ?? this.showNumbers,
      );
}

class SettingsNotifier extends AsyncNotifier<SettingsState> {
  static const _difficulties = ['easy', 'medium', 'hard', 'extreme'];
  // All known palettes (crayon packs), in catalogue order. cyclePalette only
  // offers the ones currently unlocked, passed in as `allowed`.
  static final _palettes = kPaletteOrder;
  static const _colorCounts = [6, 12, 18, 24, 99];

  @override
  Future<SettingsState> build() async {
    final diff = await StorageService.read(StorageService.kDifficulty) ?? 'medium';
    final pal = await StorageService.read(StorageService.kPalette) ?? 'classic';
    final cnt = await StorageService.readInt(StorageService.kColorCount, 12);
    final nums = await StorageService.readBool(StorageService.kShowNumbers, false);
    return SettingsState(
        difficulty: diff, palette: pal, colorCount: cnt, showNumbers: nums);
  }

  Future<void> cycleDifficulty(List<String> allowed) async {
    final s = state.valueOrNull;
    if (s == null) return;
    final available = _difficulties.where(allowed.contains).toList();
    if (available.isEmpty) return;
    final idx = available.indexOf(s.difficulty);
    final next = available[(idx + 1) % available.length];
    await StorageService.write(StorageService.kDifficulty, next);
    state = AsyncData(s.copyWith(difficulty: next));
    AnalyticsService.track('difficulty_changed', {'from': s.difficulty, 'to': next});
  }

  Future<void> cyclePalette(List<String> allowed) async {
    final s = state.valueOrNull;
    if (s == null) return;
    final available = _palettes.where(allowed.contains).toList();
    if (available.isEmpty) return;
    final idx = available.indexOf(s.palette);
    final next = available[(idx + 1) % available.length];
    await StorageService.write(StorageService.kPalette, next);
    state = AsyncData(s.copyWith(palette: next));
    AnalyticsService.track('palette_changed', {'from': s.palette, 'to': next});
  }

  Future<void> cycleColorCount(List<int> allowed) async {
    final s = state.valueOrNull;
    if (s == null) return;
    final available = _colorCounts.where(allowed.contains).toList();
    if (available.isEmpty) return;
    final idx = available.indexOf(s.colorCount);
    final next = available[(idx + 1) % available.length];
    await StorageService.writeInt(StorageService.kColorCount, next);
    state = AsyncData(s.copyWith(colorCount: next));
    AnalyticsService.track('color_count_changed', {'value': next});
  }

  Future<void> toggleNumbers() async {
    final s = state.valueOrNull;
    if (s == null) return;
    final next = !s.showNumbers;
    await StorageService.writeBool(StorageService.kShowNumbers, next);
    state = AsyncData(s.copyWith(showNumbers: next));
    AnalyticsService.track('numbers_toggled', {'enabled': next});
  }

  Future<void> setDifficulty(String d) async {
    final s = state.valueOrNull;
    if (s == null) return;
    await StorageService.write(StorageService.kDifficulty, d);
    state = AsyncData(s.copyWith(difficulty: d));
  }

  Future<void> setPalette(String p) async {
    final s = state.valueOrNull;
    if (s == null) return;
    await StorageService.write(StorageService.kPalette, p);
    state = AsyncData(s.copyWith(palette: p));
  }
}

final settingsProvider =
    AsyncNotifierProvider<SettingsNotifier, SettingsState>(SettingsNotifier.new);
