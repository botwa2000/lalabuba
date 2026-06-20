// Generate docs/STORE_SUBMISSION.md — the single fill-in sheet for submitting
// Lalabuba to BOTH the Apple App Store and Google Play. Pulls every localized
// listing field from store-assets/store-listing-i18n.json (already validated
// against Apple/Play character limits) and embeds the shared app metadata,
// privacy/data-safety answers, screenshot inventory, and a submission checklist.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(ROOT,'store-assets','store-listing-i18n.json'),'utf8'));

// display name + store locale codes per language key
const META = {
  en:{name:'English',apple:'English (U.S.) — en-US',play:'en-US (default)'},
  de:{name:'German',apple:'German — de-DE',play:'de-DE'},
  es:{name:'Spanish',apple:'Spanish (Spain) — es-ES',play:'es-ES'},
  fr:{name:'French',apple:'French — fr-FR',play:'fr-FR'},
  it:{name:'Italian',apple:'Italian — it',play:'it-IT'},
  nl:{name:'Dutch',apple:'Dutch — nl-NL',play:'nl-NL'},
  pl:{name:'Polish',apple:'Polish — pl',play:'pl-PL'},
  pt:{name:'Portuguese',apple:'Portuguese (Portugal) — pt-PT',play:'pt-PT'},
  ru:{name:'Russian',apple:'Russian — ru',play:'ru-RU'},
  tr:{name:'Turkish',apple:'Turkish — tr',play:'tr-TR'},
  hi:{name:'Hindi',apple:'Hindi — hi',play:'hi-IN'},
  zh:{name:'Chinese (Simplified)',apple:'Chinese, Simplified — zh-Hans',play:'zh-CN'},
};
const ORDER = ['en','de','es','fr','it','nl','pl','pt','ru','tr','hi','zh'];

const len = s => [...(s||'')].length; // code-point count (matches store counters closely)
let o = '';
const w = s => { o += s + '\n'; };

w('# Lalabuba — Store submission sheet (App Store + Google Play)');
w('');
w('> **Auto-generated** by `scripts/gen-store-submission.js` from');
w('> `store-assets/store-listing-i18n.json`. Edit the JSON and re-run, do not hand-edit this file.');
w('> Every localized field below has been validated against the store character limits.');
w('');
w('---');
w('');
w('## 1. Shared app identity & settings (both stores)');
w('');
w('| Field | Value |');
w('|-------|-------|');
w('| App name | Lalabuba |');
w('| Bundle ID (iOS) / Package (Android) | `com.lalabuba.lalabuba` |');
w('| Apple App Store ID | `6761691648` |');
w('| ASC integration (Codemagic) | `Bonistock ASC` |');
w('| Codemagic App ID | `69d2bd72c09ad496ab57741d` |');
w('| Primary / default language | English (en-US) |');
w('| Price | Free |');
w('| In-app purchases | **None** |');
w('| Ads | **None** |');
w('| Primary category | Education (alt: Kids / Family) |');
w('| Secondary category | Entertainment |');
w('| Age rating | Apple **4+** · Play **Everyone** (PEGI 3) |');
w('| Target audience | Children + general (Families / Kids program) |');
w('| Encryption | Exempt — `ITSAppUsesNonExemptEncryption=false` (HTTPS only) |');
w('| Support URL | https://lalabuba.com |');
w('| Marketing URL | https://lalabuba.com |');
w('| Privacy policy URL | https://lalabuba.com/privacy |');
w('| Support / privacy contact | privacy@lalabuba.com · info@lalabuba.com |');
w('| Copyright | © 2026 Lalabuba |');
w('');
w('**Pipelines:** iOS → Codemagic (`codemagic.yaml`, push to `main`). Android →');
w('GitHub Actions (`.github/workflows/android-release.yml`, push to `main`) → Play');
w('Console Internal testing draft → *Start rollout*.');
w('');
w('**Languages (12):** ' + ORDER.map(k=>META[k].name).join(', ') + '.');
w('');
w('---');
w('');

// ── Apple ──
w('## 2. Apple App Store Connect — localizable fields');
w('');
w('For each language: **Name** (≤30), **Subtitle** (≤30), **Promotional Text**');
w('(≤170, editable without review), **Keywords** (≤100, comma-separated no spaces),');
w('**Description** (≤4000), **What’s New**. Numbers in parentheses = current length.');
w('');
for (const k of ORDER) {
  const f = D[k];
  w(`### ${META[k].name} — ${META[k].apple}`);
  w('');
  w(`- **Name** (${len(f.name)}/30): ${f.name}`);
  w(`- **Subtitle** (${len(f.subtitle)}/30): ${f.subtitle}`);
  w(`- **Promotional Text** (${len(f.promo)}/170): ${f.promo}`);
  w(`- **Keywords** (${len(f.keywords)}/100): \`${f.keywords}\``);
  w(`- **What’s New** (${len(f.whatsnew)}):`);
  w('');
  w('  ```');
  f.whatsnew.split('\n').forEach(l => w('  ' + l));
  w('  ```');
  w(`- **Description** (${len(f.full)}/4000):`);
  w('');
  w('  ```');
  f.full.split('\n').forEach(l => w('  ' + l));
  w('  ```');
  w('');
}

w('### Apple — App Privacy (App Store Connect → App Privacy)');
w('');
w('- **Does the app collect data?** Yes.');
w('- **Identifiers → Device ID** — Purpose: **App Functionality** (rate limiting /');
w('  abuse prevention). Linked to identity: **No**. Used for tracking: **No**.');
w('- No other data types collected (drawing text is transient & not stored; artwork');
w('  and preferences stay on device).');
w('- **Tracking:** No (do not enable App Tracking Transparency).');
w('- Matches `flutter_app/ios/Runner/PrivacyInfo.xcprivacy` (`NSPrivacyTracking=false`).');
w('- **Export compliance:** `ITSAppUsesNonExemptEncryption=false`.');
w('- **Content rights:** does not contain third-party content. **Age rating:** 4+.');
w('- **Kids Category:** if listed in Kids, confirm no third-party analytics/ads in the');
w('  app build (mobile build loads neither — GA/PostHog are web-only).');
w('');
w('---');
w('');

// ── Play ──
w('## 3. Google Play Console — localizable fields');
w('');
w('For each language: **App name / Title** (≤30), **Short description** (≤80),');
w('**Full description** (≤4000). Play has no separate keywords or promo-text field.');
w('A localized "What’s new" (release notes, ≤500) can reuse the Apple text below.');
w('');
for (const k of ORDER) {
  const f = D[k];
  w(`### ${META[k].name} — ${META[k].play}`);
  w('');
  w(`- **Title** (${len(f.name)}/30): ${f.name}`);
  w(`- **Short description** (${len(f.short)}/80): ${f.short}`);
  w(`- **Release notes (What’s new)** — reuse Apple "What’s New" for ${META[k].name}.`);
  w(`- **Full description** (${len(f.full)}/4000): see \`store-assets/play-store-listing/descriptions/${k}.txt\` (identical to the Apple Description above).`);
  w('');
}

w('### Google Play — Data safety (Play Console → App content → Data safety)');
w('');
w('- **Does your app collect or share required user data?** Yes.');
w('- **Device or other IDs** — Collected: **Yes**; Shared: **No**; Processed');
w('  ephemerally: **No**; Required: **Yes**. Purpose: **Fraud prevention, security &');
w('  compliance** (+ App functionality). Linked to user: **No**. Used to track: **No**.');
w('- **Encrypted in transit:** Yes (HTTPS). **Data deletion:** uninstall removes the');
w('  on-device UUID; no server-side account exists. Contact: privacy@lalabuba.com.');
w('- Drawing subject text is sent transiently to AI providers and **not stored** — not declared.');
w('');
w('### Google Play — extra App content sections');
w('');
w('- **Ads:** No ads.');
w('- **Content rating questionnaire:** no violence, no mature content → expect *Everyone*.');
w('- **Target audience & content:** include children → complete the **Families** policy');
w('  section; external links (Privacy/Terms) are behind a parental gate.');
w('- **Government / financial / health:** No. **News app:** No.');
w('');
w('---');
w('');

// ── Screenshots ──
w('## 4. Screenshot inventory (real captures of the live web app)');
w('');
w('Generated by `scripts/store-screenshots.js` (5 screens per device, all 12');
w('languages). Screens: `1-create` (hero), `2-color` (color-by-number), `3-rewards`');
w('(rewards journal), `4-stickers` (sticker album), `5-mascot` (decorated mascot).');
w('');
w('**iOS** — `app-store-assets/<lang>/<device>/` :');
w('');
w('| Device | Pixel size | Required |');
w('|--------|-----------|----------|');
w('| iphone_6_9 / _landscape | 1320×2868 / 2868×1320 | 6.9" — required |');
w('| iphone_6_5 / _landscape | 1284×2778 / 2778×1284 | 6.5" — required |');
w('| ipad_13 / _landscape | 2048×2732 / 2732×2048 | 13" iPad — required if iPad supported |');
w('');
w('**Android** — `store-assets/play-store-listing/screenshots/<lang>/<device>/` :');
w('');
w('| Device | Pixel size | Notes |');
w('|--------|-----------|-------|');
w('| phone / _landscape | 1080×1920 / 1920×1080 | min 2, up to 8 |');
w('| tablet_7 / _landscape | 1200×1920 / 1920×1200 | 7" tablet |');
w('| tablet_10 / _landscape | 1600×2560 / 2560×1600 | 10" tablet |');
w('');
w('> Play requires a 512×512 app icon and a 1024×500 feature graphic (separate assets).');
w('> Apple uses the 1024×1024 icon from the build (`app-store-assets/app-icon-1024.png`).');
w('');
w('---');
w('');
w('## 5. Pre-submission checklist');
w('');
w('- [ ] iOS build (latest, Build ≥1077) processed in App Store Connect.');
w('- [ ] Android AAB uploaded to Play Console (versionCode 1000+run#).');
w('- [ ] All 12 localizations filled (Name/Subtitle/Promo/Keywords/Desc/What’s New).');
w('- [ ] Screenshots uploaded for every required device size & language.');
w('- [ ] App Privacy (Apple) + Data safety (Play) answered as in §2/§3.');
w('- [ ] Age rating 4+ / Everyone; Families/Kids policy completed.');
w('- [ ] Encryption exemption declared (`ITSAppUsesNonExemptEncryption=false`).');
w('- [ ] No IAP, no ads configured in either store.');
w('- [ ] Privacy URL (lalabuba.com/privacy) reachable; parental gate on external links.');
w('- [ ] ⚠️ **Impressum street address** filled in `public/impressum.html` (NEEDS OWNER).');
w('- [ ] TestFlight "What to Test" filled for external testers.');
w('');

fs.mkdirSync(path.join(ROOT,'docs'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'docs','STORE_SUBMISSION.md'), o);
console.log('Wrote docs/STORE_SUBMISSION.md ('+o.length+' chars)');
