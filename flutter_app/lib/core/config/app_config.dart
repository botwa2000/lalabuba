import 'dart:convert';
import 'package:flutter/services.dart';

class AppConfig {
  final bool dailyChallenge;
  final bool galleryEnabled;
  final bool challengeMode;
  final bool maxPalette;
  final bool pencilMode;
  final bool analyticsEnabled;
  final bool iapEnabled;
  final bool blobSharing;
  final String apiBaseUrl;
  final String generatePath;
  final int timeoutSeconds;
  final int subjectMaxLength;
  final int undoStackDepth;
  final int dailyFreeGenerations;

  const AppConfig({
    required this.dailyChallenge,
    required this.galleryEnabled,
    required this.challengeMode,
    required this.maxPalette,
    required this.pencilMode,
    required this.analyticsEnabled,
    required this.iapEnabled,
    required this.blobSharing,
    required this.apiBaseUrl,
    required this.generatePath,
    required this.timeoutSeconds,
    required this.subjectMaxLength,
    required this.undoStackDepth,
    required this.dailyFreeGenerations,
  });

  String get generateUrl => '$apiBaseUrl$generatePath';

  factory AppConfig.fromJson(Map<String, dynamic> json) {
    final features = json['features'] as Map<String, dynamic>;
    final api = json['api'] as Map<String, dynamic>;
    final limits = json['limits'] as Map<String, dynamic>;
    return AppConfig(
      dailyChallenge: features['dailyChallenge'] as bool,
      galleryEnabled: features['galleryEnabled'] as bool,
      challengeMode: features['challengeMode'] as bool,
      maxPalette: features['maxPalette'] as bool,
      pencilMode: features['pencilMode'] as bool,
      analyticsEnabled: features['analyticsEnabled'] as bool,
      iapEnabled: features['iapEnabled'] as bool,
      blobSharing: features['blobSharing'] as bool,
      apiBaseUrl: api['baseUrl'] as String,
      generatePath: api['generatePath'] as String,
      timeoutSeconds: api['timeoutSeconds'] as int,
      subjectMaxLength: limits['subjectMaxLength'] as int,
      undoStackDepth: limits['undoStackDepth'] as int,
      dailyFreeGenerations: limits['dailyFreeGenerations'] as int,
    );
  }

  static Future<AppConfig> load() async {
    final raw = await rootBundle.loadString('assets/config/app_config.json');
    return AppConfig.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }
}
