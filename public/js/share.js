import { state } from './state.js';
import { subjectInput, difficultySelect, paletteSelect, providerSelect } from './dom.js';
import { setColorCount, setStatus } from './ui.js';
import { generatePage } from './generate.js';
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

  const q    = params.get('q');
  const d    = params.get('d');
  const p    = params.get('p');
  const c    = parseInt(params.get('c'), 10);
  const seed = parseInt(params.get('seed'), 10);

  if (!q || !seed) return;

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

  // Force direct/Pollinations mode so seed is deterministic across users
  providerSelect.value = 'direct';

  setTimeout(async () => {
    const submitBtn = document.getElementById('generate-button');
    submitBtn.disabled = true;
    try {
      await generatePage(q, seed);
    } catch (err) {
      setStatus(err.message || 'Failed to load shared picture.', true);
    } finally {
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
