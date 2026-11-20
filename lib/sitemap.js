"use strict";
// /sitemap.xml, built from the live picture library on each request (cached
// briefly). Until 2026-11 it was a static file with 55 URLs: no picture pages,
// no translated topic pages, so Google only found those by following links.
//
// Contents: every URL of public/sitemap.xml (home, language roots, hubs,
// legal/info pages) + every topic page and every picture page in every
// language that has one. Each topic/picture URL lists its language
// alternates (xhtml:link), matching the hreflang tags on the page itself.

const fs = require("fs");
const path = require("path");
const gallery = require("./gallery");
const i18n = require("./coloring-i18n");
const { topicPageUrl } = require("./topic-nav");

const ORIGIN = "https://lalabuba.com";
const STATIC_FILE = path.join(__dirname, "../public/sitemap.xml");
const CACHE_MS = 10 * 60 * 1000;
const LANGS = ["en", "de", ...Object.keys(i18n.LANGS)];

let cache = null;

const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hreflangOf = (lang) => (lang === "en" || lang === "de" ? lang : i18n.LANGS[lang].htmlLang);

function staticEntries() {
  try {
    const xml = fs.readFileSync(STATIC_FILE, "utf8");
    return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
      loc: (/<loc>([^<]+)<\/loc>/.exec(body) || [])[1],
      lastmod: (/<lastmod>([^<]+)<\/lastmod>/.exec(body) || [])[1],
      priority: (/<priority>([^<]+)<\/priority>/.exec(body) || [])[1],
    })).filter(e => e.loc);
  } catch { return []; }
}

/** All topic + picture URL groups: [{ urls: { lang: absUrl }, lastmod, priority }]. */
function libraryGroups() {
  const groups = [];
  for (const topic of gallery.TOPICS) {
    const images = gallery.getAllForTopic(topic);
    const entries = ["easy", "medium", "hard"].flatMap(d => images[d] || []);
    if (!entries.length) continue;
    const topicUrls = {};
    for (const lang of LANGS) {
      const u = topicPageUrl(lang, topic);
      if (u) topicUrls[lang] = u;
    }
    if (!Object.keys(topicUrls).length) continue;
    const newest = entries.map(e => e.date).filter(Boolean).sort().pop();
    groups.push({ urls: topicUrls, lastmod: newest, priority: "0.8" });
    for (const e of entries) {
      if (!e.slug) continue;
      const urls = {};
      for (const [lang, base] of Object.entries(topicUrls)) urls[lang] = `${base}${e.slug}/`;
      groups.push({ urls, lastmod: e.date, priority: "0.6" });
    }
  }
  return groups;
}

function urlXml(loc, { lastmod, priority, alternates } = {}) {
  let x = `  <url><loc>${xmlEsc(loc)}</loc>`;
  if (lastmod) x += `<lastmod>${xmlEsc(lastmod)}</lastmod>`;
  if (priority) x += `<priority>${priority}</priority>`;
  if (alternates) {
    for (const [lang, u] of alternates) x += `\n    <xhtml:link rel="alternate" hreflang="${hreflangOf(lang)}" href="${xmlEsc(ORIGIN + u)}"/>`;
    // Same x-default rule as the pages: English when it exists.
    const en = alternates.find(([l]) => l === "en");
    if (en) x += `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEsc(ORIGIN + en[1])}"/>`;
  }
  return x + `</url>`;
}

function build() {
  const seen = new Set();
  const out = [];
  for (const e of staticEntries()) {
    if (seen.has(e.loc)) continue;
    seen.add(e.loc);
    out.push(urlXml(e.loc, e));
  }
  for (const g of libraryGroups()) {
    const alternates = Object.entries(g.urls);
    const multi = alternates.length > 1 ? alternates : null;
    for (const [, u] of alternates) {
      const loc = ORIGIN + u;
      if (seen.has(loc)) continue;
      seen.add(loc);
      out.push(urlXml(loc, { lastmod: g.lastmod, priority: g.priority, alternates: multi }));
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${out.join("\n")}
</urlset>
`;
}

function sitemapXml() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.xml;
  cache = { at: Date.now(), xml: build() };
  return cache.xml;
}

module.exports = { sitemapXml, _build: build };
