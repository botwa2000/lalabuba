import { state, DEBUG } from './state.js';
import { PALETTES, SURPRISE_SUBJECTS } from './data.js';
import { sanitizeSubject, isSafeSubject } from './data.js';
import { t, applyTranslations, setLanguage } from './i18n.js';
import {
  form, subjectInput, showNumbersInput, difficultySelect, providerSelect,
  paletteSelect, previewCanvas, drawCanvas, printButton, downloadButton,
  debugPanel,
} from './dom.js';
import {
  renderGeneratedImage, findRegionAt, fillRegion, hexToRgb, redrawCanvas,
} from './canvas.js';
import {
  activePalette, setStatus, renderLegend, setColorCount, showLoading, hideLoading,
  openMaxPicker, closeMaxPicker, flashPaletteSwatch,
} from './ui.js';
import { generatePage, requestGeneratedImage } from './generate.js';
import { initDrawingTool } from './drawing.js';
import { initShareHandlers, loadFromShare } from './share.js';

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
  }
}

// ─── Form submit ─────────────────────────────────────────────────────────────
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
    await generatePage(subject);
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  } finally {
    submitButton.disabled = false;
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

// ─── Canvas click ─────────────────────────────────────────────────────────────
previewCanvas.addEventListener("click", (event) => {
  if (!state.regionMap) return;

  const rect = previewCanvas.getBoundingClientRect();
  const canvasX = Math.floor((event.clientX - rect.left) * (previewCanvas.width / rect.width));
  const canvasY = Math.floor((event.clientY - rect.top) * (previewCanvas.height / rect.height));

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
      for (const idx of pixels) {
        const o = idx * 4;
        paint[o] = base[o]; paint[o+1] = base[o+1]; paint[o+2] = base[o+2]; paint[o+3] = base[o+3];
      }
      state.completedRegions.delete(regionId);
      state.celebrationShown = false;
      redrawCanvas();
      setStatus(t('areaCleared'));
    }
    return;
  }

  let fillColor;
  if (state.selectedPaletteIndex === -1) {
    // Custom color — no constraint enforced, fills freely.
    fillColor = hexToRgb(state.customColor);
  } else {
    // Color-constraint: when numbers are shown, enforce the assigned palette color.
    if (showNumbersInput.checked && state.regionColorMap && state.regionColorMap.has(regionId)) {
      const required = state.regionColorMap.get(regionId);
      if (state.selectedPaletteIndex !== required) {
        const c = activePalette()[required];
        setStatus(t('needsColor', required + 1, c.label), false);
        flashPaletteSwatch(required);
        return;
      }
    }
    const palette = activePalette();
    fillColor = hexToRgb(palette[state.selectedPaletteIndex].color);
  }

  if (!state.coloringStartTime) state.coloringStartTime = Date.now();
  state.completedRegions.add(regionId);
  fillRegion(regionId, fillColor);
  const label = state.selectedPaletteIndex === -1 ? t('customColorLabel') : activePalette()[state.selectedPaletteIndex].label;
  setStatus(t('filled', label));
  checkCompletion();
  // Hide coloring hint on first successful fill
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

// ─── Size pills ───────────────────────────────────────────────────────────────
const canvasWrapper = document.querySelector(".canvas-wrapper");
canvasWrapper.classList.add("size-medium");

document.querySelectorAll(".size-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".size-pill").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    state.selectedSize = btn.dataset.size;
    canvasWrapper.classList.remove("size-small", "size-medium", "size-large", "size-xxl");
    canvasWrapper.classList.add(`size-${btn.dataset.size}`);
  });
});

// ─── Language buttons ─────────────────────────────────────────────────────────
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
});

// ─── Drawing tool ─────────────────────────────────────────────────────────────
initDrawingTool();

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

