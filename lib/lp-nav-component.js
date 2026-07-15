'use strict';

// Unified server-rendered nav for all Lalabuba static + dynamic LP pages.
// lp-nav.js (client) is wiring-only — no DOM restructuring needed.
// Usage: buildNav({ lang, breadcrumbs, hreflangMap, ctaHref })
//   lang        : ISO code, e.g. 'de', 'en', 'fr'
//   breadcrumbs : array of { href?, label } — last item has no href (current page)
//   hreflangMap : { en: 'https://...', de: 'https://...', fr: '...', ... }
//   ctaHref     : URL for the primary "Draw!" CTA button (defaults to '/{lang}/')

const WORDMARK = ['#ff4757','#ff7043','#ffca28','#26c281','#1e90ff','#7c4dff','#f06292','#ff6b6b']
  .map((c, i) => `<span style="color:${c}">${'Lalabuba'[i]}</span>`).join('');

const CTA_LABEL = {
  en:'✏️ Draw!', de:'✏️ Ausmalen!', fr:'✏️ Colorier!', es:'✏️ ¡Colorear!',
  pt:'✏️ Colorir!', ru:'✏️ Раскрасить!', it:'✏️ Colorare!', nl:'✏️ Kleuren!',
  pl:'✏️ Kolorować!', tr:'✏️ Boyama!', zh:'✏️ 涂色！', hi:'✏️ रंग भरें!',
};

const THEME_ARIA = {
  en:'Toggle theme', de:'Hell/Dunkel wechseln', fr:'Changer le thème', es:'Cambiar tema',
  pt:'Alterar tema', ru:'Переключить тему', it:'Cambia tema', nl:'Thema wisselen',
  pl:'Zmień motyw', tr:'Temayı değiştir', zh:'切换主题', hi:'थीम बदलें',
};

const JOURNAL_ARIA = {
  en:'My Journal', de:'Mein Journal', fr:'Mon Journal', es:'Mi Diario',
  pt:'Meu Diário', ru:'Мой Журнал', it:'Il Mio Diario', nl:'Mijn Dagboek',
  pl:'Mój Dziennik', tr:'Günlüğüm', zh:'我的日记', hi:'मेरी डायरी',
};

const EXPLORE_ARIA = {
  en:'Explore coloring pages', de:'Ausmalbilder entdecken', fr:'Explorer les coloriages',
  es:'Explorar páginas para colorear', pt:'Explorar páginas de colorir', ru:'Обзор раскрасок',
  it:'Esplora disegni da colorare', nl:'Kleurplaten verkennen', pl:'Przeglądaj kolorowanki',
  tr:'Boyama sayfalarını keşfet', zh:'探索图画', hi:'रंग पेज देखें',
};

// Per-language coloring-page hub root paths (matches lib/coloring-i18n.js roots)
const HUB_ROOT = {
  en:'en/coloring-pages', de:'de/ausmalbilder', fr:'pages-a-colorier',
  es:'paginas-para-colorear', pt:'paginas-para-colorir', ru:'raskraski',
  it:'disegni-da-colorare', nl:'kleurplaten', pl:'kolorowanki',
  tr:'boyama-sayfalari', zh:'zhuose-ye', hi:'rang-bharane-ke-chitra',
};

const ACCOUNT_ARIA = {
  en:'Account', de:'Konto', fr:'Compte', es:'Cuenta',
  pt:'Conta', ru:'Аккаунт', it:'Account', nl:'Account',
  pl:'Konto', tr:'Hesap', zh:'账户', hi:'खाता',
};

// All supported languages for the picker — in display order
const ALL_LANGS = [
  { code: 'en', flag: '🇬🇧', name: 'English',    home: '/'    },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch',    home: '/de/' },
  { code: 'fr', flag: '🇫🇷', name: 'Français',   home: '/fr/' },
  { code: 'es', flag: '🇪🇸', name: 'Español',    home: '/es/' },
  { code: 'pt', flag: '🇧🇷', name: 'Português',  home: '/pt/' },
  { code: 'ru', flag: '🇷🇺', name: 'Русский',    home: '/ru/' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano',   home: '/it/' },
  { code: 'nl', flag: '🇳🇱', name: 'Nederlands', home: '/nl/' },
  { code: 'pl', flag: '🇵🇱', name: 'Polski',     home: '/pl/' },
  { code: 'tr', flag: '🇹🇷', name: 'Türkçe',     home: '/tr/' },
  { code: 'zh', flag: '🇨🇳', name: '中文',        home: '/zh/' },
  { code: 'hi', flag: '🇮🇳', name: 'हिंदी',       home: '/hi/' },
];

function buildNav({ lang = 'en', breadcrumbs = [], hreflangMap = {}, ctaHref } = {}) {
  const cta         = CTA_LABEL[lang]     || CTA_LABEL.en;
  const themeAria   = THEME_ARIA[lang]    || THEME_ARIA.en;
  const journalAria = JOURNAL_ARIA[lang]  || JOURNAL_ARIA.en;
  const accountAria = ACCOUNT_ARIA[lang]  || ACCOUNT_ARIA.en;
  const exploreAria = EXPLORE_ARIA[lang]  || EXPLORE_ARIA.en;
  const homeHref    = ctaHref || (lang === 'en' ? '/' : `/${lang}/`);
  const journalHref = lang === 'en' ? '/' : `/${lang}/`;
  const exploreHref = '/' + (HUB_ROOT[lang] || 'en/coloring-pages') + '/';
  const currentFlag = ALL_LANGS.find(l => l.code === lang)?.flag || '🌍';

  // Breadcrumbs HTML
  const crumbsHtml = breadcrumbs.map((b, i) => {
    const isLast = i === breadcrumbs.length - 1;
    const sep = i > 0 ? '<span class="nav-sep" aria-hidden="true">›</span>' : '';
    if (isLast || !b.href) {
      return `${sep}<span class="nav-current">${b.label}</span>`;
    }
    return `${sep}<a href="${b.href}">${b.label}</a>`;
  }).join('');

  // Language picker items
  const langItems = ALL_LANGS.map(l => {
    const href = hreflangMap[l.code] || l.home;
    const isCurrent = l.code === lang;
    return `<li role="none">
      <a href="${href}" role="menuitem" hreflang="${l.code}"${isCurrent ? ' aria-current="true" class="lp-lang-current"' : ''}>${l.flag} ${l.name}</a>
    </li>`;
  }).join('\n      ');

  return `<nav class="lp-nav lp-branded" data-lang="${lang}">
  <a href="${journalHref}" class="lp-nav-brand" aria-label="Lalabuba">
    <img src="/logo.png" class="lp-nav-mascot" alt="" width="36" height="36" loading="lazy">
    <span class="lp-nav-wordmark">${WORDMARK}</span>
  </a>
  <div class="lp-nav-crumbs" aria-label="Breadcrumb">${crumbsHtml}</div>
  <div class="lp-nav-actions">
    <div class="lp-lang-picker" role="navigation" aria-label="Language">
      <button class="lp-lang-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Change language">
        ${currentFlag}
      </button>
      <ul class="lp-lang-menu" role="menu" hidden>
        ${langItems}
      </ul>
    </div>
    <a href="${exploreHref}" class="lp-nav-icon-btn" aria-label="${exploreAria}" title="${exploreAria}">🎨</a>
    <a href="${journalHref}" class="lp-nav-icon-btn" aria-label="${journalAria}" title="${journalAria}">🖼️</a>
    <button class="lp-nav-icon-btn lp-nav-account-btn" aria-label="${accountAria}" title="${accountAria}" data-auth-btn>👤</button>
    <a href="${homeHref}" class="lp-nav-cta">${cta}</a>
    <button id="lp-theme-btn" aria-label="${themeAria}">🌙</button>
  </div>
</nav>`;
}

module.exports = { buildNav };
