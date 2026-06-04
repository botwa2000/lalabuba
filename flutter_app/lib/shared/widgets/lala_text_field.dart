import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class LalaTextField extends StatefulWidget {
  final String placeholder;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onSubmitted;
  final int maxLength;
  final bool enabled;
  final FocusNode? focusNode;

  const LalaTextField({
    super.key,
    required this.placeholder,
    this.controller,
    this.onChanged,
    this.onSubmitted,
    this.maxLength = 80,
    this.enabled = true,
    this.focusNode,
  });

  @override
  State<LalaTextField> createState() => _LalaTextFieldState();
}

class _LalaTextFieldState extends State<LalaTextField> {
  late TextEditingController _ctrl;
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _ctrl = widget.controller ?? TextEditingController();
    _ctrl.addListener(_onText);
    _hasText = _ctrl.text.isNotEmpty;
  }

  @override
  void dispose() {
    if (widget.controller == null) _ctrl.dispose();
    super.dispose();
  }

  void _onText() {
    final has = _ctrl.text.isNotEmpty;
    if (has != _hasText) setState(() => _hasText = has);
    widget.onChanged?.call(_ctrl.text);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return TextField(
      controller: _ctrl,
      focusNode: widget.focusNode,
      enabled: widget.enabled,
      maxLength: widget.maxLength,
      maxLines: 1,
      textInputAction: TextInputAction.search,
      onSubmitted: (_) => widget.onSubmitted?.call(),
      style: GoogleFonts.nunito(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: cs.onSurface,
      ),
      decoration: InputDecoration(
        hintText: widget.placeholder,
        hintStyle: GoogleFonts.nunito(
          fontSize: 14,
          color: cs.onSurface.withValues(alpha: 0.45),
        ),
        counterText: '',
        suffixIcon: _hasText
            ? GestureDetector(
                onTap: () {
                  _ctrl.clear();
                  widget.onChanged?.call('');
                },
                child: Icon(Icons.cancel_rounded,
                    color: cs.onSurface.withValues(alpha: 0.4), size: 20),
              )
            : null,
      ),
    );
  }
}
