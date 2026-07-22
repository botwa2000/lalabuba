import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/storage_service.dart';
import '../progress/progress_service.dart';

/// A rotating "today's mission" that nudges daily return and exploration.
///
/// Completion is measured as a DELTA from a baseline snapshot taken when the
/// mission is assigned (the first time it's read each day): done once
/// `metric(now) - metric(baseline) >= amount`. We only use counters that
/// strictly increase (never a cumulative Set), so completion is detectable
/// regardless of history and survives app restarts. Title text resolves via the
/// l10n key `mission<CapId>Text`.
class MissionDef {
  final String id;
  final String emoji;
  final int amount;
  final int Function(Progress p) metric;
  const MissionDef(this.id, this.emoji, this.amount, this.metric);
}

int _mTotal(Progress p) => p.totalCompleted;
int _mHard(Progress p) => p.hardCompleted;
int _mOwnIdea(Progress p) => p.freeTextCreations;
int _mShare(Progress p) => p.shares;
int _mSave(Progress p) => p.saves;
int _mDaily(Progress p) => p.dailyWordsCompleted;

const kMissions = <MissionDef>[
  MissionDef('colorAny', '🎨', 1, _mTotal),
  MissionDef('colorTwo', '✌️', 2, _mTotal),
  MissionDef('hard', '💪', 1, _mHard),
  MissionDef('ownIdea', '✍️', 1, _mOwnIdea),
  MissionDef('share', '📤', 1, _mShare),
  MissionDef('save', '💾', 1, _mSave),
  MissionDef('daily', '📅', 1, _mDaily),
];

String _todayKey() {
  final n = DateTime.now();
  return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
}

int _dayOfYear() {
  final n = DateTime.now();
  return n.difference(DateTime(n.year, 1, 1)).inDays;
}

/// Today's assigned mission + the progress baseline captured when it was set.
class MissionState {
  final MissionDef def;
  final Progress baseline;
  const MissionState({required this.def, required this.baseline});

  /// Progress toward the goal, clamped to [0, amount].
  int progressCount(Progress now) {
    final d = def.metric(now) - def.metric(baseline);
    return d < 0 ? 0 : (d > def.amount ? def.amount : d);
  }

  bool isDone(Progress now) => progressCount(now) >= def.amount;
}

class MissionNotifier extends AsyncNotifier<MissionState> {
  static const _key = 'daily_mission_v1';

  @override
  Future<MissionState> build() async {
    // Ensure progress is loaded first — the baseline is a snapshot of it.
    final progress = await ref.watch(progressProvider.future);
    final today = _todayKey();

    final raw = await StorageService.read(_key);
    if (raw != null && raw.isNotEmpty) {
      try {
        final j = jsonDecode(raw) as Map<String, dynamic>;
        if (j['date'] == today) {
          final def = kMissions.firstWhere((m) => m.id == j['id'],
              orElse: () => kMissions.first);
          final baseline =
              Progress.fromJson(j['baseline'] as Map<String, dynamic>);
          return MissionState(def: def, baseline: baseline);
        }
      } catch (_) {
        // fall through to assign a fresh mission
      }
    }

    // Assign today's mission deterministically and snapshot the baseline now.
    final def = kMissions[_dayOfYear() % kMissions.length];
    final state = MissionState(def: def, baseline: progress);
    await StorageService.write(
      _key,
      jsonEncode({
        'date': today,
        'id': def.id,
        'baseline': progress.toJson(),
      }),
    );
    return state;
  }
}

final missionProvider =
    AsyncNotifierProvider<MissionNotifier, MissionState>(MissionNotifier.new);
