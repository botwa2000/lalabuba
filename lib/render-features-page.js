'use strict';

const { FEATURES_LANGS } = require('./features-content');
const { buildNav } = require('./lp-nav-component');

const FEAT_LANGS_LIST = ['en','de','fr','es','pt','ru','it','nl','pl','tr','zh','hi'];
const HREFLANG_MAP = Object.fromEntries(
  FEAT_LANGS_LIST.map(l => [l, `https://lalabuba.com/${l}/features`])
);

const FAQ_BLURB = {
  en: 'Get answers to the most common questions about drawing, coloring, printing, family groups, and more.',
  de: 'Antworten auf die häufigsten Fragen zu Zeichnen, Ausmalen, Drucken, Familiengruppen und mehr.',
  fr: 'Réponses aux questions les plus courantes sur le dessin, le coloriage, l\'impression, les groupes familiaux et plus encore.',
  es: 'Respuestas a las preguntas más frecuentes sobre dibujo, colorear, imprimir, grupos familiares y más.',
  pt: 'Respostas às perguntas mais comuns sobre desenho, colorir, imprimir, grupos familiares e muito mais.',
  ru: 'Ответы на самые распространённые вопросы о рисовании, раскрашивании, печати, семейных группах и не только.',
  it: 'Risposte alle domande più comuni su disegno, colorazione, stampa, gruppi familiari e altro ancora.',
  nl: 'Antwoorden op de meest gestelde vragen over tekenen, kleuren, afdrukken, familiegroepen en meer.',
  pl: 'Odpowiedzi na najczęstsze pytania dotyczące rysowania, kolorowania, drukowania, grup rodzinnych i innych.',
  tr: 'Çizim, boyama, yazdırma, aile grupları ve daha fazlası hakkındaki en sık sorulan soruların yanıtları.',
  zh: '获取有关绘画、涂色、打印、家庭群组等最常见问题的解答。',
  hi: 'ड्राइंग, रंग भरने, प्रिंटिंग, पारिवारिक समूहों और अधिक के बारे में सबसे सामान्य प्रश्नों के उत्तर पाएं।',
};

const FAQ_BTN = {
  en: 'Browse all 80 questions →',
  de: 'Alle 80 Fragen ansehen →',
  fr: 'Voir les 80 questions →',
  es: 'Ver las 80 preguntas →',
  pt: 'Ver as 80 perguntas →',
  ru: 'Все 80 вопросов →',
  it: 'Vedi tutte le 80 domande →',
  nl: 'Bekijk alle 80 vragen →',
  pl: 'Zobacz wszystkie 80 pytań →',
  tr: 'Tüm 80 soruyu gör →',
  zh: '浏览全部 80 个问题 →',
  hi: 'सभी 80 प्रश्न देखें →',
};

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFeaturesPage(lang) {
  const t = FEATURES_LANGS[lang] || FEATURES_LANGS.en;
  const activeLang = FEATURES_LANGS[lang] ? lang : 'en';
  const navHtml = buildNav({ lang: activeLang, breadcrumbs: [{ label: t.h1 }], hreflangMap: HREFLANG_MAP });

  const hreflangTags = FEAT_LANGS_LIST.map(l =>
    `  <link rel="alternate" hreflang="${l === 'zh' ? 'zh-Hans' : l}" href="https://lalabuba.com/${l}/features"/>`
  ).concat(['  <link rel="alternate" hreflang="x-default" href="https://lalabuba.com/en/features"/>'])
  .join('\n');

  const stepsHtml = t.steps.map(s => `
      <li class="step-item">
        <div class="step-num">${esc(s.num)}</div>
        <div class="step-body"><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p></div>
      </li>`).join('');

  const featHtml = t.features.map(f => `
      <div class="feat-card">
        <span class="feat-icon">${f.icon}</span>
        <h3>${esc(f.title)}</h3>
        <p>${esc(f.desc)}</p>
      </div>`).join('');

  return `<!doctype html>
<html lang="${esc(t.htmlLang)}">
<head>
  <meta charset="utf-8"/>
  <script>(function(){var t=localStorage.getItem('lalabuba-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}})();</script>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(t.title)}</title>
  <meta name="description" content="${esc(t.description)}"/>
  <link rel="canonical" href="https://lalabuba.com/${activeLang}/features"/>
${hreflangTags}
  <meta property="og:title" content="${esc(t.h1)}"/>
  <meta property="og:description" content="${esc(t.description)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="https://lalabuba.com/${activeLang}/features"/>
  <meta property="og:image" content="https://lalabuba.com/og-image.png"/>
  <meta property="og:site_name" content="Lalabuba"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${esc(t.h1)}"/>
  <meta name="twitter:description" content="${esc(t.description)}"/>
  <meta name="twitter:image" content="https://lalabuba.com/og-image.png"/>
  <meta name="theme-color" content="#7c4dff"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="icon" href="/favicon.png" type="image/png"/>
  <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
  <link rel="stylesheet" href="/css/legal.css"/>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Lalabuba","item":"https://lalabuba.com/"},{"@type":"ListItem","position":2,"name":"Features","item":"https://lalabuba.com/${activeLang}/features"}]}
  </script>
  <script type="module" src="/js/lp-nav.js"></script>
</head>
<body>

${navHtml}

<div class="lp-hero">
  <div class="lp-hero-inner">
    <span class="lp-hero-emoji">🎨</span>
    <h1>${esc(t.h1)}</h1>
    <p class="lp-hero-desc">${esc(t.heroDesc)}</p>
    <a href="/" class="lp-cta">${esc(t.heroCta)}</a>
  </div>
</div>

<div class="legal-content">

  <section class="lp-section">
    <h2 class="section-heading">${esc(t.stepsHeading)}</h2>
    <p class="section-sub">${esc(t.stepsSub)}</p>
    <ol class="steps-list">${stepsHtml}
    </ol>
  </section>

  <section class="lp-section">
    <h2 class="section-heading">${esc(t.featuresHeading)}</h2>
    <p class="section-sub">${esc(t.featuresSub)}</p>
    <div class="feat-grid">${featHtml}
    </div>
  </section>

  <section class="lp-section">
    <h2 class="section-heading">${esc(t.badgesHeading)}</h2>
    <p class="section-sub">${esc(t.badgesSub)}</p>
    <div class="badge-row">
      <a href="https://apps.apple.com/app/id6761691648" class="app-badge" target="_blank" rel="noopener noreferrer" aria-label="Download on the App Store">
        <svg class="app-badge-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        <div class="app-badge-text">
          <span class="app-badge-sub">Download on the</span>
          <span class="app-badge-title">App Store</span>
        </div>
      </a>
      <a href="https://play.google.com/store/apps/details?id=com.lalabuba.lalabuba" class="app-badge app-badge-google" target="_blank" rel="noopener noreferrer" aria-label="Get it on Google Play">
        <svg class="app-badge-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.18 23.76c.37.2.8.2 1.18 0l11.06-6.4-2.48-2.5-9.76 8.9zm-1.1-1.04V1.28L13.5 12 2.08 22.72zM20.3 10.6l-2.5-1.45-2.8 2.83 2.8 2.82 2.52-1.46a1.94 1.94 0 000-2.74zM4.36.24L15.42 6.64l-2.48 2.5L3.18.24a1.34 1.34 0 00-1.18 0z"/></svg>
        <div class="app-badge-text">
          <span class="app-badge-sub">Get it on</span>
          <span class="app-badge-title">Google Play</span>
        </div>
      </a>
    </div>
  </section>

  <section class="lp-section" style="text-align:center">
    <h2 class="section-heading">${esc(t.faqHeading)}</h2>
    <p class="section-sub">${esc(FAQ_BLURB[activeLang] || FAQ_BLURB.en)}</p>
    <a href="/${activeLang}/faq" class="lp-cta">${esc(FAQ_BTN[activeLang] || FAQ_BTN.en)}</a>
  </section>

  <section class="lp-section" style="text-align:center">
    <h2 class="section-heading">${esc(t.ctaHeading)}</h2>
    <p class="section-sub">${esc(t.ctaSub)}</p>
    <a href="/" class="lp-cta">${esc(t.ctaBtn)}</a>
    <p style="margin-top:14px; font-size:0.85rem; color:var(--lp-muted)">
      ${esc(t.ctaOr)} <a href="/coloring-pages/">${esc(t.ctaColoringPages)}</a>
    </p>
  </section>

</div>

<footer class="legal-footer">
  <span>&copy; 2026 Lalabuba</span>
  <span class="sep">&middot;</span>
  <a href="/about">About</a>
  <span class="sep">&middot;</span>
  <a href="/coloring-pages/">Coloring Pages</a>
  <span class="sep">&middot;</span>
  <a href="/privacy">Privacy</a>
  <span class="sep">&middot;</span>
  <a href="/terms">Terms</a>
  <span class="sep">&middot;</span>
  <a href="/contact">Contact</a>
  <span class="sep">&middot;</span>
  <a href="/${activeLang}/faq">FAQ</a>
</footer>

</body>
</html>`;
}

module.exports = { renderFeaturesPage, FEAT_LANGS_LIST };
