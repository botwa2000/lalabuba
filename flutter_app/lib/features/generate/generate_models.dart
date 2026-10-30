import 'dart:typed_data';

class GenerationRequest {
  final String subject;      // English subject string
  final String difficulty;
  final int width;
  final int height;
  final int seed;
  final String deviceId;
  final String? subscriptionToken;
  /// Where the subject came from (custom | card | daily | surprise | voice |
  /// scene | explore | again) and the UI language — for the stats dashboard.
  final String? source;
  final String? lang;

  const GenerationRequest({
    required this.subject,
    required this.difficulty,
    required this.width,
    required this.height,
    required this.seed,
    required this.deviceId,
    this.subscriptionToken,
    this.source,
    this.lang,
  });

  Map<String, dynamic> toJson() => {
        'subject': subject,
        'difficulty': difficulty,
        'size': 'medium',
        'width': width,
        'height': height,
        'seed': seed,
        if (source != null) 'source': source,
        if (lang != null) 'lang': lang,
      };
}

class GenerationResult {
  final Uint8List imageBytes;
  final int seed;
  final String? imageUrl; // absolute https://lalabuba.com/img/c/... or null
  final String subject;

  const GenerationResult({
    required this.imageBytes,
    required this.seed,
    required this.subject,
    this.imageUrl,
  });
}
