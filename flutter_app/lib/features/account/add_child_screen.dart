import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../../services/account_service.dart';
import '../community/widgets/community_artwork_card.dart' show avatarEmoji;

const _kAvatarCount = 20;

class AddChildScreen extends ConsumerStatefulWidget {
  const AddChildScreen({super.key, this.isFirst = false});

  final bool isFirst;

  @override
  ConsumerState<AddChildScreen> createState() => _AddChildScreenState();
}

class _AddChildScreenState extends ConsumerState<AddChildScreen> {
  final _nicknameCtrl = TextEditingController();
  final _formKey      = GlobalKey<FormState>();
  int _pickedAvatar   = 0;
  String? _pickedAge;
  bool _loading = false;
  String? _error;

  static const _ageGroups = ['3-5', '6-8', '9-12', '13+'];

  @override
  void initState() {
    super.initState();
    // Pick a random avatar on entry
    _pickedAvatar = DateTime.now().millisecond % _kAvatarCount;
  }

  @override
  void dispose() {
    _nicknameCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _loading = true; _error = null; });
    try {
      final child = await ref.read(accountProvider.notifier).addChild(
        _nicknameCtrl.text.trim(),
        _pickedAvatar,
        _pickedAge,
      );
      await ref.read(accountProvider.notifier).setActiveChild(child.id);
      if (mounted) Navigator.of(context).pop(true);
    } on Exception catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (mounted) setState(() { _error = msg; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ref.watch(l10nProvider);
    final cs   = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('accountAddChildTitle'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Current avatar preview
              Center(
                child: GestureDetector(
                  onTap: () => _showAvatarPicker(context, l10n),
                  child: Container(
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(
                      color: cs.primary.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                      border: Border.all(color: cs.primary, width: 2),
                    ),
                    child: Center(
                      child: Text(avatarEmoji(_pickedAvatar),
                          style: const TextStyle(fontSize: 44)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Center(
                child: TextButton(
                  onPressed: () => _showAvatarPicker(context, l10n),
                  child: Text(l10n.t('accountChangeAvatar'),
                      style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: 20),

              // Nickname field
              Text(l10n.t('accountChildName'),
                  style: GoogleFonts.fredoka(
                      fontSize: 14, fontWeight: FontWeight.w700,
                      color: cs.onSurface.withValues(alpha: 0.6))),
              const SizedBox(height: 6),
              TextFormField(
                controller: _nicknameCtrl,
                textCapitalization: TextCapitalization.words,
                maxLength: 60,
                decoration: InputDecoration(
                  hintText: l10n.t('accountChildNamePlaceholder'),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  counterText: '',
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) {
                    return l10n.t('accountChildNameError');
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Age group selector
              Text(l10n.t('accountAgeGroup'),
                  style: GoogleFonts.fredoka(
                      fontSize: 14, fontWeight: FontWeight.w700,
                      color: cs.onSurface.withValues(alpha: 0.6))),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: _ageGroups.map((ag) => FilterChip(
                  label: Text(ag,
                      style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
                  selected: _pickedAge == ag,
                  onSelected: (_) => setState(() => _pickedAge = ag),
                  selectedColor: cs.primary.withValues(alpha: 0.15),
                  checkmarkColor: cs.primary,
                  side: BorderSide(
                    color: _pickedAge == ag ? cs.primary : cs.outline,
                  ),
                  shape: const StadiumBorder(),
                )).toList(),
              ),
              const SizedBox(height: 28),

              // Error banner
              if (_error != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: cs.errorContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(_error!,
                      style: GoogleFonts.nunito(
                          color: cs.onErrorContainer, fontSize: 13)),
                ),
                const SizedBox(height: 16),
              ],

              // Submit button
              FilledButton(
                onPressed: _loading ? null : _submit,
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
                    : Text(l10n.t('accountSaveChild'),
                        style: GoogleFonts.fredoka(
                            fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAvatarPicker(BuildContext context, L10n l10n) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.t('accountPickAvatar'),
                style: GoogleFonts.fredoka(
                    fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            GridView.builder(
              shrinkWrap: true,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 5,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: _kAvatarCount,
              itemBuilder: (_, i) => GestureDetector(
                onTap: () {
                  setState(() => _pickedAvatar = i);
                  Navigator.of(ctx).pop();
                },
                child: Container(
                  decoration: BoxDecoration(
                    color: _pickedAvatar == i
                        ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.12)
                        : Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                    border: _pickedAvatar == i
                        ? Border.all(
                            color: Theme.of(context).colorScheme.primary,
                            width: 2)
                        : null,
                  ),
                  child: Center(
                    child: Text(avatarEmoji(i),
                        style: const TextStyle(fontSize: 28)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
