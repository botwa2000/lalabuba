#!/usr/bin/env node
// Updates hreflang in all German ausmalbilder static HTML files.

const fs   = require('fs');
const path = require('path');
const i18n = require('../lib/coloring-i18n');

// DE slug → EN topic
const DE_TOPICS = {
  drache: 'dragon', einhorn: 'unicorn', schmetterling: 'butterfly',
  dinosaurier: 'dinosaur', katze: 'cat', prinzessin: 'princess',
  meerjungfrau: 'mermaid', rakete: 'rocket',
  // seasonal
  schultuete: null, einschulung: null,
};

const EN_TO_DE = Object.fromEntries(
  Object.entries(DE_TOPICS).filter(([, en]) => en).map(([de, en]) => [en, de])
);

function buildDeTopicHreflang(deSlug, enTopic) {
  const lines = [
    `  <link rel="alternate" hreflang="de" href="https://lalabuba.com/ausmalbilder/${deSlug}/"/>`,
    `  <link rel="alternate" hreflang="en" href="https://lalabuba.com/coloring-pages/${enTopic}/"/>`,
  ];
  if (enTopic) {
    for (const [lang, cfg] of Object.entries(i18n.LANGS)) {
      const slug = cfg.topicSlugs[enTopic];
      if (slug) lines.push(`  <link rel="alternate" hreflang="${cfg.htmlLang}" href="https://lalabuba.com/${cfg.root}/${slug}/"/>`);
    }
  }
  lines.push(`  <link rel="alternate" hreflang="x-default" href="https://lalabuba.com/coloring-pages/${enTopic || deSlug}/"/>`);
  return lines.join('\n');
}

function buildDeHubHreflang() {
  const lines = [
    `  <link rel="alternate" hreflang="de" href="https://lalabuba.com/ausmalbilder/"/>`,
    `  <link rel="alternate" hreflang="en" href="https://lalabuba.com/coloring-pages/"/>`,
  ];
  for (const [lang, cfg] of Object.entries(i18n.LANGS)) {
    lines.push(`  <link rel="alternate" hreflang="${cfg.htmlLang}" href="https://lalabuba.com/${cfg.root}/"/>`);
  }
  lines.push(`  <link rel="alternate" hreflang="x-default" href="https://lalabuba.com/coloring-pages/"/>`);
  return lines.join('\n');
}

function updateFile(filePath, newHreflang) {
  let html = fs.readFileSync(filePath, 'utf8');
  // Match block: from first hreflang to last (de, en, and maybe x-default)
  // The DE pages currently have only 2 hreflang lines
  const updated = html.replace(
    /[ \t]*<link rel="alternate" hreflang="(?:de|en)"[\s\S]*?(?:<link rel="alternate" hreflang="x-default"[^>]*\/>[\r\n]*)?(?=\s*<meta property="og:|$)/,
    (m) => newHreflang + '\n'
  );
  if (updated === html) {
    console.warn(`  WARN: no hreflang block found in ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log(`  Updated: ${filePath}`);
}

const publicDir = path.join(__dirname, '..', 'public');
const ausmalDir = path.join(publicDir, 'ausmalbilder');

// Hub
updateFile(path.join(ausmalDir, 'index.html'), buildDeHubHreflang());

// Topic pages
for (const [deSlug, enTopic] of Object.entries(DE_TOPICS)) {
  const filePath = path.join(ausmalDir, deSlug, 'index.html');
  if (!fs.existsSync(filePath)) { console.warn(`  MISSING: ${filePath}`); continue; }
  updateFile(filePath, buildDeTopicHreflang(deSlug, enTopic || deSlug));
}

console.log('Done.');
