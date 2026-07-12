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
    );
  // Drop the leading separator that sat between the logo and the breadcrumb
  while (crumbs.length && crumbs[0].classList.contains('nav-sep')) crumbs.shift();
  const crumbsHtml = crumbs.map(el => el.outerHTML).join('');

  nav.innerHTML = `
    <a href="/" class="lp-nav-brand" aria-label="Lalabuba">
      <img src="/logo.png" class="lp-nav-mascot" alt="" width="36" height="36" loading="lazy">
      <span class="lp-nav-wordmark">${WORDMARK}</span>
    </a>
    <div class="lp-nav-crumbs" aria-label="Breadcrumb">${crumbsHtml}</div>
    <div class="lp-nav-actions">
      <a href="/" class="lp-nav-cta">${CTA_LABEL}</a>
      <button id="lp-theme-btn" aria-label="${ARIA_THEME}">🌙</button>
    </div>`;
  nav.classList.add('lp-branded');
  wireTheme();
}

const IG_PATH  = 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z';
const PIN_PATH = 'M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z';

function socialLink(href, cls, label, path) {
  return `<a href="${href}" class="lf-social ${cls}" target="_blank" rel="noopener noreferrer" aria-label="${label}"><svg class="lf-social-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg></a>`;
}

function injectLegalFooterSocial() {
  const footer = document.querySelector('footer.legal-footer');
  if (!footer || footer.querySelector('.lf-social')) return;
  const sep = document.createElement('span');
  sep.className = 'sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = '·';
  footer.appendChild(sep);
  const frag = document.createRange().createContextualFragment(
    socialLink('https://www.instagram.com/lalabuba.ai/', 'lf-social-ig', 'Lalabuba on Instagram', IG_PATH) +
    socialLink('https://pinterest.com/lalabubaAI/', 'lf-social-pin', 'Lalabuba on Pinterest', PIN_PATH)
  );
  footer.appendChild(frag);
}

upgradeNav();
injectLegalFooterSocial();
