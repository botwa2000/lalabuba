"use strict";
// Landing page → canvas helpers, picture labels and the sitemap.
// Runs without the server's data/gallery.json (CI): library-dependent parts use
// fixtures; the sitemap check only needs public/sitemap.xml.
const assert = require("assert");
const gallery = require("../lib/gallery");
const landing = require("../lib/landing");
const { SUBJECT_LABELS } = require("../lib/subject-labels");
const i18n = require("../lib/coloring-i18n");
const usage = require("../lib/usage");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

t("every topic subject has a label in every page language", () => {
  const langs = ["de", ...Object.keys(i18n.LANGS)];
  for (const [topic, meta] of Object.entries(gallery.TOPIC_META)) {
    if (meta.seasonal && !require("../lib/seasonal-topics").TOPICS[topic]) continue; // German-only pages
    for (const s of meta.subjects || []) for (const l of langs)
      assert(gallery.subjectLabel(l, s) !== s, `${topic}: "${s}" has no ${l} label`);
  }
  for (const l of Object.keys(SUBJECT_LABELS)) for (const v of Object.values(SUBJECT_LABELS[l])) assert(v && v.trim() === v, `${l}: empty/padded label`);
});

t("pictures sharing a subject get distinct numbers, others none", () => {
  const list = [
    { slug: "cat-easy-7", subject: "fluffy cat sitting" },
    { slug: "cat-easy-6", subject: "fluffy cat sitting" },
    { slug: "kitten-easy", subject: "kitten playing with yarn" },
    { slug: "kitten-easy-3", subject: "kitten playing with yarn" },
    { slug: "cat-easy-5", subject: "cat chasing a butterfly" },
  ];
  const out = gallery._withVariants(list);
  const v = Object.fromEntries(out.map(e => [e.slug, e.variant]));
  assert.deepStrictEqual(v, { "cat-easy-7": 2, "cat-easy-6": undefined, "kitten-easy": undefined, "kitten-easy-3": 2, "cat-easy-5": undefined });
  assert.deepStrictEqual(out.map(e => e.slug), list.map(e => e.slug), "order kept");
});

t("canvas link opens the exact library picture", () => {
  const href = landing.colorHref({ url: "/img/g/cat-easy-1.png", subject: "fluffy cat" }, "hard");
  assert.strictEqual(href, "/?s=1&img=%2Fimg%2Fg%2Fcat-easy-1.png&q=fluffy%20cat&d=hard");
  assert(!/seed=/.test(href), "never looks like a challenge link");
  assert.deepStrictEqual(landing.firstPicture({ easy: [], medium: [{ url: "m" }] }), { entry: { url: "m" }, difficulty: "medium" });
  assert.strictEqual(landing.firstPicture({}), null);
});

const page = `<nav></nav><div class="lp-hero"><div class="lp-hero-inner"><a href="/?s=1&q=cat&d=easy" class="lp-cta">Generate →</a></div></div>
<div class="legal-content lp-wide"><p>article</p><a href="/?s=1&q=cat&d=easy" class="lp-cta">Generate again →</a></div><footer></footer>`;
t("hero button retargeted, later buttons untouched", () => {
  const out = landing.retargetHeroCta(page, "/?s=1&img=x&q=a&d=easy", "🎨 Color now →");
  assert(out.includes('<a href="/?s=1&amp;img=x&amp;q=a&amp;d=easy" class="lp-cta">🎨 Color now →</a></div></div>'));
  assert(out.includes('class="lp-cta">Generate again →'), "bottom generate button kept");
  assert.strictEqual(landing.retargetHeroCta("<p>no hero</p>", "/x", "y"), "<p>no hero</p>");
});
t("pictures inserted right under the hero", () => {
  const out = landing.injectAfterHero(page, "<section>PICS</section>");
  assert(out.indexOf("PICS") > out.indexOf('class="legal-content') && out.indexOf("PICS") < out.indexOf("article"));
  assert.strictEqual(landing.injectAfterHero("<p>x</p>", "s"), null);
});
t("every page language has the landing strings", () => {
  for (const l of ["en", "de", ...Object.keys(i18n.LANGS)]) {
    const s = landing.STRINGS[l];
    assert(s && s.colorNow && s.pick && s.ready && s.colorThis, l);
  }
});

t("landing path prop: site paths only, trailing slash dropped", () => {
  const c = (v) => usage._cleanProps({ lp: v });
  assert.deepStrictEqual(c("/boyama-sayfalari/araba/monster-easy/"), { lp: "/boyama-sayfalari/araba/monster-easy" });
  assert.deepStrictEqual(c("(direct)"), { lp: "(direct)" });
  for (const bad of ["https://evil.example/x", "/a?b=1", "/<script>", "x", 7]) assert.strictEqual(c(bad), null, String(bad));
  for (const e of ["page_cta_open", "picture_open", "first_fill", "complete"]) assert(usage.EVENTS.has(e), e);
});

t("sitemap is well-formed, keeps the static pages, has no duplicates", () => {
  const xml = require("../lib/sitemap")._build();
  assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert(xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.strictEqual(new Set(locs).size, locs.length, "duplicate <loc>");
  for (const must of ["https://lalabuba.com/", "https://lalabuba.com/kolorowanki/", "https://lalabuba.com/en/coloring-pages/cat/"]) assert(locs.includes(must), must);
  assert(locs.every(l => l.startsWith("https://lalabuba.com/")));
  assert.strictEqual((xml.match(/<url>/g) || []).length, (xml.match(/<\/url>/g) || []).length);
});

console.log(`\nlanding-seo: ${n} passed`);
