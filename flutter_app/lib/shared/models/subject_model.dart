class Subject {
  final String en;
  final String emoji;
  final Map<String, String> translations;

  const Subject({
    required this.en,
    required this.emoji,
    required this.translations,
  });

  String translate(String locale) => translations[locale] ?? en;

  factory Subject.fromJson(Map<String, dynamic> json) {
    final map = <String, String>{};
    for (final k in json.keys) {
      if (k != 'emoji') map[k] = json[k] as String;
    }
    return Subject(
      en: json['en'] as String,
      emoji: json['emoji'] as String,
      translations: map,
    );
  }
}

class SubjectAction {
  final String en;
  final Map<String, String> translations;

  const SubjectAction({required this.en, required this.translations});

  String translate(String locale) => translations[locale] ?? en;

  factory SubjectAction.fromJson(Map<String, dynamic> json) {
    final map = <String, String>{};
    for (final k in json.keys) {
      map[k] = json[k] as String;
    }
    return SubjectAction(en: json['en'] as String, translations: map);
  }
}

class SubjectCard {
  final Subject subject;
  final SubjectAction action;

  const SubjectCard({required this.subject, required this.action});

  String label(String locale) {
    final s = subject.translate(locale);
    final a = action.translate(locale);
    return '$s $a';
  }

  String get englishPrompt => '${subject.en} ${action.en}';
  String get emoji => subject.emoji;
}

class PaletteColor {
  final String label;
  final int argb;

  const PaletteColor({required this.label, required this.argb});

  factory PaletteColor.fromJson(Map<String, dynamic> json) {
    final hex = (json['hex'] as String).replaceAll('#', '');
    final argb = int.parse('FF$hex', radix: 16);
    return PaletteColor(label: json['label'] as String, argb: argb);
  }
}
