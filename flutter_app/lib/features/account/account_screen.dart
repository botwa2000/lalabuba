import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../../services/account_service.dart';
import '../community/widgets/community_artwork_card.dart' show avatarEmoji;

class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _emailCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _formKey      = GlobalKey<FormState>();
  bool _loading = false;
  String? _error;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
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
          account.isSignedIn
              ? l10n.t('accountTitle')
              : l10n.t('accountSaveProgress'),
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
        ),
        centerTitle: true,
      ),
      body: account.isSignedIn
          ? _SignedInView(account: account, l10n: l10n, cs: cs,
              onSignOut: _signOut)
          : _AuthView(
              tabs: _tabs,
              emailCtrl: _emailCtrl,
              passwordCtrl: _passwordCtrl,
              formKey: _formKey,
              loading: _loading,
              error: _error,
              obscurePassword: _obscurePassword,
              onToggleObscure: () =>
                  setState(() => _obscurePassword = !_obscurePassword),
              onSubmit: _submit,
              l10n: l10n,
              cs: cs,
            ),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _loading = true; _error = null; });
    final l10n = ref.read(l10nProvider);
    final notifier = ref.read(accountProvider.notifier);
    final email    = _emailCtrl.text.trim().toLowerCase();
    final password = _passwordCtrl.text;
    try {
      if (_tabs.index == 0) {
        await notifier.register(email, password);
      } else {
        await notifier.login(email, password);
      }
      if (mounted) Navigator.of(context).pop();
    } on Exception catch (e) {
      final msg = e.toString();
      String friendly;
      if (msg.contains('EMAIL_TAKEN')) {
        friendly = l10n.t('accountEmailTaken');
      } else if (msg.contains('BAD_CREDENTIALS')) {
        friendly = l10n.t('accountWrongPassword');
      } else {
        friendly = msg.replaceFirst('Exception: ', '');
      }
      if (mounted) setState(() { _error = friendly; _loading = false; });
    }
  }

  Future<void> _signOut() async {
    setState(() => _loading = true);
    await ref.read(accountProvider.notifier).logout();
    if (mounted) Navigator.of(context).pop();
  }
}

// ── Signed-in view ────────────────────────────────────────────────────────────

class _SignedInView extends StatelessWidget {
  const _SignedInView({
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
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        // Hero identity block
        Center(
          child: Column(children: [
            Text(
              avatarEmoji(
                account.devices.isNotEmpty ? account.devices.first.avatarIndex : 0,
              ),
              style: const TextStyle(fontSize: 64),
            ),
            const SizedBox(height: 8),
            Text(
              account.email ?? '',
              style: GoogleFonts.nunito(fontSize: 14, color: cs.onSurface.withValues(alpha: 0.6)),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: cs.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '✓ ${l10n.t('accountProgressSaved')}',
                style: GoogleFonts.fredoka(
                  fontSize: 13,
                  color: cs.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 28),

        // Devices linked
        if (account.devices.isNotEmpty) ...[
          Text(
            l10n.t('accountDevicesLabel'),
            style: GoogleFonts.fredoka(
              fontSize: 15, fontWeight: FontWeight.w700,
              color: cs.onSurface.withValues(alpha: 0.5),
            ),
          ),
          const SizedBox(height: 8),
          ...account.devices.map((d) => _DeviceTile(device: d, cs: cs)),
          const SizedBox(height: 20),
        ],

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
          ),
        ),
      ],
    );
  }
}

class _DeviceTile extends StatelessWidget {
  const _DeviceTile({required this.device, required this.cs});
  final DeviceProfile device;
  final ColorScheme cs;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Text(avatarEmoji(device.avatarIndex),
            style: const TextStyle(fontSize: 28)),
        title: Text(
          device.nickname ?? '—',
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700, fontSize: 15),
        ),
        subtitle: Text(
          '🎨 ${device.totalCompleted}  🔥 ${device.currentStreak} days',
          style: GoogleFonts.nunito(fontSize: 12),
        ),
      ),
    );
  }
}

// ── Auth (register / sign in) view ────────────────────────────────────────────

class _AuthView extends StatelessWidget {
  const _AuthView({
    required this.tabs,
    required this.emailCtrl,
    required this.passwordCtrl,
    required this.formKey,
    required this.loading,
    required this.error,
    required this.obscurePassword,
    required this.onToggleObscure,
    required this.onSubmit,
    required this.l10n,
    required this.cs,
  });

  final TabController tabs;
  final TextEditingController emailCtrl;
  final TextEditingController passwordCtrl;
  final GlobalKey<FormState> formKey;
  final bool loading;
  final String? error;
  final bool obscurePassword;
  final VoidCallback onToggleObscure;
  final VoidCallback onSubmit;
  final L10n l10n;
  final ColorScheme cs;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // Fun header
          Text('🎨', style: const TextStyle(fontSize: 64)),
          const SizedBox(height: 12),
          Text(
            l10n.t('accountIdentitySub'),
            textAlign: TextAlign.center,
            style: GoogleFonts.fredoka(
                fontSize: 18, fontWeight: FontWeight.w600,
                color: cs.onSurface.withValues(alpha: 0.7)),
          ),
          const SizedBox(height: 24),

          // Tabs
          Container(
            decoration: BoxDecoration(
              color: cs.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.all(4),
            child: TabBar(
              controller: tabs,
              dividerColor: Colors.transparent,
              indicator: BoxDecoration(
                color: cs.surface,
                borderRadius: BorderRadius.circular(9),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 4, offset: const Offset(0, 1)),
                ],
              ),
              labelStyle:  GoogleFonts.fredoka(fontWeight: FontWeight.w700, fontSize: 14),
              unselectedLabelStyle: GoogleFonts.fredoka(fontSize: 14),
              tabs: [
                Tab(text: l10n.t('accountCreateTab')),
                Tab(text: l10n.t('accountSignInTab')),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Error banner
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

          // Form
          Form(
            key: formKey,
            child: Column(
              children: [
                TextFormField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  textInputAction: TextInputAction.next,
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
                const SizedBox(height: 14),
                TextFormField(
                  controller: passwordCtrl,
                  obscureText: obscurePassword,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => onSubmit(),
                  decoration: InputDecoration(
                    labelText: l10n.t('accountPasswordLabel'),
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    suffixIcon: IconButton(
                      icon: Icon(obscurePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined),
                      onPressed: onToggleObscure,
                    ),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  validator: (v) {
                    if (tabs.index == 0 && (v == null || v.length < 6)) {
                      return l10n.t('accountPasswordError');
                    }
                    if (tabs.index == 1 && (v == null || v.isEmpty)) {
                      return l10n.t('accountPasswordError');
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
                      : AnimatedBuilder(
                          animation: tabs,
                          builder: (_, __) => Text(
                            tabs.index == 0
                                ? l10n.t('accountRegisterBtn')
                                : l10n.t('accountSignInBtn'),
                            style: GoogleFonts.fredoka(
                                fontSize: 16, fontWeight: FontWeight.w700),
                          ),
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
