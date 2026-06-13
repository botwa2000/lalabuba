# Flutter / Lalabuba release ProGuard (R8) rules.
#
# The Flutter Gradle plugin already contributes the core io.flutter.* keep
# rules, so we only add what R8 can't infer on its own.

# Flutter Play Store split / deferred-components classes are referenced by the
# engine but unused here. Silence the "missing class" warnings R8 emits.
-dontwarn com.google.android.play.core.**
-dontwarn com.google.android.play.core.splitcompat.**
-dontwarn com.google.android.play.core.splitinstall.**
-dontwarn com.google.android.play.core.tasks.**

# Defensive: keep the Flutter embedding entry points.
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }

# Keep annotation attributes used by plugins that reflect at runtime.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
