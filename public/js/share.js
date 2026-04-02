import { state } from './state.js';
import { subjectInput, difficultySelect, paletteSelect } from './dom.js';
import { setColorCount, setStatus, showLoading, hideLoading } from './ui.js';
import { generatePage } from './generate.js';
import { renderGeneratedImage } from './canvas.js';
import { t } from './i18n.js';

export function buildShareUrl() {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    s:    '1',
    q:    subjectInput.value.trim(),
    d:    difficultySelect.value,
    p:    paletteSelect.value,
    c:    String(state.colorCount),
    seed: String(state.lastSeed ?? 0),
  });
  // Include persistent blob URL so recipients get the exact image instantly.
  if (state.lastImageUrl) params.set('img', state.lastImageUrl);
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

  if (!q) return;

  subjectInput.value = q;

  if (['easy', 'medium', 'hard', 'extreme'].includes(d)) {
    document.querySelectorAll('.diff-pill').forEach(b => b.classList.toggle('selected', b.dataset.diff === d));
    difficultySelect.value = d;
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
        // Exact shared image — fetch directly from CDN, no AI call.
        await renderGeneratedImage(imgUrl);
        state.lastImageUrl = imgUrl;
        setStatus(t('done'));
        document.getElementById('regen-button').disabled = false;
      } else if (Number.isFinite(seed)) {
        // Legacy share link without stored image — regenerate using seed.
        await generatePage(q, seed);
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
