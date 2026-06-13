import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/l10n/l10n_service.dart';
import '../../shared/widgets/parental_gate.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = ref.watch(l10nProvider);

    // Language + Theme intentionally live ONLY in the home top bar now (a 🌙
    // toggle and 🌐 picker). They used to be duplicated here, which made the
    // Settings screen feel like a redundant repeat of the top icons. This screen
    // now holds only what has no quick-access home: about.
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
          // About
          _buildAboutSection(context, l10n),
        ],
      ),
    );
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
