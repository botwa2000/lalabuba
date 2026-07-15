import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../../services/account_service.dart';
import '../community/widgets/community_artwork_card.dart' show avatarEmoji;
import 'otp_verification_screen.dart';
import 'child_selector_screen.dart';
import 'add_child_screen.dart';

class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  final _emailCtrl = TextEditingController();
  final _formKey   = GlobalKey<FormState>();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n    = ref.watch(l10nProvider);
    final account = ref.watch(accountProvider);
    final cs      = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          account.isSignedIn ? l10n.t('accountTitle') : l10n.t('accountSaveProgress'),
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
        ),
        centerTitle: true,
      ),
      body: account.isSignedIn
          ? _SignedInBody(account: account, l10n: l10n, cs: cs,
              onSignOut: _signOut)
          : _EmailBody(
              emailCtrl: _emailCtrl,
              formKey: _formKey,
              loading: _loading,
              error: _error,
              onSubmit: _submit,
              l10n: l10n,
              cs: cs,
            ),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _loading = true; _error = null; });
    final l10n    = ref.read(l10nProvider);
    final notifier = ref.read(accountProvider.notifier);
    final email   = _emailCtrl.text.trim().toLowerCase();
    final lang    = l10n.locale;
    try {
      await notifier.sendOtp(email, lang);
      if (!mounted) return;
      final done = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => OtpVerificationScreen(email: email)),
      );
      if (!mounted) return;
      if (done == true) _afterVerified();
    } on Exception catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (mounted) setState(() { _error = msg; _loading = false; });
    } finally {
      if (mounted && _loading) setState(() => _loading = false);
    }
  }

  Future<void> _afterVerified() async {
    final account = ref.read(accountProvider);
    if (account.children.isEmpty) {
      final child = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const AddChildScreen(isFirst: true)),
      );
      if (child == true && mounted) Navigator.of(context).pop();
    } else if (account.activeChildId == null) {
      final picked = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const ChildSelectorScreen()),
      );
      if (picked == true && mounted) Navigator.of(context).pop();
    } else {
      if (mounted) Navigator.of(context).pop();
    }
  }

  Future<void> _signOut() async {
    await ref.read(accountProvider.notifier).logout();
    if (mounted) Navigator.of(context).pop();
  }
}

// ── Email entry body ──────────────────────────────────────────────────────────
class _EmailBody extends StatelessWidget {
  const _EmailBody({
    required this.emailCtrl,
    required this.formKey,
    required this.loading,
    required this.error,
    required this.onSubmit,
    required this.l10n,
    required this.cs,
  });

  final TextEditingController emailCtrl;
  final GlobalKey<FormState> formKey;
  final bool loading;
  final String? error;
  final VoidCallback onSubmit;
  final L10n l10n;
  final ColorScheme cs;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Column(
        children: [
          const Text('🎨', style: TextStyle(fontSize: 64)),
          const SizedBox(height: 12),
          Text(
            l10n.t('accountIdentitySub'),
            textAlign: TextAlign.center,
            style: GoogleFonts.fredoka(
              fontSize: 18, fontWeight: FontWeight.w600,
              color: cs.onSurface.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.t('accountOtpHint'),
            textAlign: TextAlign.center,
            style: GoogleFonts.nunito(
              fontSize: 13, color: cs.onSurface.withValues(alpha: 0.5)),
          ),
          const SizedBox(height: 32),
          if (error != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: cs.errorContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(error!,
                  style: GoogleFonts.nunito(
                      color: cs.onErrorContainer, fontSize: 13)),
            ),
            const SizedBox(height: 16),
          ],
          Form(
            key: formKey,
            child: Column(children: [
              TextFormField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => onSubmit(),
                decoration: InputDecoration(
                  labelText: l10n.t('accountEmailLabel'),
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                validator: (v) {
                  if (v == null || v.isEmpty ||
                      !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v)) {
                    return l10n.t('accountEmailError');
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: loading ? null : onSubmit,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: loading
                    ? const SizedBox(
                        width: 22, height: 22,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.5, color: Colors.white))
                    : Text(
                        l10n.t('accountContinueBtn'),
                        style: GoogleFonts.fredoka(
                            fontSize: 16, fontWeight: FontWeight.w700),
                      ),
              ),
            ]),
          ),
        ],
      ),
    );
  }
}

// ── Signed-in body ────────────────────────────────────────────────────────────
class _SignedInBody extends StatelessWidget {
  const _SignedInBody({
    required this.account,
    required this.l10n,
    required this.cs,
    required this.onSignOut,
  });

  final AccountState account;
  final L10n l10n;
  final ColorScheme cs;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final activeChild = account.activeChild;
    final avatarIdx = activeChild?.avatarIndex
        ?? (account.devices.isNotEmpty ? account.devices.first.avatarIndex : 0);

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        // Hero
        Center(
          child: Column(children: [
            Text(avatarEmoji(avatarIdx),
                style: const TextStyle(fontSize: 64)),
            const SizedBox(height: 8),
            Text(
              activeChild?.nickname ?? account.email ?? '',
              style: GoogleFonts.fredoka(
                  fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              account.email ?? '',
              style: GoogleFonts.nunito(
                  fontSize: 13, color: cs.onSurface.withValues(alpha: 0.5)),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: cs.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '✓ ${l10n.t("accountProgressSaved")}',
                style: GoogleFonts.fredoka(
                    fontSize: 13, color: cs.primary, fontWeight: FontWeight.w600),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 28),

        // Children section
        if (account.children.isNotEmpty) ...[
          Text(l10n.t('accountWhoIsColoring'),
              style: GoogleFonts.fredoka(
                  fontSize: 15, fontWeight: FontWeight.w700,
                  color: cs.onSurface.withValues(alpha: 0.5))),
          const SizedBox(height: 8),
          ...account.children.map((c) => _ChildTile(
            child: c,
            isActive: c.id == account.activeChildId,
            cs: cs,
            onTap: () => context
                .findAncestorStateOfType<_AccountScreenState>()
                ?._selectChild(c.id),
          )),
          const SizedBox(height: 8),
        ],

        // Add child button
        OutlinedButton.icon(
          onPressed: () async {
            await Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AddChildScreen()),
            );
          },
          icon: const Icon(Icons.add_rounded),
          label: Text(l10n.t('accountAddChild'),
              style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        const SizedBox(height: 24),

        // Switch child / I'm the parent
        if (account.children.isNotEmpty)
          TextButton(
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ChildSelectorScreen()),
              );
            },
            child: Text(l10n.t('accountSwitchChild'),
                style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
          ),
        const SizedBox(height: 8),

        // Sign out
        OutlinedButton.icon(
          onPressed: onSignOut,
          icon: const Icon(Icons.logout_rounded),
          label: Text(l10n.t('accountSignOutBtn'),
              style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            side: BorderSide(color: cs.error.withValues(alpha: 0.5)),
            foregroundColor: cs.error,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ],
    );
  }
}

extension on _AccountScreenState {
  Future<void> _selectChild(int id) async {
    await ref.read(accountProvider.notifier).setActiveChild(id);
    if (mounted) Navigator.of(context).pop();
  }
}

class _ChildTile extends StatelessWidget {
  const _ChildTile({
    required this.child,
    required this.isActive,
    required this.cs,
    required this.onTap,
  });

  final ChildProfile child;
  final bool isActive;
  final ColorScheme cs;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: isActive ? cs.primary.withValues(alpha: 0.08) : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: isActive ? BorderSide(color: cs.primary, width: 1.5)
                       : BorderSide.none,
      ),
      child: ListTile(
        leading: Text(avatarEmoji(child.avatarIndex),
            style: const TextStyle(fontSize: 28)),
        title: Text(child.nickname,
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700, fontSize: 15)),
        subtitle: child.ageGroup != null
            ? Text(child.ageGroup!, style: GoogleFonts.nunito(fontSize: 12))
            : null,
        trailing: isActive
            ? Icon(Icons.check_circle_rounded, color: cs.primary)
            : const Icon(Icons.radio_button_unchecked, color: Colors.grey),
        onTap: onTap,
      ),
    );
  }
}
