# Lalabuba — Comprehensive Testing Plan

> **IMPORTANT**: Run the mandatory suite after EVERY code change. Mark which scope applies per change.
> Add new test scenarios at the bottom of each section when new features ship.

---

## 1. Testing Infrastructure

### 1.1 Automated visual QA (run after every layout/CSS change)
```powershell
$env:NODE_PATH = "C:\Users\Alexa\lalabuba\scripts\node_modules"
node scripts/screenshot-qa.js https://lalabuba.com
```
Screenshots: `public/mockups/` — READ every PNG before declaring done. Delete after review.

### 1.2 Manual browser QA
- Primary: Chrome desktop + Chrome Android (real device or emulator)
- Required: Firefox desktop, Safari mobile (via BrowserStack or physical device)

### 1.3 API / timing
- Generation turnaround: < 15 s (Novita or Together); measure in Network tab
- Segmentation worker: < 3 s (after image load); check console `[region-worker]` logs
- Turnstile: silent verify < 2 s; challenge popup only when CF demands human

---

## 2. Scope Guide

| Change type | Scope |
|---|---|
| CSS / layout only | §3 Visual + §4.1 Hero + §4.2 Coloring state |
| JS logic (fill, undo, mode) | §4.2–4.5 + §5 Mobile |
| API / server | §6 API + §4.2 generation flow |
| New feature | Entire §4 + §5 + §6 |
| i18n / text | §3 + §4 (all language spots) |
| Android/iOS | §7 Native apps |

**MANDATORY on every deploy** (flag = 🔴): §3 screenshots + §4.1.1 hero load + §4.2.1–4.2.3 generation flow

---

## 3. Visual Regression — Screen Quadrant Map

All screens are divided into a grid. Each element has a home quadrant.
For quadrant definitions see `docs/screen-quadrants.md`.

### 3.1 🔴 Desktop (1440×900) — hero
- [ ] Logo centered, top-centre zone (A2)
- [ ] Search bar full-width, middle zone (B1-B3)
- [ ] Suggestion cards 4-up, single row (C1-C4)
- [ ] Difficulty pills, settings chips row (C row, below cards)
- [ ] Right-header: Journal, Gallery, Settings icons (A3)
- [ ] Cookie banner bottom-full if first visit (F row)

### 3.2 🔴 Desktop (1440×900) — coloring
- [ ] Left panel toggle button (A1 edge)
- [ ] Canvas centred in B2-D2 zone
- [ ] Palette sidebar right (B3-D3)
- [ ] Toolbar top-centre (A2): New, Undo, I'm finished!, Numbers, Free!, Tap, Pencil, Brush🔒, Print, Save, Share, Challenge
- [ ] Zoom controls top-right of canvas (A3 edge)
- [ ] Coloring hint banner below toolbar

### 3.3 🔴 Mobile portrait (390×844) — hero
- [ ] Logo + header top bar (A row)
- [ ] Search bar full-width (B row)
- [ ] Suggestion cards 2×2 grid (C-D rows)
- [ ] Hamburger ☰ top-left, Gallery+Settings top-right aligned (A row)
- [ ] Difficulty pills wrap 2-per-row below cards

### 3.4 🔴 Mobile portrait (390×844) — coloring
- [ ] Compact toolbar: New, Undo, I'm finished!, ⋯ More (A row, scrollable)
- [ ] Canvas fills B-E rows
- [ ] Palette hidden in drawer (accessible via ☰)
- [ ] Zoom buttons visible

### 3.5 Mobile landscape (844×390)
- [ ] Config sidebar left ≤300px
- [ ] Canvas fills remaining width
- [ ] Toolbar: single row scrollable (no wrap)
- [ ] Palette as compact sidebar (not drawer)

### 3.6 Tablet landscape (1024×768+)
- [ ] 3-column layout: config | canvas | palette
- [ ] Action bar not wrapping

---

## 4. Functional QA

### 4.1 Hero / Landing Page

#### 4.1.1 🔴 Initial load
- [ ] Page loads < 3 s on 4G (check Network tab, look for 3rd-party CDN misses)
- [ ] Turnstile fires silently; no popup visible on clean page load
- [ ] Cookie banner appears on first visit, dismissed state persists
- [ ] Daily word pill shows (if data present); clicking fills search input
- [ ] Language auto-detected from browser

#### 4.1.2 Search & suggestion
- [ ] Typing in search bar enables Draw! button
- [ ] Clearing search disables Draw!
- [ ] 4 suggestion cards visible, thumbnails load
- [ ] 🎲 Shuffle deals 4 new cards with animation
- [ ] Clicking a card fills search input + enables Draw!
- [ ] 💡 Surprise me fills a random subject

#### 4.1.3 Settings chips (hero bar)
- [ ] ⭐/⭐⭐ Star chip cycles difficulty Easy→Medium→Hard→Extreme
- [ ] 🎨 Palette chip cycles palette; change persists into coloring
- [ ] 🔢 Numbers chip toggles numbers on/off; state syncs with canvas Numbers btn
- [ ] 🔊 Sound chip toggles audio
- [ ] 🗣️ Narrate chip toggles narration (hides if TTS unavailable)

#### 4.1.4 Header actions
- [ ] 🏆 Journal opens journal modal
- [ ] 🖼️ Gallery opens gallery modal with past artworks
- [ ] ⚙️ Settings opens menu (Theme, Language, How-to-play)
- [ ] Theme toggle 🌙/☀️ switches correctly; persists on reload
- [ ] Language picker dropdown: all 12 languages listed; switching updates all text inc. chips
- [ ] How-to-play opens help panel

### 4.2 Image Generation

#### 4.2.1 🔴 Generation flow
- [ ] Click Draw! → loading overlay with bouncing dots
- [ ] Turnstile: silent token fetched; no popup on normal web
- [ ] Image renders in canvas within 15 s
- [ ] Coloring hint banner shows
- [ ] Mode buttons (Tap/Pencil/Brush) enabled after image loads
- [ ] Numbers button enabled after image loads

#### 4.2.2 Art mode: Structured (Classic)
- [ ] Prompt includes "uniform thick black outlines, clean closed regions, coloring book style"
- [ ] Generated image has consistent line thickness visually
- [ ] Number badges appear on all major regions
- [ ] All regions colorable on first tap

#### 4.2.3 Art mode: Artistic (Creative)
- [ ] Different prompt used (varied line weight, textured, artistic)
- [ ] Numbers button may show fewer badges (sparse regions OK)
- [ ] Brush/Pencil mode works for freehand coloring

#### 4.2.4 Error handling
- [ ] If generation fails → "Couldn't draw that" status, Draw! re-enabled
- [ ] Timeout (15 s) shows user-facing message
- [ ] Network offline → graceful error, no spinner stuck

### 4.3 Coloring State — Core

#### 4.3.1 🔴 Tap mode
- [ ] Tapping a region fills it with selected color
- [ ] Correct color auto-selected if Numbers mode on
- [ ] Undo reverses last fill
- [ ] Region turns active-colored, not just white
- [ ] Dense/stippled regions fill (Extreme difficulty test)

#### 4.3.2 Numbers mode
- [ ] Numbers toggle ON: colored badges appear on all regions
- [ ] Numbers toggle OFF: badges hidden
- [ ] Badge disappears after region is filled
- [ ] Number matches assigned palette color
- [ ] Works on Easy, Medium, Hard, Extreme images

#### 4.3.3 Free! mode
- [ ] Go Free! button activates free mode
- [ ] Numbers hidden in free mode
- [ ] Free color picker (no fixed assignment)
- [ ] "I'm finished!" button appears after coverage threshold met
- [ ] Completing at ~90%/≥45 coverage triggers completion

#### 4.3.4 Palette & color selection
- [ ] Color swatches render correctly (not huge boxes)
- [ ] Tapping a swatch selects it (active ring visible)
- [ ] Custom color picker (eyedropper) works
- [ ] Classic/Neon/Candy/Galaxy palettes accessible (locked ones gated)
- [ ] ERASE swatch erases fills

#### 4.3.5 Pencil mode
- [ ] ✏️ Pencil button activates pencil overlay
- [ ] Strokes register on canvas
- [ ] Easy/Medium: stay-in-lines assist active (strokes masked to region)
- [ ] Hard/Extreme: no assist
- [ ] Pencil size is 5px

#### 4.3.6 Brush mode
- [ ] 🖌️ Brush button locked (🔒) until 3 completions
- [ ] Lock tooltip shows correct threshold
- [ ] Unlocks at exactly 3rd completion (toast fires)
- [ ] After unlock: brush size is 22px
- [ ] Brush strokes paint correctly

#### 4.3.7 Background color (canvas background)
- [ ] Default white background
- [ ] Color picker for background in settings panel
- [ ] Changing background updates canvas immediately
- [ ] Print / Save includes background color

#### 4.3.8 Canvas frame/shape
- [ ] Shape selector: Square (free), Circle (free), Diamond, Oval...
- [ ] Frame selector: None, Classic, Wooden, Mirror, Painting, Photo
- [ ] Selected before/at start of coloring
- [ ] Frame renders around canvas in coloring view
- [ ] Shape clips coloring to chosen shape
- [ ] Locked shapes/frames show lock badge
- [ ] Print/Save respects frame/shape

#### 4.3.9 Output actions
- [ ] 🖨️ Print opens print dialog
- [ ] 💾 Save downloads image (includes freehand layer)
- [ ] 🏆 Challenge generates QR/share link
- [ ] 🖼️ Share art shares the artwork
- [ ] 🆕 New returns to hero, retains settings

### 4.4 Completion & Unlocks

- [ ] Filling all regions triggers celebration animation
- [ ] "Coloring complete" toast + sticker earned
- [ ] Completion recorded in progress store
- [ ] Journal entry created
- [ ] Crayon unlock toast at correct thresholds (5/15/30)
- [ ] Brush unlock toast at 3 completions
- [ ] Scene/decoration unlocks fire correctly

### 4.5 Settings Persistence

- [ ] Difficulty persists across page reload
- [ ] Palette selection persists
- [ ] Numbers on/off persists
- [ ] 🔴 First visit (cleared storage): pre-selected Medium draws with 8 colours AND numbers on; mode chip reads "Numbers" (regressed until v371: drew 12 colours, no numbers)
- [ ] 🔴 Touch tablet (Lala_Tablet AVD, Chrome) landscape + portrait: whole picture visible without scrolling; hero shows the 4 suggestion cards under "or pick something fun"
- [ ] 🔴 Phone landscape (Galaxy_S25_Ultra AVD): picture fills the stage (zoom buttons float bottom-right when the card is >470px, otherwise a row above), hint ✕ visible, today's-word pill not cut off, no ◀ over Draw!
- [ ] 🔴 Phone-landscape toolbar at 667/740/844/915/932/1040 wide, EN + DE + ES, with a picture loaded (✓ I'm finished! showing): one row, "⋯ More" fully visible; Tap/Pencil/Brush in the row only when the card is >640px; at 667 Undo/More show ↩ / ⋯ only. More opens a panel OVER the picture (picture doesn't move or shrink) holding Numbers/Free, Print, Save, Share art, 🏆 Challenge!, Share, Report; tapping any of them closes the panel
- [ ] 🔴 Mouse desktop 1024×768 / 1366×768 / 1440×900 / 1920×1080, coloring state: whole picture visible without page scroll (scrollHeight = viewport), zoom buttons float bottom-right of the picture, no lone separator row in the toolbar; same with the side panel expanded and in Pencil mode (regressed until v373: bottom of the picture below the fold)
- [ ] 🔴 SEO-page CTA links (`/?s=1&q=cat&d=easy`, `…&d=hard`): auto-draw with that level's colours (Easy 6 / Hard 12) and its card highlighted; a link's own `c=` still wins (until v375 every level drew Medium's 8)
- [ ] 🔴 🏆 Challenge! in the toolbar (desktop + phone) credits the Challenger sticker and logs challenge_created (until v373 only the hidden strip's "Share →" did)
- [ ] 🔴 Challenge strip ("🏆 Challenge a friend … Share →") shows under the picture after every Draw!/Again!/Journal restore at 1440×900, 1024×768, 390×844, 375×667, 360×640, 844×390, 667×375 (EN + DE; cookie banner answered): ≤2 lines on phone portrait, 1 line (ellipsis) on desktop/landscape; picture never overlaps it or the zoom row; floating zoom buttons sit ABOVE it (never on Share →); Share → opens the challenge modal. Hidden in all three layouts until v380, so it never appeared
- [ ] 🔴 Phone-portrait toolbar row (🆕 New · ↩ · ✓ I'm finished! · ⋯ More) fits at 320/360/375/390px in all 12 languages with no horizontal scroll; ⋯ More is never cut off (sticky right edge). Undo is icon-only on phones (DE/NL/ES/RU/HI labels pushed More off-screen until v381).
- [ ] Challenge modal app link: Android UA → Google Play URL, Play glyph, `noAppYetPlay` text in the UI language (follows a language switch); other UAs → App Store + Apple glyph. Before v381 Android showed the Apple logo with untranslated English.
- [ ] Language persists
- [ ] Theme (dark/light) persists
- [ ] Sound on/off persists
- [ ] Background color persists
- [ ] Canvas frame/shape persists

---

## 5. Mobile

### 5.1 Mobile Web — Portrait (≤767px)

- [ ] ☰ Hamburger opens config panel drawer on single tap
- [ ] Drawer closes on outside tap
- [ ] Config panel contains: difficulty, palette, numbers, sound, narrate, background color, frame selector
- [ ] Canvas fills full width
- [ ] Toolbar single-row scrollable, "⋯ More" overflow for hidden buttons
- [ ] Touch-fill (tap) works: correct region fills
- [ ] Pinch-zoom on canvas works
- [ ] No element overlap

### 5.2 Mobile Web — Landscape (phones ≤500px height)

- [ ] Config sidebar left ≤180px, always visible (no drawer)
- [ ] Canvas fills remaining width
- [ ] No layout overlap
- [ ] Toolbar scrollable single row

### 5.3 Mobile Web — Tablet Portrait (768–1023px)

- [ ] 2-column layout: config left | canvas right
- [ ] Palette as right sidebar

### 5.4 Mobile Web — Tablet Landscape (≥1024px)

- [ ] 3-column layout functional
- [ ] No forced scrolling on the action bar

### 5.5 Android Native App

- [ ] App opens, no crash on launch
- [ ] Hero state renders
- [ ] Draw! triggers image generation (production server)
- [ ] Image renders in canvas
- [ ] Tap fill works
- [ ] Pencil works
- [ ] Sound on/off works
- [ ] Share works (Android share sheet)
- [ ] All difficulty levels generate images
- [ ] 🔴 🚩 Report picture (canvas app bar, Play AI-Generated Content policy): enabled once the image is ready; sheet shows 4 reasons; submit → thanks snackbar + "Draw a new one"; flag turns ✅; row in `content_reports` + evidence file in `data/reports/` (also for Explore pictures)

### 5.6 iOS Native App (Codemagic)

- [ ] TestFlight build installs
- [ ] Same functional checks as Android §5.5
- [ ] Turnstile skipped (Flutter native path — no Origin header → server skips Turnstile)
- [ ] Safe-area insets respected (notch/Dynamic Island)

---

## 6. API / Backend

### 6.1 Image generation

- [ ] 🔴 DeepInfra tier 1 (all difficulties): fresh drawing < 5 s; `[quality] DeepInfra(attempt 1/3)` in `docker service logs`; quality rejection retried with a fresh seed, then Cloudflare — `node scripts/test-deepinfra-tier.js`
- [ ] 🔴 German subjects WITHOUT umlauts are translated ("Schneemann" → snowman, not a man): `[translate]` line in logs — `node scripts/test-translate.js`
- [ ] 🔴 Every tier's output (incl. PNG tiers) is binarized + enclosed-region checked — a frame/medallion/silhouette never reaches the canvas
- [ ] Novita provider: successful generation < 15 s
- [ ] Together provider: fires if Novita fails (waterfall)
- [ ] Demo provider: returns SVG butterfly instantly (local test only)
- [ ] Server returns correct Content-Type (`image/png` or `image/jpeg`)
- [ ] Turnstile token validated server-side (401 on fake token in browser)
- [ ] Rate-limiting: > 5 req/min returns 429
- [ ] Cloudflare 8007 (NSFW false positive) retried on its own budget; 4006 (daily allocation) skips tier until 00:00 UTC — `node scripts/test-cloudflare-retry.js`
- [ ] 🔴 Content reports: `POST /api/community/report-content` (401 without X-Device-ID, 400 bad reason); `/api/admin/content-reports` lists/serves evidence/blocks subject; blocked subject → 400 on `/api/generate-image` — `node scripts/test-content-reports.js`

### 6.2 Cloudflare Turnstile

- [ ] Silent mode: no widget visible on normal page load
- [ ] `before-interactive-callback`: widget moves on-screen (left 50%)
- [ ] Widget positioned correctly, checkbox visible when shown
- [ ] `after-interactive-callback` / success: widget returns off-screen
- [ ] Token reset after each successful generation
- [ ] 🔴 Every path takes a fresh token (generate.js `takeTurnstileToken`): challenge link `/?s=1&q=Muffin` on a cold load, then Draw!, then 🎲 Again! — all three 200, server log has no `[turnstile] fail reason=timeout-or-duplicate` / `no-token`
- [ ] 🔴 /admin/stats → Health: web_turnstile_fail stays a small fraction of web_turnstile_ok
- [ ] /admin/stats → Store imports: play_listing shows "N installs (bucket)"; play_vitals ✓ once the Reporting API is on; cf_traffic ✓ once CF_ANALYTICS_TOKEN is set — then "🌐 Website traffic" and "🛠 App quality" sections fill in
- [ ] /admin one-time link: `bash /opt/lalabuba/scripts/admin-link.sh prod` → open link → lands on /admin/stats (URL shows no token); opening the same link again → "expired or already used" 401; play_reports ✓ once the service account has Play "View app information and download bulk reports"
- [ ] 🔴 /admin/stats SQL: `DATABASE_URL=postgres://…@localhost/<db with "test" in its name> node scripts/test-admin-stats-db.js` (needs a throwaway local Postgres; it wipes the usage tables and refuses anything else): buckets count a person once, Real vs All traffic, tracked periods, D1/D7/D30, stickiness (installs only), core actions, review traffic stored without the IP
- [ ] 🔴 /admin login (`/docs` shares the template): Send stays disabled until "✓ Verified by Cloudflare", clear failure after 20 s or with the script blocked; a failed bot check says "Bot check failed", never anything about the allowlist; code lifetime 10 min on /admin, 15 min on /docs; 4th send in an hour says "wait 1 hour"; a wrong code keeps the address on 401 and 429; pasted "123 456" submits itself on the sixth digit
- [ ] /admin/stats view: Real / All traffic with a note of what was left out (including Store review = 17.0.0.0/8 and Test devices = Firebase Test Lab ranges); day / week / month selector drives charts, table and CSV (default day ≤ 31 days, week ≤ 120, then month); 12m range; periods before tracking print — and export empty, no delta when the comparison period predates tracking; one shared tooltip with each series + total (tap on touch); light, dark, 390 px without horizontal page scroll; refresh every 60 s, never with focus in an input or select, keeping open details and table scroll
- [ ] 🔴 /admin/stats counts people only (migration 013 traffic class): a fresh browser that opens a page and does nothing → "Not counted · Left without interacting"; scroll/tap → becomes an active user (its earlier rows upgrade); a headless/bot UA → Bots; any browser that signed into /admin (cookie lb_int) and debug/emulator app builds (X-Internal: 1) → Internal. Periods: Day/Week/Month with ◀ ▶ + date picker, YTD, 7d/30d/90d, Custom from→to; "User activity by day" table + ⬇ CSV match the period of the KPI tiles
- [ ] Store testers are not people (migration 018): a native install that shows ≥3 UI languages within its first hour → Not counted · Test devices (its earlier events and drawings move with it, and later events stay `test`); an iOS install first seen on a version before Apple's `currentVersionReleaseDate` → Review (applied by the ios_ratings import; its summary says `live X.Y.Z, N pre-release install(s) → review`); one language switch stays human
- [ ] Mobile native apps: Turnstile skipped entirely

### 6.3 Hetzner Server Health

- [ ] `curl https://lalabuba.com/health` → 200 OK
- [ ] Docker service `lalabuba_prod` running: `docker service ls`
- [ ] No OOM killer events in last 24 h: `dmesg | grep -i kill`

---

## 7. Performance Benchmarks

| Metric | Target | Fail |
|---|---|---|
| First Contentful Paint | < 1.5 s | > 3 s |
| Image generation | < 15 s | > 30 s |
| Segmentation worker | < 3 s | > 8 s |
| Fill tap response | < 50 ms | > 200 ms |
| Undo response | < 30 ms | > 100 ms |
| Memory (mobile) | < 200 MB | > 400 MB |

---

## 8. Regression Scenarios (must not break)

These have broken in the past — test explicitly after any related change:

- [ ] **No duplicate UI elements**: every button/icon has exactly one instance unless intentional by design. Check: gallery (🖼️ header only), art style chip (one in chips row), difficulty (pills in hero, chip in coloring). If a new button is added, grep `id="<id>"` to confirm it appears once.
- [ ] **Dense-image coloring** (Extreme submarine): all regions colorable, numbers appear
- [ ] **Turnstile popup**: no visible widget on clean load; challenge shows only when CF demands
- [ ] **Color auto-select**: tapping in Numbers mode auto-selects correct color (no silent reject)
- [ ] **Mobile hero overflow**: suggestion cards don't overflow at 390px portrait
- [ ] **Brush lock**: locked at 0 completions, unlocked at exactly 3rd
- [ ] **floodFillAt dark-pixel**: tapping on line dot finds adjacent fill area
- [ ] **Region detection completes on dense/textured art** (2026-09-20): generate on Hard/Extreme with a subject likely to produce thick solid fills or fine texture lines (stripes, scales, feathers); confirm numbers appear and tap-to-fill works within ~1s, on BOTH platforms. Root cause was a genuine infinite loop in the line-bridging step's Bresenham line-draw for steep slopes (dy > dx) — present identically in the Dart AND JS ports, silently hung past the 60s isolate/worker timeout leaving the image uncolourable with zero errors shown. Permanent regression guard: `flutter_app/test/region_detection_regression_corpus_test.dart` runs on every push (`flutter-ci.yml`) against real problem images in `flutter_app/test/fixtures/regression_corpus/` — any future real-image regression must add its fixture there, not just a synthetic mimic. Cross-engine parity check: `scripts/test-parity-corpus.mjs` (manual for now, see `docs/MODULE_ARCHITECTURE.md`).
- [ ] **Seasonal DE pages are DE-only** (2026-10-17): `/de/ausmalbilder/{einschulung,schultuete,weihnachten,nikolaus,adventskalender,schneemann}/` and their image pages emit ONLY `hreflang="de"` (no `en`/`x-default` — those pointed at 404s before). Non-seasonal DE pages (e.g. `rakete`) still list `en` + i18n alternates. Gallery cards + image-page titles on DE pages show German labels (`DE_SUBJECT_LABELS` in `lib/gallery.js`), not the English prompt. Check: `curl -s https://lalabuba.com/de/ausmalbilder/weihnachten/ | grep hreflang`.
- [ ] **German related-card labels fit** (2026-10-17): no `.lp-related-card` overflows at 375 / 844 / 1440 on `/de/ausmalbilder/` and the Christmas pages ("Adventskalender" is the longest label; grid min track is 160px).
- [ ] **Car topic in every language** (2026-10-18): `/en/coloring-pages/car/`, `/de/ausmalbilder/auto/` and the 10 i18n pages (`/pages-a-colorier/voiture/`, `/raskraski/mashina/`, `/kolorowanki/samochod/`, `/zhuose-ye/qiche/` …) return 200 with 9/9/9 pictures; card captions, image-page titles and alt text are in the page language (`lib/subject-labels.js` via `gallery.subjectLabel`), never the English prompt. Per-topic grammar overrides (`topicOverrides` in `lib/coloring-i18n.js`) — e.g. RU CTA reads "Создать свою машину →".
- [ ] 🔴 **One topic nav on every coloring page** (2026-10-18): topic, picture and daily pages in all 12 languages end with the same "All topics" list from `lib/topic-nav.js` (TOPIC_META + live gallery): page-language names, the current topic highlighted and not a link, German includes the seasonal topics, other languages never link a seasonal topic, a topic with no pictures is absent. EN/DE hub grids + hub JSON-LD come from the same source (static pages hold `<!--topic-…-->` / `"__TOPIC_…__"` markers — none may reach the browser). `node scripts/test-topic-nav.js`.
- [ ] 🔴 **App Explore is API-driven + localised** (2026-10-18): `GET /api/gallery/topics?lang=xx` lists evergreen topics with localised names; `GET /api/gallery?topic=car&lang=xx` adds `label`. In the app, switch language → Explore title, header, "Color now" CTA, topic names, difficulty headings and picture captions all change; a topic added on the server appears without an app release; offline falls back to the bundled list. `flutter test test/explore_screen_test.dart`.
- [ ] **Client config fallback matches server defaults** (2026-09-20): `flutter_app/test/drawing_config_defaults_test.dart` (run in `flutter-ci.yml`) catches drift between `lib/drawing-config.js` DEFAULTS and Flutter's offline fallback. Regenerate the snapshot (`node scripts/generate-config-snapshot.mjs`) after any change to server DEFAULTS, then re-run the test.

- [ ] 🔴 **Usage stats dashboard** (2026-10-30): `node scripts/test-usage-stats.js` (helpers, CSV/TSV/UTF-16 parsing, admin vs docs session separation) + `flutter test test/usage_service_test.dart` (event contract with `lib/usage.js` EVENTS, never forwards the typed subject). Live: open `/admin/stats` → redirected to `/admin/login`; email OTP (Brevo) → dashboard renders KPI tiles incl. **Total reviews ★**, charts, prompts, screens/pages, acquisition, reviews, health; range + platform pills reload. `curl -XPOST /api/t` with an unknown event → 204 and nothing stored. A web Draw! adds one `generation_log` row with `platform=web`, `source`; an app draw adds `platform=ios|android` + `app_version`. Without cookie consent the web beacon sends no `iid` and writes nothing to localStorage. "Delete account" in the app removes that install's `usage_*`/`generation_log` rows. Store imports: dashboard "Store imports" box shows each feed ✓ or the missing credential.

- [ ] 🔴 **Feedback & ratings** (2026-10-31): `node scripts/test-usage-stats.js` (feedback helpers) + `flutter test test/feedback_widget_test.dart`. Web: finish a picture → celebration shows 😍 🙂 😕 → tap one → "Thanks" + `POST /api/feedback` 204; footer "⭐ Rate Lalabuba" → modal → Send without stars shows the error; 4★ + comment → thanks, closes, email arrives at info@. Contact form → email arrives at info@ with Reply-To = sender (Brevo; it was silently dropped before 2026-10-31). App: celebration rating row (only for server images); Settings → Send feedback → parental gate → sheet. `/admin/stats` "Feedback & ratings": site ★ avg + distribution, comments, picture ratings by provider/difficulty, re-roll rate, contact count, content reports, review prompts.

---

## 9. Test Execution Log

> Append a row each deploy. Format: `| date | version | scope | pass/fail | notes |`

| Date | Version | Scope | Result | Notes |
|---|---|---|---|---|
| 2026-06-27 | v228 | Numbers fix, dense fill, brush lock | Code-traced | Visual QA clean; real-device dense-image not yet verified |
| 2026-09-20 | web: commit 7a10d27; Flutter: 1.0.19+10079 | Full E2E: generation (Hard difficulty) → numbers → tap-to-fill → undo → free-mode toggle → freehand, both platforms | **Tested** (real device/browser, not code-traced) | Android: Galaxy S25 Ultra emulator, fresh debug APK install, real generation via Cloudflare tier (octopus-bus, hard). Web: Chrome on lalabuba.com prod, real generation via HuggingFace/nscale fallback tier (elephant, hard) — first live confirmation the tier's quality gate (added today, see image-providers.js) actually runs. Both: numbers/tap-fill/undo/mode-switch verified working, zero console errors, zero crashes. One pre-existing (not a regression) rough edge noted: a single oddly-shaped small region on a fine-detail image needed a precise tap — large regions unaffected. Fixed same-session: the line-bridge infinite-loop bug (see §8) that would have made this exact test impossible before today. |

---

## 10. Android Beta (12 testers, 14 days starting ~2026-07-01)

See `ANDROID_BETA_CHANGELOG.md` for issue tracking.
Items to track per tester session: generation success rate, fill accuracy, crash reports.

---

## Child-safety moderation (lib/moderation.js)

- 🔴 `node scripts/test-moderation.js`: fail-closed, three layers, nothing stored on refusal, triage, repeat attempts (part of `npm test`).
- 🔴 After changing a policy text or a model, run `scripts/test-moderation-live.js` in the app container. Targets: every unsafe phrase blocked, at most 2% of innocent subjects refused, on both corpora. A phrase used to tune the policy moves out of `safety-corpus-holdout.json`.
- 🔴 Web: 🚩 Report picture opens the sheet, a reason sends it, and the report appears under Safety in `/admin/stats`. "Picture is fine" and "Remove and block subject" both close it.
- Never generate sexual imagery to test the picture check, and never any imagery of minors. Use stored evidence and non-sexual positives.
