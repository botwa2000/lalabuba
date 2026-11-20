"use strict";
// Landing-page → colouring canvas helpers for the SEO pages (hubs, topic pages).
// Search visitors arrive on these pages wanting a picture to colour. The one
// obvious action is "colour a picture now": a single tap that opens a library
// picture on the canvas (/?s=1&img=… loads it directly, no generation wait).
// Generating a new picture stays available further down as the secondary path.

// Labels are generic on purpose (no topic noun) so no language needs grammatical
// case/gender agreement with a topic name.
const STRINGS = {
  en: { colorNow: "🎨 Color a picture now →",          pick: "🎨 Pick a picture to color ↓",          ready: "Ready to color — tap a picture",             colorThis: "Color this →" },
  de: { colorNow: "🎨 Jetzt ein Bild ausmalen →",       pick: "🎨 Bild zum Ausmalen wählen ↓",         ready: "Sofort ausmalen — tippe ein Bild an",        colorThis: "Ausmalen →" },
  fr: { colorNow: "🎨 Colorier un dessin maintenant →", pick: "🎨 Choisir un dessin à colorier ↓",     ready: "Prêts à colorier — touche un dessin",        colorThis: "Colorier →" },
  es: { colorNow: "🎨 Colorear un dibujo ahora →",      pick: "🎨 Elige un dibujo para colorear ↓",    ready: "Listos para colorear — toca un dibujo",      colorThis: "Colorear →" },
  pt: { colorNow: "🎨 Colorir um desenho agora →",      pick: "🎨 Escolha um desenho para colorir ↓",  ready: "Prontos para colorir — toque em um desenho", colorThis: "Colorir →" },
  ru: { colorNow: "🎨 Раскрасить картинку сейчас →",    pick: "🎨 Выбрать раскраску ↓",                ready: "Готовые раскраски — нажми на картинку",      colorThis: "Раскрасить →" },
  it: { colorNow: "🎨 Colora un disegno ora →",         pick: "🎨 Scegli un disegno da colorare ↓",    ready: "Pronti da colorare — tocca un disegno",      colorThis: "Colorare →" },
  nl: { colorNow: "🎨 Nu een kleurplaat inkleuren →",   pick: "🎨 Kies een kleurplaat ↓",              ready: "Klaar om in te kleuren — tik op een plaatje", colorThis: "Kleuren →" },
  pl: { colorNow: "🎨 Pokoloruj obrazek teraz →",       pick: "🎨 Wybierz obrazek do kolorowania ↓",   ready: "Gotowe do kolorowania — dotknij obrazka",    colorThis: "Kolorować →" },
  tr: { colorNow: "🎨 Hemen bir resim boya →",          pick: "🎨 Boyamak için bir resim seç ↓",       ready: "Boyamaya hazır — bir resme dokun",           colorThis: "Boyama →" },
  zh: { colorNow: "🎨 立即涂色 →",                       pick: "🎨 选一张图来涂色 ↓",                    ready: "现成涂色页 — 点一张开始",                     colorThis: "涂色 →" },
  hi: { colorNow: "🎨 अभी एक चित्र में रंग भरें →",       pick: "🎨 रंग भरने के लिए चित्र चुनें ↓",          ready: "रंग भरने के लिए तैयार — किसी चित्र पर टैप करें", colorThis: "रंग भरें →" },
};

const READY_ID = "ready-to-color";

function strings(lang) {
  return STRINGS[lang] || STRINGS.en;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Canvas link that opens this exact library picture (no generation). */
function colorHref(entry, difficulty) {
  return `/?s=1&img=${encodeURIComponent(entry.url)}&q=${encodeURIComponent(entry.subject || "")}&d=${difficulty || "easy"}`;
}

/** First picture of a topic, easiest first: { entry, difficulty } or null. */
function firstPicture(topicImages) {
  for (const d of ["easy", "medium", "hard"]) {
    const e = (topicImages?.[d] || [])[0];
    if (e) return { entry: e, difficulty: d };
  }
  return null;
}

// Hero = <div class="lp-hero"> … up to the first <div class="legal-content">.
function heroBounds(html) {
  const start = html.indexOf('<div class="lp-hero"');
  if (start === -1) return null;
  const end = html.indexOf('<div class="legal-content', start);
  if (end === -1) return null;
  return { start, end };
}

/** Point the hero's primary button somewhere else (first .lp-cta in the hero only). */
function retargetHeroCta(html, href, label) {
  const b = heroBounds(html);
  if (!b) return html;
  const hero = html.slice(b.start, b.end);
  const re = /<a href="[^"]*" class="lp-cta">[^<]*<\/a>/;
  if (!re.test(hero)) return html;
  const next = hero.replace(re, () => `<a href="${esc(href)}" class="lp-cta">${esc(label)}</a>`);
  return html.slice(0, b.start) + next + html.slice(b.end);
}

/** Insert a section as the first thing inside the content right below the hero. */
function injectAfterHero(html, sectionHtml) {
  const b = heroBounds(html);
  if (!b) return null;
  const open = html.indexOf(">", b.end);
  if (open === -1) return null;
  return html.slice(0, open + 1) + "\n" + sectionHtml + "\n" + html.slice(open + 1);
}

module.exports = { STRINGS, READY_ID, strings, colorHref, firstPicture, retargetHeroCta, injectAfterHero, esc };
