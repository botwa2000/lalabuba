// Shared topic navigation (lib/topic-nav.js): every coloring page lists the same
// topics, translated, linking only to pages that exist, and only topics with pictures.
const assert = require("assert");
const gallery = require("../lib/gallery");
const i18n = require("../lib/coloring-i18n");
const nav = require("../lib/topic-nav");
const seasonalTopics = require("../lib/seasonal-topics");

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

// Every other language: evergreen topics + the Christmas & winter topics
// (lib/seasonal-topics.js); Nikolaus and the school topics stay German-only.
const everywhere = gallery.TOPICS.filter(id => !gallery.TOPIC_META[id].seasonal || seasonalTopics.TOPICS[id]);
const germanOnly = seasonal.filter(id => !seasonalTopics.TOPICS[id]);
assert.deepStrictEqual(germanOnly, ["schultuete", "einschulung", "nikolaus"]);
for (const lang of ["en", ...Object.keys(i18n.LANGS)]) {
  const html = nav.topicNavSection(lang);
  assert.strictEqual(names(html).length, everywhere.length, lang);
  for (const id of germanOnly) assert.ok(!html.includes(`/${id}/`), `${lang} links German-only ${id}`);
  if (lang === "en") {
    assert.ok(links(html).includes("/en/coloring-pages/christmas-tree/") && names(html).includes("Christmas"), "en seasonal");
    assert.ok(!names(html).includes("Weihnachten"), "English nav must not show German names");
  } else {
    const cfg = i18n.LANGS[lang];
    assert.ok(links(html).every(u => u.startsWith(`/${cfg.root}/`)), lang);
    assert.deepStrictEqual(names(html), everywhere.map(id => cfg.t.topicNames[id]), `${lang} names`);
  }
}

// Seasonal slugs resolve back to their topic, and every page language has them.
assert.strictEqual(nav.topicFromSlug("en", "winter-animals"), "winteranimals");
assert.strictEqual(nav.topicFromSlug("en", "weihnachten"), null);
assert.strictEqual(nav.topicFromSlug("de", "rentier"), "reindeer");
assert.strictEqual(nav.topicFromSlug("en", "nikolaus"), null);
for (const id of Object.keys(seasonalTopics.TOPICS)) {
  const alt = nav.topicAlternates(id);
  assert.strictEqual(alt.list.length, 12, id);
  assert.ok(alt.xDefault.startsWith("https://lalabuba.com/en/coloring-pages/"), id);
  for (const lang of nav.PAGE_LANGS) {
    const cfg = i18n.pageCfg(lang);
    const o = i18n.topicT(cfg.t, id);
    assert.ok(o.topicPageH1() && o.topicPageSub() && o.topicPageTitle().endsWith("| Lalabuba"), `${lang} ${id} strings`);
  }
}
assert.strictEqual(nav.topicAlternates("nikolaus").list.length, 1);
assert.strictEqual(nav.topicAlternates("nikolaus").xDefault, null);

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
