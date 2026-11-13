import { state, LEVEL_DEFAULTS } from './state.js';
import { subjectInput, difficultySelect, paletteSelect } from './dom.js';
import { setColorCount, setStatus, showLoading, hideLoading } from './ui.js';
import { generatePage } from './generate.js';
import { renderGeneratedImage } from './canvas.js';
import { t } from './i18n.js';

export function buildShareUrl() {
  const isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const base = !isDev ? 'https://lalabuba.com/' : window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    s:    '1',
    q:    subjectInput.value.trim(),
    d:    difficultySelect.value,
    p:    paletteSelect.value,
    c:    String(state.colorCount),
    seed: String(state.lastSeed ?? 0),
  });
  // Include persistent blob URL + 7-day expiry so recipients get the exact
  // image instantly and old links are clearly invalid after a week.
  if (state.lastImageUrl) {
    params.set('img', state.lastImageUrl);
    params.set('exp', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  }
  return `${base}?${params}`;
}

export function openShareModal() {
  const url = buildShareUrl();
  // QR code via free public API — no JS library needed
  const qrImg = document.getElementById('qr-image');
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&margin=10&color=1e1b2e&bgcolor=ffffff`;
  document.getElementById('share-link-input').value = url;
  const modal = document.getElementById('share-modal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

export function loadFromShare() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('s') !== '1') return;

  const q      = params.get('q');
  const d      = params.get('d');
  const p      = params.get('p');
  const c      = parseInt(params.get('c'), 10);
  const seed   = parseInt(params.get('seed'), 10);
  const imgUrl = params.get('img');
  const exp    = parseInt(params.get('exp'), 10);

  if (!q) return;

  // Expired link — restore the subject so the user can regenerate easily.
  if (imgUrl && exp && Date.now() > exp) {
    subjectInput.value = q;
    setStatus(t('linkExpiredError') || 'This shared link has expired — generate a new coloring page! 🎨', true);
    return;
  }

  subjectInput.value = q;

  // Level from the link: select its card and apply its colour preset. This
  // used to toggle the long-gone .diff-pill buttons only, so every SEO-page
  // "Try Easy / Try Hard" link drew Medium's 8 colours and the Medium card
  // stayed highlighted. A link's own colour count (c=) still wins below.
  if (['easy', 'medium', 'hard', 'extreme'].includes(d)) {
    document.querySelectorAll('.level-card').forEach(b => b.classList.toggle('selected', b.dataset.diff === d));
    difficultySelect.value = d;
    setColorCount(LEVEL_DEFAULTS[d]);
  }
  if (['classic', 'pastel', 'nature'].includes(p)) {
    document.querySelectorAll('.palette-pill').forEach(b => b.classList.toggle('selected', b.dataset.palette === p));
    paletteSelect.value = p;
  }
  if (!isNaN(c) && c >= 2) setColorCount(c);
  if (Number.isFinite(seed)) state.lastSeed = seed;

  setTimeout(async () => {
    const submitBtn = document.getElementById('generate-button');
    submitBtn.disabled = true;
    showLoading();
    try {
      if (imgUrl) {
        // Switch from hero (landing) to coloring layout — same as generatePage()
        document.querySelector('.app')?.classList.remove('app-hero');
        const cp = document.querySelector('.config-panel');
        if (cp) {
          cp.classList.add('collapsed');
          cp.classList.remove('mobile-open');
          const toggleBtn = document.getElementById('panel-toggle');
          if (toggleBtn) toggleBtn.textContent = '▶';
        }
        // Load the pre-drawn image directly — no AI call.
        await renderGeneratedImage(imgUrl);
        state.lastImageUrl = imgUrl;
        setStatus(t('done'));
        document.getElementById('regen-button').disabled = false;
      } else if (Number.isFinite(seed)) {
        // Legacy share link without stored image — regenerate using seed.
        state.generationSource = 'challenge';
        await generatePage(q, seed);
      } else {
        // Direct link from coloring-page CTAs (no seed, no cached image) — generate fresh.
        // Own source so the dashboard tells SEO-page draws from real challenges.
        state.generationSource = 'coloring_page';
        await generatePage(q);
      }
    } catch (err) {
      setStatus(err.message || 'Failed to load shared picture.', true);
    } finally {
      hideLoading();
      submitBtn.disabled = false;
    }
  }, 80);
}

export function initShareHandlers() {
  // Platform detection: Android users get Google Play link
  const appLink  = document.getElementById('share-app-link');
  const appLabel = document.getElementById('share-app-label');
  if (appLink && appLabel && /Android/i.test(navigator.userAgent)) {
    appLink.href = 'https://play.google.com/store/apps/details?id=com.lalabuba.lalabuba';
    // Own i18n key (applyTranslations re-applies it on a language change) and
    // the Play glyph instead of the Apple logo.
    appLabel.dataset.i18n = 'noAppYetPlay';
    appLabel.textContent = t('noAppYetPlay');
    appLink.querySelector('.share-apple-icon path')
      ?.setAttribute('d', 'M3.6 1.8c-.3.3-.5.8-.5 1.4v17.6c0 .6.2 1.1.5 1.4l.1.1 9.9-9.9v-.2L3.7 1.7l-.1.1zM16.9 15.7l-3.3-3.3v-.2l3.3-3.3.1.1 3.9 2.2c1.1.6 1.1 1.7 0 2.3l-3.9 2.2h-.1zM17 15.6 13.6 12 3.6 22.2c.4.4 1 .4 1.7.1L17 15.6M17 8.4 5.3 1.7c-.7-.4-1.3-.3-1.7.1L13.6 12 17 8.4z');
  }

  document.getElementById('share-button').addEventListener('click', openShareModal);

  document.getElementById('close-share-modal').addEventListener('click', () => {
    const modal = document.getElementById('share-modal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  });

  // Close on backdrop click
  document.getElementById('share-modal').addEventListener('click', (e) => {
    if (e.target.id === 'share-modal') {
      e.target.classList.add('hidden');
      e.target.setAttribute('aria-hidden', 'true');
    }
  });

  document.getElementById('copy-share-btn').addEventListener('click', async () => {
    const link = document.getElementById('share-link-input').value;
    const btn  = document.getElementById('copy-share-btn');
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Fallback for browsers without clipboard permission
      const inp = document.getElementById('share-link-input');
      inp.select();
      document.execCommand('copy');
    }
    btn.textContent = t('shareCopied');
    setTimeout(() => { btn.textContent = t('shareCopy'); }, 2000);
  });
}
