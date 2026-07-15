import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';
import '../../services/account_service.dart';
import '../community/widgets/community_artwork_card.dart' show avatarEmoji;
import 'add_child_screen.dart';

class ChildSelectorScreen extends ConsumerWidget {
  const ChildSelectorScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n    = ref.watch(l10nProvider);
    final account = ref.watch(accountProvider);
    final cs      = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('accountWhoIsColoring'),
            style: GoogleFonts.fredoka(fontWeight: FontWeight.w700)),
        centerTitle: true,
        automaticallyImplyLeading: false,
      ),
      body: Column(
        children: [
          // Grid of child cards
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 14,
                  mainAxisSpacing: 14,
                  childAspectRatio: 0.9,
                ),
                itemCount: account.children.length + 1, // +1 for Add button
                itemBuilder: (context, i) {
                  if (i == account.children.length) {
                    // Add child card
                    return _AddChildCard(l10n: l10n, cs: cs);
                  }
                  final child = account.children[i];
                  final isActive = child.id == account.activeChildId;
                  return _ChildCard(
                    child: child,
                    isActive: isActive,
                    cs: cs,
                    onTap: () async {
                      await ref.read(accountProvider.notifier).setActiveChild(child.id);
                      if (context.mounted) Navigator.of(context).pop(true);
                    },
                  );
                },
              ),
            ),
          ),

          // "I'm the parent" button
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              child: TextButton(
                onPressed: () async {
                  await ref.read(accountProvider.notifier).setActiveChild(null);
                  if (context.mounted) Navigator.of(context).pop(true);
                },
                child: Text(
                  l10n.t('accountImParent'),
                  style: GoogleFonts.fredoka(
                    fontWeight: FontWeight.w700,
                    color: cs.onSurface.withValues(alpha: 0.5),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChildCard extends StatelessWidget {
  const _ChildCard({
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
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: isActive
              ? cs.primary.withValues(alpha: 0.1)
              : cs.surfaceContainerLow,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isActive ? cs.primary : cs.outline.withValues(alpha: 0.3),
            width: isActive ? 2 : 1,
          ),
          boxShadow: isActive
              ? [BoxShadow(
                  color: cs.primary.withValues(alpha: 0.15),
                  blurRadius: 12, offset: const Offset(0, 4))]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(avatarEmoji(child.avatarIndex),
                style: const TextStyle(fontSize: 48)),
            const SizedBox(height: 8),
            Text(
              child.nickname,
              style: GoogleFonts.fredoka(
                  fontSize: 16, fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
            ),
            if (child.ageGroup != null) ...[
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                decoration: BoxDecoration(
                  color: cs.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  child.ageGroup!,
                  style: GoogleFonts.nunito(
                      fontSize: 11, color: cs.primary, fontWeight: FontWeight.w700),
                ),
              ),
            ],
            if (isActive) ...[
              const SizedBox(height: 6),
              Icon(Icons.check_circle_rounded, color: cs.primary, size: 20),
            ],
          ],
        ),
      ),
    );
  }
}

class _AddChildCard extends StatelessWidget {
  const _AddChildCard({required this.l10n, required this.cs});

  final L10n l10n;
  final ColorScheme cs;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const AddChildScreen()),
      ),
      child: Container(
        decoration: BoxDecoration(
          color: cs.surfaceContainerLow,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: cs.outline.withValues(alpha: 0.3),
            style: BorderStyle.solid,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_circle_outline_rounded,
                size: 48, color: cs.onSurface.withValues(alpha: 0.35)),
            const SizedBox(height: 8),
            Text(
              l10n.t('accountAddChild'),
              style: GoogleFonts.fredoka(
                  fontSize: 16, fontWeight: FontWeight.w700,
                  color: cs.onSurface.withValues(alpha: 0.5)),
            ),
          ],
        ),
      ),
    );
  }
}
