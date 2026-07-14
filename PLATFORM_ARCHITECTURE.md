# Lalabuba — Platform Architecture Plan

> **Reference document for AI sessions.** Describes the target end-state for three
> interrelated systems: coloring-page URL structure, unified navigation, and account
> / family architecture. Read this before touching any of these areas.

---

## 1. Coloring-Page URL Architecture

### End State

Every coloring page URL carries an explicit language prefix. No page lives at a
bare path like `/coloring-pages/dinosaur/`.

```
/en/coloring-pages/                                    ← hub
/en/coloring-pages/dinosaur/                           ← topic index
/en/coloring-pages/dinosaur/triceratops-easy/          ← individual image
/en/coloring-pages/dinosaur/triceratops-easy/print     ← print / download view

/de/ausmalbilder/                                      ← hub
/de/ausmalbilder/dinosaurier/                          ← topic index
/de/ausmalbilder/dinosaurier/triceratops-leicht/       ← individual image
/de/ausmalbilder/dinosaurier/triceratops-leicht/print

/fr/pages-a-colorier/dinosaure/triceratops-facile/
/es/paginas-para-colorear/dinosaurio/triceratops-facil/
/pt/paginas-para-colorir/dinossauro/triceratops-facil/
/ru/raskraski/dinozavr/triceratops-legkij/
/it/disegni-da-colorare/dinosauro/triceratops-facile/
/nl/kleurplaten/dinosaurus/triceratops-makkelijk/
/pl/kolorowanki/dinozaur/triceratops-latwy/
/tr/boyama-sayfalari/dinozor/triceratops-kolay/
/zh/zhuose-ye/konglong/triceratops-jidian/
/hi/rang-bharane-ke-chitra/dayanasora/triceratops-aasaan/
```

#### Redirects (301, permanent)
Old bare paths redirect to language-prefixed equivalents:
- `/coloring-pages/*`  → `/en/coloring-pages/*`
- `/ausmalbilder/*`    → `/de/ausmalbilder/*`
- `/pages-a-colorier/*` → `/fr/pages-a-colorier/*`
- etc.

The main app also follows this: `/` → `/en/` (or user's preferred language).

### Slug Generation

Slugs are generated at gallery-population time and stored in `gallery.json`:

```
subject: "friendly triceratops", difficulty: "easy", lang: "en"
  → slug: "triceratops-easy"

subject: "friendly triceratops", difficulty: "easy", lang: "de"
  → slug: "triceratops-leicht"
```

Rules:
- Derive the display word from the subject (first noun, or full subject with spaces→hyphens)
- Append `-{difficulty_in_lang}` (`leicht` / `mittel` / `schwer` for DE, etc.)
- If slug collision within a topic, append `-2`, `-3`, etc.
- Store slug in `gallery.json` entry alongside existing `url`, `subject`, `difficulty`

### Individual Image Page — Content

Each image page is a server-rendered HTML page with:

**Above the fold:**
- Full-width coloring image (the actual PNG, visible immediately, no JS needed)
- `<h1>` specific to this image: "Triceratops Coloring Page (Easy)"
- Two primary buttons:
  - **"Color this now →"** — links to `/{lang}/?img=<encoded-url>&q=<subject>&d=<difficulty>`
    (loads that exact image with zero AI call via the existing `share.js` `img=` path)
  - **"🖨️ Download / Print"** — links to `/{lang}/coloring-pages/dinosaur/triceratops-easy/print`

**Below the fold:**
- 3–4 sentence description specific to this image + difficulty level (age range, number of regions)
- Grid of other images in the same topic + difficulty
- "Generate your own unique Dinosaur" CTA → triggers AI generation
- Related topics grid

**Schema markup per image:**
```json
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "name": "Triceratops Coloring Page (Easy)",
  "description": "Free printable triceratops coloring page...",
  "contentUrl": "https://lalabuba.com/img/g/dinosaur-easy-triceratops-12345.png",
  "thumbnailUrl": "https://lalabuba.com/img/g/dinosaur-easy-triceratops-12345.png",
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "acquireLicensePage": "https://lalabuba.com/en/terms",
  "creator": { "@type": "Organization", "name": "Lalabuba" },
  "encodingFormat": "image/png",
  "keywords": "dinosaur coloring page, triceratops coloring, free printable, kids coloring"
}
```

### Print / Download Route

`GET /{lang}/coloring-pages/{topic}/{slug}/print`

Server response: the PNG image itself with headers:
```
Content-Type: image/png
Content-Disposition: attachment; filename="lalabuba-triceratops-easy.png"
```

For in-browser print: a minimal HTML page with `<img>` + `@media print { body { margin:0 } }` +
`window.print()` on load.

### Gallery Depth Target

| Tier | Images per topic per difficulty |
|------|--------------------------------|
| Current | 0–9 |
| Target (for individual pages to be useful) | 30+ |
| Ideal (for topic to rank) | 60–100 |

Use the existing gallery admin HTTP API to batch-generate. Scripts in `scripts/`.

### Topic Coverage Target

Current: ~10 topics. Target: 50–100. Add batch via `TOPIC_META` in `lib/gallery.js`.

---

## 2. Unified Navigation Architecture

### Problem

There are currently two different nav implementations:
1. **`lpBrandNav()` in `server.js`** — server-rendered, used on EN coloring pages and daily pages. Has logo + breadcrumbs + CTA. No language picker, no account button, no journal/gallery.
2. **`lp-nav.js`** — client-side, upgrades the `<nav>` on static DE/ausmalbilder pages. Adds 🖼️ and ⚙️ icon buttons after the fix in commit `aca002e`. Still no language picker.

Neither matches the main app nav, which has a completely different layout.

### End State: One Server-Rendered Nav

All pages (static LP, dynamic LP, main app shell) use a **single server-rendered nav** component (`lib/lp-nav-component.js`). The client-side `lp-nav.js` is removed.

The nav renders with full content in HTML — no JS required for structure (only for interactivity: theme toggle, language dropdown, account flyout). This means Google and Pinterest see the full nav.

**Nav structure:**
```html
<nav class="lp-nav" data-lang="de">
  <!-- Left: brand -->
  <a href="/de/" class="lp-nav-brand">
    <img src="/logo.png" width="36" height="36" alt="">
    <span class="lp-nav-wordmark"><!-- colored Lalabuba --></span>
  </a>

  <!-- Center: breadcrumbs (omitted on main app) -->
  <div class="lp-nav-crumbs">
    <a href="/de/ausmalbilder/">Ausmalbilder</a>
    <span aria-hidden="true">›</span>
    <span>Dinosaurier</span>
  </div>

  <!-- Right: actions -->
  <div class="lp-nav-actions">
    <!-- Language picker -->
    <div class="lp-lang-picker" role="navigation" aria-label="Language">
      <button class="lp-lang-btn" aria-expanded="false">🌍 DE</button>
      <ul class="lp-lang-menu" hidden>
        <li><a href="/en/coloring-pages/dinosaur/" hreflang="en">English</a></li>
        <li><a href="/fr/pages-a-colorier/dinosaure/" hreflang="fr">Français</a></li>
        <!-- ... all 12 languages with correct cross-link URLs ... -->
      </ul>
    </div>

    <!-- Journal / Gallery -->
    <a href="/en/" class="lp-nav-icon-btn" aria-label="My Journal" title="My Journal">🖼️</a>

    <!-- Account -->
    <button class="lp-nav-icon-btn lp-nav-account-btn" aria-label="Account" title="Account">👤</button>

    <!-- Theme toggle -->
    <button class="lp-nav-theme-btn" aria-label="Toggle theme">🌙</button>
  </div>
</nav>
```

**Component function: `lib/lp-nav-component.js`**
```javascript
module.exports = function buildNav({ lang, breadcrumbs, hreflangMap }) {
  // lang: 'de'
  // breadcrumbs: [{ href: '/de/ausmalbilder/', label: 'Ausmalbilder' }, { label: 'Dinosaurier' }]
  // hreflangMap: { en: '/en/coloring-pages/dinosaur/', de: '/de/ausmalbilder/dinosaurier/', ... }
  // Returns: HTML string for the <nav> element
};
```

**Client-side JS (`/js/lp-nav.js` rewritten to only wire interactivity):**
- Theme toggle (reads/writes `localStorage` + `data-theme`)
- Language menu open/close (keyboard accessible)
- Account flyout (sign in / show profile / switch child)
- NO structural DOM manipulation — the HTML is already there from the server

---

## 3. Account & Family Architecture

### End State Model

```
ParentAccount
  ├── id
  ├── email (unique, normalized)
  ├── password_hash (bcrypt, nullable — future magic-link support)
  ├── email_verified_at (NULL = not verified; unverified accounts cannot share community content)
  └── ChildProfile[]  (1 to max_child_profiles config, default 6)
        ├── id
        ├── nickname (from curated list)
        ├── avatar_index
        ├── age_group  ('3-5' | '6-8' | '9-12')
        ├── access_pin_hash (optional 4-digit PIN, bcrypt)
        ├── sort_order
        └── device_uuid → profiles (community progress, art history, streaks)
```

A **guest** user has no account. Their progress lives in `localStorage` and their community profile is identified by a random `device_uuid`. When they register, the device is linked to their account and the active child profile inherits the progress.

An account with **no child profiles** is treated as a single-user (adult) account.

An account with **multiple child profiles** shows a "Who's coloring today?" screen on each session start.

### Database Schema Changes

**Migration: `db/migrations/003_account_children.sql`**

```sql
-- Email verification
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_attempted_at TIMESTAMPTZ;

-- OTP codes table (6-digit, 10-min TTL)
CREATE TABLE IF NOT EXISTS email_otp_codes (
  id          BIGSERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  code        CHAR(6)      NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,
  attempts    SMALLINT     DEFAULT 0,  -- max 5 attempts before code invalidated
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON email_otp_codes(email, expires_at);

-- Child profiles
CREATE TABLE IF NOT EXISTS child_profiles (
  id               SERIAL PRIMARY KEY,
  account_id       INTEGER     NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  nickname         VARCHAR(60) NOT NULL,
  avatar_index     SMALLINT    DEFAULT 0,
  age_group        VARCHAR(5),            -- '3-5', '6-8', '9-12'
  access_pin_hash  VARCHAR(60),           -- bcrypt of 4-digit PIN, optional
  sort_order       SMALLINT    DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_child_profiles_account ON child_profiles(account_id);

-- Link community profiles to child profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS child_profile_id INTEGER REFERENCES child_profiles(id) ON DELETE SET NULL;
```

### API Endpoints (New / Modified)

All under `/api/auth/`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/send-otp` | Generate + email 6-digit OTP. Rate: 3/hour per email. |
| POST | `/api/auth/verify-email` | Submit OTP → sets `email_verified_at`. |
| POST | `/api/auth/resend-otp` | Re-send code (same rate limit bucket as send-otp). |
| GET  | `/api/auth/children` | List child profiles for authenticated parent. |
| POST | `/api/auth/children` | Create child profile. Requires verified email. |
| PATCH | `/api/auth/children/:id` | Update nickname / avatar / age_group / PIN. |
| DELETE | `/api/auth/children/:id` | Delete child profile (cascades community profile). |
| POST | `/api/auth/children/:id/verify-pin` | Validate child PIN; returns short-lived child session token. |
| POST | `/api/auth/children/:id/link-device` | Link a device_uuid to a child profile. |

**Modified:**
- `POST /api/auth/register` — after creating account, immediately call `send-otp` and return `{ ok: true, pendingVerification: true }`. No access/refresh token until email is verified.
- `POST /api/auth/login` — if `email_verified_at` is NULL, return `{ code: 'EMAIL_NOT_VERIFIED' }` with 403; client shows "Please verify your email" with resend button.

### OTP Flow Detail

1. `POST /api/auth/register` → account row inserted, OTP sent → client shows "Enter the 6-digit code we sent to {email}"
2. `POST /api/auth/verify-email { email, code }`:
   - Find latest non-expired, non-used OTP for email
   - Increment `attempts`; if ≥ 5, mark code used (force resend)
   - If code matches → `used_at = NOW()`, `accounts.email_verified_at = NOW()`, issue access + refresh tokens
   - Return `{ ok: true, accessToken, refreshToken, expiresIn }`
3. `POST /api/auth/resend-otp { email }` → invalidates prior codes, sends new one (rate: max 3 per hour per email)

**OTP generation:** `Math.floor(100000 + Math.random() * 900000).toString()` — 6 digits, always 6 chars.

**Email provider:** Resend (`https://api.resend.com/emails`), API key in `.env` as `RESEND_API_KEY`. Simple fetch, no SDK. Template: text + HTML, subject "Your Lalabuba verification code: 123456".

### Web UI Changes

**Registration flow:**
1. Enter email + password → submit
2. Screen: "Check your email! Enter the 6-digit code sent to {email}" + 6 input boxes (auto-advance) + "Resend" link
3. On success: "Welcome! Who's coloring today?" → option to create first child profile or continue as adult

**Account settings modal (expanded):**
- "Your children" section: cards with avatar + nickname + age badge + edit button
- "+ Add child" → nickname picker wheel + avatar grid + age group + optional PIN
- "Verify your email" banner if `email_verified_at` is null
- Each child card shows their progress summary (streak, total completions)

**"Who's coloring?" screen:**
- Shown on app load if account has ≥ 1 child profile and no active child session
- Full-screen overlay: large avatar + nickname cards, tap to select
- If child has PIN: tap → 4-digit PIN keypad
- "I'm the parent" option at bottom → opens settings/account

### Flutter UI Changes

**New screens:**
- `OtpVerificationScreen` — 6-digit input (auto-advance), resend timer
- `ChildSelectorScreen` — "Who's coloring?" grid, shown on session start
- `AddChildScreen` — `CupertinoPicker` nickname wheel + `GridView` avatar picker + age group chips + optional PIN setup
- `ChildPinScreen` — 4-digit PIN entry for children with PIN set

**Modified screens:**
- `settings_screen.dart`: "Family" section → list of child profiles, "Add child" button, "Switch child" button
- Registration flow: email → OTP → child setup

**State:** `activeChildProfileId` stored in `SharedPreferences`. On app launch, if not set and account has children → show `ChildSelectorScreen`.

### COPPA / GDPR Compliance

- Child profiles have **no email address** — only the parent account has an email
- Parent email is **verified before any community sharing** is possible
- Community profiles for children show only `nickname` + `avatar_index` — never `account_id` or parent email
- `DELETE /api/auth/children/:id` cascades: deletes community profile, all shared artworks, all progress data for that child
- "Delete my account" deletes parent account + all children + all community content
- Data export endpoint: `GET /api/auth/export` returns JSON of all parent + children data

---

## 4. Implementation Order

All three areas are independent enough to build in parallel, but the dependency order within each is:

### Coloring Pages
1. Add slug field to `gallery.json` schema + populate existing entries
2. Add language-prefixed routing in `server.js` (with 301 redirects from old bare paths)
3. Build `lib/lp-nav-component.js` (unified nav, see §2)
4. Build individual image page template (server-renders from `gallery.json` entry)
5. Build print route
6. Expand gallery depth to 30+ per topic (use admin API)
7. Expand topic coverage to 50+

### Navigation
1. Build `lib/lp-nav-component.js` (shared by static pages + can be used in main app shell)
2. Remove `public/js/lp-nav.js` client-side DOM manipulation (replace with wiring-only)
3. Wire language picker: cross-links computed from `hreflangMap` passed to component
4. Wire account flyout: reads session cookie, shows profile or sign-in prompt
5. Apply consistently: all server-rendered pages use the same component
6. Apply to main app shell (`public/index.html`) — the app nav becomes a subset of this same component

### Account / Family
1. Run migration `003_account_children.sql`
2. Add `RESEND_API_KEY` to Swarm secrets
3. Build `lib/email.js` (Resend HTTP wrapper)
4. `POST /api/auth/send-otp` + `POST /api/auth/verify-email` + `POST /api/auth/resend-otp`
5. Modify `register.js` — no token until verified; modify `login.js` — 403 if not verified
6. Child profile CRUD endpoints
7. Web UI: OTP step in registration, account settings children section, "Who's coloring?" screen
8. Flutter: `OtpVerificationScreen`, `ChildSelectorScreen`, `AddChildScreen`, `ChildPinScreen`

---

## 5. Files to Create / Modify

### New files
- `lib/lp-nav-component.js` — unified nav HTML builder
- `lib/email.js` — Resend API wrapper (send transactional email)
- `api/auth/send-otp.js`
- `api/auth/verify-email.js`
- `api/auth/resend-otp.js`
- `api/auth/children.js` — list + create
- `api/auth/child-update.js` — PATCH + DELETE + verify-pin + link-device
- `db/migrations/003_account_children.sql`
- `public/js/child-selector.js` — "Who's coloring?" web UI
- `public/css/child-selector.css`
- `flutter_app/lib/features/auth/screens/otp_verification_screen.dart`
- `flutter_app/lib/features/family/screens/child_selector_screen.dart`
- `flutter_app/lib/features/family/screens/add_child_screen.dart`
- `flutter_app/lib/features/family/screens/child_pin_screen.dart`
- `flutter_app/lib/features/family/family_service.dart`

### Modified files
- `server.js` — language-prefixed routing, 301 redirects, individual image pages, print route
- `lib/gallery.js` — add slug generation + store in `gallery.json`
- `api/auth/router.js` — add new endpoints
- `api/auth/register.js` — trigger OTP, no token until verified
- `api/auth/login.js` — 403 with `EMAIL_NOT_VERIFIED` if unverified
- `public/js/lp-nav.js` — reduce to wiring-only (no DOM restructuring)
- `public/js/account.js` — OTP flow, children management
- `public/index.html` — "Who's coloring?" overlay, OTP modal step
- `flutter_app/lib/features/settings/settings_screen.dart` — family section
- `flutter_app/lib/features/auth/auth_screen.dart` — OTP step after registration
- `docker-stack.prod.yml` / `docker-stack.dev.yml` — add `RESEND_API_KEY` secret reference
