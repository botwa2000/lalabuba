// Regenerate per-language store description files from store-listing-i18n.json.
//  - app-store-assets/description-<lang>.txt          ← full (Apple description)
//  - store-assets/play-store-listing/descriptions/<lang>.txt        ← full
//  - store-assets/play-store-listing/descriptions/<lang>-short.txt  ← short
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT,'store-assets','store-listing-i18n.json'),'utf8'));

const appStore = path.join(ROOT,'app-store-assets');
const playDesc = path.join(ROOT,'store-assets','play-store-listing','descriptions');

let n = 0;
for (const [lang, f] of Object.entries(data)) {
  fs.writeFileSync(path.join(appStore, `description-${lang}.txt`), f.full + '\n');
  fs.writeFileSync(path.join(playDesc, `${lang}.txt`), f.full + '\n');
  fs.writeFileSync(path.join(playDesc, `${lang}-short.txt`), f.short + '\n');
  // sanity: Play short description hard limit is 80 chars
  if (f.short.length > 80) console.warn(`  ! ${lang} short = ${f.short.length} chars (>80)`);
  if (f.full.length > 4000) console.warn(`  ! ${lang} full = ${f.full.length} chars (>4000)`);
  n++;
}
console.log(`Wrote descriptions for ${n} languages.`);
