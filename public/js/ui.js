import { state } from './state.js';
import { PALETTES, buildMaxPalette } from './data.js';
import { t } from './i18n.js';
import { legendList, paletteSelect, statusElement, showNumbersInput } from './dom.js';
import { renderGeneratedImage, setPaletteContext } from './canvas.js';

export function activePalette() {
  const base = state.paletteOverride ?? PALETTES[paletteSelect.value];
  return base.slice(0, state.colorCount);
}

export function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
  statusElement.style.color = "";
}

export function renderLegend() {
  const palette = activePalette();
  legendList.innerHTML = "";

  // ── Free mode: big color picker button + eraser only ──────────────
  if (state.isFreeMode) {
    const currentHex = state.selectedPaletteIndex === -1
      ? state.customColor
      : (palette[state.selectedPaletteIndex]?.color ?? '#e91e63');

    const freeItem = document.createElement('li');
    freeItem.className = 'legend-tool-item legend-free-item';
    freeItem.innerHTML = `<button class="tool-btn free-color-btn" style="background:${currentHex}" title="${t('pickColorBtn')}">
      <span class="free-color-icon">🎨</span>
      <span>${t('pickColorBtn')}</span>
    </button>`;
    freeItem.querySelector('button').addEventListener('click', () => openMaxPicker());
    legendList.appendChild(freeItem);

    const sep = document.createElement('li');
    sep.className = 'legend-sep';
    sep.setAttribute('aria-hidden', 'true');
    legendList.appendChild(sep);

    const erFreeItem = document.createElement('li');
    erFreeItem.className = 'legend-tool-item';
    erFreeItem.innerHTML = `<button class="tool-btn erase-btn${state.eraseMode ? ' active' : ''}" title="${t('eraseMode')}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 20" width="28" height="20" aria-hidden="true">
        <rect x="8" y="1" width="19" height="12" rx="2.5" fill="#fff0ee" stroke="#ef9a9a" stroke-width="1.5"/>
        <rect x="1" y="1" width="11" height="12" rx="2.5" fill="#ef9a9a" stroke="#e57373" stroke-width="1.5"/>
        <line x1="9" y1="1.5" x2="9" y2="12.5" stroke="#e57373" stroke-width="1.5"/>
        <line x1="4" y1="18" x2="24" y2="18" stroke="#ddd" stroke-width="2" stroke-linecap="round"/>
        <line x1="4" y1="18" x2="12" y2="18" stroke="#ef9a9a" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>${t('eraseBtn')}</span>
    </button>`;
    erFreeItem.querySelector('button').addEventListener('click', () => {
      state.eraseMode = true;
      renderLegend();
      setStatus(t('eraseMode'));
    });
    legendList.appendChild(erFreeItem);
    setPaletteContext(palette, state.colorCount);
    return;
  }

  // ── Erase tool — full-width pill button, not a circle ──────────────
  const eraseItem = document.createElement("li");
  eraseItem.className = "legend-tool-item";
  eraseItem.innerHTML = `<button class="tool-btn erase-btn${state.eraseMode ? " active" : ""}" title="${t('eraseMode')}">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 20" width="28" height="20" aria-hidden="true">
      <rect x="8" y="1" width="19" height="12" rx="2.5" fill="#fff0ee" stroke="#ef9a9a" stroke-width="1.5"/>
      <rect x="1" y="1" width="11" height="12" rx="2.5" fill="#ef9a9a" stroke="#e57373" stroke-width="1.5"/>
      <line x1="9" y1="1.5" x2="9" y2="12.5" stroke="#e57373" stroke-width="1.5"/>
      <rect x="1" y="13" width="19" height="2" rx="1" fill="none"/>
      <line x1="4" y1="18" x2="24" y2="18" stroke="#ddd" stroke-width="2" stroke-linecap="round"/>
      <line x1="4" y1="18" x2="12" y2="18" stroke="#ef9a9a" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <span>${t('eraseBtn')}</span>
  </button>`;
  eraseItem.querySelector("button").addEventListener("click", () => {
    state.eraseMode = true;
    renderLegend();
    setStatus(t('eraseMode'));
  });
  legendList.appendChild(eraseItem);

  // ── Separator ───────────────────────────────────────────────────────
  const sep1 = document.createElement("li");
  sep1.className = "legend-sep";
  sep1.setAttribute("aria-hidden", "true");
  legendList.appendChild(sep1);

  // ── Colour swatches — bare squares ─────────────────────────────────
  palette.forEach((entry, index) => {
    const item = document.createElement("li");
    const active = !state.eraseMode && index === state.selectedPaletteIndex;
    item.innerHTML = `<button class="color-swatch${active ? " active" : ""}" style="--c:${entry.color}" title="${index + 1} — ${entry.label}"></button>`;
    item.querySelector("button").addEventListener("click", () => {
      state.eraseMode = false;
      state.selectedPaletteIndex = index;
      renderLegend();
      setStatus(t('selected', entry.label));
    });
    legendList.appendChild(item);
  });

  // Guided mode: palette swatches + eraser only — no custom color picker
  // (custom/free color is only available after tapping 🎨 Free!)
  setPaletteContext(activePalette(), state.colorCount);
}

// Module-level loading timer state
let loadingTimer1 = null, loadingTimer2 = null, loadingShownAt = 0;
const MIN_LOADING_MS = 900;

export function showLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  const emptyHint = document.querySelector('.empty-hint');
  const text = document.getElementById('loading-text');
  text.textContent = t('loadingMsg');
  if (emptyHint) emptyHint.style.display = 'none';
  loadingOverlay.style.display = 'flex';
  loadingShownAt = Date.now();
  loadingTimer1 = setTimeout(() => { text.textContent = t('loadingWait'); }, 10000);
  loadingTimer2 = setTimeout(() => { text.textContent = t('loadingLong'); }, 25000);
}

export function hideLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  const emptyHint = document.querySelector('.empty-hint');
  const elapsed = Date.now() - loadingShownAt;
  const doHide = () => {
    loadingOverlay.style.display = 'none';
    if (emptyHint) emptyHint.style.display = '';
    clearTimeout(loadingTimer1);
    clearTimeout(loadingTimer2);
  };
  if (elapsed < MIN_LOADING_MS) {
    setTimeout(doHide, MIN_LOADING_MS - elapsed);
  } else {
    doHide();
  }
}

// ─── Max colour picker (16 × 16 grid modal) ──────────────────────────────────
export function openMaxPicker() {
  closeMaxPicker();
  const colors = buildMaxPalette();
  const currentHex = (state.selectedPaletteIndex === -1 ? state.customColor : '').toLowerCase();

  const backdrop = document.createElement('div');
  backdrop.id = 'max-picker-backdrop';
  backdrop.className = 'max-picker-backdrop';

  const cells = colors.map(c => {
    const sel = c.toLowerCase() === currentHex;
    return `<button class="max-cell${sel ? ' selected' : ''}" style="background:${c}" data-color="${c}" aria-label="${c}"></button>`;
  }).join('');

  backdrop.innerHTML = `
    <div class="max-picker-panel" role="dialog" aria-modal="true" aria-label="Pick a color">
      <div class="max-picker-header">
        <div>
          <div class="max-picker-title">🎨 Pick a color!</div>
          <div class="max-picker-hint">Tap any color to paint with it</div>
        </div>
        <button class="max-picker-close" id="max-picker-close" aria-label="Close">✕</button>
      </div>
      <div class="max-picker-grid">${cells}</div>
    </div>`;

  document.body.appendChild(backdrop);

  backdrop.querySelector('.max-picker-grid').addEventListener('click', e => {
    const btn = e.target.closest('.max-cell');
    if (!btn) return;
    state.customColor = btn.dataset.color;
    state.eraseMode = false;
    state.selectedPaletteIndex = -1;
    renderLegend();
    closeMaxPicker();
  });

  document.getElementById('max-picker-close').addEventListener('click', closeMaxPicker);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeMaxPicker(); });

  const onKey = e => {
    if (e.key === 'Escape') { closeMaxPicker(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  requestAnimationFrame(() => backdrop.classList.add('open'));
}

export function closeMaxPicker() {
  const el = document.getElementById('max-picker-backdrop');
  if (!el) return;
  el.classList.remove('open');
  el.addEventListener('transitionend', () => el.remove(), { once: true });
}

export function setColorCount(n, isMax) {
  const maxN = PALETTES[paletteSelect.value].length;
  n = Math.max(2, Math.min(Math.round(n), maxN));
  state.colorCount = n;

  const pills = document.querySelectorAll('.count-pill');
  pills.forEach(b => {
    if (b.classList.contains('count-max-pill')) {
      b.classList.toggle('selected', isMax === true || n === maxN);
    } else {
      b.classList.toggle('selected', isMax !== true && Number(b.dataset.count) === n);
    }
  });
  if (state.selectedPaletteIndex >= state.colorCount) state.selectedPaletteIndex = 0;
  renderLegend();
  if (state.currentImage && showNumbersInput.checked) {
    renderGeneratedImage(state.currentImage).catch(err => setStatus(err.message, true));
  }
}

export function flashPaletteSwatch(index) {
  const swatches = legendList.querySelectorAll('.color-swatch');
  const target = swatches[index];
  if (!target) return;
  target.classList.remove('flash');
  // Force reflow so re-adding the class triggers the animation again
  void target.offsetWidth;
  target.classList.add('flash');
  setTimeout(() => target.classList.remove('flash'), 750);
}
