# Lalabuba — Delivery Plan

> **Session-persistent checklist.** Every Claude session working on Lalabuba MUST
> read this file first. Update task status inline as work progresses. Architecture
> detail lives in `PLATFORM_ARCHITECTURE.md`; QA infrastructure in `TESTING_PLAN.md`.
>
> ⚠️ **CONFLICT ZONE:** A second VS Code + Claude Code instance may be running
> Android emulator tests. Never launch `flutter emulators`, `flutter run -d emulator-*`,
> or `adb` commands unless you have confirmed the other instance is idle. Editing
> `.dart` files, `flutter analyze`, and `flutter test` (unit/widget) are safe.

---

## QA Protocol (run after EVERY change, no exceptions)

### Web — after any HTML/CSS/JS/server change
```powershell
$env:NODE_PATH = "C:\Users\Alexa\lalabuba\scripts\node_modules"
node scripts/screenshot-qa.js https://lalabuba.com
```
- READ every one of the 12 PNGs produced in `public/mockups/` with the Read tool
- Inspect: desktop (1440×900), mobile-portrait (390×844), mobile-landscape (844×390) × hero + coloring + no-numbers + free-mode
- Delete ALL screenshots after review
- Also run Playwright against the staging URL if only deployed to dev: `node scripts/screenshot-qa.js https://dev.lalabuba.com`

**After any server-rendered page change**, manually verify in browser (use Chrome DevTools device toolbar for portrait/landscape):
- Desktop: nav elements correct, breadcrumbs correct, language picker functional
- Mobile portrait: hamburger opens drawer, nav not clipped
- Mobile landscape: sidebar not overlapping canvas

### Web — functional smoke test after every deploy
Confirm live URL serves the right version: `curl -s https://lalabuba.com/js/main.js?v=NNN | head -3`

### Flutter — after any `.dart` change
```powershell
cd flutter_app
flutter analyze          # must be clean
flutter test             # all unit + widget tests must pass
```
**Do NOT launch emulator if other VS Code instance may be active.**
When clear to run emulator:
```powershell
flutter emulators --launch Galaxy_S25_Ultra   # phone portrait+landscape
flutter emulators --launch Lala_Tablet        # tablet portrait+landscape
```
Capture: `adb -s emulator-5554 exec-out screencap -p > tmp.png` → Read → Delete.
Verify: hero screen, coloring screen (portrait + rotate to landscape for each device).

### Deploy sequence (web)
1. Bump `?v=NNN` in `public/index.html` by 1 (grep `?v=` to find current)
2. `git add <changed files> public/index.html`
3. `git commit -m "description\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`
4. `git push origin main`
5. Health check: `ssh -i ~/.ssh/id_rsa root@91.99.212.17 "docker service logs lalabuba-prod_app --since 2m 2>&1 | tail -5"`
6. Run Playwright screenshots, read all 12

### Deploy sequence (Android — Play Store)
1. `cd flutter_app && flutter build appbundle --release`
2. Save APK sideload: `flutter build apk --release` → copy to `C:\Users\Alexa\OneDrive\TEMP\`
3. Upload AAB to Play Console (Internal Testing → promote to Production when stable)

### Deploy sequence (iOS — App Store via Codemagic)
1. Push to `main` — GHA triggers Codemagic `flutter-release` workflow
2. Codemagic builds + signs + uploads to TestFlight automatically
3. Review TestFlight build on device; promote to App Store Connect when stable

---

## System 1: Navigation (Unified)

**Problem:** Two incompatible nav implementations exist.
- `lpBrandNav()` in `server.js` (server-rendered, used by EN/dynamic pages) — has NO language picker, NO account button
- `lp-nav.js` (client JS, upgrades static DE pages) — has 🖼️⚙️ but NO language picker
- Neither matches the main app's nav

**Target:** Single server-rendered nav component used everywhere. `lp-nav.js` becomes wiring-only (theme toggle, dropdown open/close, account flyout). Details in `PLATFORM_ARCHITECTURE.md §2`.

### Tasks

- [x] **NAV-1** Create `lib/lp-nav-component.js`
  - Exports `buildNav({ lang, breadcrumbs, hreflangMap, ctaHref })` → HTML string
  - Logo (colored wordmark), breadcrumbs, language picker dropdown (all 12 langs with correct cross-links), 🖼️ journal link, 👤 account icon button, theme toggle button
  - Language picker: native `<details><summary>` or `<div role="combobox">` with `<ul>` — no JS needed to open, JS adds keyboard nav
  - Account button: shows 👤 if not logged in; shows avatar emoji + nickname if session cookie present (server reads JWT)
  - Mark nav with `class="lp-nav lp-branded"` and `data-lang="{lang}"`

- [x] **NAV-2** Rewrite `public/js/lp-nav.js` to wiring-only
  - Remove all DOM restructuring (the `upgradeNav()` function that rewrites `innerHTML`)
  - Keep: `wireTheme()` (theme toggle), `wireLangMenu()` (open/close dropdown keyboard), `wireAccountFlyout()` (fetch `/api/auth/me`, show sign-in or profile), `injectLegalFooterSocial()`
  - The HTML nav is already server-rendered; JS only adds interactivity

- [x] **NAV-3** Replace `lpBrandNav()` in `server.js` with `buildNav()` from NAV-1
  - Add language picker `<ul>` with correct cross-links per page (pass `hreflangMap` — already computed for every page)
  - Add 🖼️ journal link (href = `/{lang}/` with `#gallery` fragment or modal trigger)
  - Add 👤 account button (no server-side session reading needed; JS flyout does it client-side)
  - Apply to: today page, daily page, DE daily page, hub pages, topic pages

- [x] **NAV-4** Apply `buildNav()` to all static DE ausmalbilder pages
  - The static HTML pages at `public/ausmalbilder/*/index.html` currently have `<nav class="legal-nav">` which `lp-nav.js` upgrades client-side
  - After NAV-2, `lp-nav.js` no longer restructures the DOM
  - Options: (a) server regenerate these files with the new nav pre-baked, or (b) keep the static files but have the server inject the new nav on the fly in `serveTopicPageWithGallery` (simplest: replace the `<nav>` block in the HTML string)
  - Chosen approach: server rewrites the `<nav class="legal-nav">...</nav>` block in `injectGalleryIntoHtml()` using `buildNav()` result

- [x] **NAV-5** Add language picker CSS to `public/css/legal.css`
  - `.lp-lang-picker`: position relative, inline-flex
  - `.lp-lang-btn`: same style as `.lp-nav-icon-btn`, shows current flag+code
  - `.lp-lang-menu`: absolute dropdown, `hidden` attr toggle, `z-index` above content
  - `.lp-lang-menu a`: full-width, hover highlight, current lang bolded
  - MUST work at 375px (mobile portrait): dropdown does not clip off-screen (use `right: 0` anchor)

- [x] **NAV-6** Playwright screenshots + manual browser verification
  - Desktop: language picker visible and functional, account button present
  - Mobile portrait: nav not clipped, picker opens without overflow
  - Mobile landscape: nav single row, no wrap

---

## System 2: Coloring-Page URL Architecture

**Problem:** Pages at `/coloring-pages/dinosaur/` and `/ausmalbilder/dinosaurier/` have no language prefix. Pre-generated images have no individual canonical URLs.

**Target:** `/en/coloring-pages/dinosaur/triceratops-easy/` with its own title/description/ImageObject schema + print route. Language prefix on all pages. Details in `PLATFORM_ARCHITECTURE.md §1`.

### Tasks

- [x] **URL-1** Add slug field to `gallery.json` schema
  - In `lib/gallery.js`, when a new image is saved to the manifest, compute and store `slug`
  - Slug formula: take first significant noun from `subject` (e.g. `"friendly triceratops"` → `"triceratops"`), append `-{difficulty}` in English (`-easy`, `-medium`, `-hard`)
  - Collision guard: if slug already exists in this topic, append `-2`, `-3`, etc.
  - Also store `slugs` map per language (DE: `triceratops-leicht`, FR: `triceratops-facile`, etc.) — difficulty label from each LANGS config
  - Backfill existing gallery entries (run over existing `gallery.json` on boot if `slug` missing)

- [x] **URL-2** Add 301 redirects for old bare paths
  - In `server.js` routing block, before serving any coloring page:
    - `/coloring-pages/*` → `/en/coloring-pages/*` (301)
    - `/ausmalbilder/*` → `/de/ausmalbilder/*` (301)
    - `/pages-a-colorier/*` → `/fr/pages-a-colorier/*` (301)
    - etc. for all 10 non-EN non-DE languages
  - Exception: routes that are already language-prefixed pass through

- [x] **URL-3** Add language-prefixed routing in `server.js`
  - Current patterns: `/coloring-pages/:topic/` and `/ausmalbilder/:slug/`
  - New patterns: `/en/coloring-pages/:topic/`, `/de/ausmalbilder/:slug/`, `/{lang}/{root}/{topicSlug}/`
  - The logic already exists; extract path with `p.match(/^\/(en|de|fr|es|pt|ru|it|nl|pl|tr|zh|hi)\/(.+)/)` and route to existing handlers
  - Update `lpBrandNav()` / `buildNav()` links to use language-prefixed URLs

- [x] **URL-4** Individual image page template (server-rendered)
  - Route: `GET /{lang}/coloring-pages/{topic}/{slug}/`
  - Look up entry in `gallery.json` by `topic` + `slug` (or language-specific slug)
  - Render full HTML page:
    - `<title>{SubjectName} Coloring Page ({Difficulty}) — Free Printable | Lalabuba</title>`
    - `<meta description>` specific to this image (subject + difficulty + age range)
    - `<link rel="canonical">` + full `hreflang` block for all 12 language equivalents
    - `ImageObject` + `BreadcrumbList` schema
    - Above fold: `<img src="{imageUrl}">` + "Color this now →" CTA + "Download / Print" CTA
    - Below fold: description, difficulty info, related images grid, "Generate your own" section
  - OG image = the actual coloring page PNG (not og-image.png)

- [x] **URL-5** Print / download route
  - Route: `GET /{lang}/coloring-pages/{topic}/{slug}/print`
  - Response for `?download=1`: serve PNG with `Content-Disposition: attachment; filename="lalabuba-{slug}.png"`
  - Response without param: minimal HTML page with `<img>` + `window.print()` on load + `@media print { body { margin:0 } }`

- [x] **URL-6** Topic index pages updated to link to individual pages
  - The gallery card links currently go to `/?s=1&img=...`
  - Change `galleryCardHtml()` to link to `/{lang}/coloring-pages/{topic}/{slug}/` instead
  - "Color this →" text on the card → clicking opens the individual page (which then has the "Color now →" CTA)

- [ ] **URL-7** Expand gallery depth
  - Target: 30 images per topic per difficulty (= 30 × 3 × 8 topics = 720 images)
  - Use existing admin HTTP API (`POST /api/admin/generate-gallery`)
  - Run in batches via `scripts/populate-gallery.js` (create this script)
  - Do NOT run simultaneously with live traffic spikes

- [ ] **URL-8** Playwright + manual verification
  - `/en/coloring-pages/dinosaur/triceratops-easy/` loads with image, both CTAs present
  - `/de/ausmalbilder/dinosaurier/triceratops-leicht/print` serves PNG
  - Old URL `/coloring-pages/dinosaur/` redirects 301 to `/en/coloring-pages/dinosaur/`
  - Schema markup present: `application/ld+json` with `ImageObject`

---

## System 3: Account & Family Architecture

**Problem:** No email verification. No child profiles. No parent/child distinction. One flat account per family.

**Target:** Parent account (email + OTP verification) → N child profiles (nickname, avatar, optional PIN). "Who's coloring today?" screen. Details in `PLATFORM_ARCHITECTURE.md §3`.

### Tasks

- [x] **ACC-1** DB migration `004_email_otp_children.sql`
  ```sql
  ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_verification_attempted_at TIMESTAMPTZ;

  CREATE TABLE IF NOT EXISTS email_otp_codes (
    id         BIGSERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    code       CHAR(6)      NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used_at    TIMESTAMPTZ,
    attempts   SMALLINT     DEFAULT 0,
    created_at TIMESTAMPTZ  DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_otp_email ON email_otp_codes(email, expires_at);

  CREATE TABLE IF NOT EXISTS child_profiles (
    id              SERIAL PRIMARY KEY,
    account_id      INTEGER     NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    nickname        VARCHAR(60) NOT NULL,
    avatar_index    SMALLINT    DEFAULT 0,
    age_group       VARCHAR(5),
    access_pin_hash VARCHAR(60),
    sort_order      SMALLINT    DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_child_profiles_account ON child_profiles(account_id);

  ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS child_profile_id INTEGER REFERENCES child_profiles(id) ON DELETE SET NULL;
  ```

- [x] **ACC-2** `lib/email.js` — Resend API wrapper
  - `sendOtp(email, code, lang)` — sends 6-digit code via `POST https://api.resend.com/emails`
  - Reads `RESEND_API_KEY` from env
  - Simple subject: "Your Lalabuba code: {code}"
  - Plain text + minimal HTML body (code in large bold)
  - Add `RESEND_API_KEY` to Swarm secrets: `scripts/deploy.sh secrets prod`

- [x] **ACC-3** `api/auth/send-otp.js`
  - `POST /api/auth/send-otp { email }`
  - Rate limit: 3 per hour per email (not per IP — emails are specific)
  - Generate 6-digit code: `Math.floor(100000 + Math.random() * 900000).toString()`
  - Insert into `email_otp_codes` with `expires_at = NOW() + interval '10 minutes'`
  - Invalidate (set `used_at = NOW()`) any prior unused codes for same email
  - Call `email.sendOtp()`
  - Return `{ ok: true }` — never reveal whether email exists (prevent enumeration)

- [x] **ACC-4** `api/auth/verify-email.js`
  - `POST /api/auth/verify-email { email, code }`
  - Find latest non-expired, non-used OTP for email
  - Increment `attempts`; if ≥ 5, mark `used_at = NOW()` and return 429 `{ code: 'MAX_ATTEMPTS' }`
  - If code doesn't match: return 400 `{ code: 'WRONG_CODE', attemptsLeft: 5-attempts }`
  - On match: `used_at = NOW()`, `accounts.email_verified_at = NOW()`
  - Issue access + refresh tokens (same as current login.js)
  - Return `{ ok: true, accessToken, refreshToken, expiresIn, accountId, email }`

- [x] **ACC-5** `api/auth/resend-otp.js`
  - `POST /api/auth/resend-otp { email }`
  - Same rate limit bucket as `send-otp`
  - Invalidates prior codes, generates new one, sends email
  - Returns `{ ok: true, cooldownSeconds: 60 }`

- [x] **ACC-6** Modify `api/auth/register.js`
  - After creating account, call `send-otp` internally (don't issue tokens yet)
  - Return `{ ok: true, pendingVerification: true, email }` — no `accessToken` yet
  - Unverified accounts CANNOT log in (ACC-7)

- [x] **ACC-7** Modify `api/auth/login.js`
  - After credential check, if `email_verified_at IS NULL`: return 403 `{ code: 'EMAIL_NOT_VERIFIED', email }`
  - Client must then show "Check your email for the verification code" with resend button

- [x] **ACC-8** Child profile CRUD `api/auth/children.js`
  - `GET /api/auth/children` — list all child profiles for authed account
  - `POST /api/auth/children { nickname, avatarIndex, ageGroup, pin? }` — create (requires verified email)
    - Max children = `max_child_profiles` config (default 6)
    - `nickname` must pass `isValidNickname()` from `lib/nicknames.js`
    - `avatarIndex` must pass `isValidAvatar()` from `lib/avatar.js`
    - If `pin` provided: bcrypt hash it, store as `access_pin_hash`
  - `PATCH /api/auth/children/:id { nickname?, avatarIndex?, ageGroup?, pin? }` — update
  - `DELETE /api/auth/children/:id` — delete (cascades profiles/artworks)
  - `POST /api/auth/children/:id/verify-pin { pin }` — validates PIN; returns `{ ok: true }` or 401

- [x] **ACC-9** Add routes to `api/auth/router.js`
  - `/api/auth/send-otp`, `/api/auth/verify-email`, `/api/auth/resend-otp`
  - `/api/auth/children` (GET + POST)
  - `/api/auth/children/:id` (PATCH + DELETE) — regex match
  - `/api/auth/children/:id/verify-pin` (POST) — regex match

- [x] **ACC-10** Web UI — OTP verification step
  - In account modal / registration flow: after email+password submit, show OTP screen
  - 6 individual digit inputs (auto-advance on each keypress)
  - Countdown timer for expiry (10 min from send time)
  - "Resend code" link (active after 60s cooldown)
  - On success: show "Email verified! Now set up who's coloring."

- [x] **ACC-11** Web UI — Child profile management
  - Account settings modal: "Children" section
  - List of child profile cards (avatar emoji, nickname, age badge, edit/delete)
  - "+ Add child" button → inline form: nickname picker (from curated list), avatar grid, age group radio, optional PIN toggle
  - On app load (coloring state): if account has ≥1 child and no `active_child_id` in session → show "Who's coloring?" modal overlay (grid of child cards, tap to select, PIN prompt if child has one)
  - "I'm the parent" link at bottom of selector → closes selector, uses parent account directly

- [x] **ACC-12** Flutter — OtpVerificationScreen
  - Shown after registration, before issuing tokens
  - 6 `TextField` boxes in a row, auto-advance on each digit, backspace goes back
  - "Resend" button with 60s cooldown timer
  - Calls `POST /api/auth/verify-email`; on success navigates to ChildSelectorScreen or HomeScreen

- [x] **ACC-13** Flutter — ChildSelectorScreen
  - Full-screen grid of child profile cards
  - Each card: large avatar emoji, nickname, age badge
  - Tap → if PIN set: show `ChildPinScreen`; else set `activeChildId` in `SharedPreferences`, navigate to HomeScreen
  - "I'm the parent" TextButton at bottom
  - Shown on app start if `account != null && children.isNotEmpty && activeChildId == null`

- [x] **ACC-14** Flutter — AddChildScreen
  - `CupertinoPicker` (iOS-style wheel) for nickname (curated list from `GET /api/community/nicknames`)
  - Emoji grid for avatar (20 options)
  - Age group chip selector: "3–5 years", "6–8 years", "9–12 years"
  - Optional PIN: toggle → 4-digit PIN keypad appears
  - Submit → `POST /api/auth/children`

- [x] **ACC-15** Flutter — Settings screen family section
  - "Family" group in settings: list of children, "+ Add child" tile, "Switch child" tile
  - Each child tile: avatar + nickname + age + edit icon
  - Edit opens AddChildScreen in edit mode

- [x] **ACC-16** DB migration run on prod + dev
  - `scripts/deploy.sh dev` (migration runs on boot automatically via `runMigrations()`)
  - Verify: `psql $DATABASE_URL -c "\dt"` — all new tables present
  - `scripts/deploy.sh prod` (typed `deploy` confirmation)

- [ ] **ACC-17** QA — account flow end to end
  - Web: register → OTP email arrives → enter code → verified → create child → "who's coloring?" appears on next visit → select child
  - Flutter: same flow on Galaxy_S25_Ultra AVD (when other instance is idle)
  - Verify: unverified account cannot log in (gets 403 + resend option)
  - Verify: child PIN prompt appears correctly
  - Verify: community sharing blocked until email verified

---

## Deployment Checklist

### Web (Hetzner)
- [x] **DEPLOY-W1** All NAV tasks complete + Playwright green
- [ ] **DEPLOY-W2** All URL tasks complete + Playwright green (blocked on URL-7 gallery depth)
- [ ] **DEPLOY-W3** `RESEND_API_KEY` added to Swarm secrets (both dev + prod) — BLOCKING: key not in any secrets store; needs owner input
- [ ] **DEPLOY-W4** All ACC tasks complete + manual OTP test passing (blocked on DEPLOY-W3)
- [x] **DEPLOY-W5** `scripts/deploy.sh prod` — final production deploy (live on prod)
- [x] **DEPLOY-W6** Verify live: `curl https://lalabuba.com/en/coloring-pages/dinosaur/triceratops-easy/` returns 200 ✓
- [x] **DEPLOY-W7** Verify old redirect: `curl -I https://lalabuba.com/coloring-pages/dinosaur/` returns 301 ✓

### Android (Play Store)
- [x] **DEPLOY-A1** `flutter analyze` clean ✓
- [x] **DEPLOY-A2** `flutter test` all pass (107/107) ✓
- [x] **DEPLOY-A3** ACC Flutter screens complete (ACC-12 through ACC-15) ✓
- [ ] **DEPLOY-A4** Emulator portrait + landscape QA passes (when other instance idle)
- [ ] **DEPLOY-A5** `flutter build appbundle --release` succeeds (triggered via flutter-release.yml)
- [ ] **DEPLOY-A6** Save release APK to `C:\Users\Alexa\OneDrive\TEMP\`
- [ ] **DEPLOY-A7** Upload AAB to Play Console → Internal Testing → promote to Production

### iOS (App Store via Codemagic)
- [ ] **DEPLOY-I1** Same Flutter code as Android (single codebase)
- [ ] **DEPLOY-I2** Push to `main` → GHA triggers Codemagic `flutter-release`
- [ ] **DEPLOY-I3** Codemagic build passes — review TestFlight artifact
- [ ] **DEPLOY-I4** Test on physical iOS device or TestFlight (safe areas, PIN entry, OTP)
- [ ] **DEPLOY-I5** Submit to App Store Connect for review

---

## Implementation Order

Start with NAV (visible to users immediately), then URL (SEO), then ACC (account system):

```
NAV-1 → NAV-2 → NAV-3 → NAV-4 → NAV-5 → NAV-6 (deploy)
URL-1 → URL-2 → URL-3 → URL-4 → URL-5 → URL-6 → URL-8 (deploy)
URL-7 (background — gallery population)
ACC-1 → ACC-2 → ACC-3 → ACC-4 → ACC-5 → ACC-6 → ACC-7 (deploy backend)
ACC-8 → ACC-9 → ACC-10 → ACC-11 (deploy web UI)
ACC-12 → ACC-13 → ACC-14 → ACC-15 → ACC-16 → ACC-17 (deploy mobile)
DEPLOY-W1…W7 → DEPLOY-A1…A7 → DEPLOY-I1…I5
```

---

## Session Handoff Notes

When a new session picks this up:
1. Check which tasks above are marked `[x]` — start from the first `[ ]`
2. Read `PLATFORM_ARCHITECTURE.md` for architecture detail before implementing any task
3. Read `TESTING_PLAN.md` for full QA checklist
4. Check for emulator conflict before any `flutter emulators --launch` command
5. Never deploy without running Playwright screenshots and reading all 12 PNGs
6. Bump `?v=NNN` in `index.html` on every deploy that changes a static asset
