// Theme toggle for Lalabuba static/landing pages.
// Called after DOMContentLoaded — the initial data-theme is set by the
// inline <head> snippet before first paint.

export function initLpTheme() {
  const btn = document.getElementById('lp-theme-btn');
  if (!btn) return;

  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyTheme(dark) {
    const val = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', val);
    localStorage.setItem('lalabuba-theme', val);
    btn.textContent = dark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  btn.addEventListener('click', () => applyTheme(!isDark()));
  applyTheme(isDark());
}

document.addEventListener('DOMContentLoaded', initLpTheme);
