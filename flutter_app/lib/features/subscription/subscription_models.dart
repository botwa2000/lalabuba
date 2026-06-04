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

  static const free = Entitlements(
    dailyGenerations: 5,
    difficulties: ['easy', 'medium'],
    palettes: ['classic'],
    maxColors: 12,
    resolution: 768,
    pencilMode: false,
    gallery: false,
    galleryLimit: 0,
    exactSharing: false,
    hdPrint: false,
    zoomControls: false,
    colorPicker: false,
    maxPalette: false,
    childProfiles: 0,
  );
}
