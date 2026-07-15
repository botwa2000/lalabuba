import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../../services/account_service.dart';

class OtpVerificationScreen extends ConsumerStatefulWidget {
  const OtpVerificationScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final List<TextEditingController> _ctrls =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _nodes = List.generate(6, (_) => FocusNode());

  bool _loading   = false;
  String? _error;
  int _cooldown   = 60;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCooldown();
    WidgetsBinding.instance.addPostFrameCallback((_) => _nodes[0].requestFocus());
  }

  @override
  void dispose() {
    for (final c in _ctrls) { c.dispose(); }
    for (final n in _nodes) { n.dispose(); }
    _timer?.cancel();
    super.dispose();
  }

  void _startCooldown([int seconds = 60]) {
    _timer?.cancel();
    setState(() => _cooldown = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_cooldown <= 1) {
        t.cancel();
        setState(() => _cooldown = 0);
      } else {
        setState(() => _cooldown--);
      }
    });
  }

  String get _code => _ctrls.map((c) => c.text).join();
  bool get _isFull  => _code.length == 6;

  void _onDigitInput(int index, String value) {
    final clean = value.replaceAll(RegExp(r'[^0-9]'), '');
    if (clean.length > 1) {
      // Handle paste: distribute across cells
      for (var i = 0; i < clean.length && index + i < 6; i++) {
        _ctrls[index + i].text = clean[i];
      }
      final nextFocus = (index + clean.length).clamp(0, 5);
      _nodes[nextFocus].requestFocus();
    } else {
      _ctrls[index].text = clean;
      if (clean.isNotEmpty && index < 5) {
        _nodes[index + 1].requestFocus();
      }
    }
    setState(() => _error = null);
    if (_isFull) _submit();
  }

  void _onKeyEvent(int index, KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _ctrls[index].text.isEmpty &&
        index > 0) {
      _nodes[index - 1].requestFocus();
      _ctrls[index - 1].text = '';
    }
  }

  Future<void> _submit() async {
    if (!_isFull || _loading) return;
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(accountProvider.notifier).verifyOtp(widget.email, _code);
      if (mounted) Navigator.of(context).pop(true);
    } on Exception catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      // DioException wraps the body — extract the error field
      final errorMsg = msg.contains('attemptsLeft') || msg.contains('INVALID_CODE')
          ? ref.read(l10nProvider).t('accountInvalidCode')
          : msg.contains('EXPIRED') || msg.contains('404')
              ? ref.read(l10nProvider).t('accountCodeExpired')
              : msg;
      if (mounted) {
        setState(() { _error = errorMsg; _loading = false; });
        for (final c in _ctrls) { c.text = ''; }
        _nodes[0].requestFocus();
      }
    }
  }

  Future<void> _resend() async {
    if (_cooldown > 0) return;
    setState(() { _loading = true; _error = null; });
    final l10n = ref.read(l10nProvider);
    try {
      await ref.read(accountProvider.notifier).resendOtp(widget.email, l10n.locale);
      _startCooldown(60);
    } on Exception catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ref.watch(l10nProvider);
    final cs   = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('accountVerifyEmail'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          children: [
            const Text('📨', style: TextStyle(fontSize: 56)),
            const SizedBox(height: 16),
            Text(
              l10n.t('accountOtpSent'),
              textAlign: TextAlign.center,
              style: GoogleFonts.fredoka(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(
              widget.email,
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(
                  fontSize: 14, color: cs.onSurface.withValues(alpha: 0.6)),
            ),
            const SizedBox(height: 32),

            // 6 digit boxes
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(6, (i) => _DigitBox(
                controller: _ctrls[i],
                focusNode: _nodes[i],
                cs: cs,
                onInput: (v) => _onDigitInput(i, v),
                onKeyEvent: (e) => _onKeyEvent(i, e),
              )),
            ),
            const SizedBox(height: 20),

            // Error
            if (_error != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: cs.errorContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(_error!,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.nunito(
                        color: cs.onErrorContainer, fontSize: 13)),
              ),
            const SizedBox(height: 20),

            // Verify button (shown when 6 digits entered and not auto-submitted)
            FilledButton(
              onPressed: (_isFull && !_loading) ? _submit : null,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 22, height: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.5, color: Colors.white))
                  : Text(l10n.t('accountVerifyBtn'),
                      style: GoogleFonts.fredoka(
                          fontSize: 16, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(height: 16),

            // Resend row
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TextButton(
                  onPressed: _cooldown == 0 ? _resend : null,
                  child: Text(
                    _cooldown > 0
                        ? '${l10n.t("accountResendIn")} ${_cooldown}s'
                        : l10n.t('accountResendCode'),
                    style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
                  ),
                ),
                const Text(' · '),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(l10n.t('accountChangeEmail'),
                      style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DigitBox extends StatelessWidget {
  const _DigitBox({
    required this.controller,
    required this.focusNode,
    required this.cs,
    required this.onInput,
    required this.onKeyEvent,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ColorScheme cs;
  final ValueChanged<String> onInput;
  final ValueChanged<KeyEvent> onKeyEvent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: SizedBox(
        width: 46,
        height: 58,
        child: KeyboardListener(
          focusNode: FocusNode(),
          onKeyEvent: onKeyEvent,
          child: TextFormField(
            controller: controller,
            focusNode: focusNode,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            maxLength: 1,
            style: GoogleFonts.robotoMono(
                fontSize: 22, fontWeight: FontWeight.w700),
            decoration: InputDecoration(
              counterText: '',
              contentPadding: const EdgeInsets.symmetric(vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: cs.outline),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: cs.primary, width: 2),
              ),
            ),
            onChanged: onInput,
          ),
        ),
      ),
    );
  }
}
