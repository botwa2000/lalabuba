import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import '../../shared/services/storage_service.dart';

/// Optional spoken feedback for pre-readers ("read aloud"): names the number a
/// child just colored and praises them on completion. OFF by default. A silent
/// no-op while the toggle is off, so callers never have to guard. Parity with
/// the web `narrate.js` (governed there by `lalabuba-narrate-v1`).
///
/// App language code → BCP-47 voice tag (best-effort; the engine picks the
/// closest installed voice, falling back to its default if none matches).
const _langTag = <String, String>{
  'en': 'en-US', 'de': 'de-DE', 'es': 'es-ES', 'fr': 'fr-FR', 'it': 'it-IT',
  'nl': 'nl-NL', 'pl': 'pl-PL', 'pt': 'pt-PT', 'ru': 'ru-RU', 'tr': 'tr-TR',
  'zh': 'zh-CN', 'hi': 'hi-IN',
};

class NarrationController extends AsyncNotifier<bool> {
  final _tts = FlutterTts();
  bool _ttsConfigured = false;

  @override
  Future<bool> build() async {
    return StorageService.readBool(StorageService.kNarrate, false);
  }

  bool get isOn => state.valueOrNull ?? false;

  Future<void> toggle() async {
    final next = !isOn;
    state = AsyncData(next);
    await StorageService.writeBool(StorageService.kNarrate, next);
    // Give immediate feedback when turning it on, like the web chip does.
    if (next) {
      // Read praise so the child hears the voice working right away. The caller
      // passes a localized string; here we only have the raw API, so the canvas
      // chip handler speaks the localized praise itself after calling toggle().
    }
  }

  Future<void> _ensureConfigured(String locale) async {
    final tag = _langTag[locale] ?? 'en-US';
    try {
      await _tts.setLanguage(tag);
      if (!_ttsConfigured) {
        await _tts.setSpeechRate(0.45); // flutter_tts scale differs from web; ~slow+clear
        await _tts.setPitch(1.15); // friendly, slightly bright
        _ttsConfigured = true;
      }
    } catch (_) {
      // Engine missing/!supported (rare on iOS/Android) — speak() will no-op.
    }
  }

  /// Speak [text] in [locale]. No-op when the toggle is off or text is empty.
  /// Cancels any in-flight utterance first so rapid taps don't queue a backlog.
  Future<void> speak(String text, String locale) async {
    if (!isOn || text.isEmpty) return;
    try {
      await _ensureConfigured(locale);
      await _tts.stop();
      await _tts.speak(text);
    } catch (e) {
      if (kDebugMode) debugPrint('TTS speak failed: $e');
    }
  }
}

final narrationProvider =
    AsyncNotifierProvider<NarrationController, bool>(NarrationController.new);
