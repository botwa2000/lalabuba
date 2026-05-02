import { state, DEBUG } from './state.js';
import { PALETTES, SURPRISE_SUBJECTS, EXAMPLE_SUGGESTIONS, getDailyChallenge, getTranslatedDailyWord } from './data.js';
import { sanitizeSubject, isSafeSubject } from './data.js';
import { saveArtwork, initGalleryHandlers } from './gallery.js';
import { t, applyTranslations, setLanguage, getCurrentLang } from './i18n.js';
import {
  form, subjectInput, showNumbersInput, difficultySelect, providerSelect,
  paletteSelect, previewCanvas, drawCanvas, printButton, downloadButton,
  debugPanel,
} from './dom.js';
import {
  renderGeneratedImage, findRegionAt, fillRegion, undoLastFill, hexToRgb, redrawCanvas,
} from './canvas.js';
import {
  activePalette, setStatus, renderLegend, setColorCount, showLoading, hideLoading,
  openMaxPicker, closeMaxPicker, flashPaletteSwatch,
} from './ui.js';
import { generatePage, requestGeneratedImage } from './generate.js';
import { initDrawingTool, setPaintEndCallback, updateDrawCanvasMode } from './drawing.js';
import { initShareHandlers, loadFromShare } from './share.js';
import { initZoom, getCanvasCoords, isPanMode } from './zoom.js';
import { initOnboarding } from './onboarding.js';

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function checkCompletion() {
  if (state.celebrationShown || !showNumbersInput.checked || !state.regionColorMap || state.regionColorMap.size === 0) return;
  if ([...state.regionColorMap.keys()].every((id) => state.completedRegions.has(id))) {
    state.celebrationShown = true;
    const elapsed = state.coloringStartTime ? Date.now() - state.coloringStartTime : 0;
    const timeEl = document.getElementById("celebration-time");
    if (timeEl) timeEl.textContent = elapsed > 0 ? t('celebTime', formatTime(elapsed)) : '';
    document.getElementById("celebration").classList.remove("hidden");
    document.getElementById("celebration").setAttribute("aria-hidden", "false");
    // Auto-save completed artwork to local gallery (with restoration data)
    let lineArtDataUrl = null;
    let fillDataUrl = null;
    if (state.baseImageData && state.paintedImageData) {
      const artC = document.createElement('canvas');
      artC.width = previewCanvas.width; artC.height = previewCanvas.height;
      artC.getContext('2d').putImageData(state.baseImageData, 0, 0);
      lineArtDataUrl = artC.toDataURL('image/png');

      const fillC = document.createElement('canvas');
      fillC.width = previewCanvas.width; fillC.height = previewCanvas.height;
      fillC.getContext('2d').putImageData(state.paintedImageData, 0, 0);
      fillDataUrl = fillC.toDataURL('image/png');
    }
    saveArtwork({
      subject: subjectInput.value.trim() || '?',
      difficulty: difficultySelect.value,
      colorCount: state.colorCount,
      previewCanvas,
      drawCanvas,
      lineArtDataUrl,
      fillDataUrl,
      completedRegions: [...state.completedRegions],
    }).then(() => setStatus(t('gallerySaved'))).catch(() => {});
  }
}

// ─── Turnstile ───────────────────────────────────────────────────────────────
// Auto-render uses data-callback="onTurnstileSuccess" on the widget div.
// This fires regardless of script/module load order — no manual render needed.
window.onTurnstileSuccess = (token) => { state.turnstileToken = token; };

function getTurnstileToken() {
  const isNative = window.Capacitor?.isNativePlatform?.() ||
                   window.location.protocol === 'capacitor:' ||
                   window.location.protocol === 'ionic:';
  if (isNative || !window.turnstile) return Promise.resolve(null);
  // Token already stored from auto-render callback
  if (state.turnstileToken) return Promise.resolve(state.turnstileToken);
  // Token might be available in the widget but callback fired before state was ready
  const el = document.getElementById('turnstile-widget');
  const existing = el ? window.turnstile.getResponse(el) : null;
  if (existing) return Promise.resolve(existing);
  // Poll — covers the case where user needs to complete a checkbox challenge
  return new Promise((resolve) => {
    const poll = setInterval(() => {
      if (state.turnstileToken) { clearInterval(poll); resolve(state.turnstileToken); }
    }, 100);
    setTimeout(() => { clearInterval(poll); resolve(null); }, 10000);
  });
}

// ─── Form submit ─────────────────────────────────────────────────────────────
let _pendingSeedOverride = null;
// When a card / daily-word / surprise sets this, the English original is used
// directly for the AI prompt (skips server translation). Cleared on manual input.
let _pendingEnglishSubject = null;

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pendingEnglish = _pendingEnglishSubject;
  _pendingEnglishSubject = null;
  // Pre-defined: use English original. Custom: use raw input (server will translate).
  const subject = pendingEnglish ?? sanitizeSubject(subjectInput.value);
  if (!subject) {
    setStatus(t('typeFirst'), true);
    return;
  }

  if (!isSafeSubject(subject)) {
    setStatus(t('unsafeSubject'), true);
    return;
  }

  const submitButton = document.getElementById("generate-button");
  submitButton.disabled = true;

  try {
    state.turnstileToken = await getTurnstileToken();
    const seedOverride = _pendingSeedOverride;
    _pendingSeedOverride = null;
    await generatePage(subject, seedOverride, !!pendingEnglish);
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  } finally {
    submitButton.disabled = false;
    // Reset token so next submission gets a fresh one
    state.turnstileToken = null;
    const tsEl = document.getElementById('turnstile-widget');
    if (window.turnstile && tsEl) window.turnstile.reset(tsEl);
  }
});

// ─── Show numbers checkbox ───────────────────────────────────────────────────
showNumbersInput.addEventListener("change", async () => {
  if (!state.currentImage) {
    return;
  }

  try {
    await renderGeneratedImage(state.currentImage);
  } catch (error) {
    setStatus(error.message || "Failed to redraw preview.", true);
  }
});

// ─── Palette select ──────────────────────────────────────────────────────────
paletteSelect.addEventListener("change", async () => {
  renderLegend();
  updatePaletteChip();
  updateCountChip();

  if (!state.currentImage) {
    return;
  }

  if (showNumbersInput.checked) {
    await renderGeneratedImage(state.currentImage);
  }
});

// ─── Provider select ─────────────────────────────────────────────────────────
providerSelect.addEventListener("change", () => {
  const hints = {
    direct:  "Ready — type any word in any language.",
    backend: "Ready — make sure the server is running (npm start).",
    demo:    "Offline demo: try butterfly, cat, rocket, or castle.",
  };
  setStatus(hints[providerSelect.value] || "Ready.");
});

// ─── Difficulty select ───────────────────────────────────────────────────────
difficultySelect.addEventListener("change", () => {
  // Clamp selectedPaletteIndex to new palette size.
  const palette = activePalette();
  if (state.selectedPaletteIndex >= palette.length) {
    state.selectedPaletteIndex = 0;
  }
  renderLegend();
  updateDiffChip();

  if (state.currentImage && showNumbersInput.checked) {
    renderGeneratedImage(state.currentImage).catch((error) => {
      setStatus(error.message || "Failed to redraw preview.", true);
    });
  }
});

// ─── Undo helpers ─────────────────────────────────────────────────────────────
const UNDO_MAX = 10;
const undoButton = document.getElementById('undo-button');

function pushUndo(regionId, fillResult, completedBefore) {
  if (!fillResult.success) return;
  state.undoStack.push({ regionId, record: fillResult.record, completedBefore });
  if (state.undoStack.length > UNDO_MAX) state.undoStack.shift();
  if (undoButton) undoButton.disabled = false;
}

function doUndo() {
  if (!state.undoStack.length) return;
  undoLastFill();
  if (undoButton) undoButton.disabled = state.undoStack.length === 0;
  setStatus(t('undoDone'));
  updateUndoBtn();
}

function updateUndoBtn() {
  if (undoButton) undoButton.disabled = state.undoStack.length === 0;
}

if (undoButton) undoButton.addEventListener('click', doUndo);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    doUndo();
  }
});

// ─── Canvas click ─────────────────────────────────────────────────────────────
let _lastClickMs = 0, _lastClickId = 0;

previewCanvas.addEventListener("click", (event) => {
  if (isPanMode()) return; // pan mode active — drag is for moving, not coloring
  if (state.colorMode === 'paint') return; // paint mode uses draw-canvas, not click-fill
  if (!state.regionMap) return;

  const { x: canvasX, y: canvasY } = getCanvasCoords(event);

  const regionId = findRegionAt(canvasX, canvasY);

  if (DEBUG && debugPanel) {
    debugPanel.textContent = [
      `Clicked     : (${canvasX}, ${canvasY})`,
      `Region id   : ${regionId > 0 ? regionId : "none"}${regionId === state.backgroundRegionId ? " (bg)" : ""} (${state.regionPixels.get(regionId)?.length ?? 0} px)`,
      `Mode        : ${state.eraseMode ? "erase" : "fill " + activePalette()[state.selectedPaletteIndex]?.label}`,
    ].join("\n");
    document.getElementById("debug-details").open = true;
  }

  if (!regionId) {
    setStatus(t('notEnclosed'), true);
    return;
  }

  // Erase mode: restore region pixels to the original base image.
  if (state.eraseMode) {
    const pixels = state.regionPixels.get(regionId);
    if (pixels) {
      const paint = state.paintedImageData.data;
      const base  = state.baseImageData.data;
      // Record undo entry for erase too
      const undoEntries = [];
      for (const idx of pixels) {
        const o = idx * 4;
        undoEntries.push(idx, paint[o], paint[o+1], paint[o+2], paint[o+3]);
        paint[o] = base[o]; paint[o+1] = base[o+1]; paint[o+2] = base[o+2]; paint[o+3] = base[o+3];
      }
      const completedBefore = state.completedRegions.has(regionId);
      state.completedRegions.delete(regionId);
      state.celebrationShown = false;
      redrawCanvas();
      setStatus(t('areaCleared'));
      // Pack erase as undo record
      const count = undoEntries.length / 5;
      const record = new Uint8Array(count * 7);
      for (let i = 0, b = 0; i < undoEntries.length; i += 5, b += 7) {
        const idx = undoEntries[i];
        record[b] = idx & 0xff; record[b+1] = (idx>>8)&0xff; record[b+2] = (idx>>16)&0xff;
        record[b+3] = undoEntries[i+1]; record[b+4] = undoEntries[i+2];
        record[b+5] = undoEntries[i+3]; record[b+6] = undoEntries[i+4];
      }
      pushUndo(regionId, { success: true, record }, completedBefore);
    }
    return;
  }

  let fillColor;
  if (state.selectedPaletteIndex === -1) {
    fillColor = hexToRgb(state.customColor);
  } else {
    if (showNumbersInput.checked && state.regionColorMap && state.regionColorMap.has(regionId)) {
      const required = state.regionColorMap.get(regionId);
      if (state.selectedPaletteIndex !== required) {
        const c = activePalette()[required];
        setStatus(t('needsColor', required + 1, c.label), false);
        flashPaletteSwatch(required);
        return;
      }
    }
    fillColor = hexToRgb(activePalette()[state.selectedPaletteIndex].color);
  }

  // ── Double-click/tap: fill ALL regions of the same color number ──────────
  const now = Date.now();
  const isDouble = (now - _lastClickMs) < 400 && _lastClickId === regionId;
  _lastClickMs = now; _lastClickId = regionId;

  if (isDouble && showNumbersInput.checked && state.regionColorMap?.has(regionId)) {
    const colorNum = state.regionColorMap.get(regionId);
    const batchRecords = [];
    if (!state.coloringStartTime) state.coloringStartTime = Date.now();
    for (const [rid, num] of state.regionColorMap) {
      if (num === colorNum && !state.completedRegions.has(rid)) {
        const completedBefore = state.completedRegions.has(rid);
        state.completedRegions.add(rid);
        const result = fillRegion(rid, fillColor);
        if (result.success) batchRecords.push({ regionId: rid, record: result.record, completedBefore });
      }
    }
    if (batchRecords.length) {
      // Push as a single batch entry (array of records) — undo reverts all at once
      state.undoStack.push({ batch: batchRecords });
      if (state.undoStack.length > UNDO_MAX) state.undoStack.shift();
      updateUndoBtn();
    }
    const label = activePalette()[colorNum]?.label ?? '';
    const total = state.regionColorMap.size;
    const done = [...state.regionColorMap.keys()].filter(id => state.completedRegions.has(id)).length;
    setStatus(done < total ? t('filledProgress', label, done, total) : t('filled', label));
    checkCompletion();
    const hint = document.getElementById('coloring-hint');
    if (hint) hint.hidden = true;
    return;
  }

  if (!state.coloringStartTime) state.coloringStartTime = Date.now();
  const completedBefore = state.completedRegions.has(regionId);
  state.completedRegions.add(regionId);
  const fillResult = fillRegion(regionId, fillColor);
  pushUndo(regionId, fillResult, completedBefore);

  const label = state.selectedPaletteIndex === -1 ? t('customColorLabel') : activePalette()[state.selectedPaletteIndex].label;
  if (showNumbersInput.checked && state.regionColorMap && state.regionColorMap.size > 0) {
    const total = state.regionColorMap.size;
    const done = [...state.regionColorMap.keys()].filter(id => state.completedRegions.has(id)).length;
    setStatus(done < total ? t('filledProgress', label, done, total) : t('filled', label));
  } else {
    setStatus(t('filled', label));
  }
  checkCompletion();
  const hint = document.getElementById('coloring-hint');
  if (hint) hint.hidden = true;
});

// ─── Print button ────────────────────────────────────────────────────────────
printButton.addEventListener("click", () => {
  window.print();
});

// ─── Download button ─────────────────────────────────────────────────────────
downloadButton.addEventListener("click", () => {
  if (!state.currentImage) return;

  // Composite the coloring canvas and pencil drawing layer into one image.
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width  = previewCanvas.width;
  tempCanvas.height = previewCanvas.height;
  const tCtx = tempCanvas.getContext("2d");
  tCtx.drawImage(previewCanvas, 0, 0);
  tCtx.drawImage(drawCanvas, 0, 0);

  const link = document.createElement("a");
  link.href = tempCanvas.toDataURL("image/png");
  link.download = `${subjectInput.value.trim().replace(/\s+/g, "-").toLowerCase() || "coloring-page"}.png`;
  link.click();
});

// ─── Share artwork button ─────────────────────────────────────────────────────
const shareArtworkBtn = document.getElementById('share-artwork-btn');
if (shareArtworkBtn) {
  shareArtworkBtn.addEventListener('click', async () => {
    if (!state.currentImage) return;

    const tmp = document.createElement('canvas');
    tmp.width  = previewCanvas.width;
    tmp.height = previewCanvas.height;
    const ctx  = tmp.getContext('2d');
    ctx.drawImage(previewCanvas, 0, 0);
    ctx.drawImage(drawCanvas, 0, 0);

    const subject  = subjectInput.value.trim().replace(/\s+/g, '-').toLowerCase() || 'coloring-page';
    const filename = `${subject}.png`;

    // Try Web Share API (mobile)
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await new Promise(r => tmp.toBlob(r, 'image/png'));
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Lalabuba — my coloring', text: '🎨 Look what I colored!' });
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') { /* fall through to download */ }
        else return;
      }
    }

    // Desktop fallback: download PNG
    const link    = document.createElement('a');
    link.href     = tmp.toDataURL('image/png');
    link.download = filename;
    link.click();
  });
}

// ─── Celebration buttons ─────────────────────────────────────────────────────
document.getElementById("celebration-keep").addEventListener("click", () => {
  document.getElementById("celebration").classList.add("hidden");
  document.getElementById("celebration").setAttribute("aria-hidden", "true");
});

document.getElementById("celebration-new").addEventListener("click", () => {
  document.getElementById("celebration").classList.add("hidden");
  document.getElementById("celebration").setAttribute("aria-hidden", "true");
  subjectInput.value = "";
  subjectInput.focus();
});

// ─── Difficulty pills ─────────────────────────────────────────────────────────
document.querySelectorAll('.diff-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-pill').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    difficultySelect.value = btn.dataset.diff;
    difficultySelect.dispatchEvent(new Event('change'));
  });
});

// ─── Count pills ──────────────────────────────────────────────────────────────
document.querySelectorAll('.count-pill[data-count]').forEach(btn => {
  btn.addEventListener('click', () => {
    closeMaxPicker();
    setColorCount(Number(btn.dataset.count));
  });
});
const countMaxPill = document.querySelector('.count-max-pill');
if (countMaxPill) {
  countMaxPill.addEventListener('click', () => {
    setColorCount(PALETTES[paletteSelect.value].length, true);
    openMaxPicker();
  });
}

// ─── Palette pills ────────────────────────────────────────────────────────────
document.querySelectorAll('.palette-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.palette-pill').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    paletteSelect.value = btn.dataset.palette;
    paletteSelect.dispatchEvent(new Event('change'));
  });
});

// ─── Regen button ─────────────────────────────────────────────────────────────
const regenButton = document.getElementById('regen-button');
regenButton.addEventListener('click', async () => {
  const subject = sanitizeSubject(subjectInput.value);
  if (!subject) return;
  regenButton.disabled = true;
  const submitButton = document.getElementById('generate-button');
  submitButton.disabled = true;
  try {
    await generatePage(subject);
  } catch (error) {
    setStatus(error.message || 'Something went wrong.', true);
  } finally {
    regenButton.disabled = false;
    submitButton.disabled = false;
  }
});

// ─── Help panel toggle ────────────────────────────────────────────────────────
document.getElementById('help-btn').addEventListener('click', () => {
  const panel = document.getElementById('help-panel');
  panel.hidden = !panel.hidden;
});

// ─── Language picker ──────────────────────────────────────────────────────────
const langToggle   = document.getElementById('lang-toggle');
const langDropdown = document.getElementById('lang-dropdown');

langToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  const opening = langDropdown.hidden;
  langDropdown.hidden = !opening;
  langToggle.setAttribute('aria-expanded', String(opening));
});

document.addEventListener('click', () => {
  langDropdown.hidden = true;
  langToggle.setAttribute('aria-expanded', 'false');
});

document.querySelectorAll('.lang-option').forEach(btn => {
  btn.addEventListener('click', () => {
    setLanguage(btn.dataset.lang);
    renderExamples();
    if (dailyWordValue) {
      dailyWordValue.textContent = getTranslatedDailyWord(dailyWord, getCurrentLang());
    }
    updateDiffChip(); updatePaletteChip(); // refresh translated chip titles
    langDropdown.hidden = true;
    langToggle.setAttribute('aria-expanded', 'false');
  });
});

// ─── Drawing tool ─────────────────────────────────────────────────────────────
initDrawingTool();

// ─── Paint mode toggle ────────────────────────────────────────────────────────
const modeTapBtn   = document.getElementById('mode-tap-btn');
const modePaintBtn = document.getElementById('mode-paint-btn');

function setColorMode(mode) {
  state.colorMode = mode;
  if (modeTapBtn)   modeTapBtn.classList.toggle('active', mode === 'tap');
  if (modePaintBtn) modePaintBtn.classList.toggle('active', mode === 'paint');
  updateDrawCanvasMode();
  if (mode === 'paint') setStatus(t('paintMode'));
}

if (modeTapBtn)   modeTapBtn.addEventListener('click',   () => setColorMode('tap'));
if (modePaintBtn) modePaintBtn.addEventListener('click', () => setColorMode('paint'));

// ─── Paint coverage check ────────────────────────────────────────────────────
function checkPaintCoverage() {
  if (!state.regionPixels || !state.paintedImageData) return;

  const ctx = drawCanvas.getContext('2d');
  const drawData = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);

  let bestRegion = null;
  let bestPct = 0;

  for (const [regionId, pixels] of state.regionPixels) {
    if (state.completedRegions.has(regionId)) continue;
    if (regionId === state.backgroundRegionId) continue;
    if (!pixels || pixels.length === 0) continue;

    let covered = 0;
    for (let i = 0; i < pixels.length; i++) {
      if (drawData.data[pixels[i] * 4 + 3] > 32) covered++;
    }
    const pct = covered / pixels.length;
    if (pct > bestPct) { bestPct = pct; bestRegion = regionId; }
  }

  if (bestRegion === null || bestPct < 0.02) return; // nothing meaningful drawn

  if (bestPct >= 0.70) {
    let fillColor;
    if (state.selectedPaletteIndex === -1) {
      fillColor = hexToRgb(state.customColor);
    } else {
      fillColor = hexToRgb(activePalette()[state.selectedPaletteIndex].color);
    }
    if (!fillColor) return;

    if (!state.coloringStartTime) state.coloringStartTime = Date.now();
    const completedBefore = state.completedRegions.has(bestRegion);
    state.completedRegions.add(bestRegion);
    const fillResult = fillRegion(bestRegion, fillColor);
    pushUndo(bestRegion, fillResult, completedBefore);

    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    const label = state.selectedPaletteIndex === -1 ? t('customColorLabel') : activePalette()[state.selectedPaletteIndex].label;
    const total = state.regionColorMap?.size ?? state.regionPixels.size;
    const done  = state.completedRegions.size;
    setStatus(done < total ? t('filledProgress', label, done, total) : t('filled', label));
    checkCompletion();
  } else {
    setStatus(t('paintCoverage', Math.round(bestPct * 100)));
  }
}

setPaintEndCallback(checkPaintCoverage);

// ─── Zoom ─────────────────────────────────────────────────────────────────────
const canvasFrame = document.querySelector('.canvas-frame');
if (canvasFrame) initZoom(canvasFrame, previewCanvas);

// ─── Config panel toggle (desktop sidebar + mobile drawer) ────────────────────
const configPanel    = document.getElementById('config-panel');
const panelToggleBtn = document.getElementById('panel-toggle');
const mobileMenuBtn  = document.getElementById('mobile-menu-btn');

function togglePanel() {
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    configPanel?.classList.toggle('mobile-open');
  } else {
    configPanel?.classList.toggle('collapsed');
    if (panelToggleBtn) {
      panelToggleBtn.textContent = configPanel?.classList.contains('collapsed') ? '▶' : '◀';
    }
  }
}

panelToggleBtn?.addEventListener('click', togglePanel);
mobileMenuBtn?.addEventListener('click', togglePanel);

// Close mobile panel when clicking outside
document.addEventListener('click', (e) => {
  if (window.innerWidth < 768 &&
      configPanel?.classList.contains('mobile-open') &&
      !configPanel.contains(e.target) &&
      e.target !== mobileMenuBtn) {
    configPanel.classList.remove('mobile-open');
  }
});

// ─── Share handlers ───────────────────────────────────────────────────────────
initShareHandlers();

// ─── Settings chips (A2) ──────────────────────────────────────────────────────
const DIFF_CYCLE    = ['easy', 'medium', 'hard', 'extreme'];
const COUNT_CYCLE   = [6, 12, 18, 24, 'max'];
const PALETTE_CYCLE = ['classic', 'pastel', 'nature'];
const DIFF_EMOJI    = { easy: '🌟', medium: '🌟🌟', hard: '🌟🌟🌟', extreme: '🔥' };
const PALETTE_EMOJI = { classic: '🖍️', pastel: '🌸', nature: '🌿' };

const chipDiff    = document.getElementById('chip-diff');
const chipCount   = document.getElementById('chip-count');
const chipPalette = document.getElementById('chip-palette');
const chipNumbers = document.getElementById('chip-numbers');

function updateDiffChip() {
  if (!chipDiff) return;
  chipDiff.textContent = DIFF_EMOJI[difficultySelect.value] || '⭐';
  const diffLabels = { easy: t('diffEasy'), medium: t('diffMedium'), hard: t('diffHard'), extreme: t('diffExtreme') };
  chipDiff.title = t('difficulty') + ': ' + (diffLabels[difficultySelect.value] || difficultySelect.value);
}
function updateCountChip() {
  if (!chipCount) return;
  chipCount.textContent = state.colorCount >= (PALETTES[paletteSelect.value]?.length || 24)
    ? `🎨 Max`
    : `🎨 ${state.colorCount}`;
}
function updatePaletteChip() {
  if (!chipPalette) return;
  chipPalette.textContent = PALETTE_EMOJI[paletteSelect.value] || '🖍️';
  const paletteLabels = { classic: t('paletteClassic'), pastel: t('palettePastel'), nature: t('paletteNature') };
  chipPalette.title = t('palette') + ': ' + (paletteLabels[paletteSelect.value] || paletteSelect.value);
}
function updateNumbersChip() {
  if (!chipNumbers) return;
  const on = showNumbersInput.checked;
  chipNumbers.textContent = on ? '🔢 ●' : '🔢 ○';
  chipNumbers.classList.toggle('setting-chip--on', on);
}
function updateAllChips() {
  updateDiffChip(); updateCountChip(); updatePaletteChip(); updateNumbersChip();
}

if (chipDiff) chipDiff.addEventListener('click', () => {
  const cur = DIFF_CYCLE.indexOf(difficultySelect.value);
  difficultySelect.value = DIFF_CYCLE[(cur + 1) % DIFF_CYCLE.length];
  difficultySelect.dispatchEvent(new Event('change'));
  updateDiffChip();
});

if (chipCount) chipCount.addEventListener('click', () => {
  const palette = PALETTES[paletteSelect.value];
  const maxCount = palette.length;
  const cur = COUNT_CYCLE.indexOf(state.colorCount);
  const nextRaw = COUNT_CYCLE[(cur + 1) % COUNT_CYCLE.length];
  const next = nextRaw === 'max' ? maxCount : Number(nextRaw);
  setColorCount(next, next === maxCount);
  updateCountChip();
});

if (chipPalette) chipPalette.addEventListener('click', () => {
  const cur = PALETTE_CYCLE.indexOf(paletteSelect.value);
  paletteSelect.value = PALETTE_CYCLE[(cur + 1) % PALETTE_CYCLE.length];
  paletteSelect.dispatchEvent(new Event('change'));
  updatePaletteChip();
  updateCountChip(); // palette affects max count
});

if (chipNumbers) chipNumbers.addEventListener('click', () => {
  showNumbersInput.checked = !showNumbersInput.checked;
  showNumbersInput.dispatchEvent(new Event('change'));
  updateNumbersChip();
});

updateAllChips();

// ─── Populate-only helpers (A1) ───────────────────────────────────────────────
function pulseDraw() {
  const btn = document.getElementById('generate-button');
  if (!btn) return;
  btn.classList.remove('pulse');
  void btn.offsetWidth; // reflow to restart animation
  btn.classList.add('pulse');
  btn.addEventListener('animationend', () => btn.classList.remove('pulse'), { once: true });
}

// ─── Surprise button ──────────────────────────────────────────────────────────
document.getElementById('surprise-button').addEventListener('click', () => {
  const subjects = SURPRISE_SUBJECTS;
  subjectInput.value = subjects[Math.floor(Math.random() * subjects.length)];
  _pendingEnglishSubject = subjectInput.value; // SURPRISE_SUBJECTS are English
  subjectInput.focus();
  pulseDraw();
});

// ─── Coloring hint dismiss ────────────────────────────────────────────────────
const dismissHintBtn = document.getElementById('dismiss-hint');
if (dismissHintBtn) {
  dismissHintBtn.addEventListener('click', () => {
    const hint = document.getElementById('coloring-hint');
    if (hint) hint.hidden = true;
  });
}

// ─── Challenge strip share button ────────────────────────────────────────────
const challengeShareBtn = document.getElementById('challenge-share-btn');
if (challengeShareBtn) {
  challengeShareBtn.addEventListener('click', () => {
    document.getElementById('share-button').click();
  });
}

// ─── Daily word button ────────────────────────────────────────────────────────
const dailyWordRow   = document.getElementById('daily-word-row');
const dailyWordBtn   = document.getElementById('daily-word-btn');
const dailyWordValue = document.getElementById('daily-word-value');
const dailyInfoBtn   = document.getElementById('daily-word-info-btn');
const dailyInfoPopup = document.getElementById('daily-info-popup');
const { word: dailyWord, seed: dailySeed } = getDailyChallenge();
// Clear seed override when user manually changes the input
subjectInput.addEventListener('input', () => { _pendingSeedOverride = null; _pendingEnglishSubject = null; });

if (dailyWordRow && dailyWordBtn && dailyWordValue) {
  dailyWordValue.textContent = getTranslatedDailyWord(dailyWord, getCurrentLang());
  dailyWordRow.hidden = false;
  dailyWordBtn.addEventListener('click', () => {
    subjectInput.value = getTranslatedDailyWord(dailyWord, getCurrentLang());
    _pendingEnglishSubject = dailyWord; // use English original for the AI prompt
    _pendingSeedOverride = dailySeed;
    subjectInput.focus();
    pulseDraw(); // A1: guide user to click Draw instead of auto-submitting
  });
}
if (dailyInfoBtn && dailyInfoPopup) {
  dailyInfoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !dailyInfoPopup.classList.contains('hidden');
    dailyInfoPopup.classList.toggle('hidden', isOpen);
    dailyInfoBtn.classList.toggle('active', !isOpen);
  });
  document.addEventListener('click', () => {
    dailyInfoPopup.classList.add('hidden');
    dailyInfoBtn.classList.remove('active');
  });
  dailyInfoPopup.addEventListener('click', (e) => e.stopPropagation());
}

// ─── Initialization ───────────────────────────────────────────────────────────

// Mark native app so CSS can hide web-only elements (e.g. store badges)
if (window.Capacitor?.isNativePlatform?.()) {
  document.body.classList.add('is-native');
}

// Hide debug-only elements in production
if (!DEBUG) {
  const debugAside = document.getElementById('debug-aside');
  if (debugAside) debugAside.style.display = 'none';
  document.querySelectorAll('.debug-item').forEach(el => { el.style.display = 'none'; });
}

renderLegend();
applyTranslations();
loadFromShare();

// Hide native splash screen now that fonts + i18n are ready
if (window.Capacitor?.isNativePlatform?.()) {
  window.Capacitor.Plugins?.SplashScreen?.hide({ fadeOutDuration: 300 }).catch(() => {});
  // Show first-time onboarding after splash fade completes
  setTimeout(initOnboarding, 500);
}

// ─── Gallery: continue drawing ────────────────────────────────────────────────
async function continueArtwork(item) {
  showLoading();
  try {
    // 1. Restore clean line art (rebuilds baseImageData + regionMap via drawBaseImage)
    await renderGeneratedImage(item.lineArtDataUrl);

    // 2. Overwrite paintedImageData with the saved fill state
    const fillImg = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = item.fillDataUrl;
    });
    const fillC = document.createElement('canvas');
    fillC.width = previewCanvas.width;
    fillC.height = previewCanvas.height;
    fillC.getContext('2d').drawImage(fillImg, 0, 0, fillC.width, fillC.height);
    state.paintedImageData = fillC.getContext('2d').getImageData(0, 0, fillC.width, fillC.height);

    // 3. Restore which regions were already completed
    state.completedRegions = new Set(item.completedRegions || []);
    state.celebrationShown = false;
    state.coloringStartTime = Date.now();

    // 4. Reset undo stack (history from a previous session isn't replayable)
    state.undoStack = [];
    const undoBtn = document.getElementById('undo-button');
    if (undoBtn) undoBtn.disabled = true;

    // 5. Draw the restored fill state
    redrawCanvas();

    // 6. Show coloring UI elements
    const coloringHint = document.getElementById('coloring-hint');
    if (coloringHint) coloringHint.hidden = false;
    const challengeStrip = document.getElementById('challenge-strip');
    if (challengeStrip) challengeStrip.hidden = false;

    setStatus(t('done'));
  } catch {
    setStatus('Could not restore artwork — please generate a new one.', true);
  } finally {
    hideLoading();
    document.querySelector('.workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

initGalleryHandlers(continueArtwork);

// ─── Hero suggestion cards ────────────────────────────────────────────────────
const CARD_GRADIENTS = [
  'linear-gradient(135deg,#ff9a9e,#fecfef)',
  'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
  'linear-gradient(135deg,#d4fc79,#96e6a1)',
  'linear-gradient(135deg,#ffecd2,#fcb69f)',
  'linear-gradient(135deg,#e0c3fc,#8ec5fc)',
  'linear-gradient(135deg,#fddb92,#d1fdff)',
  'linear-gradient(135deg,#f9f,#c6f)',
  'linear-gradient(135deg,#b2f5ea,#81e6d9)',
];

// Shuffled once per visit; re-rendered on language change to update labels.
let examplePicks = null;

function renderExamples() {
  const grid = document.getElementById('examples-grid');
  if (!grid) return;
  // Shuffle once per session, reuse on subsequent renders
  if (!examplePicks) {
    const pool = [...EXAMPLE_SUGGESTIONS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    examplePicks = pool.slice(0, 4);
  }
  const lang = getCurrentLang();
  grid.innerHTML = examplePicks.map((item, idx) => {
    const label = item.labels?.[lang]
      || (item.subject.charAt(0).toUpperCase() + item.subject.slice(1));
    return `<button class="example-card" data-subject="${item.subject}" data-label="${label}" type="button" aria-label="${label}">
      <div class="example-card-art" style="background:${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]}">
        <span class="example-emoji">${item.emoji}</span>
      </div>
      <p class="example-label">${label}</p>
    </button>`;
  }).join('');
  grid.querySelectorAll('.example-card').forEach(card => {
    card.addEventListener('click', () => {
      // A1: populate input only — don't auto-draw
      // B1: use translated label so user sees their language in the input field
      subjectInput.value = card.dataset.label;
      _pendingEnglishSubject = card.dataset.subject; // use English original for the AI prompt
      subjectInput.focus();
      pulseDraw();
    });
  });
}
renderExamples();

// ─── Shuffle suggestions button ──────────────────────────────────────────────
document.getElementById('shuffle-cards-btn').addEventListener('click', () => {
  const btn = document.getElementById('shuffle-cards-btn');
  btn.classList.remove('spinning');
  void btn.offsetWidth;          // reflow to restart animation
  btn.classList.add('spinning');

  examplePicks = null;           // force fresh shuffle
  renderExamples();

  // Stagger card deal-in animation
  document.querySelectorAll('.example-card').forEach((card, i) => {
    card.style.animationDelay = `${i * 0.07}s`;
    card.classList.add('deal-in');
    card.addEventListener('animationend', () => card.classList.remove('deal-in'), { once: true });
  });
});

