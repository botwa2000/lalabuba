'use strict';

const { FAQ_LANGS } = require('./faq-content');
const { buildNav } = require('./lp-nav-component');

const FAQ_LANG_LIST = ['en','de','fr','es','pt','ru','it','nl','pl','tr','zh','hi'];
const CAT_ORDER = ['start','draw','options','print','daily','community','challenge','family','journal','settings','privacy','tech'];

const HREFLANG_MAP = Object.fromEntries(
  FAQ_LANG_LIST.map(l => [l, `https://lalabuba.com/${l}/faq`])
);

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function renderFaqPage(lang) {
  const t = FAQ_LANGS[lang] || FAQ_LANGS.en;
  const activeLang = FAQ_LANGS[lang] ? lang : 'en';
  const canon = `https://lalabuba.com/${activeLang}/faq`;

  const navHtml = buildNav({ lang: activeLang, breadcrumbs: [{ label: 'FAQ' }], hreflangMap: HREFLANG_MAP });

  const hreflangTags = FAQ_LANG_LIST.map(l =>
    `  <link rel="alternate" hreflang="${l === 'zh' ? 'zh-Hans' : l}" href="https://lalabuba.com/${l}/faq"/>`
  ).concat(['  <link rel="alternate" hreflang="x-default" href="https://lalabuba.com/en/faq"/>'])
  .join('\n');

  // FAQPage JSON-LD (Google uses plain text for answers)
  const faqLd = t.questions.map(q => ({
    '@type': 'Question',
    name: q.q,
    acceptedAnswer: { '@type': 'Answer', text: stripHtml(q.a) },
  }));

  // Group questions by category in canonical order
  const bycat = {};
  for (const q of t.questions) {
    if (!bycat[q.cat]) bycat[q.cat] = [];
    bycat[q.cat].push(q);
  }

  const catButtons = ['all', ...CAT_ORDER].map(key => {
    const label = t.cats[key] || key;
    return `<button class="faq-cat${key === 'all' ? ' active' : ''}" data-cat="${key}" role="tab" aria-selected="${key === 'all' ? 'true' : 'false'}">${esc(label)}</button>`;
  }).join('\n    ');

  const sectionsHtml = CAT_ORDER.filter(cat => bycat[cat]?.length).map(cat => {
    const heading = t.sectionHeadings[cat] || cat;
    const items = bycat[cat].map((q, i) => {
      const id = `q-${cat}-${i}`;
      return `
      <details class="faq-item" id="${id}">
        <summary class="faq-q">${esc(q.q)}</summary>
        <div class="faq-a">${q.a}</div>
      </details>`;
    }).join('');
    return `
    <section class="faq-section" data-cat="${cat}">
      <h2 class="faq-section-heading">${esc(heading)}</h2>
      ${items}
    </section>`;
  }).join('\n');

  const totalQ = t.questions.length;
  const countLabel = esc(t.questionsCount(totalQ));

  return `<!doctype html>
<html lang="${esc(t.htmlLang)}">
<head>
  <meta charset="utf-8"/>
  <script>(function(){var t=localStorage.getItem('lalabuba-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}})();<\/script>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(t.title)}</title>
  <meta name="description" content="${esc(t.description)}"/>
  <link rel="canonical" href="${canon}"/>
${hreflangTags}
  <meta property="og:title" content="${esc(t.h1)}"/>
  <meta property="og:description" content="${esc(t.description)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${canon}"/>
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
  <link rel="stylesheet" href="/css/faq.css"/>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Lalabuba","item":"https://lalabuba.com/"},{"@type":"ListItem","position":2,"name":"FAQ","item":"${canon}"}]}
  <\/script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"FAQPage","mainEntity":${JSON.stringify(faqLd)}}
  <\/script>
  <script type="module" src="/js/lp-nav.js"><\/script>
</head>
<body>

${navHtml}

<div class="lp-hero faq-hero">
  <div class="lp-hero-inner">
    <span class="lp-hero-emoji">❓</span>
    <h1>${esc(t.h1)}</h1>
    <p class="lp-hero-desc">${esc(t.heroPara)}</p>
  </div>
</div>

<div class="faq-page">

  <div class="faq-search-wrap">
    <div class="faq-search-inner">
      <span class="faq-search-icon">🔍</span>
      <input type="search" id="faq-search" class="faq-search-input"
        placeholder="${esc(t.searchPlaceholder)}" autocomplete="off" spellcheck="false"
        aria-label="${esc(t.searchPlaceholder)}"/>
      <button class="faq-search-clear hidden" id="faq-search-clear" aria-label="✕">✕</button>
    </div>
    <p class="faq-search-hint" id="faq-count-hint"><span id="faq-visible-count">${totalQ}</span> ${countLabel.replace(/^[0-9]+ ?/, '')}</p>
  </div>

  <div class="faq-cats" role="tablist" aria-label="${esc(t.cats.all)}" id="faq-cats">
    ${catButtons}
  </div>

  <div class="faq-no-results hidden" id="faq-no-results">
    <span class="faq-no-results-emoji">🤔</span>
    <p>${esc(t.noResults)}</p>
    <p><a href="mailto:info@lalabuba.com">${esc(t.emailUs)}</a></p>
  </div>

  <div class="faq-list" id="faq-list">
    ${sectionsHtml}
  </div>

  <div class="faq-still-question">
    <span class="faq-still-emoji">💬</span>
    <p>${esc(t.askUs)}</p>
    <a href="mailto:info@lalabuba.com" class="faq-contact-btn">${esc(t.emailUs)}</a>
  </div>

</div>

<footer class="legal-footer">
  <div class="legal-footer-inner">
    <a href="/">🎨 Lalabuba</a> ·
    <a href="/${activeLang}/features">Features</a> ·
    <a href="/about">About</a> ·
    <a href="/${activeLang}/faq">FAQ</a> ·
    <a href="/privacy">Privacy</a> ·
    <a href="/terms">Terms</a> ·
    <a href="/contact">Contact</a>
  </div>
</footer>

<script>
(function () {
  var input    = document.getElementById('faq-search');
  var clear    = document.getElementById('faq-search-clear');
  var hint     = document.getElementById('faq-visible-count');
  var noRes    = document.getElementById('faq-no-results');
  var items    = Array.from(document.querySelectorAll('.faq-item'));
  var sections = Array.from(document.querySelectorAll('.faq-section'));

  function normalize(s) { return s.toLowerCase().replace(/[\\u2018\\u2019']/g, "'"); }

  function applySearch(q) {
    q = normalize(q.trim());
    var visible = 0;
    items.forEach(function(item) {
      var match = !q || normalize(item.textContent).indexOf(q) !== -1;
      item.classList.toggle('hidden', !match);
      if (match) visible++;
    });
    sections.forEach(function(sec) {
      var any = Array.from(sec.querySelectorAll('.faq-item')).some(function(i) { return !i.classList.contains('hidden'); });
      sec.classList.toggle('hidden', !any);
    });
    hint.textContent = visible;
    noRes.classList.toggle('hidden', visible > 0);
    clear.classList.toggle('hidden', !q);
  }

  input.addEventListener('input', function() { applySearch(this.value); });
  clear.addEventListener('click', function() { input.value = ''; applySearch(''); input.focus(); });

  var catBtns = Array.from(document.querySelectorAll('.faq-cat'));
  catBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var cat = this.dataset.cat;
      catBtns.forEach(function(b) {
        b.classList.toggle('active', b.dataset.cat === cat);
        b.setAttribute('aria-selected', b.dataset.cat === cat ? 'true' : 'false');
      });
      sections.forEach(function(sec) {
        sec.classList.toggle('hidden', cat !== 'all' && sec.dataset.cat !== cat);
      });
      input.value = '';
      items.forEach(function(i) { i.classList.remove('hidden'); });
      var count = cat === 'all' ? items.length
        : Array.from(document.querySelectorAll('.faq-section[data-cat="' + cat + '"] .faq-item')).length;
      hint.textContent = count;
      noRes.classList.add('hidden');
      clear.classList.add('hidden');
    });
  });

  items.forEach(function(item) {
    item.addEventListener('toggle', function() {
      if (this.open) items.forEach(function(o) { if (o !== item && o.open) o.removeAttribute('open'); });
    });
  });

  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target && target.classList.contains('faq-item')) {
      target.setAttribute('open', '');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
})();
<\/script>
</body>
</html>`;
}

module.exports = { renderFaqPage, FAQ_LANG_LIST };
