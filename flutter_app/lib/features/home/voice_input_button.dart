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
  // Latest recognized text (partial or final) for the current session, and a
  // guard so it's delivered exactly once. Many Android recognizers end the
  // session (via pauseFor) WITHOUT a finalResult event, so we must flush the
  // last partial on session-end — otherwise a perfectly-heard word is dropped
  // ("nothing was recognized").
  String _lastWords = '';
  bool _delivered = false;

  // App language code → speech_to_text localeId (underscore form). Best-effort:
  // if the device lacks the locale, listen() falls back to the system default.
  static const _localeId = <String, String>{
    'en': 'en_US', 'de': 'de_DE', 'es': 'es_ES', 'fr': 'fr_FR', 'it': 'it_IT',
    'nl': 'nl_NL', 'pl': 'pl_PL', 'pt': 'pt_PT', 'ru': 'ru_RU', 'tr': 'tr_TR',
    'zh': 'zh_CN', 'hi': 'hi_IN',
  };

  Future<void> _ensureInit() async {
    if (_initTried && _available) return;
    _initTried = true;
    try {
      _available = await _speech.initialize(
        debugLogging: true, // surfaces recognizer issues in `adb logcat`
        onStatus: (s) {
          if (!mounted) return;
          // 'done' / 'notListening' = the recognizer closed the session. Flush
          // whatever we heard (covers engines that never send a finalResult).
          if (s == 'done' || s == 'notListening') {
            _deliver();
            setState(() => _listening = false);
          }
        },
        onError: (_) {
          if (!mounted) return;
          setState(() {
            _listening = false;
            _error = true;
          });
          // Re-probe permission/availability on the next tap (handles the user
          // granting the mic permission after the first failure).
          _initTried = false;
        },
      );
    } catch (_) {
      _available = false;
    }
    // A failed init (no recognizer yet / permission pending) should not lock the
    // button out forever — allow a retry on the next tap.
    if (!_available) _initTried = false;
    if (mounted) setState(() {});
  }

  // Deliver the recognized text exactly once per session.
  void _deliver() {
    if (_delivered) return;
    _delivered = true;
    final text = _lastWords.trim();
    if (text.isNotEmpty) widget.onResult(text);
  }

  Future<void> _toggle() async {
    HapticFeedback.lightImpact();
    await _ensureInit();
    if (!_available) {
      // Couldn't start recognition — give visible feedback instead of silently
      // doing nothing, then let the child try again.
      if (mounted) setState(() => _error = true);
      return;
    }
    if (_listening) {
      await _speech.stop();
      _deliver();
      if (mounted) setState(() => _listening = false);
      return;
    }
    _lastWords = '';
    _delivered = false;
    setState(() {
      _error = false;
      _listening = true;
    });
    await _speech.listen(
      listenOptions: SpeechListenOptions(
        localeId: _localeId[widget.locale] ?? 'en_US',
        listenFor: const Duration(seconds: 10),
        pauseFor: const Duration(seconds: 3),
        partialResults: true, // accumulate words even before a final event
      ),
      onResult: (r) {
        final text = r.recognizedWords.trim();
        if (text.isNotEmpty) _lastWords = text;
        if (r.finalResult) {
          _deliver();
          if (mounted) setState(() => _listening = false);
        }
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
    // Always show the mic — it's the only voice affordance, and a child needs
    // feedback (the error state) when recognition can't start rather than a
    // button that silently vanishes after a tap. Availability is (re)probed on
    // tap, so granting the permission later makes it work without a restart.
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
