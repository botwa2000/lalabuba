# Store privacy declarations — Lalabuba (free-only v1)

This is the source of truth for the **Apple App Privacy** ("Nutrition Label")
and **Google Play Data safety** questionnaires. Keep it in sync with
`flutter_app/ios/Runner/PrivacyInfo.xcprivacy`, `public/privacy.html`, and the
actual code. It reflects the free-only build with **no in-app purchases and no
ads**.

## What the app actually does with data

| Data | Where | Sent off device? | Purpose | Linked to identity? | Tracking? |
|------|-------|------------------|---------|---------------------|-----------|
| Random install UUID (`device_id`) | Mobile app → our API | Yes (with each draw request) | Rate limiting / abuse prevention (app functionality) | No | No |
| Drawing subject text | Mobile app → our API → AI providers | Yes (transient) | Generate the coloring page; not stored beyond the request | No | No |
| Saved artwork (PNG) | On device gallery only | No | User keeps their pictures | No | No |
| App preferences (language, options) | On-device secure storage | No | Remember settings | No | No |

The **mobile apps do not load Google Analytics or PostHog** — those run only on
the website, gated behind a cookie-consent banner.

There is no account, no login, no advertising identifier, no location, no
contacts, no payment data.

---

## Apple — App Privacy (App Store Connect → App Privacy)

**Does the app collect data?** → **Yes** (the device UUID is sent to our server).

Data type to declare:
- **Identifiers → Device ID**
  - Used for: **App Functionality** (fraud/abuse prevention, rate limiting)
  - Linked to the user's identity: **No**
  - Used for tracking: **No**

Everything else (drawing text is transient and not stored; artwork/preferences
stay on device) is **not collected** in Apple's sense.

- **Tracking:** No. Do **not** enable App Tracking Transparency — we don't track.
- This matches `PrivacyInfo.xcprivacy` (`NSPrivacyTracking=false`, Device ID
  collected for App Functionality, not linked, not tracking).
- **Encryption:** `ITSAppUsesNonExemptEncryption = false` (standard HTTPS only).

---

## Google Play — Data safety (Play Console → App content → Data safety)

**Does your app collect or share any of the required user data types?** → **Yes**.

Declare one data type:
- **Device or other IDs**
  - Collected: **Yes**; Shared: **No**
  - Processed ephemerally: **No** (the UUID persists on device, sent each request)
  - Required or optional: **Required** (needed for abuse prevention)
  - Purpose: **Fraud prevention, security, and compliance** (+ App functionality)
  - Linked to the user: **No**
  - Used to track the user: **No**

Notes for the rest of the form:
- **Data is encrypted in transit:** Yes (HTTPS).
- **Users can request data deletion:** Uninstalling removes the on-device UUID;
  no server-side account exists to delete. Provide the privacy contact
  (privacy@lalabuba.com).
- The drawing subject text is sent to AI providers transiently to render the
  image and is **not stored** — not declared as collected.

**Target audience & content:** mixed audience including children → complete the
**Families** policy section. The app has **no ads, no IAP**, and gates external
links (Privacy/Terms) behind a parental check.

---

## Cross-checks before submitting
- [ ] `PrivacyInfo.xcprivacy` is in the Runner target (Copy Bundle Resources).
- [ ] `public/privacy.html` lists GA + PostHog (web) and the mobile device-ID. ✅ done
- [ ] No IAP products configured in either store (free-only). ✅ code side done
- [ ] Impressum street address filled in (`public/impressum.html`). ⚠️ NEEDS OWNER
- [ ] Parental gate present before external links. ✅ done
