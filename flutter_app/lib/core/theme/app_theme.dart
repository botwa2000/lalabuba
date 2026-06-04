import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

class LalaColors {
  final Color primary;
  final Color primaryDark;
  final Color secondary;
  final Color background;
  final Color surface;
  final Color surfaceVariant;
  final Color border;
  final Color ink;
  final Color muted;
  final Color error;
  final Color success;
  final Color warning;
  final List<List<Color>> cardGradients;

  const LalaColors({
    required this.primary,
    required this.primaryDark,
    required this.secondary,
    required this.background,
    required this.surface,
    required this.surfaceVariant,
    required this.border,
    required this.ink,
    required this.muted,
    required this.error,
    required this.success,
    required this.warning,
    required this.cardGradients,
  });

  factory LalaColors.fromJson(Map<String, dynamic> json) {
    Color hex(String h) {
      final s = h.replaceFirst('#', '');
      return Color(int.parse('FF$s', radix: 16));
    }

    final gradients = json['gradients'] as Map<String, dynamic>;
    final cardGradientKeys = ['card1', 'card2', 'card3', 'card4', 'card5', 'card6'];
    final cardGradientsList = cardGradientKeys
        .map((k) => (gradients[k] as List).map((c) => hex(c as String)).toList())
        .toList();

    return LalaColors(
      primary: hex(json['colors']['primary'] as String),
      primaryDark: hex(json['colors']['primaryDark'] as String),
      secondary: hex(json['colors']['secondary'] as String),
      background: hex(json['colors']['background'] as String),
      surface: hex(json['colors']['surface'] as String),
      surfaceVariant: hex(json['colors']['surfaceVariant'] as String),
      border: hex(json['colors']['border'] as String),
      ink: hex(json['colors']['ink'] as String),
      muted: hex(json['colors']['muted'] as String),
      error: hex(json['colors']['error'] as String),
      success: hex(json['colors']['success'] as String),
      warning: hex(json['colors']['warning'] as String),
      cardGradients: cardGradientsList,
    );
  }
}

class AppTheme {
  final LalaColors colors;
  final ThemeData themeData;

  const AppTheme({required this.colors, required this.themeData});

  static Future<({AppTheme light, AppTheme dark})> load() async {
    final lightRaw = await rootBundle.loadString('assets/config/theme_light.json');
    final darkRaw = await rootBundle.loadString('assets/config/theme_dark.json');
    final lightColors = LalaColors.fromJson(jsonDecode(lightRaw) as Map<String, dynamic>);
    final darkColors = LalaColors.fromJson(jsonDecode(darkRaw) as Map<String, dynamic>);
    return (
      light: AppTheme(colors: lightColors, themeData: _build(lightColors, Brightness.light)),
      dark: AppTheme(colors: darkColors, themeData: _build(darkColors, Brightness.dark)),
    );
  }

  static ThemeData _build(LalaColors c, Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: c.primary,
      onPrimary: Colors.white,
      secondary: c.secondary,
      onSecondary: Colors.white,
      error: c.error,
      onError: Colors.white,
      surface: c.surface,
      onSurface: c.ink,
    );

    final textTheme = GoogleFonts.nunitoTextTheme(
      TextTheme(
        displayLarge: TextStyle(fontFamily: 'Fredoka', color: c.ink),
        displayMedium: TextStyle(fontFamily: 'Fredoka', color: c.ink),
        displaySmall: TextStyle(fontFamily: 'Fredoka', color: c.ink),
        headlineLarge: TextStyle(fontFamily: 'Fredoka', color: c.ink),
        headlineMedium: TextStyle(fontFamily: 'Fredoka', color: c.ink),
        headlineSmall: TextStyle(fontFamily: 'Fredoka', color: c.ink),
        titleLarge: TextStyle(fontFamily: 'Fredoka', color: c.ink, fontWeight: FontWeight.w700),
        titleMedium: TextStyle(color: c.ink, fontWeight: FontWeight.w700),
        titleSmall: TextStyle(color: c.ink, fontWeight: FontWeight.w700),
        bodyLarge: TextStyle(color: c.ink),
        bodyMedium: TextStyle(color: c.ink),
        bodySmall: TextStyle(color: c.muted),
        labelLarge: TextStyle(color: c.ink, fontWeight: FontWeight.w800),
        labelMedium: TextStyle(color: c.muted),
        labelSmall: TextStyle(color: c.muted),
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: c.background,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: c.surface,
        foregroundColor: c.ink,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.fredoka(
          color: c.ink,
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardThemeData(
        color: c.surface,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: c.border, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: c.primary,
          foregroundColor: Colors.white,
          shape: const StadiumBorder(),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          textStyle: GoogleFonts.fredoka(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(50),
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(50),
          borderSide: BorderSide(color: c.border, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(50),
          borderSide: BorderSide(color: c.primary, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        modalBackgroundColor: c.surface,
        dragHandleColor: isDark ? Colors.white24 : Colors.black26,
        showDragHandle: true,
      ),
      dividerTheme: DividerThemeData(color: c.border, thickness: 1),
      iconTheme: IconThemeData(color: c.muted),
    );
  }
}

// Extension for quick color access anywhere
extension ThemeX on BuildContext {
  LalaColors get lala => _LalaColorsScope.of(this);
}

class _LalaColorsScope extends InheritedWidget {
  final LalaColors colors;
  const _LalaColorsScope({required this.colors, required super.child});

  static LalaColors of(BuildContext ctx) =>
      ctx.dependOnInheritedWidgetOfExactType<_LalaColorsScope>()!.colors;

  @override
  bool updateShouldNotify(_LalaColorsScope old) => colors != old.colors;
}

class LalaColorsProvider extends StatelessWidget {
  final LalaColors colors;
  final Widget child;
  const LalaColorsProvider({super.key, required this.colors, required this.child});

  @override
  Widget build(BuildContext context) =>
      _LalaColorsScope(colors: colors, child: child);
}
