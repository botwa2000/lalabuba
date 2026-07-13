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

### 5.6 iOS Native App (Codemagic)

- [ ] TestFlight build installs
- [ ] Same functional checks as Android §5.5
- [ ] Turnstile skipped (Flutter native path — no Origin header → server skips Turnstile)
- [ ] Safe-area insets respected (notch/Dynamic Island)

---

## 6. API / Backend

### 6.1 Image generation

- [ ] Novita provider: successful generation < 15 s
- [ ] Together provider: fires if Novita fails (waterfall)
- [ ] Demo provider: returns SVG butterfly instantly (local test only)
- [ ] Server returns correct Content-Type (`image/png` or `image/jpeg`)
- [ ] Turnstile token validated server-side (401 on fake token in browser)
- [ ] Rate-limiting: > 5 req/min returns 429

### 6.2 Cloudflare Turnstile

- [ ] Silent mode: no widget visible on normal page load
- [ ] `before-interactive-callback`: widget moves on-screen (left 50%)
- [ ] Widget positioned correctly, checkbox visible when shown
- [ ] `after-interactive-callback` / success: widget returns off-screen
- [ ] Token reset after each successful generation
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

---

## 9. Test Execution Log

> Append a row each deploy. Format: `| date | version | scope | pass/fail | notes |`

| Date | Version | Scope | Result | Notes |
|---|---|---|---|---|
| 2026-06-27 | v228 | Numbers fix, dense fill, brush lock | Code-traced | Visual QA clean; real-device dense-image not yet verified |

---

## 10. Android Beta (12 testers, 14 days starting ~2026-07-01)

See `ANDROID_BETA_CHANGELOG.md` for issue tracking.
Items to track per tester session: generation success rate, fill accuracy, crash reports.
