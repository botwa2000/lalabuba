import 'dart:typed_data';

class GenerationRequest {
  final String subject;      // English subject string
  final String difficulty;
  final int width;
  final int height;
  final int seed;
  final String deviceId;
  final String? subscriptionToken;

  const GenerationRequest({
    required this.subject,
    required this.difficulty,
    required this.width,
    required this.height,
    required this.seed,
    required this.deviceId,
    this.subscriptionToken,
  });

  Map<String, dynamic> toJson() => {
        'subject': subject,
        'difficulty': difficulty,
        'size': 'medium',
        'width': width,
        'height': height,
        'seed': seed,
      };
}

class GenerationResult {
  final Uint8List imageBytes;
  final int seed;
  final String? blobUrl;
  final String subject;

  const GenerationResult({
    required this.imageBytes,
    required this.seed,
    required this.subject,
    this.blobUrl,
  });
}
