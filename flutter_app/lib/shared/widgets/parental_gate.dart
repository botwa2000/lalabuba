import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';

/// A simple parental gate shown before the app links out to external content
/// (e.g. the Privacy Policy / Terms web pages). Apple's Kids Category and
/// Google Families policies require a gate that a young child is unlikely to
/// pass before leaving the app. We use a small multiplication question — easy
/// for an adult, hard for a pre-reader.
///
/// Returns `true` only when the grown-up answers correctly.
Future<bool> showParentalGate(BuildContext context, L10n l10n) async {
  final rng = Random();
  final a = 3 + rng.nextInt(7); // 3..9
  final b = 3 + rng.nextInt(7); // 3..9
  final answer = a * b;

  final result = await showDialog<bool>(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => _ParentalGateDialog(a: a, b: b, answer: answer, l10n: l10n),
  );
  return result ?? false;
}

class _ParentalGateDialog extends StatefulWidget {
  final int a;
  final int b;
  final int answer;
  final L10n l10n;
  const _ParentalGateDialog(
      {required this.a, required this.b, required this.answer, required this.l10n});

  @override
  State<_ParentalGateDialog> createState() => _ParentalGateDialogState();
}

class _ParentalGateDialogState extends State<_ParentalGateDialog> {
  final _ctrl = TextEditingController();
  bool _wrong = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _submit() {
    if (int.tryParse(_ctrl.text.trim()) == widget.answer) {
      Navigator.of(context).pop(true);
    } else {
      setState(() => _wrong = true);
      _ctrl.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = widget.l10n;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text('🔒 ${l10n.t('parentalGateTitle')}',
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.t('parentalGatePrompt',
                {'a': '${widget.a}', 'b': '${widget.b}'}),
            style: GoogleFonts.nunito(fontSize: 15),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _ctrl,
            autofocus: true,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onSubmitted: (_) => _submit(),
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              errorText: _wrong ? l10n.t('parentalGateWrong') : null,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l10n.t('cancel'),
              style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        ),
        FilledButton(
          onPressed: _submit,
          child: Text(l10n.t('parentalGateContinue'),
              style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }
}
