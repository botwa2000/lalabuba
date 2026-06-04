import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/storage_service.dart';
import 'subscription_models.dart';

class SubscriptionState {
  final SubscriptionTier tier;
  final Entitlements entitlements;
  final int dailyUsed;
  final String todayKey;

  const SubscriptionState({
    required this.tier,
    required this.entitlements,
    required this.dailyUsed,
    required this.todayKey,
  });

  bool get canGenerate =>
      entitlements.isUnlimited || dailyUsed < entitlements.dailyGenerations;

  int get remainingToday =>
      entitlements.isUnlimited ? 99 : entitlements.dailyGenerations - dailyUsed;

  SubscriptionState copyWith({int? dailyUsed}) => SubscriptionState(
        tier: tier,
        entitlements: entitlements,
        dailyUsed: dailyUsed ?? this.dailyUsed,
        todayKey: todayKey,
      );
}

class SubscriptionNotifier extends AsyncNotifier<SubscriptionState> {
  @override
  Future<SubscriptionState> build() async {
    const tier = SubscriptionTier.free;
    const ents = Entitlements.free;
    final todayKey = _todayKey();
    final savedDate = await StorageService.read(StorageService.kDailyDate);
    int used = 0;
    if (savedDate == todayKey) {
      used = await StorageService.readInt(StorageService.kDailyCount, 0);
    } else {
      await StorageService.write(StorageService.kDailyDate, todayKey);
      await StorageService.writeInt(StorageService.kDailyCount, 0);
    }
    return SubscriptionState(
        tier: tier, entitlements: ents, dailyUsed: used, todayKey: todayKey);
  }

  Future<void> recordGeneration() async {
    final s = state.valueOrNull;
    if (s == null) return;
    final newUsed = s.dailyUsed + 1;
    await StorageService.writeInt(StorageService.kDailyCount, newUsed);
    state = AsyncData(s.copyWith(dailyUsed: newUsed));
  }

  static String _todayKey() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }
}

final subscriptionProvider =
    AsyncNotifierProvider<SubscriptionNotifier, SubscriptionState>(
        SubscriptionNotifier.new);
