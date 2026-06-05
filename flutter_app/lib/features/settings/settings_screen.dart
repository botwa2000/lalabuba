import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/di/providers.dart';
import '../../core/l10n/l10n_service.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = ref.watch(l10nProvider);
    final themeMode = ref.watch(themeModeProvider);
    final settings = ref.watch(settingsProvider).valueOrNull;

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
          // Language
          _SectionHeader(l10n.t('settingsLanguage')),
          _buildLanguagePicker(context, ref, l10n),
          const SizedBox(height: 16),

          // Theme
          _SectionHeader(l10n.t('settingsTheme')),
          _buildThemeSelector(context, ref, l10n, themeMode),
          const SizedBox(height: 16),

          // Difficulty
          _SectionHeader(l10n.t('diffLabel')),
          _buildDifficultySelector(context, ref, l10n, settings),
          const SizedBox(height: 16),

          // Subscription placeholder
          _SectionHeader(l10n.t('settingsSubscription')),
          _buildSubscriptionTile(context, l10n),
          const SizedBox(height: 16),

          // About
          _buildAboutSection(context, l10n),
        ],
      ),
    );
  }

  Widget _buildLanguagePicker(
      BuildContext context, WidgetRef ref, L10n l10n) {
    final currentLocale =
        ref.watch(localeProvider).valueOrNull?.locale ?? 'en';
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: languageMeta.entries.map((e) {
        final selected = e.key == currentLocale;
        final cs = Theme.of(context).colorScheme;
        return GestureDetector(
          onTap: () =>
              ref.read(localeProvider.notifier).setLocale(e.key),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: selected ? cs.primaryContainer : cs.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(50),
              border: Border.all(
                  color: selected ? cs.primary : cs.outlineVariant,
                  width: selected ? 2 : 1),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(e.value.flag,
                    style: const TextStyle(fontSize: 16)),
                const SizedBox(width: 6),
                Text(
                  e.value.code,
                  style: GoogleFonts.nunito(
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
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
    );
  }

  Widget _buildThemeSelector(BuildContext context, WidgetRef ref, L10n l10n,
      ThemeMode current) {
    final options = [
      (ThemeMode.light, l10n.t('settingsThemeLight'), Icons.light_mode_rounded),
      (ThemeMode.dark, l10n.t('settingsThemeDark'), Icons.dark_mode_rounded),
      (ThemeMode.system, l10n.t('settingsThemeSystem'), Icons.brightness_auto_rounded),
    ];
    final cs = Theme.of(context).colorScheme;
    return Row(
      children: options.map((o) {
        final selected = o.$1 == current;
        return Expanded(
          child: GestureDetector(
            onTap: () =>
                ref.read(themeModeProvider.notifier).state = o.$1,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: selected
                    ? cs.primaryContainer
                    : cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: selected ? cs.primary : cs.outlineVariant,
                    width: selected ? 2 : 1),
              ),
              child: Column(
                children: [
                  Icon(o.$3,
                      color: selected
                          ? cs.onPrimaryContainer
                          : cs.onSurface),
                  const SizedBox(height: 4),
                  Text(
                    o.$2,
                    style: GoogleFonts.nunito(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: selected
                          ? cs.onPrimaryContainer
                          : cs.onSurface,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildDifficultySelector(BuildContext context, WidgetRef ref,
      L10n l10n, SettingsState? settings) {
    final cs = Theme.of(context).colorScheme;
    final options = [
      ('easy', l10n.t('diffEasy')),
      ('medium', l10n.t('diffMedium')),
      ('hard', l10n.t('diffHard')),
      ('extreme', l10n.t('diffExtreme')),
    ];
    return Wrap(
      spacing: 8,
      children: options.map((o) {
        final selected = settings?.difficulty == o.$1;
        return GestureDetector(
          onTap: () =>
              ref.read(settingsProvider.notifier).setDifficulty(o.$1),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: selected ? cs.primary : cs.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(50),
              border: Border.all(
                  color: selected ? cs.primary : cs.outlineVariant),
            ),
            child: Text(
              o.$2,
              style: GoogleFonts.nunito(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: selected ? Colors.white : cs.onSurface,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildSubscriptionTile(BuildContext context, L10n l10n) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      child: ListTile(
        onTap: () => context.pushNamed('subscription'),
        leading: const Text('⭐', style: TextStyle(fontSize: 24)),
        title: Text(
          'Free tier',
          style: GoogleFonts.fredoka(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          '5 drawings/day • Easy + Medium',
          style: GoogleFonts.nunito(fontSize: 13),
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [cs.primary, cs.secondary]),
            borderRadius: BorderRadius.circular(50),
          ),
          child: Text(
            'Go Plus',
            style: GoogleFonts.fredoka(
                color: Colors.white, fontWeight: FontWeight.w700),
          ),
        ),
      ),
    );
  }

  Widget _buildAboutSection(BuildContext context, L10n l10n) {
    return FutureBuilder<PackageInfo>(
      future: PackageInfo.fromPlatform(),
      builder: (ctx, snap) {
        final version = snap.data?.version ?? '1.0.0';
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionHeader('About'),
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
                    onTap: () => launchUrl(
                        Uri.parse('https://lalabuba.com/privacy'),
                        mode: LaunchMode.externalApplication),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    title: Text(l10n.t('settingsTerms'),
                        style: GoogleFonts.nunito(fontSize: 14)),
                    leading: const Icon(Icons.description_outlined),
                    trailing: const Icon(Icons.open_in_new_rounded, size: 16),
                    onTap: () => launchUrl(
                        Uri.parse('https://lalabuba.com/terms'),
                        mode: LaunchMode.externalApplication),
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
