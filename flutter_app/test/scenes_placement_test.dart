import 'package:flutter_test/flutter_test.dart';
import 'package:lalabuba/features/rewards/scenes.dart';

// Covers the sticker transform model added for pinch-resize + twist-rotate:
//   • Placement carries scale (clamped) and rotation;
//   • copyWith preserves the other fields;
//   • JSON round-trips and stays compact (defaults omitted);
//   • a corrupt/out-of-range scale is clamped on load.
void main() {
  group('Placement transform', () {
    test('defaults: scale 1, rotation 0', () {
      const p = Placement(deco: 'm_tree', x: 0.5, y: 0.5);
      expect(p.scale, 1.0);
      expect(p.rotation, 0.0);
    });

    test('copyWith updates only the named fields', () {
      const p = Placement(deco: 'm_tree', x: 0.2, y: 0.3);
      final q = p.copyWith(scale: 2.0, rotation: 0.5);
      expect(q.deco, 'm_tree');
      expect(q.x, 0.2);
      expect(q.y, 0.3);
      expect(q.scale, 2.0);
      expect(q.rotation, 0.5);
      // original untouched (immutability)
      expect(p.scale, 1.0);
    });

    test('toJson omits default scale/rotation but keeps custom ones', () {
      const def = Placement(deco: 'm_tree', x: 0.5, y: 0.5);
      expect(def.toJson().containsKey('s'), isFalse);
      expect(def.toJson().containsKey('r'), isFalse);

      const custom = Placement(deco: 'm_tree', x: 0.5, y: 0.5, scale: 1.8, rotation: 0.4);
      final j = custom.toJson();
      expect(j['s'], 1.8);
      expect(j['r'], 0.4);
    });

    test('round-trips through JSON', () {
      const p = Placement(art: 'art_1', x: 0.1, y: 0.9, scale: 2.5, rotation: -1.2);
      final back = Placement.fromJson(p.toJson());
      expect(back.art, 'art_1');
      expect(back.x, closeTo(0.1, 1e-9));
      expect(back.y, closeTo(0.9, 1e-9));
      expect(back.scale, closeTo(2.5, 1e-9));
      expect(back.rotation, closeTo(-1.2, 1e-9));
    });

    test('out-of-range scale is clamped on load', () {
      final tooBig = Placement.fromJson(
          {'d': 'm_tree', 'x': 0.5, 'y': 0.5, 's': 99.0});
      expect(tooBig.scale, Placement.maxScale);
      final tooSmall = Placement.fromJson(
          {'d': 'm_tree', 'x': 0.5, 'y': 0.5, 's': 0.01});
      expect(tooSmall.scale, Placement.minScale);
    });

    test('legacy placement (no s/r keys) loads as defaults', () {
      final legacy = Placement.fromJson({'d': 'm_tree', 'x': 0.4, 'y': 0.6});
      expect(legacy.scale, 1.0);
      expect(legacy.rotation, 0.0);
    });
  });
}
