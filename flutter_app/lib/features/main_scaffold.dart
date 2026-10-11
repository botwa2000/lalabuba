import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/l10n/l10n_service.dart';

class MainScaffold extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const MainScaffold({super.key, required this.navigationShell});

  void _onTabTapped(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = ref.watch(l10nProvider);
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: _onTabTapped,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          NavigationDestination(
            icon: Text('✨', style: GoogleFonts.nunito(fontSize: 22, height: 1)),
            selectedIcon: Text('✨', style: GoogleFonts.nunito(fontSize: 26, height: 1)),
            label: l10n.t('navDraw'),
          ),
          NavigationDestination(
            icon: Text('🔍', style: GoogleFonts.nunito(fontSize: 22, height: 1)),
            selectedIcon: Text('🔍', style: GoogleFonts.nunito(fontSize: 26, height: 1)),
            label: l10n.t('navExplore'),
          ),
          NavigationDestination(
            icon: Text('📓', style: GoogleFonts.nunito(fontSize: 22, height: 1)),
            selectedIcon: Text('📓', style: GoogleFonts.nunito(fontSize: 26, height: 1)),
            label: l10n.t('navJournal'),
          ),
          NavigationDestination(
            icon: Text('🌳', style: GoogleFonts.nunito(fontSize: 22, height: 1)),
            selectedIcon: Text('🌳', style: GoogleFonts.nunito(fontSize: 26, height: 1)),
            label: l10n.t('navTreehouse'),
          ),
        ],
      ),
    );
  }
}
