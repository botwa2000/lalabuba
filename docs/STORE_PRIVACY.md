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
| Saved artwork, preferences | on device only | — | — | — | — |

No account is required, no advertising ID, no ads, no IAP, no precise location,
no contacts, no third-party analytics SDK. "Delete account" in Settings deletes
the profile, shared artworks **and** the usage statistics of that install
(`DELETE /api/community/profile` → `usage.forgetInstall`).

---

## Apple — App Store Connect → App Privacy

**Do you or your third-party partners collect data from this app?** → **Yes**.

Declare these data types (every one: **Linked to the user: No**, **Used for tracking: No**):

| Category → Type | Purposes to tick |
|---|---|
| Identifiers → **Device ID** | App Functionality, Analytics |
| Usage Data → **Product Interaction** | Analytics |
| User Content → **Other User Content** | App Functionality, Analytics (typed subjects; grown-ups' feedback comments) |
| Diagnostics → **Crash Data** | App Functionality |
| Location → **Coarse Location** | Analytics |

- **Tracking:** No. Do not enable App Tracking Transparency.
- Matches `PrivacyInfo.xcprivacy` (same five types, `NSPrivacyTracking=false`).
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
| App info and performance → **Diagnostics** | Required | App functionality |
| Device or other IDs → **Device or other IDs** | Required | App functionality, Analytics, Fraud prevention/security/compliance |

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
