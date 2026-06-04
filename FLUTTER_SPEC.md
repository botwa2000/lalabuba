# Lalabuba Flutter App — Complete Build Specification

> This document is the authoritative reference for building the Flutter mobile app.
> Every design decision, feature, architecture choice, and constraint is recorded here.
> Claude must read this document at the start of every Flutter build session.
> Do not implement anything not described here without explicit user approval.

---

## 1. Context & Goals

### What we are building
A native Flutter mobile app (iOS + Android) that replaces the Capacitor-wrapped web app for mobile.
The existing Vercel web app (`lalabuba.com`) continues unchanged — the Flutter app is a separate, superior mobile experience sharing the same backend API.

### Why Flutter
- Native rendering: no WebView, no CSS layout bugs, no DOM
- `CustomPainter` + `GestureDetector` purpose-built for drawing/coloring apps
- Constraint-based layout: correct on every screen by construction, no media query patches
- Single codebase for iOS and Android
- Premium paid-app quality ceiling

### Audience
- **Primary users:** Children ages 3–12
- **Account holders / payers:** Parents (or guardians)
- Children use the app directly but do not need to create accounts
- Parents pay for premium features; children inherit access under the parent's subscription
- The app must be safe for children at all times, in all states, regardless of tier

### Strategic position in repo
```
lalabuba/                   ← existing repo root
├── public/                 ← web app (unchanged)
├── api/                    ← Vercel serverless (shared by both)
├── lib/                    ← shared server-side JS libs
├── android/                ← legacy Capacitor Android (keep until Flutter ships)
├── ios/                    ← legacy Capacitor iOS (keep until Flutter ships)
├── flutter_app/            ← NEW: entire Flutter project lives here
│   ├── lib/
│   ├── assets/
│   ├── android/
│   ├── ios/
│   ├── pubspec.yaml
│   └── ...
├── CLAUDE.md
└── FLUTTER_SPEC.md         ← this file
```

---

## 2. Architecture

### Pattern: Feature-First Clean Architecture

```
flutter_app/lib/
├── core/
│   ├── config/             ← AppConfig (loaded from assets/config/)
│   ├── di/                 ← Dependency injection (Riverpod providers)
│   ├── router/             ← go_router route definitions
│   ├── theme/              ← ThemeData built from design tokens JSON
│   ├── l10n/               ← Localization service (loads assets/i18n/*.json)
│   └── utils/              ← Extensions, helpers, constants
├── features/
│   ├── home/               ← Landing/hero screen
│   ├── canvas/             ← Coloring canvas + drawing engine
│   ├── generate/           ← AI generation service + loading
│   ├── gallery/            ← Saved artworks grid
│   ├── challenge/          ← Share + challenge mode
│   ├── settings/           ← Language, theme, preferences
│   └── subscription/       ← IAP, tier management, paywall UI
└── shared/
    ├── widgets/            ← Reusable UI components
    ├── models/             ← Shared data models
    └── services/           ← Cross-feature services (analytics, secure storage)
```

### State management: Riverpod (riverpod + flutter_riverpod + riverpod_annotation)
- All state is in providers; no setState anywhere in the feature layer
- Use `@riverpod` code generation for type safety
- `AsyncNotifierProvider` for async state (generation, gallery load)
- `NotifierProvider` for sync state (canvas, settings, subscription)
- `FutureProvider` for one-shot reads (config, asset loading)

### Navigation: go_router
- Declarative routes defined in `core/router/app_router.dart`
- Named routes only — no magic strings
- Deep linking for challenge/share URLs: `lalabuba://challenge?seed=xxx&subject=xxx`
- Universal links (iOS) + App Links (Android) for `lalabuba.com/challenge?...` web URLs

### Dependency injection: Riverpod providers
- No service locator. Everything injected via `ref.watch`/`ref.read`
- `ProviderScope` at root wraps the entire app
- Override providers in tests for isolation

---

## 3. All Content in Assets (Zero Hardcoding)

**Rule: No user-visible string, color, dimension, or data item may be hardcoded in Dart files.**
All content lives in `flutter_app/assets/` and is loaded at startup.

### Asset directory structure
```
flutter_app/assets/
├── i18n/
│   ├── en.json             ← English (source of truth)
│   ├── de.json
│   ├── ru.json
│   ├── fr.json
│   ├── es.json
│   ├── pt.json
│   ├── it.json
│   ├── nl.json
│   ├── pl.json
│   ├── tr.json
│   ├── zh.json
│   └── hi.json
├── data/
│   ├── subjects.json       ← 20 subjects × 20 actions = 400 card pool
│   ├── daily_words.json    ← 100 daily challenge words + all 12 translations
│   ├── palettes.json       ← classic / pastel / nature palette definitions
│   ├── blocked_terms.json  ← content safety blocklist (all languages)
│   ├── prompts.json        ← difficulty prompt templates (easy/medium/hard/extreme)
│   └── semantic_colors.json ← subject→palette color mapping rules
├── config/
│   ├── app_config.json     ← feature flags, API endpoints, limits per tier
│   ├── theme_light.json    ← design tokens for light mode
│   ├── theme_dark.json     ← design tokens for dark mode
│   └── iap_products.json   ← product IDs and feature entitlements per tier
└── images/
    ├── logo.png
    ├── splash.png
    └── empty_canvas_hint.png
```

### i18n JSON format (en.json excerpt)
```json
{
  "heroHeading": "What should we draw today? ✨",
  "heroSub": "Your imagination… drawn by Lalabuba",
  "drawBtn": "Draw! ✨",
  "regenBtn": "🎲 Again!",
  "diffEasy": "Easy 🌟",
  "diffMedium": "Medium 🌟🌟",
  "diffHard": "Hard 🌟🌟🌟",
  "diffExtreme": "Extreme 🔥",
  "undoBtn": "↩ Undo",
  "tapModeBtn": "🎯 Tap",
  "paintModeBtn": "🖌️ Paint",
  "pencilBtn": "✏️ Draw",
  "printBtn": "🖨️ Print",
  "saveBtn": "💾 Save",
  "shareArtBtn": "🖼️ Share art",
  "challengeBtn": "🏆 Challenge!",
  "dailyWord": "Today's word",
  "surpriseMe": "💡 Surprise me",
  "emptyHint": "Pick a card, choose Today's Word, or type your own — we'll draw it! 🎨",
  "coloringHint": "👆 Tap a color, then tap any numbered region to fill it!",
  "generating": "Drawing {subject}…",
  "galleryEmpty": "No saved drawings yet — draw something! 🎨",
  "subscribeTitle": "Unlock Lalabuba Plus ✨",
  "subscribeSubtitle": "Unlimited drawings, all difficulties, HD quality",
  "restorePurchases": "Restore purchases",
  "freeLimitReached": "You've used all 5 free drawings today — come back tomorrow, or go Plus for unlimited! 🎨",
  ...
}
```

### subjects.json format
```json
{
  "subjects": [
    {
      "en": "shark", "emoji": "🦈",
      "de": "Hai", "fr": "requin", "es": "tiburón", "pt": "tubarão",
      "it": "squalo", "nl": "haai", "pl": "rekin", "ru": "акула",
      "tr": "köpekbalığı", "zh": "鲨鱼", "hi": "शार्क"
    }
  ],
  "actions": [
    {
      "en": "playing guitar",
      "de": "spielt Gitarre", "fr": "et sa guitare", "es": "con guitarra",
      "pt": "com guitarra", "it": "e chitarra", "nl": "speelt gitaar",
      "pl": "z gitarą", "ru": "с гитарой", "tr": "gitarla",
      "zh": "弹吉他", "hi": "गिटार बजाते"
    }
  ]
}
```

### theme_light.json format (design tokens)
```json
{
  "colors": {
    "primary": "#7C4DFF",
    "primaryDark": "#5E35B1",
    "secondary": "#FF7043",
    "background": "#F8F9FF",
    "surface": "#FFFFFF",
    "surfaceVariant": "#F0EEF8",
    "border": "#E0DEF0",
    "ink": "#1A1A2E",
    "muted": "#6B6B8A",
    "error": "#FF4757",
    "success": "#26C281"
  },
  "typography": {
    "fontBrand": "Fredoka",
    "fontBody": "Nunito",
    "scaleBase": 16,
    "scales": {
      "xs": 0.75, "sm": 0.875, "md": 1.0,
      "lg": 1.25, "xl": 1.5, "xxl": 2.0, "display": 2.5
    }
  },
  "spacing": {
    "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32, "xxl": 48
  },
  "radius": {
    "sm": 8, "md": 16, "lg": 24, "full": 9999
  },
  "elevation": {
    "sm": 2, "md": 4, "lg": 8
  }
}
```

### iap_products.json format
```json
{
  "products": [
    {
      "id": "com.lalabuba.lalabuba.plus_monthly",
      "tier": "plus",
      "period": "monthly",
      "appleId": "com.lalabuba.lalabuba.plus_monthly",
      "googleId": "plus_monthly"
    },
    {
      "id": "com.lalabuba.lalabuba.plus_yearly",
      "tier": "plus",
      "period": "yearly",
      "appleId": "com.lalabuba.lalabuba.plus_yearly",
      "googleId": "plus_yearly"
    },
    {
      "id": "com.lalabuba.lalabuba.family_monthly",
      "tier": "family",
      "period": "monthly",
      "appleId": "com.lalabuba.lalabuba.family_monthly",
      "googleId": "family_monthly"
    },
    {
      "id": "com.lalabuba.lalabuba.family_yearly",
      "tier": "family",
      "period": "yearly",
      "appleId": "com.lalabuba.lalabuba.family_yearly",
      "googleId": "family_yearly"
    }
  ],
  "entitlements": {
    "free": {
      "dailyGenerations": 5,
      "difficulties": ["easy", "medium"],
      "palettes": ["classic"],
      "maxColors": 12,
      "resolution": 768,
      "pencilMode": false,
      "gallery": false,
      "galleryLimit": 0,
      "exactSharing": false,
      "hdPrint": false,
      "zoomControls": false,
      "colorPicker": false,
      "maxPalette": false,
      "childProfiles": 0
    },
    "plus": {
      "dailyGenerations": -1,
      "difficulties": ["easy", "medium", "hard", "extreme"],
      "palettes": ["classic", "pastel", "nature"],
      "maxColors": 99,
      "resolution": 1024,
      "pencilMode": true,
      "gallery": true,
      "galleryLimit": 100,
      "exactSharing": true,
      "hdPrint": true,
      "zoomControls": true,
      "colorPicker": true,
      "maxPalette": true,
      "childProfiles": 0
    },
    "family": {
      "dailyGenerations": -1,
      "difficulties": ["easy", "medium", "hard", "extreme"],
      "palettes": ["classic", "pastel", "nature"],
      "maxColors": 99,
      "resolution": 1024,
      "pencilMode": true,
      "gallery": true,
      "galleryLimit": -1,
      "exactSharing": true,
      "hdPrint": true,
      "zoomControls": true,
      "colorPicker": true,
      "maxPalette": true,
      "childProfiles": 5
    }
  }
}
```

---

## 4. Subscription Tiers

### Free
- **5 AI generations per day** (resets at local midnight)
- Easy + Medium difficulty
- Classic crayons palette, max 12 colors
- Standard resolution (768 × 768)
- Tap-to-fill and Paint coloring modes
- Basic sharing (seed-based URL; friends may get slightly different render)
- Current session only — no saved gallery
- Daily Challenge word
- All 12 languages
- No ads (Lalabuba is always ad-free)

### Lalabuba Plus — ~$2.99/month or $14.99/year
- **Unlimited AI generations**
- All difficulties: Easy, Medium, Hard, Extreme
- All 3 palettes (Classic, Pastel, Nature) + Custom color picker + Max palette (256 colors)
- All color counts (6 / 12 / 18 / 24 / Max)
- HD resolution (1024 × 1024)
- Pencil / freehand drawing mode
- **Gallery: save up to 100 artworks** permanently to device
- **Exact image sharing** (Vercel Blob URL — friends see the identical image)
- Print in HD
- Zoom + pan controls
- No "come back tomorrow" friction

### Lalabuba Family — ~$4.99/month or $24.99/year
- **Everything in Plus**
- **Up to 5 child profiles** — children use the app without creating accounts; parent manages all profiles from one account
- **Unlimited gallery** across all profiles
- **Challenge mode** — generate the same image for a family member and race to color it
- **Family gallery** — shared view of all profiles' artwork
- Priority support response

### Payment rules
1. Payments go exclusively through Apple App Store and Google Play in-app purchases — never direct/third-party on mobile
2. Subscriptions auto-renew; users cancel through the platform's subscription management
3. Parent's subscription covers all child profiles under their account
4. Children never see pricing screens or payment prompts — parents only
5. Offer a **14-day free trial** for Plus and Family (first subscription per Apple/Google account)
6. "Restore Purchases" button always accessible in Settings
7. Server-side receipt validation must happen on the backend (never trust client-side IAP status alone)
8. Offline grace period: if receipt validation fails due to network, maintain last known entitlement for up to 7 days

### Child profiles (Family tier)
- A profile is a local name + avatar emoji — no email, no account, no PII collected from children
- Profiles stored in device secure storage, associated with the parent's subscription
- COPPA: zero data collected from child profiles — no analytics events, no server-side logging of child activity
- A child opening the app sees a "pick your profile" screen, then goes directly to the coloring experience

---

## 5. Security

### Network security
- All API calls go to `https://lalabuba.com/api/` — no HTTP, no IP addresses hardcoded
- Certificate pinning via `dio` + custom `HttpClientAdapter` — pin the lalabuba.com certificate SHA256
- Pin fallback: include a backup pin (second certificate in the chain) so a certificate rotation doesn't break the app
- Certificate pins defined in `assets/config/app_config.json` (not hardcoded in Dart) so they can be updated via asset refresh
- On pin failure: show user-friendly "Connection error — please check your network" — never expose technical details

### Secure storage
- `flutter_secure_storage` for all sensitive data: auth tokens, subscription receipts, device ID
- Nothing sensitive in SharedPreferences or plain local storage
- Subscription entitlement cached in secure storage; validated against server on every app foreground

### Content safety
- Client-side blocklist loaded from `assets/data/blocked_terms.json` — instant feedback before API call
- Server-side validation in `api/generate-image.js` — double defence
- Blocklist covers all 12 languages
- Never display the raw error from the server — map all content refusals to the same friendly message: "Please choose a fun topic for kids — animals, vehicles, fantasy creatures, food…"

### Authentication
- The app uses **anonymous device-bound identity** — no username/password login required for free tier
- A UUID is generated on first launch, stored in secure storage, sent as `X-Device-ID` header
- This ID is used for: daily generation counting, gallery association, subscription linking
- For subscription: the parent signs in with Apple/Google IAP (the platform handles identity) — no separate account needed
- Optional: "Sign in with Apple" / "Sign in with Google" for cross-device sync of gallery (Plus/Family feature); never mandatory

### Privacy & compliance
- **COPPA (US):** Zero data collection from child profiles. Age gating: if a user indicates they are under 13, no analytics are fired, no data is sent to third parties. The app does not collect name, email, or location from children.
- **GDPR (EU):** Analytics consent prompt on first launch (EU users detected by locale). PostHog analytics only fires after consent. Children's profiles never generate analytics events.
- **App Store Kids Category:** The app targets the Kids category. This means: no third-party advertising SDKs, no third-party analytics SDKs that collect PII (PostHog is self-hosted EU, acceptable), no links that take children out of the app without parent confirmation.
- **Privacy manifest (iOS 17+):** Declare all API categories used: NSUserDefaults (settings), network (image generation), file system (gallery save). No use of prohibited data collection categories.
- **Data retention:** Generated images on Vercel Blob are deleted after 7 days (already implemented in backend). No user data is retained on servers beyond the session.

### Input validation
- Subject field: max 80 characters, strip HTML/script tags, normalize whitespace — all in Dart before API call
- All API responses validated before use: check Content-Type, check image magic bytes, never eval or parse untrusted JSON as code
- Deep link parameters (seed, subject) sanitized before use — never passed raw to API

### API key security
- No API keys ship in the Flutter app binary
- The app only calls `https://lalabuba.com/api/generate-image` — the backend holds all provider keys
- The backend's tiered provider waterfall (Pollinations → Together AI → Cloudflare → Novita) is transparent to the app

---

## 6. Localization

### Supported languages (12 total)
`en` (English — default), `de` (German), `ru` (Russian), `fr` (French), `es` (Spanish), `pt` (Portuguese), `it` (Italian), `nl` (Dutch), `pl` (Polish), `tr` (Turkish), `zh` (Chinese Simplified), `hi` (Hindi)

### Implementation
- Use `easy_localization` package — simpler than ARB/intl for JSON-based translations
- Locale persisted in secure storage, applied on app start before first frame
- Language picker: flag + code in Settings screen AND accessible from the home screen header
- Fallback chain: requested locale → `en` → key itself (never crash on missing key)
- RTL: none of the 12 languages require RTL; if Arabic/Hebrew added later the architecture already supports it via Flutter's directionality

### Subject card labels
- All 400 card combinations (20 subjects × 20 actions) have translations in all 12 languages
- Labels come from `assets/data/subjects.json` — computed at runtime, not stored as strings
- The English version (`subject.en + " " + action.en`) is always sent to the API regardless of UI language

### Daily word
- Word selection is deterministic from day index (same logic as web app)
- `assets/data/daily_words.json` contains all 100 words + translations in all 12 languages
- Displayed in user's selected language; English form sent to API

---

## 7. Design System

### Theming rules
- Light and dark themes built entirely from `assets/config/theme_light.json` and `theme_dark.json`
- `AppTheme` class in `core/theme/` reads the JSON and constructs Flutter `ThemeData`
- No color or text style literals anywhere in widget code — always `Theme.of(context).colorScheme.xxx` or custom tokens via `context.theme`
- System theme preference respected by default; user can override in Settings (stored in secure storage)

### Typography
- **Brand font:** Fredoka (rounded, playful — same as web app)
- **Body font:** Nunito (readable, child-friendly — same as web app)
- Both fonts bundled in `assets/fonts/` — no Google Fonts dependency at runtime (avoid network request on first paint)
- Font scale: responsive to system text size settings (accessibility)

### Color system
- Primary: `#7C4DFF` (purple)
- Secondary: `#FF7043` (orange)
- Palette colors: loaded from `assets/data/palettes.json` — never hardcoded

### Component library (`shared/widgets/`)
Every reusable component lives here. Key components:
- `LalaButton` — primary CTA button (rounded, brand font, loading state built-in)
- `LalaChip` — pill/chip for settings (difficulty, count, palette)
- `LalaBottomSheet` — modal bottom sheet with swipe-to-dismiss, drag handle, backdrop
- `LalaCard` — suggestion card with gradient art area + emoji + label
- `LalaColorSwatch` — color circle with active ring, tap/long-press
- `LalaTextField` — the prompt input with placeholder, clear button
- `LalaLoadingOverlay` — animated pencil + bouncing dots loading state
- `LalaEmptyHint` — the "Pick a card…" empty canvas state
- `LalaPaywall` — subscription upsell screen (shown when free limit reached)
- `LalaProfilePicker` — child profile selector (Family tier)
- `LalaConsentBanner` — GDPR analytics consent (EU users only)

### Animations
- All animations use Flutter's built-in animation system — no third-party animation libraries
- Card deal-in: `SlideTransition` + `FadeTransition` staggered by index
- Color swatch active state: `AnimatedScale`
- Bottom sheet: `DraggableScrollableSheet` with spring physics
- Loading pencil: `AnimationController` with custom `Tween`
- Page transitions: `CustomTransitionPage` in go_router (slide up for canvas, fade for settings)

---

## 8. Screen Inventory & Layouts

### Screen 1: Home / Hero
**Portrait:**
```
┌──────────────────────────────┐
│  🎨 Lalabuba   🌙   EN  🔍   │  AppBar 56dp
├──────────────────────────────┤
│  What should we draw today?  │  heading (Fredoka, 24sp)
│  Your imagination…           │  subheading (Nunito, 14sp muted)
│                              │
│  [🌟 Today: butterfly]       │  Daily challenge pill (if available)
│  — or pick something fun —   │  divider text
│                              │
│  ┌──────┐ ┌──────┐           │
│  │  🦈  │ │  🐘  │           │  4 suggestion cards, 2×2 grid
│  │shark │ │eleph.│           │
│  └──────┘ └──────┘           │
│  ┌──────┐ ┌──────┐           │
│  │  🦊  │ │  🦁  │           │
│  │ fox  │ │ lion │           │
│  └──────┘ └──────┘           │
│                              │
│         [🎲 Shuffle]         │
│                              │
│  ┌─ Empty canvas hint ──────┐│
│  │  🖌️                      ││  Compact canvas preview
│  │  Pick a card to start    ││  (min-height 180dp)
│  └──────────────────────────┘│
└──────────────────────────────┘
│  [🦋 butterfly...    Draw!✨] │  ← Sticky bottom bar
│  ⭐⭐  🎨12  🖍️  🔢  💡  ⚙️  │  ← Settings chips row
└──────────────────────────────┘
```

**Landscape (phone):**
```
┌──────────────┬───────────────┐
│ 🦋 butterfly │               │
│ [Draw! ✨]   │  Canvas /     │
│              │  Empty hint   │
│ ⭐  🎨  🖍️  │               │
│ 💡  🔢  ⚙️  │               │
└──────────────┴───────────────┘
```

**Tablet portrait / landscape:** Same layout as phone but with max-width 860dp centered.

### Screen 2: Canvas (Coloring Mode)
**Portrait:**
```
┌──────────────────────────────┐
│  ← Back  butterfly  🎲 Again │  AppBar
├──────────────────────────────┤
│                              │
│      [ CANVAS / IMAGE ]      │  InteractiveViewer
│      (fills available        │  with zoom + pan
│       height)                │  (Plus tier)
│                              │
├──────────────────────────────┤
│  [↩Undo] [🎯Tap/🖌️Paint] [⚙️] │  Compact action bar
│  [✏️Draw] [💾Save] [🖼️Share] │
└──────────────────────────────┘
│  Color swatches (horizontal  │  ← Sticky color row
│  scrollable, 3 rows of 4 or  │    (always visible)
│  single row if few colors)   │
└──────────────────────────────┘
```
- ⚙️ opens bottom sheet with: palette picker, color count, numbers toggle, zoom controls
- Coloring hint banner fades in after generation, dismissible

**Palette sidebar (tablet landscape only):**
- On tablets ≥600dp wide in landscape: vertical color sidebar on the right (same as web)
- On all phones: horizontal scrollable color strip at bottom

### Screen 3: Settings Bottom Sheet
```
┌─────────────────────────────┐
│ ▔▔▔▔▔▔ (drag handle)       │
│ Difficulty                  │
│ [Easy][Medium][Hard][Extreme]│
│ Palette                     │
│ [🖍️Classic][🌸Pastel][🌿Nature]│
│ Colors                      │
│ [6][12][18][24][Max]        │
│ Numbers  ● ON               │
│                             │
│ [🏆 Challenge!]             │
│ [🖨️ Print]                  │
└─────────────────────────────┘
```
- Slides up from bottom, swipe down to dismiss
- Backdrop tap dismisses
- Spring animation (not linear)

### Screen 4: Gallery
- Grid of saved artworks (2 columns portrait, 3–4 landscape)
- Tap artwork → full-screen view with share + delete
- Empty state with CTA to draw something
- Plus/Family tier only; free users see paywall

### Screen 5: Subscription / Paywall
- Shown when: free daily limit reached, user taps a locked feature
- Shows current tier + what Plus/Family unlocks
- Price loaded from App Store / Play Store at runtime (never hardcoded)
- Monthly / Yearly toggle with annual savings highlighted
- "Start free trial" CTA if eligible
- "Restore Purchases" link
- "Maybe later" dismiss (never forced)
- Children's profiles never see this screen — parent only

### Screen 6: Settings (full page)
- Language picker (flag grid)
- Theme (Light / Dark / System)
- Subscription management (current tier, manage via platform)
- Restore purchases
- Child profiles (Family tier)
- Privacy & consent settings
- App version + legal links

---

## 9. Canvas Engine

### Architecture
The coloring engine runs in a Dart `Isolate` for all CPU-heavy operations (flood fill, region detection) so the UI thread stays at 60fps.

```
canvas/
├── canvas_painter.dart       ← CustomPainter: renders regions + colors + pencil strokes
├── canvas_controller.dart    ← NotifierProvider: holds all canvas state
├── flood_fill.dart           ← Flood fill algorithm (runs in Isolate)
├── region_detector.dart      ← Extracts numbered regions from the raw image
├── pencil_overlay.dart       ← Freehand drawing layer (CustomPainter)
├── canvas_gestures.dart      ← GestureDetector + InteractiveViewer integration
└── canvas_models.dart        ← Region, ColorFill, Stroke, CanvasState models
```

### Region detection (ported from web canvas.js)
1. Receive raw image bytes from API (PNG)
2. Decode to pixel array via `dart:ui` `ImageDescriptor`
3. Scan image for black outlines (threshold: pixel darkness > 200)
4. BFS flood fill from each white region to find connected components
5. Assign region ID (1..N) based on area, largest first
6. Filter by `minArea` from difficulty config (loaded from `assets/data/prompts.json`)
7. Store region pixels as `Uint8List` bitmask (not List<Offset> — too slow)
8. Region centroids stored for number label placement
9. This entire operation runs in a separate `Isolate` — main thread never blocks

### Coloring (tap-to-fill)
1. User taps canvas → convert screen coordinate to image coordinate (accounting for zoom/pan)
2. Look up which region the tapped pixel belongs to (O(1) via region ID map)
3. Send fill command to `CanvasController`: `fillRegion(regionId, color)`
4. `CustomPainter` applies color to all pixels in region bitmask
5. Push previous state to undo stack (max 20 steps)
6. Animate: brief flash/scale on the color swatch that was used

### Paint mode (finger drag)
1. `GestureDetector.onPanUpdate` fires continuously
2. Each point sampled → region lookup → fill if not already filled with this color
3. Fills accumulate in undo stack as a single batch (one undo undoes the entire drag stroke)

### Pencil / freehand mode
1. Separate `pencil_overlay.dart` layer on top of canvas
2. Records Bezier paths (smooth via `Path.quadraticBezierTo`)
3. Strokes stored as `List<Stroke>` with color, width, opacity
4. Separate undo stack from fill undo
5. Not available in free tier — shows soft upsell on activation attempt

### Zoom / pan
1. `InteractiveViewer` wraps the canvas — handles pinch-zoom and drag naturally
2. Double-tap to reset zoom
3. Zoom level shown as indicator when zooming
4. Not available in free tier — canvas is fixed at screen size

### Undo
1. Two separate stacks: fill undo (20 steps) + pencil stroke undo (20 steps)
2. Global undo button undoes the most recent action from either stack
3. State is serializable — gallery save includes undo-safe representation

---

## 10. Image Generation Service

### API contract (same as web app)
```
POST https://lalabuba.com/api/generate-image
Content-Type: application/json
X-Device-ID: <uuid>                      (always sent)
X-Subscription-Token: <iap-receipt-hash> (Plus/Family tier)

Body:
{
  "subject": "shark playing guitar",   // always English
  "difficulty": "medium",
  "size": "medium",
  "width": 768,
  "height": 768,
  "seed": 123456789
}

Response:
Headers:
  X-Image-Seed: 123456789
  X-Image-Url: https://blob.vercel-storage.com/... (if Blob enabled)
Body: raw image bytes (PNG or JPEG)
```

### Client-side generation flow
1. Validate subject: blocklist check, length trim, whitespace normalize
2. Check daily generation count (from secure storage) — show paywall if free limit reached
3. Show `LalaLoadingOverlay` with animated pencil + rotating loading text
4. POST to backend with timeout: 60s (generous for slow AI providers)
5. On success: decode image, pass to canvas engine for region detection
6. On failure: show friendly error message (never raw HTTP error), offer "Try again"
7. On success: increment daily generation counter in secure storage

### Backend provider waterfall (unchanged from web, all server-side)
Tier 1 → Pollinations (free) → Tier 2 → Together AI → Tier 3 → Cloudflare → Tier 4 → Novita

### Resolution by tier
- Free: `768 × 768`
- Plus / Family: `1024 × 1024`

### Subject language handling
- User types in their language → client sends the raw input to backend
- Backend calls `translateToEnglish()` via LibreTranslate (already implemented)
- English subject is used for the AI prompt
- Translated English subject stored with the generated image for display

---

## 11. Sharing & Challenge Mode

### Basic sharing (all tiers)
- Share button generates a URL: `https://lalabuba.com/challenge?seed=SEED&subject=SUBJECT`
- URL opens to the web app which regenerates the same image using the seed
- Seed-based — may produce slightly different image each time (acceptable for free tier)
- Uses Flutter's `share_plus` package for native share sheet

### Exact sharing (Plus / Family)
- When Vercel Blob is configured on the backend, the `X-Image-Url` header contains a direct CDN URL
- This URL is shared instead of the seed URL — friends see the identical image
- Blob URLs expire after 7 days (handled by backend cleanup)

### Challenge mode (Family tier)
- Tapping 🏆 Challenge generates a shareable deep link
- Deep link: `lalabuba://challenge?seed=SEED&subject=SUBJECT`
- When recipient opens the link in the app, they are taken directly to the coloring screen with the same image pre-loaded
- Timer option: start a countdown and race to fill the image first
- Share via native share sheet (system messages, WhatsApp, etc.)
- QR code option: `qr_flutter` package generates a scannable QR for in-person challenges

### Gallery (Plus / Family)
- Save artwork: capture the canvas as a PNG (including filled colors + pencil strokes)
- Store in `flutter_app_gallery/` folder in app documents directory
- Metadata stored alongside (subject, date, difficulty, tier at generation time)
- Export to Camera Roll: `image_gallery_saver` package
- Share completed artwork directly as image (not URL) via `share_plus`

---

## 12. Dependencies (pubspec.yaml)

```yaml
dependencies:
  flutter:
    sdk: flutter

  # State management
  flutter_riverpod: ^2.6.1
  riverpod_annotation: ^2.3.5

  # Navigation
  go_router: ^14.0.0

  # Localization
  easy_localization: ^3.0.7

  # Network
  dio: ^5.7.0

  # Secure storage
  flutter_secure_storage: ^9.2.2

  # In-app purchases
  in_app_purchase: ^3.2.0

  # Image
  image: ^4.2.0                   # image decoding + pixel manipulation

  # Sharing
  share_plus: ^10.0.0
  image_gallery_saver: ^2.0.3

  # QR codes
  qr_flutter: ^4.1.0

  # Analytics (GDPR-gated)
  posthog_flutter: ^4.0.0

  # Fonts (bundled — no network)
  # Fredoka + Nunito in assets/fonts/

dev_dependencies:
  flutter_test:
    sdk: flutter
  riverpod_generator: ^2.4.3
  build_runner: ^2.4.13
  flutter_lints: ^5.0.0
```

**No dependencies on:**
- Firebase (not needed, privacy concern)
- Google Mobile Ads
- Any third-party analytics that collect PII
- Any UI component library (we build our own from `shared/widgets/`)

---

## 13. CI/CD Pipeline

### Android: GitHub Actions (existing `android-release.yml`)
Update to point to `flutter_app/` and use Flutter build commands:
```yaml
- name: Setup Flutter
  uses: subosito/flutter-action@v2
  with:
    flutter-version: '3.24.x'
    channel: 'stable'
- name: Build AAB
  working-directory: flutter_app
  run: flutter build appbundle --release
```

### iOS: Codemagic (existing `codemagic.yaml`)
Update workflow to use `flutter build ipa` from `flutter_app/` directory.
Codemagic natively supports Flutter — minimal config change.

### Version management
- `flutter_app/pubspec.yaml` version: `1.0.0+X` where X = GitHub run number (same as current)
- iOS build number: run_number + 100 offset (maintains continuity)

### Build signing
- Android: same keystore from `KEYSTORE-CREDENTIALS.txt` — inject via GitHub secrets
- iOS: same Apple certificates via Codemagic's App Store Connect integration ("Bonistock ASC")

---

## 14. Testing Strategy

### Unit tests (`test/`)
- `ContentSafetyTest`: all blocked terms correctly rejected in all 12 languages
- `SubjectCombinatorTest`: `buildCardPool()` produces correct 400 entries
- `DailyChallengeTest`: deterministic seed + word for given day index
- `CanvasFloodFillTest`: flood fill produces correct region masks on test images
- `SubscriptionEntitlementsTest`: correct features returned per tier from iap_products.json
- `LocalizationTest`: all keys present in all 12 language files (no missing translations)

### Widget tests (`test/widgets/`)
- `LalaButtonTest`: renders, disabled state, loading state, tap callback
- `LalaCardTest`: renders emoji + label, tap callback, deal-in animation
- `LalaColorSwatchTest`: active state, tap, flash animation
- `LalaPaywallTest`: shows correct tier, monthly/yearly toggle, dismiss

### Integration tests (`integration_test/`)
- Happy path: launch → tap card → tap Draw → loading → canvas loads → tap color → tap region → region fills
- Daily limit: after 5 generations, paywall shown on 6th attempt
- Deep link: challenge URL → app launches to canvas with correct seed

---

## 15. Feature Flags

Defined in `assets/config/app_config.json`:
```json
{
  "features": {
    "dailyChallenge": true,
    "galleryEnabled": true,
    "challengeMode": true,
    "maxPalette": true,
    "pencilMode": true,
    "analyticsEnabled": true,
    "iapEnabled": true,
    "blobSharing": true
  },
  "api": {
    "baseUrl": "https://lalabuba.com",
    "generatePath": "/api/generate-image",
    "timeoutSeconds": 60
  },
  "limits": {
    "subjectMaxLength": 80,
    "undoStackDepth": 20,
    "galleryMaxFree": 0,
    "galleryMaxPlus": 100
  }
}
```
Feature flags are loaded at startup. Disabling a feature hides its UI elements — no code paths need to be conditioned on individual flags in widget code (the config layer handles it).

---

## 16. Implementation Order

Build in this sequence. Each phase is shippable (though incomplete):

### Phase 1 — Foundation (Days 1–3)
1. Create `flutter_app/` with `flutter create`
2. Set up Riverpod + go_router + easy_localization
3. Implement asset loading service (JSON config + i18n)
4. Implement `AppTheme` from JSON tokens
5. Build `shared/widgets/` component library
6. Implement `LalaButton`, `LalaChip`, `LalaCard`, `LalaTextField`, `LalaBottomSheet`

### Phase 2 — Home Screen (Days 4–6)
1. Home screen layout (portrait + landscape)
2. Suggestion cards from `subjects.json` (4 cards, shuffle)
3. Daily challenge pill
4. Sticky bottom bar (prompt input + settings chips + Draw button)
5. Language picker (Settings bottom sheet)
6. Theme toggle

### Phase 3 — Generation + Canvas (Days 7–12)
1. API service (Dio client, request/response models)
2. Loading overlay (`LalaLoadingOverlay`)
3. Image decoding + region detection (Isolate)
4. `canvas_painter.dart` — render regions
5. Tap-to-fill coloring
6. Paint mode (drag)
7. Undo stack
8. Color palette strip (horizontal scroll)
9. Canvas → coloring state transition (mirrors web `app-hero` removal)

### Phase 4 — Coloring Tools (Days 13–16)
1. Settings bottom sheet (difficulty, palette, colors, numbers toggle)
2. Pencil / freehand mode (gated: Plus only)
3. Zoom + pan via `InteractiveViewer` (gated: Plus only)
4. Save to gallery
5. Share via system share sheet
6. Print via `printing` package

### Phase 5 — Subscription (Days 17–21)
1. IAP service (`in_app_purchase` setup for both platforms)
2. Products fetched from App Store / Play Store at runtime
3. Paywall UI (`LalaPaywall`)
4. Entitlement engine (reads iap_products.json + active subscription)
5. Daily generation counter (secure storage)
6. Server-side receipt validation endpoint on backend
7. Restore Purchases flow
8. Free trial detection

### Phase 6 — Gallery + Challenge (Days 22–25)
1. Gallery screen (grid, full-screen view, delete)
2. Camera Roll export
3. Exact sharing (Blob URL when available)
4. Challenge deep links
5. QR code generation

### Phase 7 — Family Tier (Days 26–28)
1. Child profile creation (name + avatar emoji)
2. Profile picker screen (first screen if Family subscriber)
3. Per-profile gallery separation
4. COPPA: disable analytics for child profiles

### Phase 8 — Polish + QA (Days 29–33)
1. Full QA checklist (see Section 17)
2. Accessibility: semantic labels on all interactive elements, min touch target 44dp
3. Performance: profile with Flutter DevTools, ensure 60fps on canvas interactions
4. iOS-specific: safe area insets, Dynamic Type, Dark Mode
5. Android-specific: edge-to-edge display, back gesture, Android 12+ splash
6. Localization QA: run through all 12 languages manually
7. Submit to TestFlight (iOS) + internal track (Android)

---

## 17. QA Checklist (must pass before any release)

### Home screen
- [ ] 4 suggestion cards visible (2×2 portrait, 1×4 landscape on phone, 1×4 tablet)
- [ ] Shuffle button shows new 4 cards with staggered deal-in animation
- [ ] Daily word pill appears if available; taps to fill input
- [ ] Typing in input enables Draw! button
- [ ] Surprise me (💡) fills random subject
- [ ] Difficulty chips cycle correctly
- [ ] Settings chips (palette, colors, numbers) cycle correctly
- [ ] Language picker changes all visible text immediately
- [ ] Theme toggle switches light/dark
- [ ] Empty canvas hint shows in canvas area below cards
- [ ] Sticky bottom bar always visible, never obscured by keyboard (use `resizeToAvoidBottomInset`)

### Generation + Canvas
- [ ] Draw! triggers loading overlay with pencil animation
- [ ] Image renders in canvas after generation
- [ ] Coloring hint banner fades in, is dismissible
- [ ] Tap a color swatch → active ring appears
- [ ] Tap a numbered region → fills with selected color
- [ ] Paint mode → drag finger fills regions
- [ ] Undo button works for both tap-fill and paint
- [ ] 🎲 Again! generates new image with same subject
- [ ] Back button returns to home (confirms if artwork has unsaved changes)

### Subscription
- [ ] After 5 generations (free), paywall shown on 6th tap
- [ ] Paywall shows correct prices (loaded from store)
- [ ] Monthly/yearly toggle shows both options
- [ ] Restore Purchases works
- [ ] Plus features (pencil, zoom, HD) accessible after subscription
- [ ] Plus features show soft upsell (not hard block) when tapped by free user

### Platform
- [ ] Portrait phone: no layout overflow, no elements clipped
- [ ] Landscape phone: canvas fills width, controls visible
- [ ] Portrait tablet: centered layout, max-width respected
- [ ] Landscape tablet: palette sidebar visible
- [ ] Safe area: nothing clipped by notch or home indicator
- [ ] Dark mode: all text readable, no invisible elements
- [ ] All 12 languages: no text overflow, no missing strings
- [ ] iOS: back swipe gesture works
- [ ] Android: back button/gesture returns to home or exits app correctly

---

## 18. File this spec references that already exist in the repo

These contain the source of truth for content that must be migrated to JSON assets:

| Dart/JSON asset | Source in current web app |
|-----------------|---------------------------|
| `assets/data/subjects.json` | `public/js/data.js` → `CARD_SUBJECTS` + `CARD_ACTIONS` |
| `assets/data/daily_words.json` | `public/js/data.js` → `DAILY_WORDS` + `DAILY_WORDS_I18N` |
| `assets/data/palettes.json` | `public/js/data.js` → `PALETTES` |
| `assets/data/blocked_terms.json` | `public/js/data.js` → `BLOCKED_TERMS` + `lib/content-safety.js` |
| `assets/data/prompts.json` | `public/js/data.js` → `buildPrompt()` (difficulty templates) |
| `assets/data/semantic_colors.json` | `public/js/data.js` → `SEMANTIC_COLOR_RULES` |
| `assets/i18n/*.json` | `public/js/i18n.js` → all language objects |
| `assets/config/theme_*.json` | `public/css/tokens.css` → CSS custom properties |

---

## 19. What NOT to do

- Do not use `setState` in feature-layer widgets — use Riverpod providers
- Do not hardcode any string, color, or dimension in Dart — use assets + theme tokens
- Do not collect any data from child profiles — zero analytics, zero server logs
- Do not add Firebase — not needed, privacy implications for kids app
- Do not add any third-party advertising SDK — prohibited in Kids category
- Do not skip input validation on either client or server — both layers always run
- Do not use `http` package — use `dio` for all network calls (interceptors, certificate pinning, timeout)
- Do not put IAP logic in widgets — subscription state in Riverpod providers only
- Do not ship without testing on a real device (both iOS and Android) — simulator is not sufficient for canvas touch and IAP

---

*Last updated: 2026-06-04. This document is the single source of truth. Any change to architecture, features, or design must be reflected here before implementation.*
