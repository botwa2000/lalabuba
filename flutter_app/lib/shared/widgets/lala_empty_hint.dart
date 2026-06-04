import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class LalaEmptyHint extends StatefulWidget {
  final String message;
  const LalaEmptyHint({super.key, required this.message});

  @override
  State<LalaEmptyHint> createState() => _LalaEmptyHintState();
}

class _LalaEmptyHintState extends State<LalaEmptyHint>
    with SingleTickerProviderStateMixin {
  late AnimationController _float;
  late Animation<double> _y;

  @override
  void initState() {
    super.initState();
    _float = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);
    _y = Tween<double>(begin: 0, end: -14)
        .animate(CurvedAnimation(parent: _float, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _float.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Center(
      child: Opacity(
        opacity: 0.55,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _y,
              builder: (_, __) => Transform.translate(
                offset: Offset(0, _y.value),
                child: const Text('🖌️', style: TextStyle(fontSize: 64)),
              ),
            ),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                widget.message,
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(
                  color: cs.onSurface.withValues(alpha: 0.7),
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
