import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:speech_to_text/speech_to_text.dart';
import '../../core/l10n/l10n_service.dart';

/// 🎤 voice prompt input for pre-readers who can't type yet: tap, say a word,
/// and it fills the prompt. Parity with the web `initVoiceInput`. Self-contained
/// — owns its SpeechToText instance, requests the mic permission on first use,
/// and hides itself entirely on devices where speech recognition is unavailable
/// (so it never shows a dead button).
class VoiceInputButton extends StatefulWidget {
  final L10n l10n;
  final String locale; // app language code, e.g. 'en'
  final ValueChanged<String> onResult; // final recognized text
  const VoiceInputButton({
    super.key,
    required this.l10n,
    required this.locale,
    required this.onResult,
  });

  @override
  State<VoiceInputButton> createState() => _VoiceInputButtonState();
}

class _VoiceInputButtonState extends State<VoiceInputButton> {
  final _speech = SpeechToText();
  bool _initTried = false;
  bool _available = false;
  bool _listening = false;
  bool _error = false;

  // App language code → speech_to_text localeId (underscore form). Best-effort:
  // if the device lacks the locale, listen() falls back to the system default.
  static const _localeId = <String, String>{
    'en': 'en_US', 'de': 'de_DE', 'es': 'es_ES', 'fr': 'fr_FR', 'it': 'it_IT',
    'nl': 'nl_NL', 'pl': 'pl_PL', 'pt': 'pt_PT', 'ru': 'ru_RU', 'tr': 'tr_TR',
    'zh': 'zh_CN', 'hi': 'hi_IN',
  };

  Future<void> _ensureInit() async {
    if (_initTried) return;
    _initTried = true;
    try {
      _available = await _speech.initialize(
        onStatus: (s) {
          if (!mounted) return;
          if (s == 'done' || s == 'notListening') {
            setState(() => _listening = false);
          }
        },
        onError: (_) {
          if (!mounted) return;
          setState(() {
            _listening = false;
            _error = true;
          });
        },
      );
    } catch (_) {
      _available = false;
    }
    if (mounted) setState(() {});
  }

  Future<void> _toggle() async {
    HapticFeedback.lightImpact();
    await _ensureInit();
    if (!_available) return;
    if (_listening) {
      await _speech.stop();
      if (mounted) setState(() => _listening = false);
      return;
    }
    setState(() {
      _error = false;
      _listening = true;
    });
    await _speech.listen(
      listenOptions: SpeechListenOptions(
        localeId: _localeId[widget.locale] ?? 'en_US',
        listenFor: const Duration(seconds: 8),
        pauseFor: const Duration(seconds: 3),
      ),
      onResult: (r) {
        if (!r.finalResult) return;
        final text = r.recognizedWords.trim();
        if (mounted) setState(() => _listening = false);
        if (text.isNotEmpty) widget.onResult(text);
      },
    );
  }

  @override
  void dispose() {
    _speech.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // After a probe shows recognition is unavailable, render nothing — no dead
    // affordance. Before the first probe we still show the mic (the probe runs
    // on first tap), matching web's "try, then hide on failure".
    if (_initTried && !_available) return const SizedBox.shrink();
    final cs = Theme.of(context).colorScheme;
    final tooltip = _listening
        ? widget.l10n.t('voiceListening')
        : _error
            ? widget.l10n.t('voiceError')
            : widget.l10n.t('voiceBtnLabel');
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: _toggle,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          height: 42,
          width: 42,
          decoration: BoxDecoration(
            color: _listening ? cs.errorContainer : cs.secondaryContainer,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: _listening ? cs.error : cs.outlineVariant,
              width: _listening ? 1.5 : 1,
            ),
          ),
          child: Center(
            child: Text(
              _listening ? '🔴' : '🎤',
              style: GoogleFonts.fredoka(fontSize: 18),
            ),
          ),
        ),
      ),
    );
  }
}
