// Branded nav + theme toggle for all Lalabuba static/coloring pages.
// Replaces lp-theme.js — use this instead, not in addition to.

const COLORS  = ['#ff4757','#ff7043','#ffca28','#26c281','#1e90ff','#7c4dff','#f06292','#ff6b6b'];
const WORDMARK = 'Lalabuba'.split('').map((l, i) =>
  `<span style="color:${COLORS[i]}">${l}</span>`
).join('');

const isDE = document.documentElement.lang === 'de';
const CTA_LABEL  = isDE ? '✏️ Ausmalen!' : '✏️ Draw!';
const ARIA_THEME = isDE ? 'Hell/Dunkel wechseln' : 'Toggle theme';
const ARIA_DARK  = isDE ? 'Zu hell wechseln' : 'Switch to light mode';
const ARIA_LIGHT = isDE ? 'Zu dunkel wechseln' : 'Switch to dark mode';

function wireTheme() {
  const btn = document.getElementById('lp-theme-btn');
  if (!btn) return;
  const sync = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = dark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', dark ? ARIA_DARK : ARIA_LIGHT);
  };
  sync();
  btn.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lalabuba-theme', next);
    sync();
  });
}

function upgradeNav() {
  const nav = document.querySelector('nav.legal-nav');
  if (!nav) { wireTheme(); return; }

  // Already branded (server-rendered pages) — just wire the button
  if (nav.classList.contains('lp-branded')) { wireTheme(); return; }

  // Extract breadcrumb nodes: everything except old logo, spacer, and theme btn
  const crumbs = [...nav.children]
    .filter(el =>
      !el.classList.contains('legal-logo') &&
      !el.classList.contains('nav-spacer') &&
      el.id !== 'lp-theme-btn'
    )
    .map(el => el.outerHTML)
    .join('');

  nav.innerHTML = `
    <a href="/" class="lp-nav-brand" aria-label="Lalabuba">
      <img src="/logo.png" class="lp-nav-mascot" alt="" width="36" height="36" loading="lazy">
      <span class="lp-nav-wordmark">${WORDMARK}</span>
    </a>
    <div class="lp-nav-crumbs" aria-label="Breadcrumb">${crumbs}</div>
    <div class="lp-nav-actions">
      <a href="/" class="lp-nav-cta">${CTA_LABEL}</a>
      <button id="lp-theme-btn" aria-label="${ARIA_THEME}">🌙</button>
    </div>`;
  nav.classList.add('lp-branded');
  wireTheme();
}

upgradeNav();
