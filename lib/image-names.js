"use strict";
// Descriptive picture URLs in the page's language (growth plan L3, image SEO):
//   /img/p/<topic slug>/<topic slug>-<picture slug>.<ext>   e.g. /img/p/araba/araba-sporty-hard.png
// The topic slug is the one in that language's topic-page URL, so the file name reads like
// the search ("araba", "kolorowanki samochod", "hund"). They resolve to the stored library
// file (/img/g/…). Print, save, the app and the API keep using entry.url.
const gallery = require("./gallery");

function nav() { return require("./topic-nav"); } // lazy: topic-nav requires gallery too

const lastSeg = (u) => u.split("/").filter(Boolean).pop();
const extOf = (url) => (/\.(jpe?g|png)$/i.exec(url || "") || [, "png"])[1].toLowerCase();

/** Descriptive URL for a library picture as shown on the `lang` page of `topic`, or null. */
function pictureUrl(lang, topic, entry) {
  if (!entry || !entry.slug || !entry.url) return null;
  const page = nav().topicPageUrl(lang, topic);
  if (!page) return null;
  const t = lastSeg(page);
  return `/img/p/${t}/${t}-${entry.slug}.${extOf(entry.url)}`;
}

/** The library entry behind a descriptive URL's (topic slug, file name), or null. */
function resolve(topicSlug, file) {
  const { topicPageUrl, PAGE_LANGS } = nav();
  if (!file.startsWith(topicSlug + "-")) return null;
  const m = /^(.+)\.(png|jpe?g)$/i.exec(file.slice(topicSlug.length + 1));
  if (!m) return null;
  for (const topic of gallery.TOPICS) {
    if (!PAGE_LANGS.some((l) => { const u = topicPageUrl(l, topic); return u && lastSeg(u) === topicSlug; })) continue;
    const all = gallery.getAllForTopic(topic);
    for (const d of ["easy", "medium", "hard"]) {
      const e = (all[d] || []).find((x) => x.slug === m[1]);
      if (e && extOf(e.url) === m[2].toLowerCase()) return e;
    }
  }
  return null;
}

module.exports = { pictureUrl, resolve };
