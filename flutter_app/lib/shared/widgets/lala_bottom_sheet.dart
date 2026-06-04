import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Show a Lala-styled modal bottom sheet.
/// The sheet has a drag handle, rounded top corners, and spring physics.
Future<T?> showLalaBottomSheet<T>({
  required BuildContext context,
  required Widget child,
  String? title,
  bool isDismissible = true,
  double initialChildSize = 0.5,
  double maxChildSize = 0.92,
  double minChildSize = 0.25,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    isDismissible: isDismissible,
    enableDrag: isDismissible,
    useSafeArea: true,
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: initialChildSize,
      maxChildSize: maxChildSize,
      minChildSize: minChildSize,
      builder: (ctx, scrollController) => _LalaSheetContent(
        title: title,
        scrollController: scrollController,
        child: child,
      ),
    ),
  );
}

class _LalaSheetContent extends StatelessWidget {
  final String? title;
  final ScrollController scrollController;
  final Widget child;

  const _LalaSheetContent({
    this.title,
    required this.scrollController,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 4),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: cs.onSurface.withOpacity(0.2),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          if (title != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Text(
                title!,
                style: GoogleFonts.fredoka(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: cs.onSurface,
                ),
              ),
            ),
          Flexible(
            child: SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}
