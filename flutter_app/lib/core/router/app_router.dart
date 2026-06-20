import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../features/home/home_screen.dart';
import '../../features/canvas/canvas_screen.dart';
import '../../features/gallery/gallery_screen.dart';
import '../../features/rewards/rewards_screen.dart';
import '../../features/rewards/scenes_screen.dart';
import '../../features/settings/settings_screen.dart';

export '../../features/canvas/canvas_screen.dart' show CanvasScreenArgs;

class Routes {
  static const home = '/';
  static const canvas = '/canvas';
  static const gallery = '/gallery';
  static const rewards = '/rewards';
  static const scenes = '/scenes';
  static const settings = '/settings';
  static const challenge = '/challenge';
}

final appRouter = GoRouter(
  initialLocation: Routes.home,
  routes: [
    GoRoute(
      path: Routes.home,
      name: 'home',
      builder: (ctx, state) => const HomeScreen(),
    ),
    GoRoute(
      path: Routes.canvas,
      name: 'canvas',
      pageBuilder: (ctx, state) {
        final args = state.extra as CanvasScreenArgs;
        return CustomTransitionPage(
          key: state.pageKey,
          child: CanvasScreen(args: args),
          transitionsBuilder: (ctx, anim, _, child) => SlideTransition(
            position: Tween<Offset>(
                    begin: const Offset(0, 1), end: Offset.zero)
                .animate(CurvedAnimation(
                    parent: anim, curve: Curves.easeOutCubic)),
            child: child,
          ),
        );
      },
    ),
    GoRoute(
      path: Routes.gallery,
      name: 'gallery',
      pageBuilder: (ctx, state) => CustomTransitionPage(
        key: state.pageKey,
        child: const GalleryScreen(),
        transitionsBuilder: (ctx, anim, _, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
    ),
    GoRoute(
      path: Routes.rewards,
      name: 'rewards',
      pageBuilder: (ctx, state) => CustomTransitionPage(
        key: state.pageKey,
        child: const RewardsScreen(),
        transitionsBuilder: (ctx, anim, _, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
    ),
    GoRoute(
      path: Routes.scenes,
      name: 'scenes',
      pageBuilder: (ctx, state) => CustomTransitionPage(
        key: state.pageKey,
        child: const ScenesScreen(),
        transitionsBuilder: (ctx, anim, _, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
    ),
    GoRoute(
      path: Routes.settings,
      name: 'settings',
      pageBuilder: (ctx, state) => CustomTransitionPage(
        key: state.pageKey,
        child: const SettingsScreen(),
        transitionsBuilder: (ctx, anim, _, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
    ),
    GoRoute(
      path: Routes.challenge,
      name: 'challenge',
      builder: (ctx, state) {
        final seed = int.tryParse(state.uri.queryParameters['seed'] ?? '');
        final subject = state.uri.queryParameters['subject'] ?? '';
        return CanvasScreen(
          args: CanvasScreenArgs(
            subject: subject,
            displayLabel: subject,
            seed: seed,
          ),
        );
      },
    ),
  ],
  errorBuilder: (ctx, state) => Scaffold(
    appBar: AppBar(title: const Text('Not found')),
    body: const Center(child: Text('Page not found')),
  ),
);
