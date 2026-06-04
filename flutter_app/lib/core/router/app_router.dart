import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

// Route name constants — never use raw strings in navigation calls
class Routes {
  static const home = '/';
  static const canvas = '/canvas';
  static const gallery = '/gallery';
  static const settings = '/settings';
  static const subscription = '/subscription';
  static const challenge = '/challenge';
}

// Extra params for canvas route
class CanvasArgs {
  final String subject;
  final String difficulty;
  final String palette;
  final int colorCount;
  final bool showNumbers;
  final int? seed; // null = generate new

  const CanvasArgs({
    required this.subject,
    required this.difficulty,
    required this.palette,
    required this.colorCount,
    required this.showNumbers,
    this.seed,
  });
}

final appRouter = GoRouter(
  initialLocation: Routes.home,
  routes: [
    GoRoute(
      path: Routes.home,
      name: 'home',
      builder: (ctx, state) => const _PlaceholderScreen(title: 'Home'),
    ),
    GoRoute(
      path: Routes.canvas,
      name: 'canvas',
      builder: (ctx, state) {
        final args = state.extra as CanvasArgs;
        return _PlaceholderScreen(title: 'Canvas: ${args.subject}');
      },
    ),
    GoRoute(
      path: Routes.gallery,
      name: 'gallery',
      builder: (ctx, state) => const _PlaceholderScreen(title: 'Gallery'),
    ),
    GoRoute(
      path: Routes.settings,
      name: 'settings',
      builder: (ctx, state) => const _PlaceholderScreen(title: 'Settings'),
    ),
    GoRoute(
      path: Routes.subscription,
      name: 'subscription',
      builder: (ctx, state) => const _PlaceholderScreen(title: 'Subscription'),
    ),
    // Deep link: lalabuba://challenge?seed=xxx&subject=xxx
    GoRoute(
      path: Routes.challenge,
      name: 'challenge',
      builder: (ctx, state) {
        final seed = int.tryParse(state.uri.queryParameters['seed'] ?? '');
        final subject = state.uri.queryParameters['subject'] ?? '';
        return _PlaceholderScreen(title: 'Challenge: $subject seed=$seed');
      },
    ),
  ],
  errorBuilder: (ctx, state) => Scaffold(
    body: Center(child: Text('Page not found: ${state.error}')),
  ),
);

// Temporary placeholder — replaced with real screens in later phases
class _PlaceholderScreen extends StatelessWidget {
  final String title;
  const _PlaceholderScreen({required this.title});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: Center(
          child: Text(title, style: Theme.of(context).textTheme.headlineMedium),
        ),
      );
}
