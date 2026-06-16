import 'package:flutter/material.dart';
import '../progress/progress_service.dart';

/// Crayon packs = the colour palettes, some earned by coloring. The three
/// original palettes (classic/pastel/nature) stay free (unlockAt 0); the new
/// packs unlock as the child finishes pictures, giving a reason to keep going.
///
/// This is the SINGLE source of palette colours: the canvas renders from
/// [colorsFor], the settings cycle uses [kPaletteOrder], and the Rewards screen
/// previews packs + their unlock state. Each palette is ordered so any prefix
/// (the child picks 6/12/18/24) stays maximally distinct.
class CrayonPack {
  final String id;
  final String emoji;
  final int unlockAt; // totalCompleted needed (0 = always available)
  final List<Color> colors; // 24, ordered for distinct prefixes
  const CrayonPack(this.id, this.emoji, this.unlockAt, this.colors);
}

const _classic = <Color>[
  Color(0xFFE53935), Color(0xFFFB8C00), Color(0xFFFDD835), Color(0xFFC0CA33),
  Color(0xFF43A047), Color(0xFF00897B), Color(0xFF00ACC1), Color(0xFF1E88E5),
  Color(0xFF3949AB), Color(0xFF8E24AA), Color(0xFFD81B60), Color(0xFF6D4C41),
  Color(0xFFB71C1C), Color(0xFFFFB300), Color(0xFF7CB342), Color(0xFF00695C),
  Color(0xFF4FC3F7), Color(0xFF5E35B1), Color(0xFFF06292), Color(0xFFA1887F),
  Color(0xFF212121), Color(0xFF757575), Color(0xFFBDBDBD), Color(0xFF0D47A1),
];
const _pastel = <Color>[
  Color(0xFFFFADAD), Color(0xFFFFD6A5), Color(0xFFFDFFB6), Color(0xFFD0F4A0),
  Color(0xFFB9FBC0), Color(0xFFA0F0E0), Color(0xFFA0E7E5), Color(0xFFA8D0FF),
  Color(0xFFBDB2FF), Color(0xFFD4B8FF), Color(0xFFFFC6FF), Color(0xFFE7D3B3),
  Color(0xFFFFB5A7), Color(0xFFFCD5CE), Color(0xFFFAE588), Color(0xFFC7E9B0),
  Color(0xFFB5EAD7), Color(0xFFBDE0FE), Color(0xFFCAB8FF), Color(0xFFE0C3FC),
  Color(0xFFFFD1DC), Color(0xFFEAD9C4), Color(0xFFE2E2E2), Color(0xFFC9CCD3),
];
const _nature = <Color>[
  Color(0xFF5BA82F), Color(0xFF1B5E20), Color(0xFF2A9D8F), Color(0xFF5BC0EB),
  Color(0xFF1D6FA3), Color(0xFFE07A5F), Color(0xFFBC4B2F), Color(0xFFE9C46A),
  Color(0xFFD4A373), Color(0xFF7F5539), Color(0xFF6C757D), Color(0xFFF4A261),
  Color(0xFF8FB339), Color(0xFFA7C957), Color(0xFF40916C), Color(0xFF14532D),
  Color(0xFF277DA1), Color(0xFF9D4EDD), Color(0xFFE5989B), Color(0xFF6B4226),
  Color(0xFF495057), Color(0xFF2B2D42), Color(0xFFADB5BD), Color(0xFFF2E8CF),
];
const _neon = <Color>[
  Color(0xFFFF1744), Color(0xFFFF9100), Color(0xFFFFEA00), Color(0xFFC6FF00),
  Color(0xFF00E676), Color(0xFF00E5FF), Color(0xFF2979FF), Color(0xFF651FFF),
  Color(0xFFD500F9), Color(0xFFFF00A8), Color(0xFFFF4081), Color(0xFF1DE9B6),
  Color(0xFFFF5252), Color(0xFFFFAB40), Color(0xFFEEFF41), Color(0xFF76FF03),
  Color(0xFF69F0AE), Color(0xFF18FFFF), Color(0xFF448AFF), Color(0xFF7C4DFF),
  Color(0xFFE040FB), Color(0xFFFF80AB), Color(0xFF64FFDA), Color(0xFFB2FF59),
];
const _candy = <Color>[
  Color(0xFFFF5C8A), Color(0xFFFF8FB1), Color(0xFFFFC2D1), Color(0xFFFFB5E8),
  Color(0xFFD8B4FE), Color(0xFFB28DFF), Color(0xFF8E7CFF), Color(0xFF6EC6FF),
  Color(0xFF7AF5FF), Color(0xFF8CFFDA), Color(0xFFC2F784), Color(0xFFFFF59D),
  Color(0xFFFF7AA2), Color(0xFFFFA6C9), Color(0xFFFFD0E0), Color(0xFFE9B8FF),
  Color(0xFFCAA6FF), Color(0xFF9F8CFF), Color(0xFF7FB0FF), Color(0xFF9CE8FF),
  Color(0xFFA8FFE6), Color(0xFFD4FB9B), Color(0xFFFFE082), Color(0xFFFFB07C),
];
const _galaxy = <Color>[
  Color(0xFF1A237E), Color(0xFF311B92), Color(0xFF4A148C), Color(0xFF6A1B9A),
  Color(0xFF283593), Color(0xFF1565C0), Color(0xFF0277BD), Color(0xFF00838F),
  Color(0xFF7E57C2), Color(0xFFAB47BC), Color(0xFF5C6BC0), Color(0xFFFFD54F),
  Color(0xFFFF8A65), Color(0xFFEC407A), Color(0xFF26C6DA), Color(0xFF9CCC65),
  Color(0xFFFFFFFF), Color(0xFFB39DDB), Color(0xFF80DEEA), Color(0xFFF48FB1),
  Color(0xFFCE93D8), Color(0xFF90CAF9), Color(0xFFFFE0B2), Color(0xFF0D1B4C),
];

const kCrayonPacks = <CrayonPack>[
  CrayonPack('classic', '🖍️', 0, _classic),
  CrayonPack('pastel', '🌸', 0, _pastel),
  CrayonPack('nature', '🌿', 0, _nature),
  CrayonPack('neon', '⚡', 5, _neon),
  CrayonPack('candy', '🍭', 15, _candy),
  CrayonPack('galaxy', '🌌', 30, _galaxy),
];

/// Stable order for the settings palette cycle (only unlocked ones are offered).
final kPaletteOrder = kCrayonPacks.map((p) => p.id).toList(growable: false);

CrayonPack packById(String id) =>
    kCrayonPacks.firstWhere((p) => p.id == id, orElse: () => kCrayonPacks.first);

/// Colours for [palette], trimmed to [count] (99 = all).
List<Color> colorsFor(String palette, int count) {
  final src = packById(palette).colors;
  final effective = count == 99 ? src.length : count.clamp(1, src.length);
  return src.take(effective).toList();
}

bool isPackUnlocked(Progress p, String id) =>
    p.totalCompleted >= packById(id).unlockAt;

/// Ids the child can currently choose, in catalogue order.
List<String> unlockedPaletteIds(Progress p) =>
    kCrayonPacks.where((c) => isPackUnlocked(p, c.id)).map((c) => c.id).toList();

/// Packs that this completion JUST unlocked (totalCompleted now equals their
/// threshold), so the caller can celebrate them.
List<CrayonPack> packsUnlockedAt(int totalCompleted) => kCrayonPacks
    .where((c) => c.unlockAt > 0 && c.unlockAt == totalCompleted)
    .toList();
