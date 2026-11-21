# Store privacy declarations — Lalabuba (from app 1.0.24)

Source of truth for the **Apple App Privacy** ("nutrition label") and the
**Google Play Data safety** form. Keep in sync with
`flutter_app/ios/Runner/PrivacyInfo.xcprivacy`, `public/privacy.html` and the
code (`lib/usage.js`, `flutter_app/lib/shared/services/usage_service.dart`).

What changed in 1.0.24 (2026-10-30): PostHog was removed from the apps and the
website and replaced by **first-party usage statistics** (our own server, our
own database, never shared). Firebase Crashlytics was already shipping but had
not been declared — it is now. Typed drawing subjects are now kept 30 days.

## What the app actually does with data

| Data | Sent to | Kept | Purpose | Linked to identity? | Tracking? |
|------|---------|------|---------|---------------------|-----------|
| Random install UUID (`device_id`) | our API | until uninstall / "Delete account" | abuse prevention, rate limits, usage statistics | No | No |
| Usage events (screen opened, drawing finished/saved/printed/shared, app open, app version, UI language) | our API (`/api/t`) | 13 months | analytics (product improvement) | No | No |
| Typed drawing subject | our API → AI translation + image providers (processors) | raw text 30 days, then only the English topic | app functionality, abuse review, analytics | No | No |
| Country (2 letters from Cloudflare `CF-IPCountry`; IP is never stored) | our API | 13 months, aggregated | analytics | No | No |
| Android install referrer (`utm_*` of the Play link) | our API, once | 13 months | analytics (acquisition) | No | No |
| Picture rating 😍/🙂/😕 (one tap after finishing a picture, no text) | our API (`/api/feedback`) | 13 months | analytics (picture quality) | No | No |
| Grown-ups' feedback: 1–5 ★ + optional comment (Settings → Send feedback, behind parental gate) | our API → team inbox (Brevo, processor) | 13 months | app functionality (support), analytics | No | No |
| Crash reports | Firebase Crashlytics (Google, processor) | 90 days | app functionality (fix crashes) | No | No |
| App Check token (Play Integrity / App Attest) | our API | not stored | security | No | No |
| Refused subjects (safety filter: subject, category, install UUID) | our API → AI classifiers on the same provider as generation (processor) | 30 days | app functionality (child safety) | No | No |
| Reported pictures (generated picture + preset reason, no free text) | our API | until reviewed | app functionality (child safety) | No | No |
| Pictures shared to the community gallery | our API → AI classifiers (processor), then published | until the artwork expires or is deleted | app functionality | No | No |
| Optional parent family account: email address, child nicknames/avatars/age groups, account ID, linked devices | our API (sign-in code via Brevo, processor) | until the account is deleted | app functionality (account management) | **Yes** | No |
| Saved artwork, preferences | on device only | — | — | — | — |

**Website only (2026-11-20, no store-form change — the apps send none of it):**
coloring-funnel events `picture_open` (a picture is on the canvas; `source` =
library | generated) and `first_fill` (first colour in that picture), plus the
prop `lp` on `page_cta_open` / `picture_open` / `first_fill` / `complete`: the
path of the lalabuba.com page the visitor clicked "color" on (e.g.
`/boyama-sayfalari/kedi`, or `(direct)`). It is one of our own page paths,
validated server-side to `/[\w/.-]` (no query, no external URL, no free text),
kept 13 months like every usage event, never linked to identity.

**2026-11-21 additions (website now; apps from 1.0.27):**
- `page_leave` (website only): seconds the page was open (5 s steps to a minute,
  then minutes, max 3600), scroll depth (10 % steps) and device class
  (`phone` | `tablet` | `desktop`, from pointer type + screen's short side;
  no screen size, no user agent stored).
- `abandon` (web + apps): a started picture left unfinished, with `pct` = share
  of its areas coloured (5 % steps) and the difficulty.
- `cid` on `challenge_create` / `challenge_open` and the opener's later steps: a
  random challenge-link number generated per shared picture. It identifies the
  link, not the sender or the opener.
- `reason` on app `error` events: the error class (e.g. `dio_receiveTimeout`,
  `contentSafetyError`, `format`), never the message or stack, plus the screen.
  **Store forms:** Apple → add **Diagnostics → Other Diagnostic Data — Linked:
  Yes — Analytics, App Functionality** (and `PrivacyInfo.xcprivacy`, done in
  1.0.27); Google Play → Diagnostics: add the **Analytics** purpose. Owner to
  apply in App Store Connect / Play Console with the 1.0.27 submission.

No account is required (the family account is optional and parent-created), no advertising ID, no ads, no IAP, no precise location,
no contacts, no third-party analytics SDK. "Delete account" in Settings deletes
the family account (`DELETE /api/auth/account`: child profiles, devices and
sessions cascade), the profile, shared artworks **and** the usage statistics of
that install (`DELETE /api/community/profile` → `usage.forgetInstall`). Web
deletion: ⚙️ → account → Delete account; request page https://lalabuba.com/delete-account.

---

## Apple — App Store Connect → App Privacy

**Do you or your third-party partners collect data from this app?** → **Yes**.

Declare these data types (**Used for tracking: No** for all; **Linked to the user: Yes** for all except Crash Data). Why linked: usage rows, subjects and country are stored under the install UUID, and `account_devices` ties that UUID to a family account's email, so they *can* be linked even though we never join them. Crashlytics never receives our UUID or account.

| Category → Type | Purposes to tick |
|---|---|
| Identifiers → **Device ID** — **Linked: Yes** | App Functionality, Analytics |
| Usage Data → **Product Interaction** — **Linked: Yes** | Analytics |
| User Content → **Other User Content** — **Linked: Yes** | App Functionality, Analytics (typed subjects; grown-ups' feedback comments) |
| Diagnostics → **Crash Data** — Linked: No | App Functionality |
| Diagnostics → **Other Diagnostic Data** — **Linked: Yes** | App Functionality, Analytics (error class + screen, 1.0.27+) |
| Location → **Coarse Location** — **Linked: Yes** | Analytics |
| Contact Info → **Email Address** — **Linked: Yes** | App Functionality (optional family account) |
| Contact Info → **Name** — **Linked: Yes** | App Functionality (child nicknames in the family account) |
| Identifiers → **User ID** — **Linked: Yes** | App Functionality (family account ID) |

- **Tracking:** No. Do not enable App Tracking Transparency.
- Matches `PrivacyInfo.xcprivacy` (same nine types (Other Diagnostic Data since 1.0.27), `NSPrivacyTracking=false`).
- Privacy Policy URL: `https://lalabuba.com/privacy`.
- **Kids Category:** compliant — no third-party analytics or ads; first-party
  analytics with no personal information (App Review Guideline 1.3 / 5.1.4).

## Google Play — Play Console → App content → Data safety

**Does your app collect or share any of the required user data types?** → **Yes**
**Is all of the user data collected by your app encrypted in transit?** → **Yes**
**Do you provide a way for users to request that their data is deleted?** → **Yes**
(in-app: Settings → Delete account; or privacy@lalabuba.com)

Data types — for each: **Collected: Yes · Shared: No · Processed ephemerally: No**:

| Category → Type | Required? | Purposes |
|---|---|---|
| Location → **Approximate location** | Required | Analytics |
| App activity → **App interactions** | Required | Analytics |
| App activity → **Other user-generated content** | Required | App functionality, Analytics, Fraud prevention/security/compliance (typed subjects; optional feedback comments) |
| App info and performance → **Crash logs** | Required | App functionality |
| App info and performance → **Diagnostics** | Required | App functionality, Analytics (error class + screen, 1.0.27+) |
| Device or other IDs → **Device or other IDs** | Required | App functionality, Analytics, Fraud prevention/security/compliance |
| Personal info → **Email address** | Optional | App functionality, Account management |
| Personal info → **Name** | Optional | App functionality, Account management (child nicknames) |
| Personal info → **User IDs** | Optional | App functionality, Account management |

**Account creation:** "Username and other authentication" (email + one-time code).
**Account deletion URL:** https://lalabuba.com/delete-account
**Delete data URL:** https://lalabuba.com/delete-account

"Shared: No" is correct for Crashlytics and the AI providers: Google treats
transfers to service providers that process data on our behalf as not sharing.

**Target audience & content / Families:** unchanged — mixed audience including
children; no ads, no IAP; external links behind the parental gate. First-party
statistics carry no AAID or other hardware identifiers (Families policy).

## Website

- `public/privacy.html` §2, §4–§7 describe the first-party statistics, the
  consent split (no identifier / no storage without consent; community ID with
  consent), retention and legal bases (Art. 6(1)(f) / 6(1)(a) GDPR, § 25 TDDDG).
- Google Analytics remains opt-in via the cookie banner. PostHog is removed
  (it had been loading on `index.html` **before** consent — fixed).

## Cross-checks before submitting 1.0.24
- [x] `PrivacyInfo.xcprivacy` lists the five collected types.
- [x] `public/privacy.html` updated (first-party stats, Crashlytics, DeepInfra, 30-day prompts).
- [x] `posthog_flutter` removed from `pubspec.yaml`; no PostHog script on the web.
- [ ] App Store Connect → App Privacy updated as above (manual — no API).
- [ ] Play Console → Data safety updated as above (manual, or export CSV →
      `scripts/play-data-safety.mjs <csv>` pushes it via the Play Developer API).
- [ ] Impressum street address filled in (`public/impressum.html`). ⚠️ NEEDS OWNER
