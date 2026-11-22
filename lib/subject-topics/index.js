"use strict";
// Evergreen subject topics with a page in all 12 languages (growth plan L2, batch 1: 50 topics).
// Each batch file lists topics as
//   { id, emoji, en, slug, name, h1: "en|de|fr|es|pt|ru|it|nl|pl|tr|zh|hi", intro: [12], subj: ["en prompt|11 labels" × 6] }
// and this index turns them into the shapes lib/seasonal-topics.js already uses for the
// Christmas topics (TOPICS rows, TOPIC_META entries, subject labels), which merges them in.
// Pictures: no subject may need rendered text or digits; no brands or known characters.

const L = ["en", "de", "fr", "es", "pt", "ru", "it", "nl", "pl", "tr", "zh", "hi"];
const BATCHES = ["b1-animals-1", "b1-animals-2", "b1-animals-3", "b1-vehicles-fantasy", "b1-everyday"];

function cols(str, what, id) {
  const a = String(str).split("|");
  if (a.length !== L.length) throw new Error(`subject-topics: ${id} ${what} needs ${L.length} columns, got ${a.length}`);
  return a;
}
const row = (a) => Object.fromEntries(L.map((l, i) => [l, a[i]]));

const TOPICS = {}, META = {}, SUBJECT_LABELS = {};
for (const file of BATCHES) {
  for (const t of require(`./${file}`)) {
    if (TOPICS[t.id]) throw new Error(`subject-topics: duplicate id ${t.id}`);
    if (t.intro.length !== L.length) throw new Error(`subject-topics: ${t.id} intro needs ${L.length} entries`);
    if (t.subj.length < 6) throw new Error(`subject-topics: ${t.id} needs ≥ 6 subjects`);
    TOPICS[t.id] = {
      slug: row(cols(t.slug, "slug", t.id)), name: row(cols(t.name, "name", t.id)),
      h1: row(cols(t.h1, "h1", t.id)), intro: row(t.intro),
    };
    const subjects = t.subj.map((s) => {
      const c = cols(s, "subject", t.id);
      L.slice(1).forEach((lang, i) => { (SUBJECT_LABELS[lang] ||= {})[c[0]] = c[i + 1]; });
      return c[0];
    });
    META[t.id] = { emoji: t.emoji, name: t.en, subjects };
  }
}

module.exports = { TOPICS, META, SUBJECT_LABELS };
