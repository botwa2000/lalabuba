import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../community_service.dart';
import '../models/family_model.dart';
import '../widgets/community_artwork_card.dart' show avatarEmoji;
import '../../../shared/widgets/parental_gate.dart';
import '../../../core/di/providers.dart';

class FamilyScreen extends ConsumerStatefulWidget {
  const FamilyScreen({super.key});

  @override
  ConsumerState<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends ConsumerState<FamilyScreen> {
  FamilyData? _family;
  bool _loading = true;
  bool _acting = false;
  String _baseUrl = 'https://lalabuba.com';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final svc = ref.read(communityServiceProvider);
    final config = ref.read(appConfigProvider).valueOrNull;
    if (config != null) _baseUrl = config.apiBaseUrl;
    setState(() => _loading = true);
    try {
      final data = await svc.getFamily();
      if (mounted) setState(() { _family = data; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _family = null; _loading = false; });
    }
  }

  Future<void> _createFamily() async {
    final l10n = ref.read(l10nProvider);
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showParentalGate(context, l10n);
    if (!ok || !mounted) return;
    setState(() => _acting = true);
    try {
      final svc = ref.read(communityServiceProvider);
      final result = await svc.createFamily();
      if (mounted) {
        await _load();
        messenger.showSnackBar(
          SnackBar(
            content: Text(l10n.t('familyCreatedMsg', {'code': result.familyCode})),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text(l10n.t('familyJoinError'))),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _joinFamily() async {
    final l10n = ref.read(l10nProvider);
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showParentalGate(context, l10n);
    if (!ok || !mounted) return;

    final ctrl = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(l10n.t('familyEnterCodeTitle'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLength: 6,
          textCapitalization: TextCapitalization.characters,
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[A-HJ-NP-Z2-9a-hj-np-z]')),
            LengthLimitingTextInputFormatter(6),
          ],
          decoration: const InputDecoration(
            hintText: 'ABC123',
            border: OutlineInputBorder(),
          ),
          onSubmitted: (v) {
            if (v.length == 6) Navigator.of(ctx).pop(v.toUpperCase());
          },
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(l10n.t('cancel'),
                  style: GoogleFonts.fredoka(fontWeight: FontWeight.w700))),
          FilledButton(
              onPressed: () {
                final v = ctrl.text.trim().toUpperCase();
                if (v.length == 6) Navigator.of(ctx).pop(v);
              },
              child: Text(l10n.t('familyJoinBtn'),
                  style: GoogleFonts.fredoka(fontWeight: FontWeight.w700))),
        ],
      ),
    );
    ctrl.dispose();
    if (code == null || !mounted) return;

    setState(() => _acting = true);
    try {
      await ref.read(communityServiceProvider).joinFamily(code);
      if (mounted) {
        await _load();
        messenger.showSnackBar(
          SnackBar(content: Text(l10n.t('familyJoinedMsg'))),
        );
      }
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(
              content: Text(e.toString().contains('400')
                  ? l10n.t('familyInvalidCode')
                  : l10n.t('familyJoinError'))),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _leaveFamily() async {
    final l10n = ref.read(l10nProvider);
    final leaveMessenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.t('familyLeaveDialogTitle'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        content: Text(l10n.t('familyLeaveDialogBody')),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(l10n.t('familyLeaveBtn'),
                  style: const TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _acting = true);
    try {
      await ref.read(communityServiceProvider).leaveFamily();
      if (mounted) {
        await _load();
        leaveMessenger.showSnackBar(
          SnackBar(content: Text(l10n.t('familyLeaveMsg'))),
        );
      }
    } catch (e) {
      if (mounted) {
        leaveMessenger.showSnackBar(
          SnackBar(content: Text(
            e.toString().contains('429') || e.toString().contains('Too many')
              ? l10n.t('familyLeaveRateLimit')
              : l10n.t('familyLeaveError')
          )),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final l10n = ref.watch(l10nProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('familyScreenTitle'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        actions: [
          if (_family != null)
            TextButton(
              onPressed: _acting ? null : _leaveFamily,
              child: Text(l10n.t('familyLeaveBtn'),
                  style: GoogleFonts.nunito(
                      color: cs.error, fontWeight: FontWeight.w700)),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _acting
              ? const Center(child: CircularProgressIndicator())
              : _family == null
                  ? _buildNoFamily(cs, l10n)
                  : _buildFamily(_family!, cs, l10n),
    );
  }

  Widget _buildNoFamily(ColorScheme cs, l10n) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('👨‍👩‍👧', style: TextStyle(fontSize: 64)),
            const SizedBox(height: 16),
            Text(
              l10n.t('familyShareHeading'),
              textAlign: TextAlign.center,
              style: GoogleFonts.fredoka(
                  fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              l10n.t('familyShareBody'),
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(
                  fontSize: 14,
                  color: cs.onSurface.withValues(alpha: 0.7)),
            ),
            const SizedBox(height: 32),
            FilledButton.icon(
              icon: const Text('🏠', style: TextStyle(fontSize: 18)),
              label: Text(l10n.t('familyStartBtn'),
                  style:
                      GoogleFonts.fredoka(fontSize: 16, fontWeight: FontWeight.w700)),
              onPressed: _createFamily,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(50)),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              icon: const Text('🔑', style: TextStyle(fontSize: 18)),
              label: Text(l10n.t('familyJoinBtn'),
                  style:
                      GoogleFonts.fredoka(fontSize: 16, fontWeight: FontWeight.w700)),
              onPressed: _joinFamily,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(50)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFamily(FamilyData family, ColorScheme cs, l10n) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.t('familyCodeLabel'),
                    style: GoogleFonts.nunito(
                        fontSize: 12,
                        color: cs.onSurface.withValues(alpha: 0.6))),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      family.familyCode,
                      style: GoogleFonts.fredoka(
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 4),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.copy_rounded),
                      onPressed: () {
                        Clipboard.setData(
                            ClipboardData(text: family.familyCode));
                        HapticFeedback.lightImpact();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                              content: Text(l10n.t('familyCodeCopied'))),
                        );
                      },
                    ),
                  ],
                ),
                Text(
                  l10n.t('familyMemberCount', {'count': family.memberCount.toString()}),
                  style: GoogleFonts.nunito(fontSize: 13),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(l10n.t('familyMembersLabel'),
            style: GoogleFonts.fredoka(
                fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        for (final member in family.members) ...[
          _MemberCard(member: member, baseUrl: _baseUrl),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _MemberCard extends StatelessWidget {
  final FamilyMember member;
  final String baseUrl;

  const _MemberCard({required this.member, required this.baseUrl});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(avatarEmoji(member.avatarIndex),
                    style: const TextStyle(fontSize: 28)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(member.nickname,
                          style: GoogleFonts.fredoka(
                              fontSize: 16, fontWeight: FontWeight.w700)),
                      Text(
                        '🎨 ${member.totalCompleted} · 🔥 ${member.currentStreak}',
                        style: GoogleFonts.nunito(
                            fontSize: 12,
                            color: cs.onSurface.withValues(alpha: 0.7)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (member.recentArtworks.isNotEmpty) ...[
              const SizedBox(height: 10),
              SizedBox(
                height: 80,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: member.recentArtworks.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (ctx, i) {
                    final art = member.recentArtworks[i];
                    final url = art.imageUrl.startsWith('/')
                        ? '$baseUrl${art.imageUrl}'
                        : art.imageUrl;
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        url,
                        width: 80,
                        height: 80,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 80,
                          height: 80,
                          color: cs.surfaceContainerHighest,
                          child: const Center(
                              child: Text('🎨',
                                  style: TextStyle(fontSize: 28))),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
