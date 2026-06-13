# Lalabuba — Retention + Monetization Implementation Strategy

> Status: **PLAN ONLY — not yet implemented.** Prepared for a single "implement in
> its entirety" command. Scope = web (`public/`, `api/`, `lib/`, `server.js`) +
> Flutter (`flutter_app/`). Launch stays **100% free**; everything monetization is
> built as an **inert seam** that flips on later via config — no charging at launch.
>
> Overriding constraints, in priority order: **(1) child safety & COPPA / Apple
> Kids / Google Families compliance, (2) privacy-by-design, (3) security, (4)
> retention value.** Where any feature conflicts with 1–3, 1–3 win.

---

## Infrastructure & Hosting — LOCKED DECISIONS
> These supersede any Vercel-centric references later in this document (§1.3–1.4,
> §3.3, §5.5, §7, §8). Where those mention Vercel KV / Edge Config / Neon / Vercel
> Auth, read the equivalents below.

- **Host: migrate off Vercel to Hetzner now** (pre-launch = smallest migration
  surface; staying on Vercel and building the monetization/admin stack on
  Vercel-native services only grows the surface we'd later unwind). The core
  generation logic is already portable (`lib/` served by `server.js`); the only
  real coupling is **Vercel Blob**, which is optional and cleanly abstracted.
- **Server: `91.99.212.17`** — the spare-capacity Hetzner box (currently hosts
  only taxalex.de prod+dev; the former DMS box). Isolates the kids+payments app
  from the busier bonistock/bonifatus box (`159.69.180.183`). **Verify free
  RAM/CPU before deploy** (4 GB shared with taxalex); bump to 8 GB or use a
  dedicated box if generation traffic grows.
- **Domains:** `lalabuba.com` (prod), `dev.lalabuba.com` (dev), `admin.lalabuba.com`
  (control panel). Cloudflare DNS, Origin cert, **Full-Strict**.
- **Stack (mirrors taxalex, the most evolved of the 3 existing projects):**
  Docker Swarm + nginx + PostgreSQL 16 (host) + a Redis container (durable
  metering/quota) + Cloudflare in front.
- **Billing:** RevenueCat brokers Apple IAP + Play Billing (+ Stripe for web/
  physical). RevenueCat is the entitlement source of truth; the server
  re-validates anything that costs money.
- **Object storage:** replace Vercel Blob with **Cloudflare R2 / self-hosted
  MinIO** behind the existing `blobPut/blobList/blobDel` abstraction.

### Admin control panel
- Separate surface at **`admin.lalabuba.com`**, gated by **Cloudflare Access
  (Zero Trust)** + app-level auth with **mandatory MFA** + email allowlist +
  **immutable audit log**.
- Edits a **config record in PostgreSQL** (tiers, entitlements, free caps,
  feature/content flags, paywall copy/offering, `monetizationEnabled`). Publishes
  a **sanitized, non-sensitive, read-only subset** for the app to consume.
- **Secrets never live in the config DB or client** — only in Docker Swarm
  secrets / the secrets manager (below). What the panel cannot set: IAP price
  points (App Store Connect / Play Console + RevenueCat own those); the panel
  selects the active offering and all free-tier/flag/copy logic.

### Deployment (most-optimized; supersedes generic CI notes)
- **Credential source:** **1Password / Bitwarden CLI** — master values injected
  into memory for a single deploy run; plaintext never lands on disk. Piped to
  `docker secret create` over **stdin** (never as command args / never in shell
  history or `docker inspect`).
- **Runtime secrets:** **Docker Swarm secrets**, `lalabuba_{env}_` prefixed,
  mounted tmpfs at `/run/secrets/`, loaded by `docker-entrypoint.sh` (strip
  prefix → export → `node server.js`). Never in image, on-disk env files, repo,
  or any `.md`.
- **Env var classes:** (1) build-time public (APP_URL, Turnstile *site* key) →
  `--build-arg`; (2) runtime secrets → Swarm secrets; (3) non-secret runtime
  config (caps/flags/tiers) → config DB, not env.
- **One-command deploy:** `scripts/deploy.sh push|dev|prod|secrets|logs|rollback`
  (prod requires typed `deploy` confirmation). **Windows-safe** via a repo
  `scripts/remote-deploy.sh` executed over SSH (no fragile heredoc).
- **CI/CD:** GitHub Actions — `ci.yml` (lint/build), `deploy-dev.yml` (auto on
  push to `dev`), `deploy-prod.yml` (manual, protected environment). SSH key as
  an encrypted Actions secret.
- **Hardening:** non-root `deploy` user; SSH key-only with **separate keys for
  server vs GitHub** (`IdentitiesOnly`); fail2ban; firewall 22/80/443 only;
  container runs as non-root `node`, `no-new-privileges`, dropped caps; multi-
  stage Alpine Dockerfile + healthcheck.
- **Artifacts to create on implement:** `Dockerfile`, `docker-entrypoint.sh`,
  `docker-stack.{dev,prod}.yml`, `scripts/deploy.sh` + `scripts/remote-deploy.sh`,
  `.secrets.example` + `.gitignore`, `nginx/lalabuba.conf`,
  `.github/workflows/{ci,deploy-dev,deploy-prod}.yml`.
- **Lessons applied from existing projects:** adopt taxalex's subcommand script +
  separate keys + prod confirmation + CI/CD; **avoid** bonifatus's plaintext DB
  password in docs (and dev/prod password reuse), bonistock's fragile mega-liner
  + `sed` pg_hba hack, and all three's root-SSH default.

---

## 0. What already exists (so we extend, not rebuild)

| Capability | Where it lives today | Implication |
|---|---|---|
| Entitlement model `free/plus/family` + `Entitlements.fromJson` | `flutter_app/lib/features/subscription/subscription_models.dart` | Add `plus`/`family` constants + remote source; model is reusable as-is |
| Daily generation meter (client) | `subscription_service.dart` (`recordGeneration`, `canGenerate`, `remainingToday`) | Already the conversion lever; needs a durable server twin |
| Generation gate wired at call site | `flutter_app/lib/features/canvas/canvas_screen.dart:110-143`; shown in `home_screen.dart:109` | Paywall hooks here — no new plumbing |
| Anonymous durable device id | `flutter_app/lib/shared/services/device_id_service.dart` → sent as `X-Device-ID` | COPPA-safe metering/quota key (random UUID, no PII) |
| Parental gate (multiplication) | `flutter_app/lib/shared/widgets/parental_gate.dart` (`showParentalGate`) | Reuse to gate Parent Zone + every purchase surface |
| Flutter gallery (file-based) | `flutter_app/lib/features/gallery/gallery_screen.dart` — PNGs in app docs dir, `lalabuba_*.png` | "My Journal" builds on this; add a metadata sidecar |
| Secure local storage | `flutter_app/lib/shared/services/storage_service.dart` (`flutter_secure_storage`) | Store gamification/progress JSON + entitlement cache here |
| Web coloring-complete hook | `public/js/main.js:34-36` (`celebrationShown` when all regions done) | Gamification + journal-save fire here |
| Web `saveArtwork()` w/ metadata | `public/js/gallery.js:24` (subject, difficulty, colorCount, completedRegions, dataURLs) | Web journal/collection extends this |
| Server bot/abuse gates | `api/generate-image.js`: per-IP in-memory rate limit (~38-54), Turnstile (web), `APP_API_KEY` (native), Blob storage | Add durable per-identity quota + entitlement check after these gates |
| Parental gate i18n keys | `parentalGateTitle/Prompt/Wrong/Continue` already translated | Reuse; add new keys alongside |
| Legal pages | `public/{privacy,terms,impressum,about,contact,features}.html` | Add: subscription terms, kids-privacy addendum, data-deletion |

**Gaps to close:** (a) web has **no persistent progress/gamification store** beyond theme/lang/cookie/onboarding; (b) web has **no durable gallery** equivalent verified to survive reloads (confirm `gallery.js` backend during impl); (c) server meter is **ephemeral per-IP** (resets on cold start, not per-identity); (d) `plus`/`family` entitlements undefined; (e) no billing layer; (f) no Parent Zone; (g) no remote entitlement/config source.

---

## 1. Architecture decisions (locked for this plan)

1. **Entitlement source of truth = RevenueCat** (cross-platform: App Store + Play + web/Stripe under one entitlement API). Maps directly onto `Entitlements.fromJson`. Client treats RevenueCat entitlement as authoritative; **server independently re-validates** for anything that costs money (image generation).
2. **Two-layer metering.** Client meter (existing) = UX/soft cap. **Server meter (new, durable) = hard enforcement**, because `X-Device-ID` is client-controllable (the server already notes this for the bot gate). Free quota keyed by device id in durable KV; "unlimited" only granted when the server confirms a paid entitlement.
3. **Durable store = Vercel KV / Upstash Redis (Marketplace)** for server-side quota + entitlement cache. No relational DB needed at launch.
4. **Remote config = a small server-hosted JSON** (tiers → entitlements, content-pack flags, free cap, paywall copy) consumed via the existing `Entitlements.fromJson`. Lets us flip monetization/caps without an app release.
5. **All child-side data stays anonymous and on-device.** No accounts for children. The **only** identity is an optional **parent account** (RevenueCat app user id / Stripe customer), created only inside the parental-gated Parent Zone, holding no child PII.
6. **No third-party behavioral analytics or ads — ever.** Aggregate, first-party, anonymous counters only (see §6).
7. **Physical print goods bill via Stripe** (exempt from IAP); **digital unlocks via Apple IAP / Play Billing** (mandatory). RevenueCat brokers both.

---

## 2. Retention features (build now, all free)

### Pillar 1 — My Journal + completion celebration + milestones
- **Data model (new):** `ProgressStore` — anonymous, local.
  - Flutter: new `flutter_app/lib/features/progress/progress_service.dart` (Riverpod `progressProvider`) persisting a JSON blob via `StorageService` (new key `kProgress`). Fields: `picturesCompleted`, `daysColoredSet` (ISO dates), `badgesEarned[]`, `stickersEarned[]`, `palettesUnlocked[]`, `lastSeenDate`.
  - Web: new `public/js/progress.js` persisting the same shape to **IndexedDB** (reuse the gallery DB if `gallery.js` already uses one; else localStorage for counters + IndexedDB for art). Export `recordCompletion(meta)`, `getProgress()`.
- **Hooks:**
  - Flutter: in `canvas_controller.dart` at the point a coloring is detected complete (mirror web's all-regions-filled check) → call `progressProvider.recordCompletion(...)` + auto-save to gallery (existing file save).
  - Web: `public/js/main.js:34-36` (`celebrationShown` branch) → call `progress.recordCompletion(...)` (it already calls `saveArtwork` nearby at ~line 64).
- **UI:** "My Journal" = the existing gallery, relabelled, with a header counter ("🎨 14 masterpieces!") and a **sticker/badge shelf**. Flutter: extend `gallery_screen.dart`. Web: extend `gallery.js` view.
- **Milestones/badges:** pure function `evaluateBadges(progress)` → returns newly-earned badges; celebrate with confetti (web already has a celebration path; Flutter add a lightweight overlay). **Never punish** absence.

### Pillar 2 — Daily ritual (no punishing streaks)
- Extend existing **daily word** into **Picture of the Day** with a weekly theme rotation. Content is **date-derived, offline, deterministic** (no per-child server call): a themed-prompt table keyed by `dayOfYear % N`.
- Track **cumulative "days colored"** (`daysColoredSet.size`) framed positively ("You've colored on 7 days! 🌱"). **No streak-break messaging.**

### Pillar 3 — Unlockable rewards (free, earned through play)
- Palettes/stickers/themes/frames unlocked by milestones. Drive via **content tags** (see §4) so the same mechanism gates premium later.
- Flutter palettes already in `Entitlements.palettes`; add an `unlockedPalettes` overlay in `ProgressStore` that unions with entitlement palettes.

### Pillar 4 — Surprise & delight / fresh content
- **Seasonal packs auto-rotating by date** (Halloween/Christmas/Easter…): a date-gated prompt/content set, offline, no server dependency.
- **Mystery color-by-number**: a flag on a generated picture that hides the reference until regions are filled — fits the existing numbered-region engine (`canvas.js` region map). Implement as a render mode toggle.

### Pillar 5 — Sharing (parent-mediated only)
- Keep existing share/save/challenge. **No in-app social feed, no public gallery, no usernames** (policy + privacy).
- **Printable coloring-book PDF**: bundle N journal pieces → PDF. Web: client-side PDF (jsPDF or print stylesheet). Flutter: `printing` package.
- **Greeting-card mode**: seasonal card layout around a finished piece, exported via the share sheet.

### Pillar 6 — Parent Zone (the compliant re-engagement channel)
- **New route, parental-gated.** Flutter: add `Routes.parentZone='/parent'` in `app_router.dart`; entry guarded by `showParentalGate`. Web: `public/parent.html` (or a gated section) behind a JS parental gate mirroring the Flutter one.
- Contents: usage summary, content management, **manage subscription / restore purchases** (later), **privacy controls** (export/delete local data), and **email opt-in** for a weekly "what your child made" digest + new-content news.
- **Consent nuance (critical):** the multiplication gate is a *neutral age screen*, **not** verifiable parental consent (VPC). Collecting a parent email for the digest requires a COPPA-valid consent method — use **"email-plus"** (confirmatory second email) for the free digest, or treat the **credit-card transaction at purchase** as VPC for paid features. Document which method gates which data (see §5).

---

## 3. Monetization seams (inert at launch)

### 3.1 Define the missing tiers
`subscription_models.dart`: add `Entitlements.plus` and `Entitlements.family` constants (unlimited generations, all palettes/packs, `hdPrint`, `childProfiles>1` for family). Keep `free` as the launch default.

### 3.2 Swappable entitlement source
Refactor `SubscriptionNotifier.build()` so the tier/entitlements come from an **`EntitlementSource`** abstraction (interface). Launch implementation = `StaticFreeSource` (returns `free`). Later = `RevenueCatSource`. **No call sites change** — `canvas_screen.dart`/`home_screen.dart` keep reading `subscriptionProvider`.

### 3.3 Durable server-side meter + entitlement re-check (security-critical)
In `api/generate-image.js`, **after** the existing rate-limit + bot/app-key gates, add:
- A **durable daily counter in KV** keyed by `X-Device-ID` (native) / a first-party signed cookie (web). Enforce the free cap server-side (the client cap becomes advisory).
- An **entitlement check**: "unlimited" is honored **only** when the server confirms an active paid entitlement (RevenueCat REST lookup by app-user-id, cached in KV). A spoofed `X-Device-ID` can never unlock paid limits because the server is the authority.
- Keep treating the device id as **non-identifying** (random UUID, no PII) for COPPA.

### 3.4 Billing layer (added, dormant)
- Flutter dep: `purchases_flutter` (RevenueCat). Wired but **no products fetched / no paywall shown** until a remote flag (`monetizationEnabled`) is true.
- **Paywall = a parental-gated bottom sheet** (`lala_bottom_sheet.dart` exists) triggered when `!canGenerate` *and* `monetizationEnabled`. At launch the cap simply shows "come back tomorrow" (current behavior), no paywall.

### 3.5 Server receipt validation (added, dormant)
- New Vercel function `api/revenuecat-webhook.js`: **verifies the RevenueCat `Authorization` header**, updates the entitlement cache in KV. Inert until RevenueCat is configured.

### 3.6 Physical commerce (later, Stripe)
- New `api/print-order.js` (Stripe Checkout session) — physical goods, parental-gated, available to all users. Out-of-scope for the inert launch but the route + parental gate are scaffolded.

---

## 4. Cross-cutting: content & feature tagging
Introduce a single declarative map: every palette / sticker pack / content pack / feature flagged `free | premium | unlockable`. Gating = `tag` × `entitlement` × `progress.unlocked`. At launch everything resolves to available (free). Source it from the §1.4 remote JSON so launch is config-only.

---

## 5. Security & compliance (the "utmost" requirements)

### 5.1 COPPA / kids data
- **No personal information collected from children.** Device id is a random UUID (not advertising id, not hardware id). Prompts/art are not tied to any identity server-side; minimize Blob retention (verify + set a TTL on generated-image Blobs).
- **No behavioral profiling, no third-party trackers, no ads.**
- **Parental gate** before: external links (already), Parent Zone, every purchase surface, and any data-collection opt-in.
- **VPC for data collection:** parent-email digest → email-plus consent; paid features → card transaction = VPC. State this in the kids-privacy addendum.
- **Right to erasure:** Parent Zone "Delete my child's data" wipes local progress/gallery + (later) server KV entries keyed by device id; "Export" produces a local file.

### 5.2 Apple Kids Category
- IAP only for digital goods; no external purchase links to children; no third-party analytics/ads SDKs; privacy nutrition labels updated; parental gate on all outbound links and purchases.

### 5.3 Google Play Families
- Only Families-certified SDKs (RevenueCat/Stripe SDKs reviewed for compliance before adding); Data Safety form updated; no sale of children's data; target-audience + content settings consistent.

### 5.4 GDPR-K / regional
- Data minimization; EU age-of-consent handling deferred to parent for the email channel; document lawful basis; honor erasure/export.

### 5.5 Payment & server security
- Never touch card data (Apple/Google/Stripe Checkout only). RevenueCat for receipts.
- **Verify webhook signatures** (`api/revenuecat-webhook.js`).
- Server is the **single authority** for paid entitlement and for the hard generation cap; client values are advisory.
- Preserve existing Turnstile + `APP_API_KEY` + IP rate-limit gates; layer the new KV quota after them.
- Secrets stay in env / `bonifatus-secrets` (never committed): `REVENUECAT_SECRET`, `STRIPE_SECRET`, `KV_*`. Add to `.env.example` as placeholders only.

---

## 6. Analytics (privacy-safe)
- First-party, **aggregate, anonymous** counters only: D1/D7/D30 retention, sessions, **pictures completed**, completion rate, cap-hit rate, (later) paywall-view→convert. Keyed by random device id, never joined to identity, no per-child profiles.
- Implement as lightweight server counters in KV or a single `api/event.js` with allow-listed event names — **no Google Analytics / Firebase Analytics** (not kid-safe by default).

---

## 7. Per-platform work breakdown

### Flutter (`flutter_app/`)
- New: `features/progress/progress_service.dart`, `features/parent/parent_zone_screen.dart`, `features/subscription/entitlement_source.dart`, `features/subscription/paywall_sheet.dart` (dormant).
- Edit: `subscription_models.dart` (+plus/family), `subscription_service.dart` (source abstraction), `canvas_controller.dart` (completion hook), `gallery_screen.dart` (journal + shelf), `app_router.dart` (+parent route), `storage_service.dart` (+keys: `kProgress`, `kEntitlementCache`, `kConsentEmail`).
- Deps (dormant): `purchases_flutter`, `printing`, `pdf`.

### Web (`public/`, `api/`)
- New: `public/js/progress.js`, `public/parent.html` + gated JS, `api/quota.js` (or inline in generate-image.js), `api/revenuecat-webhook.js` (dormant), `api/event.js` (analytics).
- Edit: `api/generate-image.js` (durable KV quota + entitlement re-check after existing gates), `public/js/main.js` (completion → progress), `public/js/gallery.js` (journal/collection + PDF export), legal pages.
- Infra: provision **Vercel KV / Upstash Redis** via Marketplace; add env keys.

### Shared
- i18n: add keys for journal/badges/stickers/parent-zone/paywall/print to **all** `flutter_app/assets/i18n/*.json` and the web `i18n.js` table (web currently inlines strings — match its pattern). Keep parity across all 12 languages.

---

## 8. Dependencies & infra to add
- Vercel: **KV/Upstash Redis** (Marketplace) for quota/entitlement/analytics.
- Flutter: `purchases_flutter`, `printing`, `pdf` (all dormant until `monetizationEnabled`).
- Env (placeholders only in `.env.example`): `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `REVENUECAT_SECRET`, `STRIPE_SECRET`, `APP_API_KEY` (already referenced).

## 9. QA / verification plan
- **Web:** bump `?v=NNN` (currently 187 → 188), Playwright at desktop/390/844 across hero + coloring + journal + parent-gate states; confirm completion → counter increments, journal persists across reload, parental gate blocks Parent Zone, free cap enforced **server-side** (simulate spoofed device id → still capped).
- **Flutter:** widget tests for `ProgressStore`, entitlement source returns `free`, parental gate blocks Parent Zone; integration test of completion → badge + gallery save; build **release APK** for sideload (see §11).
- **Compliance self-check:** no third-party tracker added; all outbound/purchase surfaces gated; erasure works end-to-end; Blob TTL set.

## 10. Deploy plan
- Web: commit + push → Vercel auto-deploy → verify live `?v=188` + KV wired. Follow the CLAUDE.md deploy+QA routine (version bump, screenshot QA, checklist).
- Mobile: trigger `flutter-release.yml` (platform=both, track=internal). **Also build a release APK and copy to `C:\Users\Alexa\OneDrive\TEMP`** for sideload testing (standing instruction — see memory `feedback-apk-on-store-push`).
- Monetization stays **off**: `monetizationEnabled=false` in remote config; paywall never shown; everything free.

## 11. Open decisions for the owner (resolve before/with the "implement" command)
1. **Web monetization:** does web charge (Stripe via RevenueCat) or stay a **free funnel** to the apps? (Determines whether we build the web entitlement/paywall path now or only the meter.)
2. **Free daily cap value** at launch (current Flutter default = 20/day). Tune to image-gen COGS.
3. **Parent-email digest at launch?** If yes, we implement email-plus consent now; if not, we scaffold the opt-in but leave it dark.
4. **Tier pricing & contents** for plus/family (needed only when flipping commercial, but confirms entitlement constants).
5. **Print-on-demand provider** (if/when physical goods) — affects `api/print-order.js`.

---

### One-command implementation note
On the "implement in its entirety" command, build order within the single pass:
ProgressStore (both stacks) → completion hooks → journal/badges UI → daily/seasonal content → durable server meter + KV → entitlement-source abstraction + plus/family constants → Parent Zone + gate reuse → dormant billing/webhook/paywall behind `monetizationEnabled=false` → analytics counters → i18n parity → legal pages → QA loop → deploy (web + mobile + local APK).
