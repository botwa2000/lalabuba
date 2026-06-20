// One-off: lift the 18 Sticker-Scenes i18n keys from the web TRANSLATIONS object
// (public/js/i18n.js) into the Flutter JSON locale files, converting web's
// positional-arg functions into Flutter's named {placeholder} templates.
// Run: node scripts/scene-i18n-to-flutter.js  (writes assets/i18n/<loc>.json)
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(repo, 'public/js/i18n.js'), 'utf8');

// Slice the object literal `const TRANSLATIONS = { ... };` and eval it. Functions
// inside (arrow fns for parameterized strings) survive the eval untouched.
const start = src.indexOf('const TRANSLATIONS = {');
const end = src.indexOf('\n};', start);
const objLiteral = src.slice(start + 'const TRANSLATIONS = '.length, end + 2);
// eslint-disable-next-line no-eval
const TRANSLATIONS = eval('(' + objLiteral + ')');

// Flutter target locales (= the JSON files we have).
const LOCALES = ['en','de','es','fr','hi','it','nl','pl','pt','ru','tr','zh'];

// How to resolve each key into a Flutter template. For function-valued web keys
// we call with sentinel args that become {named} placeholders Flutter substitutes.
const KEYS = {
  scenesCardTitle:    (v) => v,
  scenesCardSubtitle: (v) => v('{open}', '{total}'),
  scenesTitle:        (v) => v,
  sceneClear:         (v) => v,
  sceneHint:          (v) => v,
  sceneEarnHint:      (v) => v,
  sceneTrayEmpty:     (v) => v,
  sceneTrayHead:      (v) => v('{n}', '{total}'),
  sceneLockedShort:   (v) => v('{n}'),
  sceneMeadowName:    (v) => v,
  sceneIcebergName:   (v) => v,
  sceneOceanName:     (v) => v,
  sceneCityName:      (v) => v,
  sceneSpaceName:     (v) => v,
  sceneUnlockedToast: (v) => v('{name}'),
  // Web has singular/plural branches keyed on n; Flutter has no plural engine,
  // so take the plural template (n=9 forces that branch) and re-expose n.
  decoUnlockedToast:  (v) => v('{emoji}', 9).replace(/9/g, '{n}'),
  sceneTrayMyArt:     (v) => v,
  weekScenePill:      (v) => v('{name}'),
  // Read-aloud narration + voice-input + coloring-book strings (the other
  // richness features ported to Flutter). All plain strings on the web.
  narrateOnChip:      (v) => v,
  narrateOffChip:     (v) => v,
  narratePraise:      (v) => v,
  voiceBtnLabel:      (v) => v,
  voiceListening:     (v) => v,
  voiceError:         (v) => v,
  printBookBtn:       (v) => v,
  printBookTitle:     (v) => v,
  printBookEmpty:     (v) => v,
};

function resolve(loc, key) {
  // Fall back to EN if a locale is missing the key (shouldn't happen — web has all).
  const tbl = TRANSLATIONS[loc] || {};
  let raw = tbl[key];
  if (raw === undefined) raw = TRANSLATIONS.en[key];
  return KEYS[key](raw);
}

// The decorate-the-mascot screen was replaced by Sticker Scenes; its strings are
// now orphaned in every locale. Drop them so the JSON has no dead keys.
const DROP = ['mascotTitle','mascotCardTitle','mascotCardSubtitle','mascotHint',
  'mascotTrayEmpty','mascotClear'];

for (const loc of LOCALES) {
  const file = path.join(repo, 'flutter_app/assets/i18n', loc + '.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const k of DROP) delete json[k];
  for (const key of Object.keys(KEYS)) {
    json[key] = resolve(loc, key);
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${loc}: -${DROP.length} +${Object.keys(KEYS).length} keys`);
}
console.log('done');
