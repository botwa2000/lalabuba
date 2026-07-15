// Wiring-only: the nav HTML is server-rendered by lib/lp-nav-component.js.
// Right-side nav mirrors the main app: 🎨 🏆 🖼️ ⚙️
// ⚙️ opens a settings dropdown (theme toggle + language list).

// ── Settings dropdown ─────────────────────────────────────────────────────────

function wireSettingsDropdown() {
  const btn  = document.getElementById('lp-settings-btn');
  const menu = document.getElementById('lp-settings-menu');
  if (!btn || !menu) return;

  const open  = () => { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
  const close = () => { menu.hidden = true;  btn.setAttribute('aria-expanded', 'false'); };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden ? open() : close();
  });

  document.addEventListener('click', (e) => {
    if (!btn.closest('.lp-settings-wrap').contains(e.target)) close();
  });

  btn.closest('.lp-settings-wrap').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); btn.focus(); }
  });
}

// ── Theme toggle ─────────────────────────────────────────────────────────────

function wireTheme() {
  const btn = document.getElementById('lp-theme-btn');
  if (!btn) return;
  const lang = document.documentElement.lang?.split('-')[0] || 'en';
  const LABEL_DARK  = { en:'Theme', de:'Darstellung', fr:'Thème', es:'Tema', pt:'Tema', ru:'Тема', it:'Tema', nl:'Thema', pl:'Motyw', tr:'Tema', zh:'主题', hi:'थीम' };
  const sync = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = (dark ? '☀️ ' : '🌙 ') + (LABEL_DARK[lang] || LABEL_DARK.en);
  };
  sync();
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lalabuba-theme', next);
    sync();
    // Close the settings dropdown after toggling theme
    const menu = document.getElementById('lp-settings-menu');
    const settingsBtn = document.getElementById('lp-settings-btn');
    if (menu) menu.hidden = true;
    if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
  });
}

// ── Instagram / Pinterest footer links ────────────────────────────────────────
const IG_PATH  = 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z';
const PIN_PATH = 'M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z';

function injectLegalFooterSocial() {
  const footer = document.querySelector('footer.legal-footer');
  if (!footer || footer.querySelector('.lf-social')) return;
  const sep = document.createElement('span');
  sep.className = 'sep'; sep.setAttribute('aria-hidden', 'true'); sep.textContent = '·';
  footer.appendChild(sep);
  const make = (href, cls, label, path) =>
    `<a href="${href}" class="lf-social ${cls}" target="_blank" rel="noopener noreferrer" aria-label="${label}"><svg class="lf-social-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg></a>`;
  footer.appendChild(document.createRange().createContextualFragment(
    make('https://www.instagram.com/lalabuba.ai/', 'lf-social-ig', 'Lalabuba on Instagram', IG_PATH) +
    make('https://pinterest.com/lalabubaAI/', 'lf-social-pin', 'Lalabuba on Pinterest', PIN_PATH)
  ));
}

// ── Init ──────────────────────────────────────────────────────────────────────

wireSettingsDropdown();
wireTheme();
injectLegalFooterSocial();
