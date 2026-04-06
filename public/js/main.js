import { state, DEBUG } from './state.js';
import { PALETTES, SURPRISE_SUBJECTS, EXAMPLE_SUGGESTIONS, getDailyChallenge } from './data.js';
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
import { initDrawingTool } from './drawing.js';
import { initShareHandlers, loadFromShare } from './share.js';
import { initZoom, getCanvasCoords } from './zoom.js';

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
    // Auto-save completed artwork to local gallery
    saveArtwork({
      subject: subjectInput.value.trim() || '?',
      difficulty: difficultySelect.value,
      colorCount: state.colorCount,
      previewCanvas,
      drawCanvas,
    }).then(() => setStatus(t('gallerySaved'))).catch(() => {});
  }
}

// ─── Turnstile ───────────────────────────────────────────────────────────────
// Auto-render uses data-callback="onTurnstileSuccess" on the widget div.
// This fires regardless of script/module load order — no manual render needed.
window.onTurnstileSuccess = (token) => { state.turnstileToken = token; };

function getTurnstileToken() {
  const isNative = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const subject = sanitizeSubject(subjectInput.value);
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
    await generatePage(subject, seedOverride);
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
  setStatus(t('undoBtn'));
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
    langDropdown.hidden = true;
    langToggle.setAttribute('aria-expanded', 'false');
  });
});

// ─── Drawing tool ─────────────────────────────────────────────────────────────
initDrawingTool();

// ─── Zoom ─────────────────────────────────────────────────────────────────────
const canvasFrame = document.querySelector('.canvas-frame');
if (canvasFrame) initZoom(canvasFrame, previewCanvas);

// ─── Share handlers ───────────────────────────────────────────────────────────
initShareHandlers();

// ─── Options toggle ───────────────────────────────────────────────────────────
document.getElementById('options-toggle').addEventListener('click', () => {
  const panel = document.getElementById('options-panel');
  const btn   = document.getElementById('options-toggle');
  const opening = panel.hidden;
  panel.hidden = !opening;
  btn.classList.toggle('open', opening);
});

// ─── Surprise button ──────────────────────────────────────────────────────────
document.getElementById('surprise-button').addEventListener('click', () => {
  const subjects = SURPRISE_SUBJECTS;
  subjectInput.value = subjects[Math.floor(Math.random() * subjects.length)];
  subjectInput.focus();
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
const dailyWordBtn = document.getElementById('daily-word-btn');
const dailyWordValue = document.getElementById('daily-word-value');
const { word: dailyWord, seed: dailySeed } = getDailyChallenge();
if (dailyWordBtn && dailyWordValue) {
  dailyWordValue.textContent = dailyWord;
  dailyWordBtn.hidden = false;
  dailyWordBtn.addEventListener('click', () => {
    subjectInput.value = dailyWord;
    _pendingSeedOverride = dailySeed;
    form.requestSubmit();
  });
}

// ─── Initialization ───────────────────────────────────────────────────────────

// Hide debug-only elements in production
if (!DEBUG) {
  const debugAside = document.getElementById('debug-aside');
  if (debugAside) debugAside.style.display = 'none';
  document.querySelectorAll('.debug-item').forEach(el => { el.style.display = 'none'; });
}

renderLegend();
applyTranslations();
loadFromShare();
initGalleryHandlers();

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
    return `<button class="example-card" data-subject="${item.subject}" type="button" aria-label="${label}">
      <div class="example-card-art" style="background:${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]}">
        <span class="example-emoji">${item.emoji}</span>
      </div>
      <p class="example-label">${label}</p>
    </button>`;
  }).join('');
  grid.querySelectorAll('.example-card').forEach(card => {
    card.addEventListener('click', () => {
      subjectInput.value = card.dataset.subject;
      form.requestSubmit();
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

