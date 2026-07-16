import 'package:flutter/foundation.dart';

// ── Mascot companions ─────────────────────────────────────────────────────────

class Mascot {
  final String id;
  final String emoji;
  final String name;

  const Mascot({required this.id, required this.emoji, required this.name});
}

const kMascots = [
  Mascot(id: 'penguin', emoji: '🐧', name: 'Pixel'),
  Mascot(id: 'bunny',   emoji: '🐰', name: 'Biscuit'),
  Mascot(id: 'bear',    emoji: '🐻', name: 'Coco'),
  Mascot(id: 'fox',     emoji: '🦊', name: 'Ember'),
  Mascot(id: 'dragon',  emoji: '🐉', name: 'Spark'),
];

Mascot? mascotById(String id) {
  try { return kMascots.firstWhere((m) => m.id == id); } catch (_) { return null; }
}

// ── Decoration items ──────────────────────────────────────────────────────────

class MascotItem {
  final String id;
  final String category; // 'hat' | 'accessory' | 'expression'
  final String emoji;
  final String name;
  final int unlockAt; // colorings needed (0 = always available)

  const MascotItem({
    required this.id,
    required this.category,
    required this.emoji,
    required this.name,
    required this.unlockAt,
  });
}

const kMascotItems = [
  // ── Hats ──
  MascotItem(id: 'hat_party',   category: 'hat', emoji: '🎉', name: 'Party Hat',    unlockAt: 0),
  MascotItem(id: 'hat_beret',   category: 'hat', emoji: '🎨', name: 'Artist Beret', unlockAt: 3),
  MascotItem(id: 'hat_cowboy',  category: 'hat', emoji: '🤠', name: 'Cowboy Hat',   unlockAt: 8),
  MascotItem(id: 'hat_crown',   category: 'hat', emoji: '👑', name: 'Crown',        unlockAt: 15),
  MascotItem(id: 'hat_wizard',  category: 'hat', emoji: '🧙', name: 'Wizard Hat',   unlockAt: 25),
  MascotItem(id: 'hat_chef',    category: 'hat', emoji: '🍳', name: 'Chef Toque',   unlockAt: 40),
  MascotItem(id: 'hat_grad',    category: 'hat', emoji: '🎓', name: 'Grad Cap',     unlockAt: 60),
  MascotItem(id: 'hat_space',   category: 'hat', emoji: '🪐', name: 'Space Helmet', unlockAt: 100),
  // ── Accessories ──
  MascotItem(id: 'acc_bowtie',  category: 'accessory', emoji: '🎀', name: 'Bow Tie',    unlockAt: 2),
  MascotItem(id: 'acc_brush',   category: 'accessory', emoji: '🖌️', name: 'Paintbrush', unlockAt: 4),
  MascotItem(id: 'acc_glasses', category: 'accessory', emoji: '👓', name: 'Glasses',    unlockAt: 7),
  MascotItem(id: 'acc_scarf',   category: 'accessory', emoji: '🧣', name: 'Scarf',      unlockAt: 12),
  MascotItem(id: 'acc_medal',   category: 'accessory', emoji: '🏅', name: 'Medal',      unlockAt: 20),
  MascotItem(id: 'acc_star',    category: 'accessory', emoji: '⭐', name: 'Star Badge', unlockAt: 35),
  MascotItem(id: 'acc_cape',    category: 'accessory', emoji: '🦸', name: 'Cape',       unlockAt: 50),
  // ── Expressions ──
  MascotItem(id: 'exp_happy',   category: 'expression', emoji: '😊', name: 'Happy',   unlockAt: 0),
  MascotItem(id: 'exp_excited', category: 'expression', emoji: '🤩', name: 'Excited', unlockAt: 5),
  MascotItem(id: 'exp_sleepy',  category: 'expression', emoji: '😴', name: 'Sleepy',  unlockAt: 15),
  MascotItem(id: 'exp_cool',    category: 'expression', emoji: '😎', name: 'Cool',    unlockAt: 30),
  MascotItem(id: 'exp_party',   category: 'expression', emoji: '🥳', name: 'Party',   unlockAt: 50),
];

List<MascotItem> itemsByCategory(String cat) =>
    kMascotItems.where((i) => i.category == cat).toList();

bool isItemUnlocked(MascotItem item, int totalCompleted) =>
    totalCompleted >= item.unlockAt;

// ── Per-mascot loadout ────────────────────────────────────────────────────────

@immutable
class MascotLoadout {
  final String? hat;
  final String? accessory;
  final String? expression;

  const MascotLoadout({
    this.hat,
    this.accessory,
    this.expression = 'exp_happy',
  });

  // Decorations applied: hat + accessory + non-default expression.
  int get equippedCount {
    int c = 0;
    if (hat != null) c++;
    if (accessory != null) c++;
    if (expression != null && expression != 'exp_happy') c++;
    return c;
  }

  MascotLoadout copyWith({
    Object? hat = _sentinel,
    Object? accessory = _sentinel,
    String? expression,
  }) =>
      MascotLoadout(
        hat: hat == _sentinel ? this.hat : hat as String?,
        accessory: accessory == _sentinel ? this.accessory : accessory as String?,
        expression: expression ?? this.expression,
      );
}

const _sentinel = Object();

// ── Mascot unlock logic ───────────────────────────────────────────────────────

int _mascotsWithAtLeast(Map<String, MascotLoadout> loadouts, int n) =>
    loadouts.values.where((l) => l.equippedCount >= n).length;

bool isMascotUnlocked(Mascot mascot, Map<String, MascotLoadout> loadouts) {
  switch (mascot.id) {
    case 'penguin':
    case 'bunny':
      return true;
    case 'bear':
      // Unlock when any companion has >= 1 decoration
      return loadouts.values.any((l) => l.equippedCount >= 1);
    case 'fox':
      // Unlock when any companion has >= 2 decorations (hat + accessory)
      return _mascotsWithAtLeast(loadouts, 2) >= 1;
    case 'dragon':
      // Unlock when 2 companions each have >= 2 decorations
      return _mascotsWithAtLeast(loadouts, 2) >= 2;
    default:
      return false;
  }
}

String mascotUnlockHint(Mascot mascot) {
  switch (mascot.id) {
    case 'bear':   return 'Decorate any companion!';
    case 'fox':    return 'Give 2 items to a companion!';
    case 'dragon': return 'Dress up 2 companions fully!';
    default:       return '';
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

@immutable
class MascotState {
  final String? selectedMascotId;
  final Map<String, MascotLoadout> loadouts;

  const MascotState({
    this.selectedMascotId,
    this.loadouts = const {},
  });

  bool get isSetUp => selectedMascotId != null;

  Mascot? get mascot =>
      selectedMascotId == null ? null : mascotById(selectedMascotId!);

  MascotLoadout get currentLoadout =>
      loadouts[selectedMascotId] ?? const MascotLoadout();

  MascotItem? get hat =>
      currentLoadout.hat == null ? null : _itemById(currentLoadout.hat!);
  MascotItem? get accessory =>
      currentLoadout.accessory == null ? null : _itemById(currentLoadout.accessory!);
  MascotItem? get expression =>
      currentLoadout.expression == null ? null : _itemById(currentLoadout.expression!);

  static MascotItem? _itemById(String id) {
    try { return kMascotItems.firstWhere((i) => i.id == id); } catch (_) { return null; }
  }

  String get navLabel {
    final m = mascot;
    if (m == null) return '🐧';
    final h = hat;
    return h == null ? m.emoji : '${m.emoji}${h.emoji}';
  }

  List<Mascot> get unlockedMascots =>
      kMascots.where((m) => isMascotUnlocked(m, loadouts)).toList();

  MascotState withLoadout(String mascotId, MascotLoadout loadout) => MascotState(
        selectedMascotId: selectedMascotId,
        loadouts: {...loadouts, mascotId: loadout},
      );

  MascotState copyWith({
    String? selectedMascotId,
    Map<String, MascotLoadout>? loadouts,
  }) =>
      MascotState(
        selectedMascotId: selectedMascotId ?? this.selectedMascotId,
        loadouts: loadouts ?? this.loadouts,
      );
}
