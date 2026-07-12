#!/usr/bin/env node
// Updates hreflang in all static EN coloring-pages HTML files and the hub page.

const fs   = require('fs');
const path = require('path');
const i18n = require('../lib/coloring-i18n');

const DE_TOPIC_SLUGS = {
  dragon: 'drache', unicorn: 'einhorn', butterfly: 'schmetterling',
  dinosaur: 'dinosaurier', cat: 'katze', princess: 'prinzessin',
  mermaid: 'meerjungfrau', rocket: 'rakete',
};

function buildTopicHreflang(enTopic) {
  const lines = [
    `  <link rel="alternate" hreflang="en" href="https://lalabuba.com/coloring-pages/${enTopic}/"/>`,
  ];
  const deSlug = DE_TOPIC_SLUGS[enTopic];
  if (deSlug) lines.push(`  <link rel="alternate" hreflang="de" href="https://lalabuba.com/ausmalbilder/${deSlug}/"/>`);
  for (const [lang, cfg] of Object.entries(i18n.LANGS)) {
    const slug = cfg.topicSlugs[enTopic];
    if (slug) lines.push(`  <link rel="alternate" hreflang="${cfg.htmlLang}" href="https://lalabuba.com/${cfg.root}/${slug}/"/>`);
  }
  lines.push(`  <link rel="alternate" hreflang="x-default" href="https://lalabuba.com/coloring-pages/${enTopic}/"/>`);
  return lines.join('\n');
}

function buildHubHreflang() {
  const lines = [
    `  <link rel="alternate" hreflang="en" href="https://lalabuba.com/coloring-pages/"/>`,
    `  <link rel="alternate" hreflang="de" href="https://lalabuba.com/ausmalbilder/"/>`,
  ];
  for (const [lang, cfg] of Object.entries(i18n.LANGS)) {
    lines.push(`  <link rel="alternate" hreflang="${cfg.htmlLang}" href="https://lalabuba.com/${cfg.root}/"/>`);
  }
  lines.push(`  <link rel="alternate" hreflang="x-default" href="https://lalabuba.com/coloring-pages/"/>`);
  return lines.join('\n');
}

// Replace the hreflang block in an HTML file
function updateFile(filePath, newHreflang) {
  let html = fs.readFileSync(filePath, 'utf8');
  // Match the block from first hreflang to the x-default line (inclusive)
  const updated = html.replace(
    /[ \t]*<link rel="alternate" hreflang="en"[\s\S]*?<link rel="alternate" hreflang="x-default"[^>]*\/>/,
    newHreflang
  );
  if (updated === html) {
    console.warn(`  WARN: no hreflang block found in ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log(`  Updated: ${filePath}`);
}

const publicDir = path.join(__dirname, '..', 'public');

// Hub page
updateFile(path.join(publicDir, 'coloring-pages', 'index.html'), buildHubHreflang());

// Topic pages
const topics = ['dragon', 'unicorn', 'butterfly', 'dinosaur', 'cat', 'princess', 'mermaid', 'rocket'];
for (const topic of topics) {
  const filePath = path.join(publicDir, 'coloring-pages', topic, 'index.html');
  if (fs.existsSync(filePath)) {
    updateFile(filePath, buildTopicHreflang(topic));
  } else {
    console.warn(`  MISSING: ${filePath}`);
  }
}

console.log('Done.');
