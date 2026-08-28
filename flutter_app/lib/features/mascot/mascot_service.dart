import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/storage_service.dart';
import 'mascot.dart';

// ── Storage keys ──────────────────────────────────────────────────────────────
const _kSelected = 'mascot_selected';
String _kHat(String id)   => 'mascot_${id}_hat';
String _kAcc(String id)   => 'mascot_${id}_acc';
String _kExp(String id)   => 'mascot_${id}_exp';
String _kHatXf(String id) => 'mascot_${id}_hat_xf';
String _kAccXf(String id) => 'mascot_${id}_acc_xf';
String _kExpXf(String id) => 'mascot_${id}_exp_xf';

// ── Provider ──────────────────────────────────────────────────────────────────
final mascotProvider =
    AsyncNotifierProvider<MascotNotifier, MascotState>(MascotNotifier.new);

class MascotNotifier extends AsyncNotifier<MascotState> {
  @override
  Future<MascotState> build() async {
    final selected = await StorageService.read(_kSelected);
    final loadouts = <String, MascotLoadout>{};
    for (final m in kMascots) {
      final hat = await StorageService.read(_kHat(m.id));
      final acc = await StorageService.read(_kAcc(m.id));
      final exp = await StorageService.read(_kExp(m.id));
      final hatXf = await StorageService.read(_kHatXf(m.id));
      final accXf = await StorageService.read(_kAccXf(m.id));
      final expXf = await StorageService.read(_kExpXf(m.id));
      loadouts[m.id] = MascotLoadout(
        hat:                (hat == null || hat.isEmpty) ? null        : hat,
        accessory:          (acc == null || acc.isEmpty) ? null        : acc,
        expression:         (exp == null || exp.isEmpty) ? 'exp_happy' : exp,
        hatTransform:        ItemTransform.deserialize(hatXf),
        accessoryTransform:  ItemTransform.deserialize(accXf),
        expressionTransform: ItemTransform.deserialize(expXf),
      );
    }
    return MascotState(
      selectedMascotId: (selected == null || selected.isEmpty) ? null : selected,
      loadouts: loadouts,
    );
  }

  Future<void> chooseMascot(String mascotId) async {
    final current = state.value ?? const MascotState();
    final m = mascotById(mascotId);
    if (m == null || !isMascotUnlocked(m, current.loadouts)) return;
    await StorageService.write(_kSelected, mascotId);
    state = AsyncData(current.copyWith(selectedMascotId: mascotId));
  }

  Future<void> equipHat(String? itemId) async        => _equip('hat', itemId);
  Future<void> equipAccessory(String? itemId) async  => _equip('accessory', itemId);
  Future<void> equipExpression(String? itemId) async => _equip('expression', itemId);

  Future<void> saveTransform(String slot, ItemTransform xf) async {
    final current = state.value ?? const MascotState();
    final mid = current.selectedMascotId;
    if (mid == null) return;
    final existing = current.loadouts[mid] ?? const MascotLoadout();
    MascotLoadout newLoadout;
    switch (slot) {
      case 'hat':
        await StorageService.write(_kHatXf(mid), xf.serialize());
        newLoadout = existing.copyWith(hatTransform: xf);
        break;
      case 'accessory':
        await StorageService.write(_kAccXf(mid), xf.serialize());
        newLoadout = existing.copyWith(accessoryTransform: xf);
        break;
      case 'expression':
      default:
        await StorageService.write(_kExpXf(mid), xf.serialize());
        newLoadout = existing.copyWith(expressionTransform: xf);
        break;
    }
    state = AsyncData(current.withLoadout(mid, newLoadout));
  }

  Future<void> resetTransforms() async {
    final current = state.value ?? const MascotState();
    final mid = current.selectedMascotId;
    if (mid == null) return;
    await StorageService.write(_kHatXf(mid), '');
    await StorageService.write(_kAccXf(mid), '');
    await StorageService.write(_kExpXf(mid), '');
    final existing = current.loadouts[mid] ?? const MascotLoadout();
    state = AsyncData(current.withLoadout(mid, existing.resetTransforms()));
  }

  Future<void> _equip(String slot, String? itemId) async {
    final current = state.value ?? const MascotState();
    final mid = current.selectedMascotId;
    if (mid == null) return;
    final existing = current.loadouts[mid] ?? const MascotLoadout();
    MascotLoadout newLoadout;
    switch (slot) {
      case 'hat':
        await StorageService.write(_kHat(mid), itemId ?? '');
        newLoadout = existing.copyWith(hat: itemId);
        break;
      case 'accessory':
        await StorageService.write(_kAcc(mid), itemId ?? '');
        newLoadout = existing.copyWith(accessory: itemId);
        break;
      case 'expression':
      default:
        final val = itemId ?? 'exp_happy';
        await StorageService.write(_kExp(mid), val);
        newLoadout = existing.copyWith(expression: val);
        break;
    }
    state = AsyncData(current.withLoadout(mid, newLoadout));
  }
}
