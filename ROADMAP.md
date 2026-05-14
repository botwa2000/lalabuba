# Lalabuba — Product Roadmap

Living document. Strike completed items with `~~strikethrough~~`. Add new items at the bottom of whichever phase they belong to. Keep open questions updated as decisions are made.

---

## Architecture Overview

### Navigation model

The web and mobile app share one codebase. `data-platform="native"` is set on `<body>` at boot when running inside Capacitor. All mobile-specific layout and behaviour is gated behind that attribute in CSS and JS — the web layout is never touched.

```js
// main.js — earliest possible boot
if (window.Capacitor?.isNativePlatform?.()) {
  document.body.dataset.platform = 'native';
}
```

On **web**: one long scrollable page (current design). Works well for discovery, SEO, desktop.

On **native**: four screens managed by a small `screens.js` module (`pushScreen(id)` / `popScreen()`). Screens are `<div class="screen">` elements; one is active at a time, transitions are CSS-driven. A fixed bottom tab bar is the primary navigation chrome.

```
┌──────────────────────────────────────────────────┐
│                    App Shell                     │
│  ┌─────────┐  ┌──────────┐  ┌──────┐  ┌──────┐  │
│  │ Create  │  │  Canvas  │  │Gall. │  │ Set. │  │
│  │ (home)  │  │(pushed)  │  │(tab) │  │(tab) │  │
│  └─────────┘  └──────────┘  └──────┘  └──────┘  │
│                                                  │
│       ── Bottom Tab Bar (native only) ──         │
│     [🎨 Create]  [🖼️ Gallery]  [⚙️ Settings]    │
└──────────────────────────────────────────────────┘
```

**Canvas screen** is pushed on top of Create (slide-up sheet transition) when generation starts. The tab bar hides during coloring for full immersion and reappears when the user navigates back.

### Screen layouts

**Create (home tab)**
- Small logo top-left + no hamburger
- Centered text input ("What do you want to draw?") with keyboard-above-the-fold behaviour
- 2×3 grid of suggestion cards below input
- Daily word as a prominent card at top of grid
- Settings chips row (difficulty, color count, palette, numbers toggle) — horizontal scroll
- Large "Draw it! ✨" pinned to bottom above tab bar

**Canvas (pushed screen)**
```
┌───────────────────────────────────┐
│ [← Back]  "butterfly"  [⋮ More]  │  48px top nav bar
├───────────────────────────────────┤
│                                   │
│      CANVAS — fills all space     │  flex: 1, min-height: 0
│                                   │
├───────────────────────────────────┤
│  [↩]  [✏️]  [🔍]  [💾]  [🏆]    │  56px action bar
├───────────────────────────────────┤
│  🔴 🟠 🟡 🟢 🔵 🟣 … (scroll)  │  72px palette dock
└───────────────────────────────────┘
```
- Top nav: back arrow, subject name, overflow ⋮ (Print · Regen · Share art · Clear pencil)
- Action bar: 5 icon+label buttons always visible (Undo, Pencil, Zoom, Save, Challenge)
- Palette dock: 44px+ swatches (Apple HIG touch target), horizontal scroll, active ring
- Number legend: expandable bottom sheet on 🔢 tap (replaces always-visible sidebar)
- `100dvh` flex column + `env(safe-area-inset-*)` for notch/home indicator

**Gallery (tab)**
- Full screen — not a modal
- 2-column thumbnail grid, subject label + date per thumb
- Tap pushes a detail screen: full image + Share + Delete

**Settings (tab)**
- Language picker
- Default difficulty / color count / palette
- Notifications toggle (daily word reminder)
- Premium: current status + Upgrade / Restore buttons
- About / Version / Legal links

### Transition animations

| Transition | Style |
|---|---|
| Create → Canvas | Slide up from bottom (≤ 280ms, `cubic-bezier(0.32, 0.72, 0, 1)`) |
| Canvas → Create | Slide down / dismiss |
| Tab switches | Cross-fade |
| Canvas loading done | Fade-in |

### What never changes

The coloring engine (`canvas.js`), AI generation pipeline, and i18n system require no modifications. Every mobile change is additive.

---

## User Identity & Payments Architecture

### Core principle — Option B: Anonymous UUID

No child creates an account. On first launch the app generates `crypto.randomUUID()`, stores it in the device keychain (iOS Keychain / Android Keystore via Capacitor Preferences Secure Storage). That UUID is the user ID — opaque, not PII, never shown to the child.

**Premium status flow:**
- Purchase → RevenueCat validates receipt → entitlement stored locally + synced to RevenueCat cloud under UUID
- Reinstall / new device → RevenueCat "Restore Purchases" fetches entitlement back by receipt; no login needed
- Optional: parent provides email → UUID ↔ email mapping stored in backend → email-based recovery on new device

**Why this is COPPA / GDPR-compliant:**
- No PII collected from the child (UUID is not personal data)
- Parent email optional, clearly framed as recovery-only, confirmed via email link before storing
- No tracking, no ad SDKs, no analytics PII

### Component map

| Component | Where | Purpose |
|---|---|---|
| Device UUID | Capacitor Preferences (secure) | Persistent user identity, no PII |
| RevenueCat SDK | `@revenuecat/purchases-capacitor` | IAP receipt validation + entitlement sync |
| StoreKit 2 | iOS native | App Store purchase flow |
| Play Billing | Android native | Google Play purchase flow |
| `lib/entitlements.js` (new) | Vercel backend | RevenueCat webhook handler, UUID → email mapping |
| Database | Vercel Marketplace (Postgres/KV) | UUID → entitlement + optional parent email |

### What's free vs. premium

| | Free | Explorer — $3.99/mo | Unlimited — $8.99/mo |
|---|---|---|---|
| **AI model** | Flux Schnell | Flux Dev | Flux Pro |
| **AI generation** | 10/day | 100/month | Unlimited |
| **Difficulty** | Easy, Medium | + Hard | + Extreme |
| **Color count** | 6, 12 | + 18, 24 | + Max + custom picker |
| **Palettes** | Classic, Pastel, Nature | + Watercolor, Neon | + Monochrome + future drops |
| **Image size** | Medium | Medium | + Large, XL |
| **Export** | Standard PNG | Standard PNG | High-res PNG + PDF |
| **Child profiles** | 1 | 1 | Up to 3 |
| **Gallery** | 30 starter images | Full 500 rotating | Full 500 + 24h early access |
| **Local saves** | Last 10 | 100 | Unlimited |
| **Double-tap fill / Zoom / Share artwork** | — | ✓ | ✓ |

**Download finished artwork is always free** — shared on fridges and social media is free marketing. Never gate it.

**Daily generation limit resets at midnight UTC.** Displayed to users as "resets daily" — no timezone complexity.

**No lifetime pricing.** Subscription only. Lifetime is incompatible with per-generation AI costs.

**Paywall is suppressed entirely on web.** Web stays fully free; it drives native app discovery. All IAP and limit code must be behind `Capacitor.isNativePlatform()` guards.

### Paywall UX

Two distinct paywall triggers with different designs:

**Generation-limit paywall** (hit 10/day):
```
🎨 You've used your 10 free images today!

Come back tomorrow or go Premium for
unlimited drawing, harder levels, and
fresh new images every day.

        [ Go Premium ✨ ]          ← primary, large, colorful

        Resets in 4h 12m           ← countdown, small

────────────────────────────────────
Or keep coloring — 30 free gallery
images are waiting for you  →       ← secondary, muted, below divider
```

**Feature paywall** (tapping Hard/Extreme, 18+ colors, premium palette):
```
🔒 This is a Premium feature

Unlock harder levels, more colors,
and unlimited drawing with Premium.

        [ Go Premium ✨ ]
        [ Maybe later ]
```
No gallery escape hatch here — the user hasn't been blocked from doing anything, they've discovered a premium feature. Keep it clean and direct.

### Economics

**AI provider: Novita** (already in generation waterfall) — meaningfully cheaper than Replicate with equivalent quality.

| Model | Cost/image | Used by |
|---|---|---|
| Flux Schnell | $0.003 | Free tier |
| Flux Dev | $0.013 | Explorer (Tier 1) |
| Flux Pro | $0.035 | Unlimited (Tier 2) |

**Per-tier margin (after 30% store cut):**

| Tier | Price | Net | AI cost (avg user) | Margin | AI cost (heavy user) | Margin |
|---|---|---|---|---|---|---|
| Explorer | $3.99 | $2.79 | 60 × $0.013 = $0.78 | **$2.01 (72%)** | 100 × $0.013 = $1.30 | **$1.49 (53%)** |
| Unlimited | $8.99 | $6.29 | 100 × $0.035 = $3.50 | **$2.79 (44%)** | 200 × $0.035 = $7.00 | **−$0.71 (loss)** |

**Heavy user control — Unlimited tier:**

A Tier 2 user generating 200+ images/month consistently causes a loss. Control mechanism:

- Backend tracks `gen:monthly:{uuid}:{YYYY-MM}` counter in KV alongside the daily counter
- When a Tier 2 UUID exceeds **300 images/month**: backend silently routes to Flux Dev for the remainder of that calendar month. No UI change, no notification to user. Counter resets on the 1st.
- Threshold is intentionally high (300) — the vast majority of users never get close. It only fires for genuinely extreme usage.
- Owner is alerted by email when any UUID crosses 150 images in a single month (early warning, no action yet) and again when the 300 fallback activates (see OPS1).
- Log all fallback activations: `{ uuid, month, countAtTrigger, action: 'flux_dev_fallback' }`

---

## Implementation Phases

### M1 — Platform detection + web chrome removal
*Prerequisite for all mobile work. Ship this first — it's safe and invisible to web users.*

- [ ] Set `data-platform="native"` on `<body>` in `main.js` on Capacitor boot
- [ ] CSS: on `[data-platform="native"]` hide `.site-footer`, `.site-header`, `#cookie-banner`, `#turnstile-widget`
- [ ] CSS: `padding-top: env(safe-area-inset-top)` on `.app` root on native
- [ ] Configure Capacitor Status Bar plugin: edge-to-edge (overlay content), app handles padding via CSS
- [ ] Verify: no visual overlap with Dynamic Island / notch on iPhone; no overlap with Android status bar

### M2 — Bottom tab bar + screen wrappers
- [ ] Add `<nav class="tab-bar">` to `index.html` (hidden on web); 3 tabs: Create 🎨, Gallery 🖼️, Settings ⚙️
- [ ] CSS: tab bar fixed to bottom, `padding-bottom: env(safe-area-inset-bottom)`, 56px height + safe area
- [ ] Wrap existing sections in screen divs: `#screen-create`, `#screen-gallery`, `#screen-settings`
- [ ] Write `public/js/screens.js`: `pushScreen(id)`, `popScreen()` with CSS transition classes
- [ ] Wire tab taps to `pushScreen()` / show correct screen
- [ ] Move gallery button from header `<nav>` into Gallery tab (remove from header)
- [ ] Move language picker from header into Settings screen

### M3 — Canvas screen + transitions
- [ ] Add `#screen-canvas` div wrapping `.workspace` content
- [ ] Add top nav bar inside canvas screen: back arrow, subject `<h2>`, overflow `⋮` button
- [ ] Overflow menu items: Print, Regen, Share art, Clear pencil
- [ ] Wire back arrow + Android hardware back button (Capacitor App plugin `backButton` event) to `popScreen()`
- [ ] Wire generation start to `pushScreen('canvas')` — canvas screen appears with loading animation
- [ ] Transition: slide-up from bottom on push, slide-down on pop

### M4 — Canvas screen layout (full-height)
- [ ] Apply `100dvh` flex column layout to `#screen-canvas` on native
- [ ] Apply `env(safe-area-inset-top/bottom)` to top nav bar and palette dock respectively
- [ ] `#preview-stage`: `flex: 1; min-height: 0` so canvas fills remaining space
- [ ] Replace `.palette-sidebar` with `.palette-dock` on native: 72px fixed bar, 44px swatches, horizontal scroll
- [ ] Replace `.canvas-actions` row with `.canvas-action-bar` on native: 56px bar, 5 icon+label buttons (Undo, Pencil, Zoom, Save, Challenge)
- [ ] Number legend: hide `.palette-sidebar` label column on native; add 🔢 icon to action bar that triggers a bottom-sheet slide-up with the legend

### M5 — Create screen polish (native)
- [ ] Input + Draw button: `position: sticky; bottom: 0` above tab bar, slides above keyboard
- [ ] Viewport meta: add `interactive-widget=resizes-content` for Android keyboard push-up
- [ ] Suggestion cards: change from pill/text style to 2×3 visual card grid on native (image or icon + label)
- [ ] Daily word: promote from small pill to a full-width card at top of suggestion grid on native

### M6 — Settings screen
- [ ] Build `#screen-settings` content: Language, Defaults (difficulty / palette / color count), Notifications, Premium section (stub), About / Legal
- [ ] Move language picker DOM into settings screen; remove from header
- [ ] Premium stub: "You're on the free plan" + "Upgrade" button (wired up in P2)
- [ ] About section: version number (from `capacitor.config.json`), Privacy Policy link, Terms, Impressum

---

### P1 — UUID + RevenueCat SDK foundation
*Start after M1 is shipped so platform detection is reliable.*

- [ ] Install `@revenuecat/purchases-capacitor` Capacitor plugin
- [ ] On native app boot: read UUID from Capacitor SecureStorage; if absent generate `crypto.randomUUID()` and write it
- [ ] Configure RevenueCat: `Purchases.configure({ apiKey, appUserID: uuid })`
  - Use platform-specific API key (App Store key on iOS, Google Play key on Android)
- [ ] On boot: `Purchases.getCustomerInfo()` → set `state.isPremium` flag
- [ ] Implement `Purchases.restorePurchases()` wired to "Restore Purchase" button in Settings

### P2 — Paywall UI + tier limits
*Requires M6 (Settings screen) for the Restore button placement.*

- [ ] Add `state.tier` (`'free'` / `'explorer'` / `'unlimited'`) derived from RevenueCat entitlement on boot
- [ ] Add `state.dailyGensUsed` + `state.dailyGensDate` to `state.js`; persist in SecureStorage; reset when date changes (free tier daily cap)
- [ ] Add `state.monthlyGensUsed` + `state.monthlyGensMonth`; persist in SecureStorage; reset when month changes (Explorer monthly cap)
- [ ] Gate in `generate.js`:
  - Free: `dailyGensUsed >= 10` → generation-limit paywall
  - Explorer: `monthlyGensUsed >= 100` → generation-limit paywall
  - Unlimited: no client-side generation gate
- [ ] Gate difficulty chips:
  - Hard: locked for free; unlocked for Explorer + Unlimited
  - Extreme: locked for free + Explorer; unlocked for Unlimited only
- [ ] Gate color count chips: 18 / 24 locked for free; Max + custom picker locked for Explorer; all unlocked for Unlimited
- [ ] Gate premium palettes (once built): Watercolor/Neon unlocked for Explorer+; Monochrome for Unlimited only
- [ ] Gate image size: Large/XL locked for free + Explorer; unlocked for Unlimited
- [ ] Gate gallery saves: free → 10 cap; Explorer → 100 cap; Unlimited → no cap
- [ ] Gate child profiles: free + Explorer → 1 profile; Unlimited → up to 3
- [ ] Generation-limit paywall: primary "Go Premium ✨" CTA + countdown (daily for free, monthly for Explorer) + secondary gallery link below divider
- [ ] Feature paywall: clean "Go Premium ✨" CTA + "Maybe later" — no gallery escape hatch — show which tier unlocks the feature
- [ ] Wire paywall CTAs to `Purchases.purchase(package)` offering correct tier; on success update `state.tier`, close modal
- [ ] Add `i18n.js` keys: `paywallLimitTitle`, `paywallLimitBody`, `paywallFeatureTitle`, `paywallFeatureBody`, `paywallCta`, `paywallRestore`, `paywallLater`, `paywallGalleryEscape`, `paywallResets`, `paywallTier1Name`, `paywallTier2Name` (12 languages)
- [ ] Suppress all paywall logic when `!Capacitor.isNativePlatform()` — web stays fully free

### P3 — App Store / Play Store compliance setup
*Run in parallel with P1/P2 — store setup takes days of review time.*

**App Store Connect**
- [ ] Create IAP subscription product IDs: `com.lalabuba.explorer_monthly` ($3.99) and `com.lalabuba.unlimited_monthly` ($8.99) — no lifetime products
- [ ] Add StoreKit configuration `.storekit` file to Xcode project for sandbox testing
- [ ] Update Privacy Nutrition Label: no data collected from users
- [ ] Set age rating to 4+; confirm no user-generated content shared publicly
- [ ] COPPA declaration: app directed at children under 13

**Google Play Console**
- [ ] Create in-app products matching RevenueCat SKUs
- [ ] Complete Data Safety form: no data collected or shared
- [ ] Set target audience: children (5–12) → triggers COPPA / Families policy mode
- [ ] Confirm zero ad SDKs before submitting for Families policy review

### P4 — Optional parent email linking
- [ ] Add "Link parent email (for receipt recovery)" row in Settings screen
- [ ] On tap: bottom sheet explaining use (recovery only, no marketing) + email input
- [ ] POST `{ uuid, email }` to new `/api/link-email` endpoint → backend sends verification email
- [ ] Backend stores `uuid → email` only after email link is clicked (confirmed consent)
- [ ] "Recover via email" flow on new device: enter parent email → backend looks up UUID → `Purchases.logIn(uuid)` → entitlement restored
- [ ] GDPR deletion: `DELETE /api/user/:uuid` removes UUID ↔ email mapping (RevenueCat record kept for receipt audit trail)

### P5 — Backend entitlement verification + AI routing + heavy user control
*Hardens limits against client-side bypass and routes each tier to the correct AI model. Ship after P1/P2 are stable.*

**Entitlement + limit enforcement:**
- [ ] Pass `uuid` + RevenueCat JWT in `X-RC-Token` header on all `/api/generate-image` requests (native only)
- [ ] Backend: validate token against RevenueCat `GET /v1/subscribers/:uuid` → determine tier (`free` / `explorer` / `unlimited`)
- [ ] KV counters per UUID:
  - `gen:daily:{uuid}:{YYYY-MM-DD}` — TTL 48h — enforces free tier 10/day cap
  - `gen:monthly:{uuid}:{YYYY-MM}` — TTL 35 days — enforces Explorer 100/month cap + monitors Unlimited
- [ ] Free: daily counter ≥ 10 → return `402`; client shows generation-limit paywall
- [ ] Explorer: monthly counter ≥ 100 → return `402`; client shows generation-limit paywall with monthly reset countdown
- [ ] Unlimited: no hard limit enforced

**AI model routing by tier:**
- [ ] Free → Flux Schnell ($0.003/image)
- [ ] Explorer → Flux Dev ($0.013/image)
- [ ] Unlimited → Flux Pro ($0.035/image), unless heavy user fallback active (see below)
- [ ] Route via existing provider waterfall; add `model` param to generation request

**Heavy user control (Unlimited tier):**
- [ ] After incrementing monthly counter: if tier=unlimited and `gen:monthly:{uuid}:{YYYY-MM}` > 300 → set `gen:fallback:{uuid}:{YYYY-MM}` flag in KV (TTL: end of month)
- [ ] If fallback flag active: route to Flux Dev instead of Flux Pro — silent, no user notification
- [ ] Log fallback activation: `{ uuid, month, count, action: 'flux_dev_fallback' }` → append to KV list `ops:fallback_log`
- [ ] Return `X-Gens-Remaining` header on every response (daily remaining for free, monthly remaining for Explorer, `unlimited` for Unlimited) — client displays this in UI

### P6 — Privacy-safe analytics
- [ ] Integrate PostHog SDK (`disable_session_recording: true`, no IP capture, no PII event properties)
- [ ] Track events: `generation_started`, `generation_completed`, `palette_selected`, `paywall_shown`, `paywall_converted`, `language_changed`
- [ ] All events carry only `{ uuid, platform, language, appVersion }` — no name, email, device ID
- [ ] Settings toggle: "Share usage data" (off by default; auto-off in EU via IP geo on first launch)
- [ ] Wire toggle to `Purchases.setAttributes({ analyticsOptOut: true })` + PostHog opt-out

---

### G0 — Image quality validation (shared utility)
*Must ship before G1 and should be retrofitted into the existing `/api/generate-image` endpoint.*

The same validation logic runs on every generated image regardless of origin — user prompt, daily cron batch, or seed bootstrap. Lives in `lib/imageQuality.js`, imported by both the API handler and the cron job.

**Validation checks:**

| Check | Reject if |
|---|---|
| Region count | < 8 or > 80 |
| Blob size | < 50 KB (silent generation failure) |
| Dominant region | single region > 55% of total canvas area (too simple) |
| Aspect ratio | not approximately 1:1 |

**Behaviour by context:**
- **User prompt (`/api/generate-image`):** on failure, auto-retry with new seed up to 2 times silently. If still failing after 3 attempts, return best result with a soft "this one's a bit unusual — try again?" client message rather than a hard error.
- **Daily cron batch:** generate 40 prompts, keep first 30 that pass, discard failures. No retry needed — buffer handles it.

- [ ] Write `lib/imageQuality.js`: `validateImage({ regionCount, blobSize, dominantRegionRatio })` → `{ valid, reason }`
- [ ] Import and call in `/api/generate-image`: auto-retry logic (max 3 attempts), surface soft warning on final failure
- [ ] Import and call in cron job (G1): filter batch, discard failures silently

### G1 — Daily gallery cron + image hosting
*Requires G0. Start after P2 so premium gating of the full gallery is already in place.*

**Architecture:**
- **Shared gallery** — one cron generates images for all users. Per-user generation would multiply AI costs by active user count.
- **Cloudflare R2** for image storage — zero egress fees vs. Vercel Blob's $0.08/GB. At 500 images × ~500 KB = 250 MB stored, storage cost is < $0.01/month regardless. Egress is the variable that matters at scale.
- **Gallery manifest** — a JSON file at a stable CDN URL listing metadata for all current gallery images. App polls this on launch, downloads delta to local cache (Capacitor Filesystem).

**Gallery manifest entry:**
```json
{ "id": "2026-04-12-031", "prompt": "friendly dragon", "theme": "fantasy",
  "difficulty": "medium", "createdAt": "2026-04-12T06:00:00Z",
  "url": "https://r2.lalabuba.com/gallery/2026-04-12-031.png",
  "evergreen": false, "completions": 0 }
```

**Slot allocation (500 total):**
- ~50 evergreen slots — hand-picked themes (dragons, cats, castles, rockets, unicorns, etc.); never participate in rotation; determined by theme alone, no user data needed
- ~450 rotating slots — daily additions; rotation policy below

**Rotation policy:**

| Phase | Condition | Rule |
|---|---|---|
| Cold start | < 500 total completions across gallery | FIFO — rotate 20 oldest non-evergreen when adding 20 new |
| Warm | ≥ 500 total completions | Popularity-weighted — rotate 20 lowest-scoring non-evergreen |

Popularity score: `completions + (age_days_from_today × -0.5)`. Images with zero completions after 30 days are always rotation candidates.

**Free vs. premium access:**
- Free users: 30 permanent starter images (bootstrapped at launch, never rotated, subset of evergreen set)
- Premium users: full 500-image rotating gallery

**Cron job (`0 6 * * *` — 6 AM UTC daily):**
- [ ] Write `api/cron/gallery-batch.js` Vercel Cron endpoint
- [ ] Pick 40 prompts from `GALLERY_WORDS` list (diverse across themes: animals, fantasy, vehicles, nature, space, food, seasonal)
- [ ] Generate each via existing pipeline; run `validateImage()` from G0; keep first 30 that pass
- [ ] Upload passing images to Cloudflare R2; update manifest JSON
- [ ] Apply rotation: if manifest > 500 entries, remove 20 per rotation policy above; delete removed images from R2
- [ ] Increment `completions` counter in manifest when a user completes coloring a gallery image (via lightweight `/api/gallery/complete` POST)

**App-side caching:**
- [ ] On app launch: fetch manifest, compare against local cache, download new image data to Capacitor Filesystem
- [ ] Gallery tab renders from local cache — works offline after first download
- [ ] Thumbnail shown immediately from cache; full image lazy-loaded on tap

**Bootstrap (one-time):**
- [ ] Run cron manually at launch to seed ~30 starter images before first user opens the app

---

### OPS1 — Usage monitoring + owner alerts
*No admin panel — all visibility comes via email and PostHog. Ship alongside or just after P5.*

**Daily digest email (cron `0 8 * * *` — 8 AM UTC):**

Sent to owner email via Resend (free tier: 3,000 emails/month — digest + alerts will stay well within that).

Digest contains:
- Subscriptions: new today (Explorer / Unlimited), total active (Explorer / Unlimited)
- Estimated MRR: `(explorer_count × $3.99) + (unlimited_count × $8.99)` before store cut
- Generations today: free / Explorer / Unlimited / total
- Estimated AI cost today: `(free_gens × $0.003) + (explorer_gens × $0.013) + (unlimited_gens × $0.035)`
- Estimated daily margin: revenue prorated daily − AI cost today
- Gallery: images added today, total completions today
- Paywall: shown today / converted today / conversion rate
- Heavy users: UUIDs currently on Flux Dev fallback (count + UUID prefixes)
- Cron health: gallery batch succeeded Y/N, images generated / rejected

**Threshold alert emails (immediate, same Resend sender):**

| Trigger | Alert |
|---|---|
| Any UUID generates > 150 images in a calendar month (Unlimited) | Early warning — no action needed yet, just awareness |
| Any UUID triggers the 300/month fallback | Fallback activated — UUID prefix + count |
| Gallery cron produces < 15 passing images (quality filter too aggressive?) | Gallery batch quality warning |
| Generation API error rate > 25% in any 1-hour window | Generation pipeline alert |
| RevenueCat webhook delivery failure | Payment webhook alert |
| Any 5xx error spike: > 10 errors in 5 minutes | Backend error spike |

**Implementation:**
- [ ] Add Resend API key to Vercel environment variables
- [ ] Write `lib/mailer.js`: `sendAlert(subject, htmlBody)` and `sendDigest(data)` — thin wrapper around Resend API
- [ ] Write `api/cron/daily-digest.js` Vercel Cron (`0 8 * * *`): query KV for yesterday's counters, format digest, call `sendDigest()`
- [ ] Add alert calls inline in relevant handlers:
  - `/api/generate-image`: on monthly counter crossing 150 and 300
  - `api/cron/gallery-batch.js`: on < 15 passing images
  - Global error handler: on 5xx spike (use KV counter + rate check)
- [ ] Write `api/admin/stats.js`: protected endpoint (`?key=ADMIN_SECRET` env var) returning JSON summary of current KV counters — for on-demand spot-checks without waiting for digest. No UI needed — curl or browser address bar is sufficient.

**PostHog dashboard (complements email — visual trends over time):**
- Funnels: generation_started → generation_completed → paywall_shown → paywall_converted
- Retention: DAU / WAU / MAU by tier
- Revenue events: subscription_started, subscription_cancelled (via RevenueCat webhook → PostHog)
- These are configured in PostHog UI after P6 ships — no additional code beyond what P6 already tracks

---

## Open Questions

> Answer here as decisions are made; remove the question once resolved.

1. ~~**Pricing model**~~ **Decided: subscription only, no lifetime. Two tiers: Explorer $3.99/mo (Flux Dev, 100 images/month) and Unlimited $8.99/mo (Flux Pro, unlimited). Heavy users (> 300 images/month on Unlimited) silently fall back to Flux Dev for remainder of month.**
2. ~~**Free tier limit**: 3 gens per *session* or 3 per *day* (UUID-tracked)?~~ **Decided: 10/day, resets midnight UTC, server-enforced via UUID + KV counter.**
3. **Web monetisation**: keep web fully free forever, or eventually add Stripe-backed paywall on web too?
4. **Parental gate on Settings**: should Settings require a simple parental gate (math challenge) before showing IAP / email controls? Prevents children from accidentally triggering purchases.
5. **Family Sharing**: StoreKit 2 non-consumable IAPs share automatically via Family Sharing — do we want this? (Probably yes, but confirm it doesn't break UUID-based entitlement sync.)
6. **Daily as its own tab**: promote Daily to a 4th tab only if it gets a leaderboard / countdown timer screen; otherwise keep it on Create.
7. **Canvas transition style**: slide-up sheet vs. horizontal push — test both on device before deciding.
8. **Tab bar labels**: icon + text label vs. icon only? Kids likely need labels.
9. **Android keyboard handling**: `resizes-content` vs. `overlays-content` viewport meta — test on real Android device with the pinned input layout.
10. **Back gesture on iOS**: swipe-from-left-edge on canvas → back to Create. Needs either a JS touch gesture handler or rely on the Capacitor App `backButton` event (which fires on Android hardware back but not iOS swipe).

---

## Notes & Constraints

- RevenueCat handles cross-platform receipt validation — do not build our own
- Web app stays fully free; it drives native app discovery
- All IAP, UUID, and daily-limit code must be behind `Capacitor.isNativePlatform()` guards
- Test IAP with StoreKit sandbox (Xcode Scheme → StoreKit config) and Play Billing test accounts before any real purchases
- `100dvh` (dynamic viewport height) is required on mobile — `100vh` does not resize with the software keyboard on iOS
- Coloring engine, AI pipeline, and i18n require no structural changes for any of these phases
- Image quality validation (`lib/imageQuality.js`) is a shared utility — same checks for user prompts, cron batch, and any future generation path. Never bypass it.
- Gallery uses Cloudflare R2 (zero egress) not Vercel Blob — matters at scale
- Gallery is a shared asset (one cron for all users) — never generate per-user gallery batches
- No lifetime IAP products — subscription only. Lifetime is economically incompatible with per-generation AI costs
- AI model routing is server-side only — never trust the client to declare its own tier or model
- Heavy user fallback (Flux Dev above 300 images/month for Unlimited) is silent — no user-facing indication
- Resend handles all transactional email (digest + alerts) — do not use SendGrid or SES unless Resend becomes a bottleneck
- Owner visibility comes from: daily digest email + threshold alert emails + PostHog dashboard + `/api/admin/stats` endpoint. No admin panel needed at current scale.
