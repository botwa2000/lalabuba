import { state } from './state.js';
import { PALETTES, buildMaxPalette } from './data.js';
import { t } from './i18n.js';
import { legendList, paletteSelect, statusElement, showNumbersInput } from './dom.js';
import { renderGeneratedImage, setPaletteContext } from './canvas.js';

export function activePalette() {
  return PALETTES[paletteSelect.value].slice(0, state.colorCount);
}

export function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
  statusElement.style.color = "";
}

export function renderLegend() {
  const palette = activePalette();
  legendList.innerHTML = "";

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

  // ── Separator ───────────────────────────────────────────────────────
  const sep2 = document.createElement("li");
  sep2.className = "legend-sep";
  sep2.setAttribute("aria-hidden", "true");
  legendList.appendChild(sep2);

  // ── Custom colour picker — full-width pill button, not a circle ─────
  const customItem = document.createElement("li");
  customItem.className = "legend-tool-item";
  const isCustomActive = !state.eraseMode && state.selectedPaletteIndex === -1;
  customItem.innerHTML = `<label class="tool-btn picker-btn${isCustomActive ? " active" : ""}" style="--c:${state.customColor}" title="${t('customColorHint')}">
    <input type="color" class="color-input-hidden" value="${state.customColor}">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d="M10 2C5.58 2 2 5.58 2 10c0 3.31 2 5 4 5 1.54 0 2-1 2-2 0-.55.45-1 1-1h3c2.76 0 5-2.24 5-5C17 5.13 13.87 2 10 2z" fill="rgba(255,255,255,.8)" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>
      <circle cx="6.5" cy="8.5" r="1.4" fill="#e74c3c"/>
      <circle cx="9.5" cy="5.5" r="1.4" fill="#f39c12"/>
      <circle cx="13.2" cy="7.2" r="1.4" fill="#27ae60"/>
      <circle cx="14.2" cy="11" r="1.4" fill="#2980b9"/>
    </svg>
    <span class="picker-label">${t('customColorLabel')}</span>
    <span class="picker-dot" style="background:${state.customColor}"></span>
  </label>`;
  const colorInput = customItem.querySelector('input');
  colorInput.addEventListener('input', (e) => {
    state.customColor = e.target.value;
    state.eraseMode = false;
    state.selectedPaletteIndex = -1;
    const lbl = customItem.querySelector('label');
    lbl.style.setProperty('--c', state.customColor);
    lbl.classList.add('active');
    customItem.querySelector('.picker-dot').style.background = state.customColor;
  });
  colorInput.addEventListener('change', (e) => {
    state.customColor = e.target.value;
    state.eraseMode = false;
    state.selectedPaletteIndex = -1;
    renderLegend();
    setStatus(t('customColorSelected'));
  });
  customItem.querySelector('label').addEventListener('click', () => {
    state.eraseMode = false;
    state.selectedPaletteIndex = -1;
  });
  legendList.appendChild(customItem);

  // Sync palette context to canvas module
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
  const inp = document.getElementById('color-count-input');
  if (inp) inp.value = n;

  const presets = [6, 12, 18, 24];
  const isCustom = !isMax && !presets.includes(n);
  if (inp) inp.classList.toggle('visible', isCustom);

  const pills = document.querySelectorAll('.count-pill');
  pills.forEach(b => {
    if (b.classList.contains('count-max-pill')) {
      b.classList.toggle('selected', isMax === true || n === maxN);
    } else if (b.classList.contains('count-custom-toggle')) {
      b.classList.toggle('selected', isCustom);
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
