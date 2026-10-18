// Topic names, slugs and the shared topic navigation for every coloring page.
const gallery = require("./gallery");
const i18n = require("./coloring-i18n");

// German slug → English topic (for gallery image injection on DE pages)
const DE_TOPIC_MAP = {
  drache: "dragon", einhorn: "unicorn", schmetterling: "butterfly",
  dinosaurier: "dinosaur", katze: "cat", prinzessin: "princess",
  meerjungfrau: "mermaid", rakete: "rocket", auto: "car",
  schultuete: "schultuete", einschulung: "einschulung",
  weihnachten: "weihnachten", nikolaus: "nikolaus",
  adventskalender: "adventskalender", schneemann: "schneemann",
};
// English topic → German slug (inverse)
const EN_TO_DE_SLUG = Object.fromEntries(Object.entries(DE_TOPIC_MAP).map(([de, en]) => [en, de]));

// German display names for topics (used in gallery section titles on static DE pages)
const DE_TOPIC_NAMES = {
  dragon: 'Drachen', unicorn: 'Einhorn', butterfly: 'Schmetterling',
  dinosaur: 'Dinosaurier', cat: 'Katze', princess: 'Prinzessin',
  mermaid: 'Meerjungfrau', rocket: 'Rakete', car: 'Auto',
  schultuete: 'Schultüte', einschulung: 'Einschulung',
  weihnachten: 'Weihnachten', nikolaus: 'Nikolaus',
  adventskalender: 'Adventskalender', schneemann: 'Schneemann',
};

// Topic name in any supported language (EN/DE/the 10 i18n languages).
function topicDisplayName(lang, enTopic) {
  if (lang === "de") return DE_TOPIC_NAMES[enTopic] || gallery.TOPIC_META[enTopic]?.name || enTopic;
  return i18n.LANGS[lang]?.t.topicNames[enTopic] || gallery.TOPIC_META[enTopic]?.name || enTopic;
}

// ── Topic navigation ─────────────────────────────────────────────────────────
// Every coloring page (hubs, topic, picture and daily pages, all languages) links
// to the same topic list, built here from TOPIC_META + the live gallery: a topic
// is listed once it has pictures, in the page's language, and only where its page
// exists (seasonal topics are German-only).

function topicPageUrl(lang, enTopic) {
  const meta = gallery.TOPIC_META[enTopic];
  if (!meta) return null;
  if (lang === "de") return EN_TO_DE_SLUG[enTopic] ? `/de/ausmalbilder/${EN_TO_DE_SLUG[enTopic]}/` : null;
  if (meta.seasonal) return null;
  if (lang === "en") return `/en/coloring-pages/${enTopic}/`;
  const cfg = i18n.LANGS[lang];
  const slug = cfg?.topicSlugs[enTopic];
  return slug ? `/${cfg.root}/${slug}/` : null;
}

// season: undefined = all topics, null = evergreen only, "christmas"/"school" = that season.
function topicsForLang(lang, { season } = {}) {
  return gallery.TOPICS
    .filter(id => season === undefined || (gallery.TOPIC_META[id].season || null) === season)
    .map(id => ({ id, emoji: gallery.TOPIC_META[id].emoji, name: topicDisplayName(lang, id), url: topicPageUrl(lang, id) }))
    .filter(t => t.url && gallery.hasImages(t.id));
}

function topicNavCards(topics, current, extraClass = "") {
  const cls = `lp-related-card${extraClass ? " " + extraClass : ""}`;
  return topics.map(t => t.id === current
    ? `<span class="${cls}" aria-current="page"><span class="lp-rel-emoji">${t.emoji}</span> ${t.name}</span>`
    : `<a href="${t.url}" class="${cls}"><span class="lp-rel-emoji">${t.emoji}</span> ${t.name}</a>`
  ).join("\n      ");
}

const TOPIC_NAV_HEADING = { en: "All Coloring Page Topics", de: "Alle Ausmalbilder-Themen" };

function topicNavSection(lang, current = null) {
  const topics = topicsForLang(lang);
  if (!topics.length) return "";
  const heading = TOPIC_NAV_HEADING[lang] || i18n.LANGS[lang]?.t.topicsHeading || TOPIC_NAV_HEADING.en;
  return `<section class="lp-section lp-topic-nav">
    <h2 class="section-heading">${heading}</h2>
    <nav class="lp-related-grid" aria-label="${heading}">
      ${topicNavCards(topics, current)}
    </nav>
  </section>`;
}

function hubCards(topics, cta) {
  return topics.map(t => `<a href="${t.url}" class="lp-hub-card">
        <span class="lp-hub-emoji">${t.emoji}</span>
        <span class="lp-hub-name">${t.name}</span>
        <span class="lp-hub-cta">${cta}</span>
      </a>`).join("\n      ");
}

// Static EN/DE pages carry <!--topic-nav[:variant]--> markers where these lists go.
function fillTopicMarkers(html, lang, current = null) {
  const abs = t => `https://lalabuba.com${t.url}`;
  const deHub = ["christmas", "school", null].flatMap(season => topicsForLang("de", { season }));
  return html
    .replace('"__TOPIC_PARTS__"', () => JSON.stringify(topicsForLang(lang, { season: null })
      .map(t => ({ "@type": "WebPage", name: `${t.name} Coloring Pages`, url: abs(t) }))))
    .replace('"__TOPIC_ITEMS__"', () => JSON.stringify(deHub
      .map((t, i) => ({ "@type": "ListItem", position: i + 1, name: `${t.name} Ausmalbilder`, url: abs(t) }))))
    .replace("<!--topic-nav-->", () => topicNavSection(lang, current))
    .replace("<!--topic-hub-cards-->", () => hubCards(topicsForLang(lang, { season: null }), lang === "de" ? "Ausmalen →" : "Generate →"))
    .replace(/<!--topic-cards:(evergreen|christmas|school)-->/g, (_, s) =>
      topicNavCards(topicsForLang(lang, { season: s === "evergreen" ? null : s }), null, s === "evergreen" ? "" : "lp-related-card--featured"));
}

module.exports = {
  DE_TOPIC_MAP, EN_TO_DE_SLUG, DE_TOPIC_NAMES,
  topicDisplayName, topicPageUrl, topicsForLang, topicNavSection, hubCards, fillTopicMarkers,
};
