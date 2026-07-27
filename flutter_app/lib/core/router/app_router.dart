import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../features/main_scaffold.dart';
import '../../features/home/home_screen.dart';
import '../../features/canvas/canvas_screen.dart';
import '../../features/explore/explore_screen.dart';
import '../../features/gallery/gallery_screen.dart';
import '../../features/treehouse/treehouse_screen.dart';
import '../../features/rewards/scenes_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/mascot/mascot_studio_screen.dart';

export '../../features/canvas/canvas_screen.dart' show CanvasScreenArgs;

class Routes {
  static const draw        = '/draw';
  static const canvas      = '/canvas';
  static const explore     = '/explore';
  static const exploreTopic = '/explore/:topic';
  static const journal     = '/journal';
  static const treehouse   = '/treehouse';
  static const scenes      = '/treehouse/scenes';
  static const mascotStudio = '/treehouse/mascot';
  static const settings    = '/settings';
  static const challenge   = '/challenge';
}

final appRouter = GoRouter(
  initialLocation: Routes.draw,
  redirect: (ctx, state) {
    if (state.matchedLocation == '/') return Routes.draw;
    // Redirect legacy /gallery deep-link to journal.
    if (state.matchedLocation == '/gallery') return Routes.journal;
    return null;
  },
  routes: [
    // ─── Shell: the 4-tab scaffold ───────────────────────────────────────────
    StatefulShellRoute.indexedStack(
      builder: (ctx, state, shell) =>
          MainScaffold(navigationShell: shell),
      branches: [
        // ── Draw tab ────────────────────────────────────────────────────────
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.draw,
              name: 'draw',
              builder: (ctx, state) => const HomeScreen(),
            ),
          ],
        ),

        // ── Explore tab ─────────────────────────────────────────────────────
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.explore,
              name: 'explore',
              pageBuilder: (ctx, state) => CustomTransitionPage(
                key: state.pageKey,
                child: const ExploreScreen(),
                transitionsBuilder: (ctx, anim, _, child) =>
                    FadeTransition(opacity: anim, child: child),
              ),
              routes: [
                GoRoute(
                  path: ':topic',
                  name: 'exploreTopic',
                  pageBuilder: (ctx, state) {
                    final topic = state.pathParameters['topic'] ?? '';
                    final extra = state.extra as (String, String)?;
                    final emoji = extra?.$1 ?? '🎨';
                    final name  = extra?.$2 ?? topic;
                    return CustomTransitionPage(
                      key: state.pageKey,
                      child: ExploreTopicScreen(
                          topic: topic, emoji: emoji, name: name),
                      transitionsBuilder: (ctx, anim, _, child) =>
                          FadeTransition(opacity: anim, child: child),
                    );
                  },
                ),
              ],
            ),
          ],
        ),

        // ── Journal tab (personal + community art) ───────────────────────────
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.journal,
              name: 'journal',
              builder: (ctx, state) => const GalleryScreen(),
            ),
          ],
        ),

        // ── Treehouse tab ────────────────────────────────────────────────────
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.treehouse,
              name: 'treehouse',
              builder: (ctx, state) => const TreehouseScreen(),
              routes: [
                GoRoute(
                  path: 'mascot',
                  name: 'mascotStudio',
                  pageBuilder: (ctx, state) => CustomTransitionPage(
                    key: state.pageKey,
                    child: const MascotStudioScreen(),
                    transitionsBuilder: (ctx, anim, _, child) =>
                        FadeTransition(opacity: anim, child: child),
                  ),
                ),
                GoRoute(
                  path: 'scenes',
                  name: 'scenes',
                  pageBuilder: (ctx, state) => CustomTransitionPage(
                    key: state.pageKey,
                    child: const ScenesScreen(),
                    transitionsBuilder: (ctx, anim, _, child) =>
                        FadeTransition(opacity: anim, child: child),
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    ),

    // ─── Top-level routes (no shell, full-screen) ─────────────────────────────
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
