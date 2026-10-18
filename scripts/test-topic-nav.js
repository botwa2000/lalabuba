// Shared topic navigation (lib/topic-nav.js): every coloring page lists the same
// topics, translated, linking only to pages that exist, and only topics with pictures.
const assert = require("assert");
const gallery = require("../lib/gallery");
const i18n = require("../lib/coloring-i18n");
const nav = require("../lib/topic-nav");

let empty = new Set();
gallery.hasImages = (id) => !empty.has(id);

const evergreen = gallery.TOPICS.filter(id => !gallery.TOPIC_META[id].seasonal);
const seasonal = gallery.TOPICS.filter(id => gallery.TOPIC_META[id].seasonal);
const links = (html) => [...html.matchAll(/<a href="([^"]+)" class="lp-related-card">/g)].map(m => m[1]);
const names = (html) => [...html.matchAll(/lp-rel-emoji">[^<]*<\/span> ([^<]+)</g)].map(m => m[1]);

// German lists every topic, seasonal included, by its German name, at /de/ URLs.
const de = nav.topicNavSection("de", "butterfly");
assert.strictEqual(names(de).length, gallery.TOPICS.length);
assert.ok(names(de).includes("Schmetterling") && names(de).includes("Auto") && names(de).includes("Weihnachten"));
assert.ok(!names(de).includes("Butterfly"), "German nav must not show English names");
assert.ok(links(de).every(u => u.startsWith("/de/ausmalbilder/")));
assert.match(de, /<span class="lp-related-card" aria-current="page"><span class="lp-rel-emoji">🦋<\/span> Schmetterling</);
assert.ok(!links(de).includes("/de/ausmalbilder/schmetterling/"), "current topic is not a link");

// Every other language: evergreen topics only (seasonal pages are German-only).
for (const lang of ["en", ...Object.keys(i18n.LANGS)]) {
  const html = nav.topicNavSection(lang);
  assert.strictEqual(names(html).length, evergreen.length, lang);
  for (const id of seasonal) assert.ok(!html.includes(`/${id}/`), `${lang} links seasonal ${id}`);
  if (lang !== "en") {
    const cfg = i18n.LANGS[lang];
    assert.ok(links(html).every(u => u.startsWith(`/${cfg.root}/`)), lang);
    assert.deepStrictEqual(names(html), evergreen.map(id => cfg.t.topicNames[id]), `${lang} names`);
  }
}

// A topic without pictures drops out of every list.
empty = new Set(["car"]);
assert.ok(!nav.topicNavSection("en").includes("/car/"));
assert.ok(!nav.topicNavSection("de").includes("/auto/"));
empty = new Set();

// Static-page markers are all filled, and the hub JSON-LD stays valid JSON.
const filled = nav.fillTopicMarkers(
  '<!--topic-nav--><!--topic-hub-cards--><!--topic-cards:christmas--><!--topic-cards:evergreen-->' +
  '<script>{"itemListElement": "__TOPIC_ITEMS__", "hasPart": "__TOPIC_PARTS__"}</script>', "de", "car");
assert.ok(!/<!--topic|__TOPIC_/.test(filled));
const ld = JSON.parse(filled.match(/<script>(.*)<\/script>/)[1]);
assert.strictEqual(ld.itemListElement.length, gallery.TOPICS.length);
assert.strictEqual(ld.itemListElement[0].url, "https://lalabuba.com/de/ausmalbilder/weihnachten/");

console.log("topic-nav: all checks passed");
