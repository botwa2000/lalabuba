import 'package:flutter/material.dart';

extension StringX on String {
  String capitalize() => isEmpty ? this : '${this[0].toUpperCase()}${substring(1)}';
  String truncate(int max) => length > max ? '${substring(0, max)}…' : this;
  bool get isBlank => trim().isEmpty;
  String sanitize() =>
      trim().replaceAll(RegExp(r'<[^>]*>'), '').replaceAll(RegExp(r'\s+'), ' ');
}

extension ColorX on Color {
  String toHex() {
    final v = toARGB32();
    final r = (v >> 16) & 0xFF;
    final g = (v >> 8) & 0xFF;
    final b = v & 0xFF;
    return '#${r.toRadixString(16).padLeft(2, '0')}'
        '${g.toRadixString(16).padLeft(2, '0')}'
        '${b.toRadixString(16).padLeft(2, '0')}';
  }
}

extension BuildContextX on BuildContext {
  ThemeData get theme => Theme.of(this);
  ColorScheme get cs => Theme.of(this).colorScheme;
  TextTheme get tt => Theme.of(this).textTheme;
  Size get screenSize => MediaQuery.sizeOf(this);
  double get screenWidth => MediaQuery.sizeOf(this).width;
  double get screenHeight => MediaQuery.sizeOf(this).height;
  bool get isLandscape =>
      MediaQuery.orientationOf(this) == Orientation.landscape;
  bool get isTablet => MediaQuery.sizeOf(this).shortestSide >= 600;
  EdgeInsets get safeArea => MediaQuery.paddingOf(this);
}
