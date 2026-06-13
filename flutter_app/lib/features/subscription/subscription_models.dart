enum SubscriptionTier { free, plus, family }

class Entitlements {
  final int dailyGenerations; // -1 = unlimited
  final List<String> difficulties;
  final List<String> palettes;
  final int maxColors;
  final int resolution;
  final bool pencilMode;
  final bool gallery;
  final int galleryLimit; // -1 = unlimited
  final bool exactSharing;
  final bool hdPrint;
  final bool zoomControls;
  final bool colorPicker;
  final bool maxPalette;
  final int childProfiles;

  const Entitlements({
    required this.dailyGenerations,
    required this.difficulties,
    required this.palettes,
    required this.maxColors,
    required this.resolution,
    required this.pencilMode,
    required this.gallery,
    required this.galleryLimit,
    required this.exactSharing,
    required this.hdPrint,
    required this.zoomControls,
    required this.colorPicker,
    required this.maxPalette,
    required this.childProfiles,
  });

  bool get isUnlimited => dailyGenerations == -1;

  factory Entitlements.fromJson(Map<String, dynamic> json) {
    return Entitlements(
      dailyGenerations: json['dailyGenerations'] as int,
      difficulties: List<String>.from(json['difficulties'] as List),
      palettes: List<String>.from(json['palettes'] as List),
      maxColors: json['maxColors'] as int,
      resolution: json['resolution'] as int,
      pencilMode: json['pencilMode'] as bool,
      gallery: json['gallery'] as bool,
      galleryLimit: json['galleryLimit'] as int,
      exactSharing: json['exactSharing'] as bool,
      hdPrint: json['hdPrint'] as bool,
      zoomControls: json['zoomControls'] as bool,
      colorPicker: json['colorPicker'] as bool,
      maxPalette: json['maxPalette'] as bool,
      childProfiles: json['childProfiles'] as int,
    );
  }

  // Free-only v1: every feature is unlocked for everyone. The only limit kept
  // is a generous daily generation cap, which exists purely as a cost guard on
  // the paid image-generation API — not as a monetization gate.
  static const free = Entitlements(
    dailyGenerations: 20,
    difficulties: ['easy', 'medium', 'hard', 'extreme'],
    palettes: ['classic', 'pastel', 'nature', 'vivid', 'mono'],
    maxColors: 24,
    resolution: 1024,
    pencilMode: true,
    gallery: true,
    galleryLimit: -1,
    exactSharing: true,
    hdPrint: true,
    zoomControls: true,
    colorPicker: true,
    maxPalette: true,
    childProfiles: 1,
  );
}
