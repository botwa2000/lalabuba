"use strict";
// Search-snippet rewrites for the pages Google shows most (growth plan L1b, 2026-11-22).
// Source: the 30 pages with the most impressions over 30 days in Search Console, each
// rewritten in its own language to lead with the query people actually searched
// ("zor araba boyama", "laweta kolorowanka", "ausmalbild abschleppwagen"), then
// "free printable / print or colour online". Titles ≤ 60 chars, descriptions ≤ 155.
// Before/after + CTR are logged in docs/GROWTH-PLAN.md; re-measured at CP2.
// Applied centrally by serveHtml (server.js) to <title>, meta description and og:*.

const O = {
  // ── Türkçe ──
  "/boyama-sayfalari/roket/": ["Roket Boyama Sayfaları — Ücretsiz Yazdır veya Online Boya",
    "Ücretsiz roket boyama sayfaları: yazdır ya da hemen online boya. Kolay, orta ve zor seviye uzay temalı resimler. Kayıt gerekmez."],
  "/boyama-sayfalari/unicorn/": ["Tek Boynuzlu At Boyama — Ücretsiz Yazdır veya Online Boya",
    "Ücretsiz tek boynuzlu at (unicorn) boyama sayfaları: yazdır ya da online boya. Kolay, orta ve zor seviye. Kayıt gerekmez."],
  "/boyama-sayfalari/unicorn/unicorn-hard/": ["Zor Unicorn Boyama: Tek Boynuzlu At — Ücretsiz Yazdır",
    "Zor unicorn boyama sayfası: gökkuşağının üzerinden atlayan tek boynuzlu at, detaylı çizim. Ücretsiz yazdır ya da online boya."],
  "/boyama-sayfalari/kedi/": ["Kedi Boyama Sayfaları — Ücretsiz Yazdır veya Online Boya",
    "Ücretsiz kedi boyama: sevimli yavru kediler ve oyuncu kediler. Kolay, orta ve zor seviye; yazdır ya da online boya, kayıt gerekmez."],
  "/boyama-sayfalari/dinozor/t-rex-medium/": ["T-Rex Boyama Sayfası (Orta) — Ücretsiz Yazdır, Online Boya",
    "Ücretsiz t rex boyama sayfası: sevimli yavru T-Rex, orta seviye. Hemen yazdır ya da tarayıcıda online boya — kayıt gerekmez."],
  "/boyama-sayfalari/ejderha/dragon-hard-7/": ["Zor Ejderha Boyama (Dragon) — Ücretsiz Yazdır, Online Boya",
    "Zor ejderha boyama sayfası: küçük, dost canlısı ejderha, detaylı çizim. Ücretsiz yazdır ya da online boya — kayıt gerekmez."],
  "/boyama-sayfalari/araba/": ["Araba Boyama Sayfaları — Kolay ve Zor, Ücretsiz Yazdır",
    "Ücretsiz araba boyama: yarış arabası, çekici, arazi aracı, canavar kamyon. Kolay, orta ve zor seviye; yazdır ya da online boya."],
  "/boyama-sayfalari/araba/sporty-hard/": ["Zor Araba Boyama: Yarış Arabası — Ücretsiz Yazdır",
    "Zor araba boyama sayfası: çizgili, rüzgârlıklı yarış arabası, ince detaylı. Ücretsiz yazdır ya da online boya. Büyük çocuklar için."],
  "/boyama-sayfalari/araba/off-road-hard/": ["Zor Araba Boyama: Arazi Arabası — Ücretsiz Yazdır",
    "Zor arazi arabası boyama sayfası: ormanda arazi aracı, ince detaylı. Ücretsiz yazdır ya da online boya. Büyük çocuklar için."],
  "/boyama-sayfalari/araba/cartoon-hard/": ["Zor Araba Boyama: Neşeli Araba — Ücretsiz Yazdır",
    "Zor araba boyama sayfası: kocaman tekerlekli neşeli araba, detaylı çizim. Ücretsiz yazdır ya da online boya — kayıt gerekmez."],
  "/boyama-sayfalari/araba/off-road-easy/": ["Arazi Arabası Boyama (Kolay) — Ücretsiz Yazdır, Online Boya",
    "Kolay arazi arabası boyama: ormanda off road araç, kalın çizgiler, küçük çocuklar için. Ücretsiz yazdır ya da online boya."],
  "/boyama-sayfalari/araba/tow-medium/": ["Çekici Boyama Sayfası (Orta) — Ücretsiz Yazdır, Online Boya",
    "Ücretsiz çekici boyama sayfası: küçük arabayı çeken çekici, orta seviye. Hemen yazdır ya da online boya — kayıt gerekmez."],
  "/boyama-sayfalari/araba/convertible-hard/": ["Üstü Açık Araba Boyama (Zor) — Ücretsiz Yazdır, Online Boya",
    "Ücretsiz üstü açık araba boyama: deniz kenarında cabrio araba, zor seviye detaylı çizim. Yazdır ya da online boya — kayıt gerekmez."],
  "/boyama-sayfalari/araba/monster-easy/": ["Canavar Kamyon Boyama (Kolay) — Monster Truck, Ücretsiz",
    "Kolay canavar araba boyama: dev tekerlekli monster truck, kalın çizgiler. Ücretsiz yazdır ya da online boya — küçük çocuklar için."],
  "/boyama-sayfalari/araba/monster-medium/": ["Canavar Kamyon Boyama (Orta) — Ücretsiz Yazdır, Online Boya",
    "Ücretsiz canavar kamyon boyama sayfası: dev tekerlekli monster truck, orta seviye. Yazdır ya da online boya — kayıt gerekmez."],
  // ── Deutsch ──
  "/de/ausmalbilder/": ["KI Ausmalbild Generator – Malvorlagen kostenlos erstellen",
    "Ausmalbild erstellen mit KI: Wort eingeben, kostenlose Malvorlage bekommen. Sofort ausdrucken oder online ausmalen – ohne Anmeldung."],
  "/de/ausmalbilder/katze/": ["Ausmalbilder Katzen kostenlos – drucken oder online malen",
    "Katzen Ausmalbilder kostenlos: süße Kätzchen und verspielte Katzen zum Ausdrucken oder online Ausmalen. Einfach, mittel, schwer."],
  "/de/ausmalbilder/rakete/": ["Rakete Ausmalbild kostenlos – drucken oder online malen",
    "Raketen Ausmalbilder kostenlos: Raketen, Planeten und Astronauten zum Ausdrucken oder online Ausmalen. Einfach, mittel und schwer."],
  "/de/ausmalbilder/drache/": ["Drachen Ausmalbilder kostenlos – drucken oder online malen",
    "Drachen Ausmalbilder kostenlos: von Baby-Drachen bis Feuerdrachen, zum Ausdrucken oder online Ausmalen. Einfach, mittel und schwer."],
  "/de/ausmalbilder/prinzessin/": ["Prinzessin Ausmalbild kostenlos – drucken oder online malen",
    "Prinzessin Ausmalbilder kostenlos: Schloss, Krone und Zauberstab. Als Arbeitsblatt ausdrucken oder online ausmalen – ohne Anmeldung."],
  "/de/ausmalbilder/auto/tow-easy/": ["Ausmalbild Abschleppwagen (einfach) – kostenlos ausdrucken",
    "Abschleppwagen Ausmalbild kostenlos: Abschleppwagen mit kleinem Auto, einfach für Kleine. Ausdrucken oder online ausmalen."],
  // ── Polski ──
  "/kolorowanki/samochod/": ["Kolorowanki Samochody — Darmowe do Druku i Online",
    "Darmowe kolorowanki samochody do druku: wyścigówka, laweta, kamper, terenówka. Wydrukuj albo koloruj online — bez rejestracji."],
  "/kolorowanki/samochod/tow-easy/": ["Laweta Kolorowanka (Łatwa) — Darmowa do Druku i Online",
    "Darmowa kolorowanka laweta: laweta holująca mały samochodzik, łatwy poziom dla maluchów. Wydrukuj albo koloruj online."],
  "/kolorowanki/samochod/camper-hard/": ["Kamper Kolorowanka (Trudna) — Darmowa do Druku i Online",
    "Darmowa kolorowanka kamper: kamper nad jeziorem, trudny poziom z wieloma detalami. Wydrukuj albo koloruj online — bez rejestracji."],
  // ── Русский ──
  "/raskraski/rusalka/": ["Раскраска Русалка — распечатать бесплатно или онлайн",
    "Раскраски русалки для детей: бесплатно распечатать или раскрасить онлайн. Лёгкие, средние и сложные картинки, без регистрации."],
  // ── Italiano ──
  "/disegni-da-colorare/auto/cartoon-hard/": ["Macchinina da Colorare (Difficile) — Gratis da Stampare",
    "Disegno macchinina da colorare gratis: macchinina allegra con ruote grandi, livello difficile. Stampa o colora online."],
  // ── Nederlands ──
  "/kleurplaten/auto/": ["Kleurplaat Auto — Gratis Kleurplaten Printen of Online",
    "Gratis auto kleurplaten: raceauto, takelwagen, camper, jeep en monstertruck. Printen of online kleuren, zonder account."],
  "/kleurplaten/auto/off-road-easy/": ["Kleurplaat Jeep — Gratis Printen of Online Kleuren",
    "Gratis kleurplaat jeep: een jeep in de jungle, makkelijk voor kleuters. Print hem uit of kleur online — zonder account."],
  // ── English ──
  "/en/coloring-pages/dinosaur/": ["Dinosaur Coloring Pages — Free Printable or Color Online",
    "Free printable dinosaur coloring pages for kids: T-Rex, Triceratops, Brachiosaurus and more. Print or color online, no sign-up."],
  "/en/coloring-pages/cat/": ["Cat Coloring Pages — Free Printable or Color Online",
    "Free printable cat coloring pages for kids: fluffy kittens and playful cats. Print or color online — easy, medium and hard."],
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function normPath(url) {
  let p = String(url || "").split(/[?#]/)[0];
  try { p = decodeURIComponent(p); } catch { /* keep raw */ }
  return p.endsWith("/") ? p : p + "/";
}

function forPath(url) {
  const o = O[normPath(url)];
  return o ? { title: o[0], desc: o[1] } : null;
}

// Rewrites title, meta description and og:title/og:description when the path has an override.
function apply(html, url) {
  if (typeof html !== "string") return html;
  const o = forPath(url);
  if (!o) return html;
  const t = esc(o.title), d = esc(o.desc);
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}"/>`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${t}"/>`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}"/>`);
}

module.exports = { apply, forPath, OVERRIDES: O };
