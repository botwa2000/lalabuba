# Lalabuba Implementation Plan — 2026-07-27

## Priority Order (implement fully before moving to next)

### PHASE 1: Critical Bug Fixes
1. Colors chip: remove 99/MAX — Flutter settings_controller.dart + home_screen.dart
2. Canvas preloadedUrl bug: canvas_screen.dart initState guard fix
3. Drawing stuck: server provider timeouts + Flutter timeout increase
4. Web: verify colors already [6,12,18,24] (confirmed — no change needed)

### PHASE 2: Settings UX
5. Add dark/light mode toggle + language picker to Flutter SettingsScreen (/settings route)

### PHASE 3: Journal / Treehouse
6. Remove locked badges from Journal header sticker shelf (Journal shows only earned stickers; Treehouse shows all progress)

### PHASE 4: Community Sharing
7. After share success: navigate to Community tab + refresh gallery
8. Add "Share to Community" action in Journal full-screen viewer
9. Dedup protection: check same artwork URL or subject+seed before uploading

### PHASE 5: Navigation Redesign
New bottom tab structure:
  0: Draw ✨ (/draw) — HomeScreen, prompt + generate
  1: Explore 🔍 (/explore) — ExploreScreen promoted from AppBar icon
  2: Journal 📓 (/journal) — My art only (no locked items in header)
  3: Treehouse 🌳 (/treehouse) — Badges, mascot, scenes, ALL rewards
Remove dedicated Community/Gallery tab → Community gallery accessible from Journal (sub-tab: My Art | Community)
Fix CommunityGalleryScreen: replace pink gradient with app colorScheme

Settings: consistent gear icon in every tab's AppBar

Back/forward: Canvas AppBar must show ← back (not 🏠 Home button)

### PHASE 6: Testing
- Android emulator: Galaxy_S25_Ultra + Lala_Tablet
- Chrome web: full QA checklist

### PHASE 7: Deploy
- Bump web ?v=NNN, commit, push → Hetzner prod
- flutter analyze + flutter test
- APK → OneDrive\TEMP
- GitHub Actions → Play Store alpha
- Codemagic → TestFlight

### PHASE 8: Store Screenshots
- Regenerate all 8 phone + 8 tablet composites after emulator run
- Analyze each PNG before accepting
- Upload to Google Play (phone + tablets) + App Store Connect (iPhone + iPad)
