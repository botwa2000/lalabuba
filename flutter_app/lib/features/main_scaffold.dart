import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

class MainScaffold extends StatelessWidget {
  final StatefulNavigationShell navigationShell;

  const MainScaffold({super.key, required this.navigationShell});

  void _onTabTapped(int index) {
    navigationShell.goBranch(
      index,
      // Second tap on the same tab restores the branch root (scroll-to-top pattern).
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
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
            label: 'Draw',
          ),
          NavigationDestination(
            icon: Text('📓', style: GoogleFonts.nunito(fontSize: 22, height: 1)),
            selectedIcon: Text('📓', style: GoogleFonts.nunito(fontSize: 26, height: 1)),
            label: 'Journal',
          ),
          NavigationDestination(
            icon: Text('🖼️', style: GoogleFonts.nunito(fontSize: 22, height: 1)),
            selectedIcon: Text('🖼️', style: GoogleFonts.nunito(fontSize: 26, height: 1)),
            label: 'Gallery',
          ),
          NavigationDestination(
            icon: Text('🌳', style: GoogleFonts.nunito(fontSize: 22, height: 1)),
            selectedIcon: Text('🌳', style: GoogleFonts.nunito(fontSize: 26, height: 1)),
            label: 'Treehouse',
          ),
        ],
      ),
    );
  }
}
