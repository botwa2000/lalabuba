import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/l10n/l10n_service.dart';

const kCommunityAvatars = [
  '🐉','🐧','🐻','🦄','🐯','🦊','🐰','🐬','🦅','🐺',
  '🐼','🐨','🐆','🦉','🦜','🐹','🦔','🦦','🐿️','🦘',
];

/// Shows a dialog for picking an avatar emoji.
/// Returns the selected index or null if dismissed.
Future<int?> showAvatarPicker(BuildContext context, int currentIndex, L10n l10n) async {
  return showDialog<int>(
    context: context,
    builder: (_) => _AvatarPickerDialog(currentIndex: currentIndex, l10n: l10n),
  );
}

class _AvatarPickerDialog extends StatefulWidget {
  final int currentIndex;
  final L10n l10n;
  const _AvatarPickerDialog({required this.currentIndex, required this.l10n});

  @override
  State<_AvatarPickerDialog> createState() => _AvatarPickerDialogState();
}

class _AvatarPickerDialogState extends State<_AvatarPickerDialog> {
  late int _selected;

  @override
  void initState() {
    super.initState();
    _selected = widget.currentIndex;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final l10n = widget.l10n;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(l10n.t('avatarPickerTitle'),
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
      content: Wrap(
        spacing: 12,
        runSpacing: 12,
        alignment: WrapAlignment.center,
        children: List.generate(kCommunityAvatars.length, (i) {
          final isSelected = i == _selected;
          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _selected = i);
            },
            child: Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected
                    ? cs.primaryContainer
                    : cs.surfaceContainerHighest,
                border: isSelected
                    ? Border.all(color: cs.primary, width: 2.5)
                    : null,
              ),
              alignment: Alignment.center,
              child: Text(kCommunityAvatars[i],
                  style: const TextStyle(fontSize: 26)),
            ),
          );
        }),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text('Cancel',
              style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_selected),
          child: Text(l10n.t('avatarPickerChoose'),
              style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }
}
