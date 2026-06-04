import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/di/providers.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class LalabubaApp extends ConsumerWidget {
  const LalabubaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themesAsync = ref.watch(appThemesProvider);
    final themeMode = ref.watch(themeModeProvider);

    return themesAsync.when(
      loading: () => const MaterialApp(
        home: Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      ),
      error: (e, _) => MaterialApp(
        home: Scaffold(body: Center(child: Text('Failed to load theme: $e'))),
      ),
      data: (themes) {
        final colors = themeMode == ThemeMode.dark
            ? themes.dark.colors
            : themeMode == ThemeMode.light
                ? themes.light.colors
                : WidgetsBinding.instance.platformDispatcher.platformBrightness ==
                        Brightness.dark
                    ? themes.dark.colors
                    : themes.light.colors;

        return LalaColorsProvider(
          colors: colors,
          child: MaterialApp.router(
            title: 'Lalabuba',
            debugShowCheckedModeBanner: false,
            theme: themes.light.themeData,
            darkTheme: themes.dark.themeData,
            themeMode: themeMode,
            routerConfig: appRouter,
          ),
        );
      },
    );
  }
}
