# Flutter Navigation Redesign

**Goal:** Replace the current flat go_router structure with a 4-tab bottom navigation bar.  
**Status:** Planning complete — implementation in progress.  
**Design reference:** [Proposal artifact](https://claude.ai/code/artifact/73322813-ca4c-44cd-93e3-d2e3778e009e)

---

## Tab structure

| Tab | Icon | Route root | Screens in stack |
|-----|------|-----------|-----------------|
| Draw | ✨ | `/draw` | HomeScreen → ExploreTopicScreen → CanvasScreen |
| Journal | 📓 | `/journal` | GalleryScreen (personal) → artwork detail |
| Gallery | 🖼️ | `/gallery` | CommunityGalleryScreen → artwork detail → CanvasScreen |
| Treehouse | 🌳 | `/treehouse` | TreehouseScreen → MascotStudioScreen / ScenesScreen |

Canvas (`/canvas`) lives **outside** all shells — pushed on top of any tab, hides the bottom nav.  
Settings (`/settings`) also lives outside — pushed via ⚙️ gear icon available in each tab header.

---

## Navigation rules

- **Bottom nav** = switch between tab roots (always resets to root of that tab on first tap; restores scroll on subsequent taps — standard IndexedStack behaviour)
- **Back gesture / ← arrow** = go up within the current tab stack
- **No Home buttons** anywhere — back gesture handles all within-tab exits
- **Canvas is full-screen** — bottom nav hidden; ← back arrow (top-left of canvas AppBar) exits to wherever canvas was launched from
- **Tab switching mid-canvas is impossible** — bottom nav is hidden in canvas
- **Auto-save** canvas progress on exit (no "leave?" prompt — kids must not lose work)
- **⚙️ gear** in each tab's header navigates to `/settings` (pushed over current tab, back returns)

---

## go_router architecture change

Replace flat `GoRoute` list with `StatefulShellRoute.indexedStack` + top-level routes for canvas and settings.

```
appRouter
├── StatefulShellRoute.indexedStack (MainScaffold with BottomNavBar)
│   ├── Branch 0 — Draw    /draw
│   │   └── /draw/:topic   ExploreTopicScreen
│   ├── Branch 1 — Journal /journal
│   ├── Branch 2 — Gallery /gallery
│   └── Branch 3 — Treehouse /treehouse
│       ├── /treehouse/mascot   MascotStudioScreen
│       └── /treehouse/scenes   ScenesScreen
├── /canvas   CanvasScreen (full-screen, no shell)
├── /settings SettingsScreen (full-screen, no shell)
└── /challenge CanvasScreen (deep-link entry, no shell)
```

---

## Milestone plan

### M1 — Router skeleton (no UI visible yet)
- [ ] Replace `appRouter` flat routes with `StatefulShellRoute.indexedStack`
- [ ] Create `MainScaffold` widget with `BottomNavigationBar` (4 tabs, icons + labels)
- [ ] Wire branches: Draw → HomeScreen, Journal → GalleryScreen, Gallery → CommunityGalleryScreen, Treehouse → placeholder `TreehouseScreen`
- [ ] Canvas + Settings + Challenge remain top-level routes outside shell
- [ ] Verify: tapping tabs switches screens; canvas hides bottom nav; back works

### M2 — Treehouse screen
- [ ] Create `lib/features/treehouse/treehouse_screen.dart`
- [ ] Port existing `RewardsScreen` content (mascot card, daily mission, scenes card, crayon packs, sticker album) into TreehouseScreen sections
- [ ] Remove old `/rewards` route; redirect to `/treehouse`
- [ ] MascotStudio pushed as `/treehouse/mascot` (within treehouse branch)
- [ ] ScenesScreen pushed as `/treehouse/scenes` (within treehouse branch)
- [ ] Delete `rewards_screen.dart` (content moved)

### M3 — Canvas nav cleanup
- [ ] Remove "Home" / 🏠 button from CanvasScreen (wherever it is — search for home navigation in canvas_screen.dart)
- [ ] Confirm CanvasScreen AppBar already has a back/close button or add `← IconButton` calling `context.pop()`
- [ ] Auto-save on pop: trigger save-to-gallery in `dispose()` or `WillPopScope`/`PopScope`
- [ ] Test: canvas entered from Draw → back → Draw root ✓; entered from Gallery "Color this too!" → back → Gallery ✓

### M4 — Settings gear icon
- [ ] Add ⚙️ `IconButton` to each tab root screen's AppBar `actions`
- [ ] On tap: `context.push(Routes.settings)`
- [ ] Remove settings from any in-tab nav (currently accessed via HomeScreen top bar)
- [ ] Confirm SettingsScreen has back arrow (go_router default AppBar back button)

### M5 — Draw tab: Explore integration
- [ ] HomeScreen currently navigates to `/explore` as a separate full-screen
- [ ] Decision: keep ExploreScreen as a full-screen push within Draw tab (stack: HomeScreen → ExploreScreen → ExploreTopicScreen → Canvas) OR embed topic grid inline on HomeScreen
- [ ] Recommended: keep ExploreScreen as a push (existing code works); just ensure it routes through the Draw shell branch

### M6 — Web vocabulary alignment (separate, small)
- [ ] Rename top-bar icon labels: Gallery → "My Art", Community → "Gallery"
- [ ] Add tab switcher inside gallery modal: "My Art" tab + "Gallery" tab
- [ ] Remove Explore from top-bar icons (it's embedded in the hero)
- [ ] Bump CSS version

### M7 — Polish + QA
- [ ] Tab active state styling (color matches per-tab accent — Draw=coral, Journal=purple, Gallery=teal, Treehouse=orange)
- [ ] Bottom nav safe-area padding (iOS home indicator)
- [ ] Android back button exits canvas correctly (PopScope)
- [ ] flutter analyze clean
- [ ] Widget tests for MainScaffold tab switching
- [ ] Emulator QA: Galaxy_S25_Ultra + Lala_Tablet (adb screencap harness)
- [ ] Delete screenshots after review

---

## Files to create
- `flutter_app/lib/features/treehouse/treehouse_screen.dart`
- `flutter_app/lib/features/main_scaffold.dart`

## Files to modify
- `flutter_app/lib/core/router/app_router.dart` — StatefulShellRoute
- `flutter_app/lib/app.dart` — no change needed
- `flutter_app/lib/features/canvas/canvas_screen.dart` — remove Home button, add PopScope auto-save
- `flutter_app/lib/features/home/home_screen.dart` — add ⚙️ action, remove old nav icons
- `flutter_app/lib/features/gallery/gallery_screen.dart` — add ⚙️ action
- `flutter_app/lib/features/community/screens/community_gallery_screen.dart` — add ⚙️ action
- `flutter_app/lib/features/rewards/rewards_screen.dart` — content moves to TreehouseScreen
- `flutter_app/lib/features/rewards/scenes_screen.dart` — route change only
- `flutter_app/lib/features/mascot/mascot_studio_screen.dart` — route change only

## Files to delete (after M2 complete)
- `flutter_app/lib/features/rewards/rewards_screen.dart`

---

## Session-resume instructions
1. Read this file for current status
2. Check which milestone checkboxes are ticked
3. Read `flutter_app/lib/core/router/app_router.dart` to see current state
4. Continue from first unchecked item in current milestone
