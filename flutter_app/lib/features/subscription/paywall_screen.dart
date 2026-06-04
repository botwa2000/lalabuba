import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/l10n/l10n_service.dart';

class PaywallScreen extends ConsumerWidget {
  const PaywallScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final l10n = ref.watch(l10nProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      const SizedBox(height: 24),
                      const Text('✨', style: TextStyle(fontSize: 72)),
                      const SizedBox(height: 16),
                      Text(
                        l10n.t('subscribeTitle'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.fredoka(
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                          color: cs.primary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l10n.t('subscribeSubtitle'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.nunito(
                          fontSize: 15,
                          color: cs.onSurface.withValues(alpha: 0.7),
                        ),
                      ),
                      const SizedBox(height: 32),
                      // Feature list
                      ...l10n.tList('plusFeatures').map((f) => _FeatureRow(f)),
                      const SizedBox(height: 24),
                      // Price cards (placeholder — real prices from store at runtime)
                      _PriceCard(
                        title: l10n.t('subscribePlusMonthly'),
                        price: '\$2.99/mo',
                        primary: false,
                        onTap: () => _purchase(context, 'plus_monthly'),
                      ),
                      const SizedBox(height: 12),
                      _PriceCard(
                        title: l10n.t('subscribePlusYearly'),
                        price: '\$14.99/yr',
                        badge: l10n.t('subscribeYearlySave', {'percent': '58'}),
                        primary: true,
                        onTap: () => _purchase(context, 'plus_yearly'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Dismiss
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  l10n.t('subscribeLater'),
                  style: GoogleFonts.nunito(
                      fontSize: 14,
                      color: cs.onSurface.withValues(alpha: 0.5)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _purchase(BuildContext context, String productId) {
    // TODO: wire up in_app_purchase
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text('Purchase $productId — coming soon!')),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  final String text;
  const _FeatureRow(this.text);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(Icons.check_circle_rounded, color: cs.primary, size: 20),
          const SizedBox(width: 10),
          Text(text, style: GoogleFonts.nunito(fontSize: 14)),
        ],
      ),
    );
  }
}

class _PriceCard extends StatelessWidget {
  final String title;
  final String price;
  final String? badge;
  final bool primary;
  final VoidCallback onTap;

  const _PriceCard({
    required this.title,
    required this.price,
    required this.primary,
    required this.onTap,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: primary ? cs.primary : cs.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
          border: primary
              ? null
              : Border.all(color: cs.outlineVariant),
          boxShadow: primary
              ? [
                  BoxShadow(
                      color: cs.primary.withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4))
                ]
              : null,
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.fredoka(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                      color: primary ? Colors.white : cs.onSurface,
                    ),
                  ),
                  if (badge != null)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(50),
                      ),
                      child: Text(
                        badge!,
                        style: GoogleFonts.nunito(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: primary ? Colors.white : cs.primary,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Text(
              price,
              style: GoogleFonts.fredoka(
                fontWeight: FontWeight.w700,
                fontSize: 18,
                color: primary ? Colors.white : cs.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
