import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/l10n/l10n_service.dart';
import '../../services/account_service.dart';
import '../../shared/widgets/parental_gate.dart';
import '../community/community_service.dart';
import '../community/models/profile_model.dart';
import '../community/widgets/nickname_picker.dart';
import '../community/widgets/avatar_picker.dart';
import '../community/screens/family_screen.dart';
import '../community/widgets/community_artwork_card.dart' show avatarEmoji;
import '../account/account_screen.dart';
import '../account/child_selector_screen.dart';
import '../account/add_child_screen.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  CommunityProfile? _profile;
  bool _profileLoading = true;

  Widget _buildAccountSection(BuildContext context, L10n l10n) {
    final account = ref.watch(accountProvider);
    final cs      = Theme.of(context).colorScheme;
    final activeChild = account.activeChild;
    final avatarIdx   = activeChild?.avatarIndex
        ?? (account.devices.isNotEmpty ? account.devices.first.avatarIndex : 0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(l10n.t('accountSaveProgress')),
        Card(
          child: Column(
            children: [
              // Account row
              ListTile(
                leading: Text(
                  account.isSignedIn ? avatarEmoji(avatarIdx) : '👤',
                  style: const TextStyle(fontSize: 28),
                ),
                title: Text(
                  account.isSignedIn
                      ? (activeChild?.nickname ?? account.email ?? l10n.t('accountTitle'))
                      : l10n.t('accountSaveProgress'),
                  style: GoogleFonts.fredoka(
                    fontWeight: FontWeight.w700,
                    color: account.isSignedIn ? null
                        : cs.onSurface.withValues(alpha: 0.6),
                  ),
                ),
                subtitle: Text(
                  account.isSignedIn
                      ? '✓ ${l10n.t("accountProgressSaved")}'
                      : l10n.t('accountSaveProgressSub'),
                  style: GoogleFonts.nunito(
                    fontSize: 12,
                    color: account.isSignedIn ? cs.primary : null,
                  ),
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AccountScreen()),
                ),
              ),
              // Children section (only when signed in with children)
              if (account.isSignedIn && account.children.isNotEmpty) ...[
                const Divider(height: 1),
                ListTile(
                  leading: const Text('🧒', style: TextStyle(fontSize: 24)),
                  title: Text(l10n.t('accountWhoIsColoring'),
                      style: GoogleFonts.nunito(
                          fontSize: 14, fontWeight: FontWeight.w700)),
                  subtitle: Text(
                    activeChild?.nickname ?? l10n.t('accountNoChildSelected'),
                    style: GoogleFonts.nunito(fontSize: 12),
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ChildSelectorScreen()),
                  ),
                ),
              ],
              // Add child tile (only when signed in)
              if (account.isSignedIn) ...[
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.add_rounded),
                  title: Text(l10n.t('accountAddChild'),
                      style: GoogleFonts.nunito(
                          fontSize: 14, fontWeight: FontWeight.w700)),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const AddChildScreen()),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadProfile());
  }

  Future<void> _loadProfile() async {
    try {
      final svc = ref.read(communityServiceProvider);
      final p = await svc.getProfile();
      if (mounted) setState(() { _profile = p; _profileLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _profileLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ref.watch(l10nProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          l10n.t('settingsTitle'),
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildAccountSection(context, l10n),
          const SizedBox(height: 16),
          _buildCommunitySection(context, l10n),
          const SizedBox(height: 16),
          _buildAboutSection(context, l10n),
        ],
      ),
    );
  }

  Widget _buildCommunitySection(BuildContext context, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(l10n.t('communityProfileHeader')),
        Card(
          child: Column(
            children: [
              // Avatar + nickname row
              ListTile(
                leading: _profileLoading
                    ? const SizedBox(
                        width: 32, height: 32,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(
                        avatarEmoji(_profile?.avatarIndex ?? 0),
                        style: const TextStyle(fontSize: 28),
                      ),
                title: Text(
                  _profile?.nickname ?? l10n.t('communityNoNickname'),
                  style: GoogleFonts.fredoka(
                    fontWeight: FontWeight.w700,
                    color: _profile?.nickname == null
                        ? cs.onSurface.withValues(alpha: 0.5)
                        : null,
                  ),
                ),
                subtitle: Text(
                  _profile?.sharingEnabled == true
                      ? l10n.t('communitySharingOn')
                      : l10n.t('communitySharingOff'),
                  style: GoogleFonts.nunito(fontSize: 12),
                ),
                trailing: TextButton(
                  onPressed: _editProfile,
                  child: Text(l10n.t('communityEditBtn'),
                      style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
                ),
              ),
              const Divider(height: 1),
              // Family group tile
              ListTile(
                leading: const Text('👨‍👩‍👧', style: TextStyle(fontSize: 24)),
                title: Text(l10n.t('communityFamilyGroupTitle'),
                    style: GoogleFonts.nunito(
                        fontSize: 14, fontWeight: FontWeight.w700)),
                subtitle: Text(
                  _profile?.familyId != null
                      ? l10n.t('communityFamilyInGroup')
                      : l10n.t('communityFamilyShareSub'),
                  style: GoogleFonts.nunito(fontSize: 12),
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const FamilyScreen()),
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _editProfile() async {
    final l10n = ref.read(l10nProvider);
    final svc = ref.read(communityServiceProvider);
    final messenger = ScaffoldMessenger.of(context);

    // Avatar
    final newAvatar = await showAvatarPicker(
        context, _profile?.avatarIndex ?? 0, l10n);
    if (!mounted) return;

    // Nickname
    final newNickname = await showNicknamePicker(context, svc, l10n);
    if (!mounted) return;

    // Parental consent if sharing not yet enabled
    bool withConsent = false;
    if (_profile?.sharingEnabled != true) {
      final ok = await showParentalGate(context, l10n);
      if (!mounted) return;
      withConsent = ok;
    }

    if (newAvatar == null && newNickname == null && !withConsent) return;

    try {
      final updated = await svc.setupProfile(
        nickname: newNickname,
        avatarIndex: newAvatar,
        withParentalConsent: withConsent,
      );
      if (mounted) {
        setState(() => _profile = updated);
        messenger.showSnackBar(
          SnackBar(content: Text(l10n.t('communityProfileUpdated'))),
        );
      }
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  // Gate external links behind a parental check (Kids Category / Families
  // requirement) before leaving the app to the web.
  Future<void> _openExternal(BuildContext context, L10n l10n, String url) async {
    final ok = await showParentalGate(context, l10n);
    if (!ok) return;
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  Widget _buildAboutSection(BuildContext context, L10n l10n) {
    return FutureBuilder<PackageInfo>(
      future: PackageInfo.fromPlatform(),
      builder: (ctx, snap) {
        final version = snap.data?.version ?? '1.0.0';
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionHeader(l10n.t('settingsAbout')),
            Card(
              child: Column(
                children: [
                  ListTile(
                    title: Text(
                      l10n.t('settingsVersion', {'version': version}),
                      style: GoogleFonts.nunito(fontSize: 14),
                    ),
                    leading: const Icon(Icons.info_outline_rounded),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    title: Text(l10n.t('settingsPrivacy'),
                        style: GoogleFonts.nunito(fontSize: 14)),
                    leading: const Icon(Icons.privacy_tip_outlined),
                    trailing: const Icon(Icons.open_in_new_rounded, size: 16),
                    onTap: () => _openExternal(
                        ctx, l10n, 'https://lalabuba.com/privacy'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    title: Text(l10n.t('settingsTerms'),
                        style: GoogleFonts.nunito(fontSize: 14)),
                    leading: const Icon(Icons.description_outlined),
                    trailing: const Icon(Icons.open_in_new_rounded, size: 16),
                    onTap: () => _openExternal(
                        ctx, l10n, 'https://lalabuba.com/terms'),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String text;
  const _SectionHeader(this.text);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: GoogleFonts.fredoka(
          fontWeight: FontWeight.w700,
          fontSize: 16,
          color: cs.primary,
        ),
      ),
    );
  }
}
