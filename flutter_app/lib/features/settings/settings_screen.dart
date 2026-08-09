import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/l10n/l10n_service.dart';
import '../../core/di/providers.dart' show themeModeProvider;
import '../../services/account_service.dart';
import '../../shared/services/storage_service.dart';
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

  Widget _buildDisplaySection(BuildContext context, L10n l10n) {
    final themeMode = ref.watch(themeModeProvider);
    final currentLocale = ref.watch(localeProvider).value?.locale ?? 'en';
    final cs = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(l10n.t('settingsDisplay')),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Theme toggle
                Text(l10n.t('settingsTheme'),
                    style: GoogleFonts.nunito(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: cs.onSurface.withValues(alpha: 0.6))),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _SettingsChoiceChip(
                      label: l10n.t('settingsThemeLight'),
                      icon: Icons.light_mode_rounded,
                      selected: themeMode == ThemeMode.light,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        ref.read(themeModeProvider.notifier).state = ThemeMode.light;
                      },
                    ),
                    const SizedBox(width: 8),
                    _SettingsChoiceChip(
                      label: l10n.t('settingsThemeDark'),
                      icon: Icons.dark_mode_rounded,
                      selected: themeMode == ThemeMode.dark,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        ref.read(themeModeProvider.notifier).state = ThemeMode.dark;
                      },
                    ),
                    const SizedBox(width: 8),
                    _SettingsChoiceChip(
                      label: l10n.t('settingsThemeSystem'),
                      icon: Icons.brightness_auto_rounded,
                      selected: themeMode == ThemeMode.system,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        ref.read(themeModeProvider.notifier).state = ThemeMode.system;
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Language picker
                Text(l10n.t('settingsLanguage'),
                    style: GoogleFonts.nunito(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: cs.onSurface.withValues(alpha: 0.6))),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: languageMeta.entries.map((e) {
                    final selected = e.key == currentLocale;
                    return GestureDetector(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        ref.read(localeProvider.notifier).setLocale(e.key);
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: selected
                              ? cs.primaryContainer
                              : cs.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: selected
                                ? cs.primary.withValues(alpha: 0.55)
                                : cs.outlineVariant.withValues(alpha: 0.5),
                            width: selected ? 1.5 : 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(e.value.flag,
                                style: const TextStyle(fontSize: 16)),
                            const SizedBox(width: 6),
                            Text(
                              e.value.name,
                              style: GoogleFonts.nunito(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: selected
                                    ? cs.onPrimaryContainer
                                    : cs.onSurface,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

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
          _buildDisplaySection(context, l10n),
          const SizedBox(height: 16),
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
                  const Divider(height: 1),
                  ListTile(
                    title: Text(
                      l10n.t('settingsDeleteAccount'),
                      style: GoogleFonts.nunito(
                          fontSize: 14, color: Colors.red[700]),
                    ),
                    leading: Icon(Icons.delete_forever_outlined,
                        color: Colors.red[700]),
                    onTap: () => _confirmDeleteAccount(ctx, l10n),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Future<void> _confirmDeleteAccount(BuildContext ctx, L10n l10n) async {
    final confirmed = await showDialog<bool>(
      context: ctx,
      builder: (dCtx) => AlertDialog(
        title: Text(l10n.t('deleteAccountTitle'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        content: Text(l10n.t('deleteAccountBody'),
            style: GoogleFonts.nunito()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dCtx, false),
            child: Text(l10n.t('cancel')),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red[700]),
            onPressed: () => Navigator.pop(dCtx, true),
            child: Text(l10n.t('deleteAccountConfirm')),
          ),
        ],
      ),
    );
    if (confirmed != true || !ctx.mounted) return;

    // Delete server-side profile + artworks (best-effort — don't block on network)
    try {
      final svc = ref.read(communityServiceProvider);
      await svc.deleteProfile();
    } catch (_) {}

    // Wipe all local secure storage (except theme + locale which are device preferences)
    await Future.wait([
      StorageService.delete(StorageService.kDeviceId),
      StorageService.delete(StorageService.kDifficulty),
      StorageService.delete(StorageService.kPalette),
      StorageService.delete(StorageService.kColorCount),
      StorageService.delete(StorageService.kShowNumbers),
      StorageService.delete(StorageService.kDailyCount),
      StorageService.delete(StorageService.kDailyDate),
      StorageService.delete(StorageService.kTutorialHome),
      StorageService.delete(StorageService.kTutorialCanvas),
      StorageService.delete(StorageService.kNarrate),
    ]);

    if (!ctx.mounted) return;
    // Return to root — app will re-initialise as a fresh install on next launch
    Navigator.of(ctx).popUntil((route) => route.isFirst);
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(content: Text(l10n.t('deleteAccountSuccess'))),
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

class _SettingsChoiceChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _SettingsChoiceChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? cs.primaryContainer : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? cs.primary.withValues(alpha: 0.55)
                : cs.outlineVariant.withValues(alpha: 0.5),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: 16,
                color: selected ? cs.onPrimaryContainer : cs.onSurface),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.nunito(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: selected ? cs.onPrimaryContainer : cs.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
