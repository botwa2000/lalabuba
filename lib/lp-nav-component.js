'use strict';

// Unified server-rendered nav for all Lalabuba static + dynamic LP pages.
// lp-nav.js (client) is wiring-only — no DOM restructuring needed.
// Right-side actions mirror the main app header: 🎨 🏆 🖼️ ⚙️
// ⚙️ opens a settings dropdown (theme toggle + language picker).
// Usage: buildNav({ lang, breadcrumbs, hreflangMap })

const WORDMARK = ['#ff4757','#ff7043','#ffca28','#26c281','#1e90ff','#7c4dff','#f06292','#ff6b6b']
  .map((c, i) => `<span style="color:${c}">${'Lalabuba'[i]}</span>`).join('');

const THEME_ARIA = {
  en:'Toggle theme', de:'Hell/Dunkel wechseln', fr:'Changer le thème', es:'Cambiar tema',
  pt:'Alterar tema', ru:'Переключить тему', it:'Cambia tema', nl:'Thema wisselen',
  pl:'Zmień motyw', tr:'Temayı değiştir', zh:'切换主题', hi:'थीम बदलें',
};

const THEME_LABEL = {
  en:'Theme', de:'Darstellung', fr:'Thème', es:'Tema',
  pt:'Tema', ru:'Тема', it:'Tema', nl:'Thema',
  pl:'Motyw', tr:'Tema', zh:'主题', hi:'थीम',
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

const REWARDS_ARIA = {
  en:'Rewards', de:'Belohnungen', fr:'Récompenses', es:'Recompensas',
  pt:'Recompensas', ru:'Достижения', it:'Premi', nl:'Beloningen',
  pl:'Nagrody', tr:'Ödüller', zh:'奖励', hi:'पुरस्कार',
};

const SETTINGS_ARIA = {
  en:'Settings', de:'Einstellungen', fr:'Paramètres', es:'Ajustes',
  pt:'Configurações', ru:'Настройки', it:'Impostazioni', nl:'Instellingen',
  pl:'Ustawienia', tr:'Ayarlar', zh:'设置', hi:'सेटिंग्स',
};

// Per-language coloring-page hub root paths (matches lib/coloring-i18n.js roots)
const HUB_ROOT = {
  en:'en/coloring-pages', de:'de/ausmalbilder', fr:'pages-a-colorier',
  es:'paginas-para-colorear', pt:'paginas-para-colorir', ru:'raskraski',
  it:'disegni-da-colorare', nl:'kleurplaten', pl:'kolorowanki',
  tr:'boyama-sayfalari', zh:'zhuose-ye', hi:'rang-bharane-ke-chitra',
};

// All supported languages for the settings dropdown — in display order
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

function buildNav({ lang = 'en', breadcrumbs = [], hreflangMap = {} } = {}) {
  const themeAria   = THEME_ARIA[lang]    || THEME_ARIA.en;
  const themeLabel  = THEME_LABEL[lang]   || THEME_LABEL.en;
  const journalAria = JOURNAL_ARIA[lang]  || JOURNAL_ARIA.en;
  const exploreAria = EXPLORE_ARIA[lang]  || EXPLORE_ARIA.en;
  const rewardsAria = REWARDS_ARIA[lang]  || REWARDS_ARIA.en;
  const settingsAria= SETTINGS_ARIA[lang] || SETTINGS_ARIA.en;
  const journalHref = lang === 'en' ? '/' : `/${lang}/`;
  const exploreHref = '/' + (HUB_ROOT[lang] || 'en/coloring-pages') + '/';

  // Breadcrumbs HTML
  const crumbsHtml = breadcrumbs.map((b, i) => {
    const isLast = i === breadcrumbs.length - 1;
    const sep = i > 0 ? '<span class="nav-sep" aria-hidden="true">›</span>' : '';
    if (isLast || !b.href) {
      return `${sep}<span class="nav-current">${b.label}</span>`;
    }
    return `${sep}<a href="${b.href}">${b.label}</a>`;
  }).join('');

  // Flat language links inside settings dropdown
  const langItems = ALL_LANGS.map(l => {
    const href = hreflangMap[l.code] || l.home;
    const isCurrent = l.code === lang;
    return `<a href="${href}" class="lp-settings-lang-item${isCurrent ? ' lp-lang-current' : ''}" hreflang="${l.code}">${l.flag} ${l.name}</a>`;
  }).join('\n      ');

  return `<nav class="lp-nav lp-branded" data-lang="${lang}">
  <a href="${journalHref}" class="lp-nav-brand" aria-label="Lalabuba">
    <img src="/logo.png" class="lp-nav-mascot" alt="" width="36" height="36" loading="lazy">
    <span class="lp-nav-wordmark">${WORDMARK}</span>
  </a>
  <div class="lp-nav-crumbs" aria-label="Breadcrumb">${crumbsHtml}</div>
  <div class="lp-nav-actions">
    <a href="${exploreHref}" class="lp-nav-icon-btn" aria-label="${exploreAria}" title="${exploreAria}">🎨</a>
    <a href="${journalHref}" class="lp-nav-icon-btn" aria-label="${rewardsAria}" title="${rewardsAria}">🏆</a>
    <a href="${journalHref}" class="lp-nav-icon-btn" aria-label="${journalAria}" title="${journalAria}">🖼️</a>
    <div class="lp-settings-wrap">
      <button id="lp-settings-btn" class="lp-nav-icon-btn" aria-haspopup="menu" aria-expanded="false" aria-label="${settingsAria}" title="${settingsAria}">⚙️</button>
      <div id="lp-settings-menu" class="lp-settings-menu" hidden>
        <button id="lp-theme-btn" class="lp-settings-item" aria-label="${themeAria}">🌙 ${themeLabel}</button>
        <hr class="lp-settings-div" aria-hidden="true">
        ${langItems}
      </div>
    </div>
  </div>
</nav>`;
}

module.exports = { buildNav };
