import { state, DEBUG } from './state.js';
import { PALETTES, EXAMPLE_SUGGESTIONS, randomCardSubject, getDailyChallenge, getTranslatedDailyWord, getTranslatedSubject, getSemanticPaletteOrder } from './data.js';
import { sanitizeSubject, isSafeSubject } from './data.js';
import { CRAYON_PACKS, packById, isPackUnlocked, unlockedPaletteIds, packsUnlockedAt } from './data.js';
import { saveArtwork, initGalleryHandlers, openGalleryModal } from './gallery.js';
import { recordCompletion, recordShare, recordSave, recordChallengeCreated, getProgress } from './progress.js';
import { awardForCompletion, addArtSticker, weekScene, SCENE_SUBJECTS } from './scenes.js';
import { isSoundOn, toggleSound, playComplete, bounce, sparkleBurst } from './fx.js';
import { isNarrateOn, toggleNarrate, narrateSupported, speak } from './narrate.js';
import { animateCompletion } from './canvas.js';
import { t, applyTranslations, setLanguage, getCurrentLang } from './i18n.js';
import {
  form, subjectInput, showNumbersInput, difficultySelect, providerSelect,
  paletteSelect, previewCanvas, drawCanvas, printButton, downloadButton,
  debugPanel,
} from './dom.js';
import {
  renderGeneratedImage, findRegionAt, fillRegion, floodFillAt, undoLastFill, hexToRgb, redrawCanvas,
} from './canvas.js';
import {
  activePalette, setStatus, renderLegend, setColorCount, showLoading, hideLoading,
  openMaxPicker, closeMaxPicker, flashPaletteSwatch,
} from './ui.js';
import { generatePage, requestGeneratedImage } from './generate.js';
import { initDrawingTool, setPaintEndCallback, setStrokeEndCallback, updateDrawCanvasMode, creditDrawPenSticker } from './drawing.js';
import { numberedCapFor, pickMeaningfulTargets, freeComplete, isCovered } from './completion-core.js';
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

// ─── Journal badge dot + days-colored pill ──────────────────────────────────
const JOURNAL_DIRTY_KEY = 'lalabuba-journal-dirty';

function markJournalDirty() {
  try { localStorage.setItem(JOURNAL_DIRTY_KEY, '1'); } catch {}
  const dot = document.getElementById('journal-dot');
  if (dot) dot.hidden = false;
}

function clearJournalDirty() {
  try { localStorage.removeItem(JOURNAL_DIRTY_KEY); } catch {}
  const dot = document.getElementById('journal-dot');
  if (dot) dot.hidden = true;
}

// Kid-friendly toast for freshly-earned stickers from a record* event. Shows the
// first new sticker (the most significant) via setStatus, lights the Journal
// "new" dot, and keeps the masterpiece count badge in sync.
function cap(id) { return id.charAt(0).toUpperCase() + id.slice(1); }
function toastNewBadges(newBadges) {
  if (!newBadges || !newBadges.length) return;
  const b = newBadges[0];
  try { setStatus(t('stickerEarnedToast', b.emoji, t(`badge${cap(b.id)}Title`))); } catch {}
  markJournalDirty();
  refreshJournalCount();
}

function refreshDaysColoredPill() {
  const pill = document.getElementById('days-colored-pill');
  if (!pill) return;
  let days = 0;
  try { days = getProgress().daysColored || 0; } catch {}
  if (days > 0) {
    pill.textContent = t('daysColoredPill', days);
    pill.hidden = false;
  } else {
    pill.hidden = true;
  }
}

// Masterpiece count badge on the Journal icon. The header previously showed only
// a boolean "new" dot, so a child who finished 2 pictures saw no "2" anywhere up
// top — they read the days-colored pill ("1 day") as a wrong count. This surfaces
// the real masterpiece tally on the Journal button so the count is unambiguous,
// and doubles as the always-visible "you have rewards here" announcement.
function refreshJournalCount() {
  let n = 0;
  try { n = getProgress().totalCompleted || 0; } catch {}
  const badge = document.getElementById('journal-count');
  if (badge) {
    if (n > 0) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
  // First-time announcement: before any picture is finished, a "🏆 Earn stickers!"
  // teaser sits beside the Journal icon so it's clear from the very first screen
  // that rewards/progress exist. It disappears once the child has a masterpiece
  // (the count badge takes over). CSS restricts it to the hero state.
  const teaser = document.getElementById('rewards-teaser');
  if (teaser) teaser.hidden = n > 0;
  // Mobile (where the wide teaser is hidden): pulse the Journal icon for first-
  // time users so the rewards entry is still noticeable. CSS scopes the pulse to
  // the mobile breakpoint, so adding the class on desktop is harmless.
  const jbtn = document.getElementById('journal-btn');
  if (jbtn) jbtn.classList.toggle('attention', n === 0);
}

// The meaningful areas of the picture = the largest K regions (excluding the
// outer background, K = difficulty-scaled numberedCapFor). Computed from the
// per-pixel region sets that precompute builds in BOTH modes, so free-colour
// pages have a target set even though they never draw number badges. The cap /
// threshold / selection math lives in completion-core.js (unit-tested).
function meaningfulTargets() {
  if (!state.regionPixels || state.regionPixels.size === 0) return [];
  // Cache per image: this runs on every fill, and sorting all regions (thousands
  // on Extreme) each time would be wasteful. Invalidated on new image / difficulty
  // change (state.numberTargets = null).
  if (state.numberTargets) return state.numberTargets;
  const cap = numberedCapFor(difficultySelect.value);
  const entries = [...state.regionPixels.entries()].map(([id, px]) => [id, px.length]);
  state.numberTargets = pickMeaningfulTargets(entries, cap, state.backgroundRegionId);
  return state.numberTargets;
}

// Which target areas count as coloured in free mode: tap/paint fills, PLUS areas
// the child covered enough by freehand (pencil) on the draw layer. Coverage is
// measured forgivingly (≥45% of the area's pixels) because children colour
// unevenly, leaving white gaps — that should still count as "done".
function freeColouredRegions(targets) {
  const covered = new Set();
  for (const id of targets) if (state.completedRegions.has(id)) covered.add(id);
  // Only read back the freehand layer if the brush was actually used. Tap-only
  // colouring (the common case) never touches getImageData — this is what keeps
  // checkCompletion cheap on every fill and avoids the page freezing.
  if (!state.hasFreehand) return covered;
  try {
    const dctx = drawCanvas.getContext('2d');
    const dw = drawCanvas.width, dh = drawCanvas.height;
    if (dw && dh) {
      const data = dctx.getImageData(0, 0, dw, dh).data;
      for (const id of targets) {
        if (covered.has(id)) continue;
        const px = state.regionPixels.get(id);
        if (!px || !px.length) continue;
        const step = Math.max(1, Math.floor(px.length / 400));
        let cov = 0, cnt = 0;
        for (let i = 0; i < px.length; i += step) {
          if (data[px[i] * 4 + 3] > 20) cov++;
          cnt++;
        }
        if (isCovered(cov, cnt)) covered.add(id);
      }
    }
  } catch { /* getImageData can throw on a tainted canvas; ignore */ }
  return covered;
}

// Any freehand marks at all (sampled) — gates the manual finish button so it
// can't claim a reward on a page the child only lightly doodled-then-cleared.
function hasPencilMarks() {
  if (!state.hasFreehand) return false;
  try {
    const dctx = drawCanvas.getContext('2d');
    const dw = drawCanvas.width, dh = drawCanvas.height;
    if (!dw || !dh) return false;
    const data = dctx.getImageData(0, 0, dw, dh).data;
    for (let i = 3; i < data.length; i += 4 * 13) { if (data[i] > 20) return true; }
    return false;
  } catch { return false; }
}

function checkCompletion() {
  if (state.celebrationShown) return;

  const numbersOn = showNumbersInput.checked && !state.isFreeMode;
  if (numbersOn) {
    // Guided colour-by-number: strict — every numbered area in its assigned colour.
    if (!state.regionColorMap || state.regionColorMap.size === 0) return;
    if (![...state.regionColorMap.keys()].every((id) => state.completedRegions.has(id))) return;
  } else {
    // Free-colour: forgiving, self-scaling ~90% of the meaningful areas coloured
    // with ANY colour (tap/paint fill OR enough pencil coverage). This is the
    // logical finish + reward a numberless page used to lack entirely.
    const targets = meaningfulTargets();
    if (!targets.length) return;
    const covered = freeColouredRegions(targets);
    const done = targets.filter((id) => covered.has(id)).length;
    if (!freeComplete(targets.length, done)) return;
  }

  celebrate();
}

// Manual finish (free-colour mode): the child taps "I'm finished!" to claim their
// reward whenever they feel done — the most reliable + motivating "done" signal
// for uneven/pencil colouring. Bypasses the ~90% auto-threshold (the child is the
// judge) but still requires that SOMETHING was coloured.
function finishColoringManually() {
  if (state.celebrationShown) return;
  const targets = meaningfulTargets();
  const covered = targets.length ? freeColouredRegions(targets) : new Set();
  const hasProgress =
    state.completedRegions.size > 0 || covered.size > 0 || hasPencilMarks() || state.anyFillApplied;
  if (!hasProgress) { setStatus(t('finishNeedsColor')); return; }
  celebrate();
}

function celebrate() {
  state.celebrationShown = true;
  const subjectText = subjectInput.value.trim() || '?';
  const elapsed = state.coloringStartTime ? Date.now() - state.coloringStartTime : 0;
  const timeEl = document.getElementById("celebration-time");
  if (timeEl) timeEl.textContent = elapsed > 0 ? t('celebTime', formatTime(elapsed)) : '';

  // Record progress + persist the masterpiece exactly ONCE per coloring session.
  // canvas.js clears state.celebrationShown on undo so the overlay can re-appear
  // after an undo-then-refill, and a piece continued from the Journal is already
  // counted — in BOTH cases recording again would double-count stats/badges and
  // save a duplicate artwork. state.completionRecorded gates the side-effects and
  // is reset only when a brand-new image loads (drawBaseImage) — never on undo.
  let progress = null;
  let newBadges = [];
  const firstTime = !state.completionRecorded;
  if (firstTime) {
    try {
      const r = recordCompletion({
        // English subject drives locale-stable theme (Explorer) classification;
        // fall back to the displayed text if no English original was captured.
        subject: state.lastEnglishSubject || subjectText,
        difficulty: difficultySelect.value,
        palette: paletteSelect.value,
        colorCount: state.colorCount,
        isCustom: !!state.lastSubjectIsCustom,
        isDaily: !!state.lastSubjectIsDaily,
      });
      progress = r.progress;
      newBadges = r.newBadges;
      // Crayon-pack unlocks: a completion that crosses a pack threshold reveals a
      // new palette — celebrate it (separate from sticker reveal so both show).
      try {
        const unlocked = packsUnlockedAt(progress.totalCompleted);
        if (unlocked.length) {
          const pk = unlocked[0];
          setStatus(t('crayonUnlockedToast', t(`pack${cap(pk.id)}Name`)));
        }
      } catch {}
      // Brush tool unlock: exactly at the threshold, show celebration.
      try {
        if (progress.totalCompleted === BRUSH_UNLOCK_AT) {
          setStatus(t('brushUnlockedToast'));
          syncBrushLock();
        }
      } catch {}
      // Sticker Scenes: theme-matched decoration drip + scene unlocks.
      try {
        const { newDecos, newScenes } = awardForCompletion(
          state.lastEnglishSubject || subjectText, progress.totalCompleted);
        if (newScenes && newScenes.length) {
          setStatus(t('sceneUnlockedToast', t(`scene${cap(newScenes[0].id)}Name`)));
          markJournalDirty();
        } else if (newDecos && newDecos.length) {
          setStatus(t('decoUnlockedToast', newDecos[0].emoji, newDecos.length));
          markJournalDirty();
        }
      } catch {}
    } catch {}
    state.completionRecorded = true;
  } else {
    try { progress = getProgress(); } catch {}
  }

  const journalEl = document.getElementById("celebration-journal");
  if (journalEl) journalEl.textContent = t('celebJournalSaved');
  const statsEl = document.getElementById("celebration-stats");
  if (statsEl && progress) statsEl.textContent = t('celebStats', progress.totalCompleted, progress.streak);

  const stickerEl = document.getElementById("celebration-sticker");
  if (stickerEl) {
    if (newBadges && newBadges.length) {
      const b = newBadges[0]; // reveal the most significant new sticker
      const emoji = document.getElementById("sticker-emoji");
      const title = document.getElementById("sticker-title");
      const desc  = document.getElementById("sticker-desc");
      if (emoji) emoji.textContent = b.emoji;
      if (title) title.textContent = t(`badge${b.id.charAt(0).toUpperCase()}${b.id.slice(1)}Title`);
      if (desc)  desc.textContent  = t(`badge${b.id.charAt(0).toUpperCase()}${b.id.slice(1)}Desc`);
      stickerEl.hidden = false;
      markJournalDirty(); // new sticker waiting → badge dot on the Journal icon
    } else {
      stickerEl.hidden = true;
    }
  }
  markJournalDirty(); // a new masterpiece is always waiting in the Journal
  refreshDaysColoredPill();
  refreshJournalCount(); // keep the masterpiece count on the Journal icon in sync

  // Play the "comes to life" beat on the finished canvas, THEN slide in the
  // celebration card (animateCompletion resolves after the reveal + bounce +
  // sparkles + chime). Falls back to showing the card immediately on any error.
  const _showCeleb = () => {
    const c = document.getElementById("celebration");
    c.classList.remove("hidden");
    c.setAttribute("aria-hidden", "false");
    speak(t('narratePraise')); // read-aloud praise (no-op unless narration is on)
  };
  try { animateCompletion().then(_showCeleb, _showCeleb); } catch { _showCeleb(); }

  if (!firstTime) return; // already saved this session — don't duplicate the artwork

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

    // Capture the finished page as a reusable "art sticker" for Sticker Scenes —
    // the child's own picture becomes something they can place, resize and rotate.
    // 240px (was 120) so it stays crisp even at the max 3.5× scene scale; a
    // flat-fill PNG this size is still only a few KB and we cap to 24.
    try {
      const TH = 240;
      const thumbC = document.createElement('canvas');
      thumbC.width = TH; thumbC.height = TH;
      const tctx = thumbC.getContext('2d');
      tctx.imageSmoothingQuality = 'high';
      tctx.fillStyle = '#fff';
      tctx.fillRect(0, 0, TH, TH);
      tctx.drawImage(fillC, 0, 0, TH, TH);
      addArtSticker({
        subject: state.lastEnglishSubject || subjectInput.value.trim() || '',
        thumb: thumbC.toDataURL('image/png'),
        ts: Date.now(),
      });
      markJournalDirty();
    } catch { /* ignore capture failures */ }
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

// ─── Theme toggle ────────────────────────────────────────────────────────────
(function() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function syncIcon() {
    const dark = isDark();
    const aria = dark ? t('themeToLight') : t('themeToDark');
    const icon = document.getElementById('theme-toggle-icon');
    const label = document.getElementById('theme-toggle-label');
    if (icon)  icon.textContent  = dark ? '☀️' : '🌙';
    if (label) label.textContent = aria;
    btn.setAttribute('aria-label', aria);
  }

  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lalabuba-theme', next);
    syncIcon();
    // Auto-close the ⚙️ settings menu after the choice is applied.
    const sm = document.getElementById('settings-menu');
    const st = document.getElementById('settings-toggle');
    if (sm) sm.hidden = true;
    if (st) st.setAttribute('aria-expanded', 'false');
  });

  syncIcon();
})();

// ─── Turnstile ───────────────────────────────────────────────────────────────
// Silent pre-load: widget starts off-screen at page load and obtains a token
// in the background. For ~99 % of real users the token is ready before Draw!
// is clicked — no popup, no interaction. The widget moves on-screen ONLY when
// CF explicitly needs a human click (before-interactive-callback).
window.onTurnstileSuccess = (token) => {
  state.turnstileToken = token;
  document.body.classList.remove('ts-needs-interaction');
};
window.onTurnstileExpired = () => { state.turnstileToken = null; };
window.onTurnstileError   = () => {
  state.turnstileToken = null;
  document.body.classList.remove('ts-needs-interaction');
};
// CF fires this just before showing the visual checkbox — move widget on-screen.
window.onTurnstileBeforeInteractive = () => {
  document.body.classList.add('ts-needs-interaction');
};
// CF fires this after the user completes the interactive challenge.
window.onTurnstileAfterInteractive = () => {
  document.body.classList.remove('ts-needs-interaction');
};

function getTurnstileToken() {
  const isNative = window.Capacitor?.isNativePlatform?.() ||
                   window.location.protocol === 'capacitor:' ||
                   window.location.protocol === 'ionic:';
  if (isNative || !window.turnstile) return Promise.resolve(null);
  if (state.turnstileToken) return Promise.resolve(state.turnstileToken);
  const el = document.getElementById('turnstile-widget');
  const existing = el ? window.turnstile.getResponse(el) : null;
  if (existing) return Promise.resolve(existing);
  // Token not ready yet — wait silently. If CF needs a human click it will call
  // onTurnstileBeforeInteractive which moves the widget on-screen automatically.
  return new Promise((resolve) => {
    const poll = setInterval(() => {
      if (state.turnstileToken) { clearInterval(poll); clearTimeout(timer); resolve(state.turnstileToken); }
    }, 100);
    // 15 s grace period, then pass null so the API call still proceeds.
    const timer = setTimeout(() => { clearInterval(poll); resolve(null); }, 15000);
  });
}

// ─── Form submit ─────────────────────────────────────────────────────────────
let _pendingSeedOverride = null;
// When a card / daily-word / surprise sets this, the English original is used
// directly for the AI prompt (skips server translation). Cleared on manual input.
let _pendingEnglishSubject = null;
// Set true by either daily-word button so a finished daily-word picture credits
// the Daily Star sticker / mission. Cleared on manual input (see input handler).
let _pendingIsDaily = false;

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pendingEnglish = _pendingEnglishSubject;
  _pendingEnglishSubject = null;
  // Capture how the subject was chosen so completion can credit the right
  // stickers. A predefined card/daily/surprise sets pendingEnglish → not the
  // child's own typed idea (isCustom = false). When the child types their own
  // word, pendingEnglish is null → isCustom = true. isDaily is set only by the
  // daily-word buttons. The English subject (predefined original, else the typed
  // text) drives locale-stable theme classification in recordCompletion.
  state.lastSubjectIsCustom = !pendingEnglish;
  state.lastSubjectIsDaily = _pendingIsDaily;
  state.lastEnglishSubject = pendingEnglish || subjectInput.value.trim();
  _pendingIsDaily = false;
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
    state.paletteOverride = getSemanticPaletteOrder(
      pendingEnglish || subject, paletteSelect.value, PALETTES[paletteSelect.value]);
    // Re-render the legend in the new (semantic) order BEFORE the image draws, so
    // the displayed/highlighted swatch, the number badges, and the colour a tap
    // actually fills all use ONE consistent order. Without this the swatches kept
    // the old order while activePalette() switched to the new one — so a tap
    // filled a different colour than the one shown selected (e.g. red→blue).
    renderLegend();
    await generatePage(subject, seedOverride, !!pendingEnglish);
    updateFinishBtnVisibility();
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  } finally {
    submitButton.disabled = false;
    // Clear token and restart the silent background challenge for the next Draw.
    // Widget stays off-screen (default CSS); ts-needs-interaction is already clear.
    state.turnstileToken = null;
    const tsEl = document.getElementById('turnstile-widget');
    if (window.turnstile && tsEl) window.turnstile.reset(tsEl);
  }
});

// ─── Show numbers checkbox ───────────────────────────────────────────────────
showNumbersInput.addEventListener("change", () => {
  redrawCanvas(); // just re-overlays/removes number badges — never resets fills
  updateFinishBtnVisibility();
});

// ─── Palette select ──────────────────────────────────────────────────────────
paletteSelect.addEventListener("change", async () => {
  state.paletteOverride = null; // user explicitly changed palette — clear semantic override
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
  state.numberTargets = null; // cap changed → recompute free-mode targets

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

// Erase a single region by id, recording undo. Skips if already erased this stroke.
let _erasedThisStroke = new Set();
function eraseRegionById(regionId) {
  if (!regionId || _erasedThisStroke.has(regionId)) return;
  const pixels = state.regionPixels.get(regionId);
  if (!pixels) return;
  const paint = state.paintedImageData.data;
  const base  = state.baseImageData.data;
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
  const count = undoEntries.length / 5;
  const record = new Uint8Array(count * 7);
  for (let i = 0, b = 0; i < undoEntries.length; i += 5, b += 7) {
    const idx = undoEntries[i];
    record[b] = idx & 0xff; record[b+1] = (idx>>8)&0xff; record[b+2] = (idx>>16)&0xff;
    record[b+3] = undoEntries[i+1]; record[b+4] = undoEntries[i+2];
    record[b+5] = undoEntries[i+3]; record[b+6] = undoEntries[i+4];
  }
  pushUndo(regionId, { success: true, record }, completedBefore);
  _erasedThisStroke.add(regionId);
}

// Pointer-based erase: fires immediately (no 300ms touch delay) and supports drag-to-erase.
let _eraseDown = false;
previewCanvas.addEventListener('pointerdown', (e) => {
  if (!state.eraseMode || isPanMode() || state.colorMode !== 'tap' || !state.regionMap) {
    if (state.isSegmenting && state.eraseMode) setStatus(t('segmenting'));
    return;
  }
  e.preventDefault();
  _eraseDown = true;
  _erasedThisStroke = new Set();
  previewCanvas.setPointerCapture(e.pointerId);
  const { x, y } = getCanvasCoords(e);
  eraseRegionById(findRegionAt(x, y));
});
previewCanvas.addEventListener('pointermove', (e) => {
  if (!_eraseDown || !state.eraseMode || !state.regionMap) return;
  const { x, y } = getCanvasCoords(e);
  eraseRegionById(findRegionAt(x, y));
});
previewCanvas.addEventListener('pointerup',     () => { _eraseDown = false; });
previewCanvas.addEventListener('pointercancel', () => { _eraseDown = false; });

previewCanvas.addEventListener("click", (event) => {
  if (isPanMode()) return;
  if (state.colorMode !== 'tap') return;
  if (state.eraseMode) return;
  if (!state.paintedImageData) return; // no image yet

  const { x: canvasX, y: canvasY } = getCanvasCoords(event);

  // Determine fill color (let — may be updated below by color auto-select)
  let fillColor = state.selectedPaletteIndex === -1
    ? hexToRgb(state.customColor)
    : hexToRgb(activePalette()[state.selectedPaletteIndex].color);

  // regionId: 0 until the background worker finishes — that's OK. Used only for
  // color enforcement, double-click batch, and completion tracking.
  const regionId = findRegionAt(canvasX, canvasY);

  // Color guidance in numbers mode — block fill if wrong color, flash the correct one.
  // The kid must select the right colour first; this is the core colour-by-number mechanic.
  if (!state.isFreeMode && showNumbersInput.checked && regionId > 0 && state.regionColorMap?.size > 0) {
    // Direct hit (exact numbered region); fall back to nearest badge centroid when
    // the worker region isn't one of the N badge regions (common on complex images).
    let required = state.regionColorMap.get(regionId) ?? -1;
    if (required < 0 && state.numberRegions?.length > 0) {
      let bestDist = Infinity;
      for (const reg of state.numberRegions) {
        const mid = reg._mapId ?? 0;
        if (!(mid > 0) || !state.regionColorMap.has(mid)) continue;
        const dx = canvasX - reg.x, dy = canvasY - reg.y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; required = state.regionColorMap.get(mid); }
      }
    }
    if (required >= 0 && state.selectedPaletteIndex !== required) {
      const colorLabel = activePalette()[required]?.label ?? '';
      flashPaletteSwatch(required);
      setStatus(t('needsColor', required + 1, colorLabel));
      return;
    }
  }

  if (DEBUG && debugPanel) {
    debugPanel.textContent = [
      `Clicked     : (${canvasX}, ${canvasY})`,
      `Region id   : ${regionId > 0 ? regionId : "none"}${regionId === state.backgroundRegionId ? " (bg)" : ""} (${state.regionPixels?.get(regionId)?.length ?? 0} px)`,
      `Mode        : fill ${activePalette()[state.selectedPaletteIndex]?.label}`,
    ].join("\n");
    document.getElementById("debug-details").open = true;
  }

  // ── Double-click: fill ALL regions of the same color number ────────────────
  const now = Date.now();
  const isDouble = (now - _lastClickMs) < 400 && _lastClickId === regionId && regionId > 0;
  _lastClickMs = now; _lastClickId = regionId;

  if (isDouble && showNumbersInput.checked && state.regionColorMap?.has(regionId)) {
    const colorNum = state.regionColorMap.get(regionId);
    const batchRecords = [];
    if (!state.coloringStartTime) state.coloringStartTime = Date.now();
    for (const [rid, num] of state.regionColorMap) {
      if (num === colorNum && !state.completedRegions.has(rid)) {
        state.completedRegions.add(rid);
        const result = fillRegion(rid, fillColor);
        if (result.success) batchRecords.push({ regionId: rid, record: result.record, completedBefore: false });
      }
    }
    if (batchRecords.length) {
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

  // Primary fill: use exact region pixels when worker has finished (accurate,
  // no MAX_FILL cap). fillRegion works for ANY region including the background —
  // it has the exact pixel list so it never overflows. Fall back to BFS only when
  // regionMap is not yet ready (segmentation still running).
  let fillResult;
  if (state.regionMap && regionId > 0) {
    fillResult = fillRegion(regionId, fillColor);
  } else {
    fillResult = floodFillAt(canvasX, canvasY, fillColor);
  }
  if (!fillResult.success) {
    if (state.isSegmenting) setStatus(t('segmentingHint'), false);
    return;
  }

  state.anyFillApplied = true;

  // If regionMap is ready, mark the corresponding region for completion tracking.
  const completedBefore = state.completedRegions.has(regionId);
  if (regionId > 0) state.completedRegions.add(regionId);

  pushUndo(regionId, fillResult, completedBefore);

  const label = state.selectedPaletteIndex === -1
    ? t('customColorLabel')
    : activePalette()[state.selectedPaletteIndex].label;
  if (showNumbersInput.checked && state.regionColorMap && state.regionColorMap.size > 0) {
    const total = state.regionColorMap.size;
    const done = [...state.regionColorMap.keys()].filter(id => state.completedRegions.has(id)).length;
    setStatus(done < total ? t('filledProgress', label, done, total) : t('filled', label));
  } else {
    setStatus(t('filled', label));
  }
  speak(label);
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

  // Explicit Save → credit the Keeper / Collector / Gallery Star stickers.
  try { toastNewBadges(recordSave().newBadges); } catch {}
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

    // Credit the Sharing / Super Sharer stickers once the artwork actually leaves
    // (a successful Web Share OR the desktop download fallback). A user-cancelled
    // share (AbortError) does NOT count.
    const creditShare = () => { try { toastNewBadges(recordShare().newBadges); } catch {} };

    // Try Web Share API (mobile)
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await new Promise(r => tmp.toBlob(r, 'image/png'));
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Lalabuba — my coloring', text: '🎨 Look what I colored!' });
          creditShare();
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') { /* fall through to download */ }
        else return; // user cancelled — no credit
      }
    }

    // Desktop fallback: download PNG
    const link    = document.createElement('a');
    link.href     = tmp.toDataURL('image/png');
    link.download = filename;
    link.click();
    creditShare();
  });
}

// ─── Celebration "what-next" loop ────────────────────────────────────────────
function closeCelebration() {
  const c = document.getElementById("celebration");
  c.classList.add("hidden");
  c.setAttribute("aria-hidden", "true");
  // Reset the one-shot sticker reveal for the next completion.
  const sticker = document.getElementById("celebration-sticker");
  if (sticker) sticker.hidden = true;
}

// Keep coloring: dismiss and stay on the finished picture.
document.getElementById("celebration-keep").addEventListener("click", closeCelebration);

// Again: same subject, new picture — closes the loop straight back to creation.
document.getElementById("celebration-again").addEventListener("click", () => {
  closeCelebration();
  const regen = document.getElementById("regen-button");
  if (regen && !regen.disabled) regen.click();
});

// New: clear the subject and return to the create surface.
document.getElementById("celebration-new").addEventListener("click", () => {
  closeCelebration();
  subjectInput.value = "";
  document.querySelector('.app')?.classList.add('app-hero');
  subjectInput.focus();
});

// Share: reuse the existing share-artwork action (the growth engine).
document.getElementById("celebration-share").addEventListener("click", () => {
  closeCelebration();
  const shareBtn = document.getElementById("share-artwork-btn");
  if (shareBtn && !shareBtn.disabled) shareBtn.click();
});

// Print: reuse the existing print action.
document.getElementById("celebration-print").addEventListener("click", () => {
  closeCelebration();
  const printBtn = document.getElementById("print-button");
  if (printBtn) printBtn.click(); else window.print();
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

// (Removed dead .count-pill / .count-max-pill / .palette-pill listeners — those
// elements no longer exist in index.html; settings are driven by the chips.)

// ─── Regen button ─────────────────────────────────────────────────────────────
const regenButton = document.getElementById('regen-button');
regenButton.addEventListener('click', async () => {
  const subject = sanitizeSubject(subjectInput.value);
  if (!subject) return;
  regenButton.disabled = true;
  const submitButton = document.getElementById('generate-button');
  submitButton.disabled = true;
  try {
    state.paletteOverride = getSemanticPaletteOrder(subject, paletteSelect.value, PALETTES[paletteSelect.value]);
    renderLegend(); // keep swatches/badges/fill in one consistent order (see submit handler)
    await generatePage(subject);
    updateFinishBtnVisibility();
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
  // The button now lives in the ⚙️ menu — close the menu and bring the panel
  // (which renders down in the form) into view.
  const sm = document.getElementById('settings-menu');
  const st = document.getElementById('settings-toggle');
  if (sm) sm.hidden = true;
  if (st) st.setAttribute('aria-expanded', 'false');
  if (!panel.hidden) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    // Refresh BOTH daily-word displays — the hero pill (config panel) AND the
    // search-area proxy pill. Previously only the first was updated, so the
    // word-of-the-day stayed stuck in the prior language on the other element.
    const lang = getCurrentLang();
    if (dailyWordValue) {
      dailyWordValue.textContent = getTranslatedDailyWord(dailyWord, lang);
    }
    const hdt = document.getElementById('hero-daily-text');
    if (hdt) hdt.textContent = getTranslatedDailyWord(dailyWord, lang);
    updateDiffChip(); updatePaletteChip(); updateNumbersChip(); // refresh translated chip titles
    refreshWeekScenePill(); // re-translate the scene-of-the-week pill
    syncCanvasNumbersBtn(); // re-sync after applyTranslations() resets data-i18n buttons
    langDropdown.hidden = true;
    langToggle.setAttribute('aria-expanded', 'false');
    // Language is a terminal choice — auto-close the whole ⚙️ settings menu too.
    const sm = document.getElementById('settings-menu');
    const st = document.getElementById('settings-toggle');
    if (sm) sm.hidden = true;
    if (st) st.setAttribute('aria-expanded', 'false');
  });
});

// ─── Settings (⚙️) menu — holds Theme, Language, How-to-play ───────────────────
const settingsToggle = document.getElementById('settings-toggle');
const settingsMenu   = document.getElementById('settings-menu');
if (settingsToggle && settingsMenu) {
  settingsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = settingsMenu.hidden;
    settingsMenu.hidden = !opening;
    settingsToggle.setAttribute('aria-expanded', String(opening));
    if (!opening) langDropdown.hidden = true; // closing the menu also closes lang list
  });
  // Clicks inside the menu shouldn't close it — except the language controls,
  // which manage their own state and should let the menu close after a pick.
  settingsMenu.addEventListener('click', (e) => {
    if (!e.target.closest('#lang-toggle') && !e.target.closest('.lang-option')) {
      e.stopPropagation();
    }
  });
  document.addEventListener('click', (e) => {
    if (!settingsMenu.contains(e.target) && e.target !== settingsToggle) {
      settingsMenu.hidden = true;
      settingsToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// ─── Drawing tool ─────────────────────────────────────────────────────────────
initDrawingTool();

// ─── Coloring mode toggle (tap / pencil / brush) ──────────────────────────────
const modeTapBtn    = document.getElementById('mode-tap-btn');
const modePencilBtn = document.getElementById('mode-pencil-btn');
const modeBrushBtn  = document.getElementById('mode-brush-btn');
const drawToolsGroup = document.getElementById('draw-tools-group');

const BRUSH_UNLOCK_AT = 3; // completions required to unlock the Brush tool

function isBrushUnlocked() {
  try { return (getProgress().totalCompleted || 0) >= BRUSH_UNLOCK_AT; } catch { return false; }
}

function syncBrushLock() {
  if (!modeBrushBtn) return;
  const locked = !isBrushUnlocked();
  modeBrushBtn.classList.toggle('mode-btn-locked', locked);
  modeBrushBtn.title = locked ? t('brushLocked', BRUSH_UNLOCK_AT) : '';
}

function setColorMode(mode) {
  // Gate: Brush requires BRUSH_UNLOCK_AT completions.
  if (mode === 'brush' && !isBrushUnlocked()) {
    setStatus(t('brushLocked', BRUSH_UNLOCK_AT), true);
    syncBrushLock();
    return;
  }
  state.colorMode = mode;
  if (modeTapBtn)    modeTapBtn.classList.toggle('active',    mode === 'tap');
  if (modePencilBtn) modePencilBtn.classList.toggle('active', mode === 'pencil');
  if (modeBrushBtn)  modeBrushBtn.classList.toggle('active',  mode === 'brush');
  if (drawToolsGroup) drawToolsGroup.style.display = (mode === 'pencil' || mode === 'brush') ? '' : 'none';
  updateDrawCanvasMode();
  if (mode === 'pencil') {
    setStatus(t('pencilMode'));
    const badges = creditDrawPenSticker();
    if (badges.length) {
      const b = badges[0];
      const cap = b.id.charAt(0).toUpperCase() + b.id.slice(1);
      setStatus(t('stickerEarnedToast', b.emoji, t(`badge${cap}Title`)));
      try { localStorage.setItem('lalabuba-journal-dirty', '1'); } catch {}
    }
  }
  if (mode === 'brush') {
    setStatus(t('brushMode'));
    const badges = creditDrawPenSticker();
    if (badges.length) {
      const b = badges[0];
      const cap = b.id.charAt(0).toUpperCase() + b.id.slice(1);
      setStatus(t('stickerEarnedToast', b.emoji, t(`badge${cap}Title`)));
      try { localStorage.setItem('lalabuba-journal-dirty', '1'); } catch {}
    }
  }
}

// Re-evaluate lock state on page show (in case progress updated elsewhere).
syncBrushLock();

if (modeTapBtn)    modeTapBtn.addEventListener('click',    () => setColorMode('tap'));
if (modePencilBtn) modePencilBtn.addEventListener('click', () => setColorMode('pencil'));
if (modeBrushBtn)  modeBrushBtn.addEventListener('click',  () => setColorMode('brush'));

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
// Pencil/freehand strokes also re-check free-mode coverage completion so a child
// who colours by hand (unevenly) still earns the auto-celebration.
setStrokeEndCallback(() => { try { checkCompletion(); } catch {} });

// ─── Zoom ─────────────────────────────────────────────────────────────────────
const canvasFrame = document.querySelector('.canvas-frame');
if (canvasFrame) initZoom(canvasFrame, previewCanvas);

// ─── Config panel toggle (desktop sidebar + mobile drawer) ────────────────────
const configPanel    = document.getElementById('config-panel');
const panelToggleBtn = document.getElementById('panel-toggle');
const mobileMenuBtn  = document.getElementById('mobile-menu-btn');

function isPhoneLandscape() {
  // Use screen.orientation.angle — immune to keyboard-open shrinking window.innerHeight.
  // Use screen.height (physical) not window.innerHeight (CSS viewport, keyboard-affected).
  const angle = screen?.orientation?.angle ?? (typeof window.orientation === 'number' ? window.orientation : null);
  if (angle !== null) {
    return (Math.abs(angle) === 90 || Math.abs(angle) === 270) && screen.height <= 500;
  }
  return screen.height <= 500 && screen.width > screen.height;
}

function togglePanel() {
  const isMobilePortrait = window.innerWidth < 768 && !isPhoneLandscape();
  if (isMobilePortrait) {
    const willOpen = !configPanel?.classList.contains('mobile-open');
    if (willOpen) configPanel?.classList.remove('collapsed'); // collapsed would pin max-height:0
    configPanel?.classList.toggle('mobile-open', willOpen);
    if (mobileMenuBtn) {
      mobileMenuBtn.textContent = willOpen ? '✕' : '☰';
      mobileMenuBtn.setAttribute('aria-label', willOpen ? 'Close settings' : 'Open settings');
    }
  } else {
    configPanel?.classList.toggle('collapsed');
    if (panelToggleBtn) {
      panelToggleBtn.textContent = configPanel?.classList.contains('collapsed') ? '▶' : '◀';
    }
  }
}

// Expand sidebar in phone landscape so prompt input is immediately visible
function syncSidebarToOrientation() {
  const examplesGrid  = document.getElementById('examples-grid');
  const shuffleBtn    = document.getElementById('shuffle-cards-btn');
  const heroTagline   = document.querySelector('.hero-tagline');
  const regenBtn      = document.getElementById('regen-button');
  if (isPhoneLandscape()) {
    configPanel?.classList.remove('collapsed');
    configPanel?.classList.remove('mobile-open');
    if (panelToggleBtn) panelToggleBtn.textContent = '◀';
    // Hide non-essential elements so Draw button and text input are above the fold
    if (examplesGrid) examplesGrid.style.display = 'none';
    if (shuffleBtn)   shuffleBtn.style.display   = 'none';
    if (heroTagline)  heroTagline.style.display   = 'none';
    if (regenBtn)     regenBtn.style.display      = 'none';
  } else {
    if (examplesGrid) examplesGrid.style.display = '';
    if (shuffleBtn)   shuffleBtn.style.display   = '';
    if (heroTagline)  heroTagline.style.display   = '';
    if (regenBtn)     regenBtn.style.display      = '';
  }
}
syncSidebarToOrientation();
window.addEventListener('orientationchange', () => setTimeout(syncSidebarToOrientation, 150));
window.addEventListener('resize', () => syncSidebarToOrientation());

panelToggleBtn?.addEventListener('click', togglePanel);
mobileMenuBtn?.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(); });

// ─── New drawing button (canvas action bar) ──────────────────────────────────
// Re-opens the prompt so a new subject can be entered without losing canvas space.
const newDrawingBtn = document.getElementById('new-drawing-btn');
newDrawingBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const isMobilePortrait = window.innerWidth < 768 && !isPhoneLandscape();
  if (isMobilePortrait) {
    configPanel?.classList.remove('collapsed'); // collapsed would pin max-height:0
    configPanel?.classList.add('mobile-open');
    if (mobileMenuBtn) { mobileMenuBtn.textContent = '✕'; mobileMenuBtn.setAttribute('aria-label', 'Close settings'); }
  } else {
    configPanel?.classList.remove('collapsed');
    if (panelToggleBtn) panelToggleBtn.textContent = '◀';
  }
  // Clear the prompt and any pending daily-word/card seed so the user starts fresh
  subjectInput.value = '';
  _pendingSeedOverride = null;
  _pendingEnglishSubject = null;
  _pendingIsDaily = false;
  configPanel?.scrollTo({ top: 0, behavior: 'smooth' });
  subjectInput.focus();
});

// ─── More actions toggle (mobile): reveal secondary action buttons ────────────
const moreActionsBtn = document.getElementById('more-actions-btn');
const canvasActionsEl = document.querySelector('.canvas-actions');
moreActionsBtn?.addEventListener('click', () => {
  const open = canvasActionsEl?.classList.toggle('show-more');
  moreActionsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
});

// Close mobile portrait panel when clicking outside
document.addEventListener('click', (e) => {
  if (window.innerWidth < 768 && !isPhoneLandscape() &&
      configPanel?.classList.contains('mobile-open') &&
      !configPanel.contains(e.target) &&
      !mobileMenuBtn?.contains(e.target)) {
    configPanel.classList.remove('mobile-open');
    if (mobileMenuBtn) { mobileMenuBtn.textContent = '☰'; mobileMenuBtn.setAttribute('aria-label', 'Open settings'); }
  }
});

// ─── Share handlers ───────────────────────────────────────────────────────────
initShareHandlers();

// ─── Settings chips (A2) ──────────────────────────────────────────────────────
const DIFF_CYCLE    = ['easy', 'medium', 'hard', 'extreme'];
const COUNT_CYCLE   = [6, 12, 18, 24, 'max'];
const PALETTE_CYCLE = ['classic', 'pastel', 'nature'];
const DIFF_EMOJI    = { easy: '🌟', medium: '🌟🌟', hard: '🌟🌟🌟', extreme: '🔥' };
const PALETTE_EMOJI = { classic: '🖍️', pastel: '🌸', nature: '🌿', neon: '⚡', candy: '🍭', galaxy: '🌌' };

const chipDiff    = document.getElementById('chip-diff');
const chipCount   = document.getElementById('chip-count');
const chipPalette = document.getElementById('chip-palette');
const chipArtStyle = document.getElementById('chip-art-style');
const chipNumbers = document.getElementById('chip-numbers');
const chipSound   = document.getElementById('chip-sound');
const chipNarrate = document.getElementById('chip-narrate');

function updateDiffChip() {
  if (!chipDiff) return;
  const diffI18nKeys = { easy: 'diffEasy', medium: 'diffMedium', hard: 'diffHard', extreme: 'diffExtreme' };
  const key = diffI18nKeys[difficultySelect.value] || 'diffEasy';
  const raw = t(key);
  const parts = raw.split(' ');
  const label = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
  chipDiff.textContent = (DIFF_EMOJI[difficultySelect.value] || '⭐') + ' ' + label;
  chipDiff.title = t('difficulty') + ': ' + label;
}
function updateCountChip() {
  if (!chipCount) return;
  chipCount.textContent = `🎨 ${state.colorCount}`;
}
function updatePaletteChip() {
  if (!chipPalette) return;
  const paletteI18nKeys = { classic: 'paletteClassic', pastel: 'palettePastel', nature: 'paletteNature' };
  const v = paletteSelect.value;
  let label;
  if (paletteI18nKeys[v]) {
    const raw = t(paletteI18nKeys[v]);
    const parts = raw.split(' ');
    label = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  } else {
    // Unlockable packs use the plain pack<Name>Name strings (no leading emoji).
    label = t(`pack${v.charAt(0).toUpperCase()}${v.slice(1)}Name`);
  }
  chipPalette.textContent = (PALETTE_EMOJI[v] || '🖍️') + ' ' + label;
  chipPalette.title = t('palette') + ': ' + label;
}
function updateNumbersChip() {
  if (!chipNumbers) return;
  const on = showNumbersInput.checked;
  chipNumbers.textContent = '🔢 ' + t('numbersChip');
  chipNumbers.classList.toggle('setting-chip--on', on);
}
function updateSoundChip() {
  if (!chipSound) return;
  const on = isSoundOn();
  chipSound.textContent = on ? '🔊' : '🔇';
  chipSound.classList.toggle('setting-chip--on', on);
  chipSound.title = t(on ? 'soundOnChip' : 'soundOffChip');
}
function updateNarrateChip() {
  if (!chipNarrate) return;
  // Hide the chip entirely where speech synthesis isn't available.
  if (!narrateSupported()) { chipNarrate.hidden = true; return; }
  const on = isNarrateOn();
  chipNarrate.textContent = on ? '🗣️' : '🤫';
  chipNarrate.classList.toggle('setting-chip--on', on);
  chipNarrate.title = t(on ? 'narrateOnChip' : 'narrateOffChip');
}
function updateArtStyleChip() {
  if (!chipArtStyle) return;
  const isClassic = state.artStyle !== 'artistic';
  chipArtStyle.textContent = isClassic ? '🖌️ Classic' : '✏️ Sketch';
  chipArtStyle.classList.toggle('setting-chip--on', isClassic);
  chipArtStyle.title = isClassic ? t('artStyleClassicHint') : t('artStyleSketchHint');
}
function updateAllChips() {
  updateDiffChip(); updateCountChip(); updatePaletteChip(); updateArtStyleChip(); updateNumbersChip(); updateSoundChip(); updateNarrateChip();
}

if (chipSound) chipSound.addEventListener('click', () => {
  toggleSound();
  updateSoundChip();
});

if (chipNarrate) chipNarrate.addEventListener('click', () => {
  const on = toggleNarrate();
  updateNarrateChip();
  // Confirm with a spoken sample the moment it's switched on.
  if (on) speak(t('narratePraise'));
});

// ─── Art style chip ───────────────────────────────────────────────────────────
// Load persisted value first.
try { state.artStyle = localStorage.getItem('lalabuba-art-style') || 'structured'; } catch {}
updateArtStyleChip();

if (chipArtStyle) chipArtStyle.addEventListener('click', () => {
  state.artStyle = state.artStyle === 'structured' ? 'artistic' : 'structured';
  try { localStorage.setItem('lalabuba-art-style', state.artStyle); } catch {}
  updateArtStyleChip();
  // In artistic mode, auto-switch coloring tool to pencil (freehand is the primary tool)
  // and turn off numbers (artistic images have fewer sealed regions).
  if (state.artStyle === 'artistic' && state.currentImage) {
    setColorMode('pencil');
    if (showNumbersInput.checked) {
      showNumbersInput.checked = false;
      showNumbersInput.dispatchEvent(new Event('change'));
      updateNumbersChip();
      syncHeroNumbersBtn();
      syncCanvasNumbersBtn();
    }
  }
});

if (chipDiff) chipDiff.addEventListener('click', () => {
  const cur = DIFF_CYCLE.indexOf(difficultySelect.value);
  difficultySelect.value = DIFF_CYCLE[(cur + 1) % DIFF_CYCLE.length];
  difficultySelect.dispatchEvent(new Event('change'));
  updateDiffChip();
});

if (chipCount) chipCount.addEventListener('click', () => {
  const palette = PALETTES[paletteSelect.value];
  const maxCount = palette.length;
  const atMax = state.colorCount >= maxCount;
  const curIdx = atMax ? COUNT_CYCLE.length - 1 : Math.max(0, COUNT_CYCLE.indexOf(state.colorCount));
  const nextRaw = COUNT_CYCLE[(curIdx + 1) % COUNT_CYCLE.length];
  const next = nextRaw === 'max' ? maxCount : Number(nextRaw);
  setColorCount(next, next >= maxCount);
  updateCountChip();
});

if (chipPalette) chipPalette.addEventListener('click', () => {
  // Cycle only through packs the child has unlocked (classic/pastel/nature are
  // always available; neon/candy/galaxy appear once their threshold is met).
  let cycle = PALETTE_CYCLE;
  try {
    const ids = unlockedPaletteIds(getProgress().totalCompleted);
    if (ids.length) cycle = ids;
  } catch {}
  const cur = cycle.indexOf(paletteSelect.value);
  paletteSelect.value = cycle[(cur + 1) % cycle.length];
  paletteSelect.dispatchEvent(new Event('change'));
  updatePaletteChip();
  updateCountChip(); // palette affects max count
});

if (chipNumbers) chipNumbers.addEventListener('click', () => {
  showNumbersInput.checked = !showNumbersInput.checked;
  showNumbersInput.dispatchEvent(new Event('change'));
  updateNumbersChip();
  syncHeroNumbersBtn();
});

function syncHeroNumbersBtn() {
  const heroBtn = document.getElementById('hero-numbers-toggle');
  if (!heroBtn) return;
  const on = showNumbersInput.checked;
  heroBtn.classList.toggle('setting-chip--on', on);
}

const heroNumbersToggle = document.getElementById('hero-numbers-toggle');
if (heroNumbersToggle) {
  heroNumbersToggle.addEventListener('click', () => {
    showNumbersInput.checked = !showNumbersInput.checked;
    showNumbersInput.dispatchEvent(new Event('change'));
    updateNumbersChip();
    syncHeroNumbersBtn();
  });
}

updateAllChips();
syncHeroNumbersBtn();

// ─── Canvas numbers toggle (in drawing area) ──────────────────────────────────
const canvasNumbersBtn = document.getElementById('canvas-numbers-btn');
if (canvasNumbersBtn) {
  canvasNumbersBtn.addEventListener('click', () => {
    if (state.isFreeMode) { _exitFreeMode(); return; }
    showNumbersInput.checked = !showNumbersInput.checked;
    showNumbersInput.dispatchEvent(new Event('change'));
    updateNumbersChip();
    syncHeroNumbersBtn();
    syncCanvasNumbersBtn();
  });
}

function syncCanvasNumbersBtn() {
  if (!canvasNumbersBtn) return;
  const on = showNumbersInput.checked;
  canvasNumbersBtn.classList.toggle('action-btn--on', on);
  canvasNumbersBtn.textContent = on ? t('numbersBtn') : t('numbersBtnOff');
}

// ─── Go Free button ───────────────────────────────────────────────────────────
const goFreeBtn = document.getElementById('go-free-btn');
if (goFreeBtn) {
  goFreeBtn.addEventListener('click', () => {
    if (state.isFreeMode) return;
    const hasProgress = state.undoStack.length > 0;
    if (hasProgress) {
      _showGoFreeDialog();
    } else {
      _activateFreeMode();
    }
  });
}

// ─── Manual "I'm finished!" (free-colour mode) ───────────────────────────────
const finishColoringBtn = document.getElementById('finish-coloring-btn');
const finishColoringSep = document.querySelector('.action-sep--finish');
if (finishColoringBtn) {
  finishColoringBtn.addEventListener('click', () => finishColoringManually());
}
// Shown whenever a picture is loaded — works in both numbers and free-colour mode.
// Auto-finish on all-numbers-placed is a nice bonus but not the only path.
function updateFinishBtnVisibility() {
  const show = !!state.currentImage;
  if (finishColoringBtn) finishColoringBtn.hidden = !show;
  if (finishColoringSep) finishColoringSep.hidden = !show;
}

function _showGoFreeDialog() {
  // Remove existing dialog if any
  const existing = document.getElementById('go-free-dialog');
  if (existing) existing.remove();

  const dialog = document.createElement('div');
  dialog.id = 'go-free-dialog';
  dialog.className = 'go-free-backdrop';
  dialog.innerHTML = `
    <div class="go-free-panel" role="dialog" aria-modal="true">
      <div class="go-free-icon">🎨</div>
      <h3 class="go-free-title" data-i18n="goFreeTitle">Switch to free coloring?</h3>
      <p class="go-free-body" data-i18n="goFreeBody">Color any area with any color! Your coloring stays. 🎉</p>
      <div class="go-free-actions">
        <button class="go-free-cancel" data-i18n="goFreeCancel">Keep guided</button>
        <button class="go-free-confirm" data-i18n="goFreeConfirm">Go free!</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  applyTranslations(dialog);

  dialog.querySelector('.go-free-confirm').addEventListener('click', () => {
    dialog.remove();
    _activateFreeMode();
  });
  dialog.querySelector('.go-free-cancel').addEventListener('click', () => dialog.remove());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove(); });

  requestAnimationFrame(() => dialog.classList.add('open'));
}

function _activateFreeMode() {
  state.isFreeMode = true;
  // Hide numbers
  showNumbersInput.checked = false;
  showNumbersInput.dispatchEvent(new Event('change'));
  updateNumbersChip();
  syncCanvasNumbersBtn();
  // Update go-free button appearance
  if (goFreeBtn) {
    goFreeBtn.textContent = t('goFreeBtn');
    goFreeBtn.classList.add('action-btn--active');
    goFreeBtn.disabled = true;
  }
  if (canvasNumbersBtn) canvasNumbersBtn.disabled = false;
  // Show free mode picker in legend
  renderLegend();
}

function _exitFreeMode() {
  state.isFreeMode = false;
  // Re-enable free button
  if (goFreeBtn) {
    goFreeBtn.disabled = false;
    goFreeBtn.classList.remove('action-btn--active');
    goFreeBtn.textContent = t('goFreeBtn');
  }
  // Reset color count to max
  const maxN = PALETTES[paletteSelect.value].length;
  setColorCount(maxN, true);
  updateCountChip();
  // Turn numbers back on (setColorCount already called renderLegend with isFreeMode=false)
  showNumbersInput.checked = true;
  showNumbersInput.dispatchEvent(new Event('change'));
  updateNumbersChip();
  syncHeroNumbersBtn();
  syncCanvasNumbersBtn();
}

// ─── Canvas background colour ─────────────────────────────────────────────────
const CANVAS_BG_UNLOCK = 5; // completions to unlock additional shapes/frames

function applyCanvasBg(color) {
  state.canvasBgColor = color;
  try { localStorage.setItem('lalabuba-canvas-bg', color); } catch {}
  const pc = document.getElementById('preview-canvas');
  if (pc) pc.style.backgroundColor = color;
  // sync active state on swatches
  document.querySelectorAll('.canvas-bg-swatch').forEach(s => {
    s.classList.toggle('canvas-bg-swatch--active', s.dataset.color === color);
  });
  const customInput = document.getElementById('canvas-bg-color');
  if (customInput) customInput.value = color;
}

// Restore from localStorage
try { const saved = localStorage.getItem('lalabuba-canvas-bg'); if (saved) state.canvasBgColor = saved; } catch {}

document.querySelectorAll('.canvas-bg-swatch').forEach(btn => {
  btn.addEventListener('click', () => applyCanvasBg(btn.dataset.color));
});
const canvasBgColorInput = document.getElementById('canvas-bg-color');
if (canvasBgColorInput) {
  canvasBgColorInput.addEventListener('input', e => applyCanvasBg(e.target.value));
}
// Apply on page load and after image renders
applyCanvasBg(state.canvasBgColor);

// ─── Canvas shape & frame ─────────────────────────────────────────────────────
const SHAPE_UNLOCK = { oval: CANVAS_BG_UNLOCK, diamond: CANVAS_BG_UNLOCK * 2 };
const FRAME_UNLOCK = { wooden: CANVAS_BG_UNLOCK, gold: CANVAS_BG_UNLOCK * 2 };

function applyCanvasShape(shape) {
  const progress = (() => { try { return getProgress().totalCompleted || 0; } catch { return 0; } })();
  const needed = SHAPE_UNLOCK[shape];
  if (needed && progress < needed) {
    setStatus(t('canvasShapeLocked', needed), true);
    return;
  }
  state.canvasShape = shape;
  try { localStorage.setItem('lalabuba-canvas-shape', shape); } catch {}
  document.querySelectorAll('.canvas-shape-btn').forEach(b =>
    b.classList.toggle('canvas-shape-btn--active', b.dataset.shape === shape));
  const pc = document.getElementById('preview-canvas');
  if (!pc) return;
  const clips = {
    circle:  'circle(50% at 50% 50%)',
    oval:    'ellipse(48% 46% at 50% 50%)',
    diamond: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
    square:  'none',
  };
  pc.style.clipPath = clips[shape] || 'none';
  // Also clip the draw canvas
  const dc = document.getElementById('draw-canvas');
  if (dc) dc.style.clipPath = clips[shape] || 'none';
}

function applyCanvasFrame(frame) {
  const progress = (() => { try { return getProgress().totalCompleted || 0; } catch { return 0; } })();
  const needed = FRAME_UNLOCK[frame];
  if (needed && progress < needed) {
    setStatus(t('canvasFrameLocked', needed), true);
    return;
  }
  state.canvasFrame = frame;
  try { localStorage.setItem('lalabuba-canvas-frame', frame); } catch {}
  document.querySelectorAll('.canvas-frame-btn').forEach(b =>
    b.classList.toggle('canvas-frame-btn--active', b.dataset.frame === frame));
  const stage = document.getElementById('preview-stage');
  if (!stage) return;
  stage.dataset.frame = frame;
}

document.querySelectorAll('.canvas-shape-btn:not(.canvas-shape-btn--locked)').forEach(btn =>
  btn.addEventListener('click', () => applyCanvasShape(btn.dataset.shape)));
document.querySelectorAll('.canvas-shape-btn--locked').forEach(btn =>
  btn.addEventListener('click', () => {
    const needed = SHAPE_UNLOCK[btn.dataset.shape] || CANVAS_BG_UNLOCK;
    setStatus(t('canvasShapeLocked', needed), true);
  }));
document.querySelectorAll('.canvas-frame-btn:not(.canvas-frame-btn--locked)').forEach(btn =>
  btn.addEventListener('click', () => applyCanvasFrame(btn.dataset.frame)));
document.querySelectorAll('.canvas-frame-btn--locked').forEach(btn =>
  btn.addEventListener('click', () => {
    const needed = FRAME_UNLOCK[btn.dataset.frame] || CANVAS_BG_UNLOCK;
    setStatus(t('canvasFrameLocked', needed), true);
  }));

// Restore shape/frame on load
try { const s = localStorage.getItem('lalabuba-canvas-shape'); if (s) applyCanvasShape(s); } catch {}
try { const f = localStorage.getItem('lalabuba-canvas-frame'); if (f) applyCanvasFrame(f); } catch {}

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
  const subject = randomCardSubject();
  subjectInput.value = subject;
  _pendingEnglishSubject = subject; // randomCardSubject always returns English
  subjectInput.focus();
  pulseDraw();
});

// ─── Voice prompt input (🎤) — lets a pre-reader say the subject ─────────────
(function initVoiceInput() {
  const btn = document.getElementById('voice-btn');
  if (!btn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return; // unsupported → leave the button hidden
  btn.hidden = false;
  const VOICE_LANG = {
    en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', nl: 'nl-NL',
    pl: 'pl-PL', pt: 'pt-PT', ru: 'ru-RU', tr: 'tr-TR', zh: 'zh-CN', hi: 'hi-IN',
  };
  const label = btn.querySelector('span');
  const setLabel = (key) => { if (label) label.textContent = t(key); };
  let rec = null, listening = false;
  const reset = () => { listening = false; btn.classList.remove('listening'); setLabel('voiceBtnLabel'); };

  btn.addEventListener('click', () => {
    if (listening) { try { rec && rec.stop(); } catch {} return; }
    try {
      rec = new SR();
      rec.lang = VOICE_LANG[getCurrentLang()] || 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = ((e.results[0] && e.results[0][0] && e.results[0][0].transcript) || '').trim();
        if (text) {
          subjectInput.value = text.slice(0, 80);
          // The spoken word is in the user's language → treat as a custom subject.
          subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
          subjectInput.focus();
          pulseDraw();
        }
      };
      rec.onerror = () => { listening = false; btn.classList.remove('listening'); setLabel('voiceError'); setTimeout(() => setLabel('voiceBtnLabel'), 1600); };
      rec.onend = () => { if (listening) reset(); };
      listening = true;
      btn.classList.add('listening');
      setLabel('voiceListening');
      rec.start();
    } catch { reset(); }
  });
})();

// ─── Scene of the week pill ───────────────────────────────────────────────────
const _weekScenePill = document.getElementById('week-scene-pill');
function refreshWeekScenePill() {
  if (!_weekScenePill) return;
  try {
    const wk = weekScene();
    const name = t(`scene${wk.id.charAt(0).toUpperCase()}${wk.id.slice(1)}Name`);
    // Lead with the SCENE's own emoji (🐧, 🌊, 🚀…) — not the ⭐ the daily-word
    // pill uses — so the two adjacent pills read as clearly different actions
    // (a themed-idea picker vs the word of the day).
    _weekScenePill.textContent = `${wk.emoji} ${t('weekScenePill', name)}`;
    _weekScenePill.dataset.scene = wk.id;
    _weekScenePill.hidden = false;
  } catch { _weekScenePill.hidden = true; }
}
if (_weekScenePill) {
  _weekScenePill.addEventListener('click', () => {
    const id = _weekScenePill.dataset.scene;
    const list = (SCENE_SUBJECTS && SCENE_SUBJECTS[id]) || [];
    if (!list.length) return;
    const subject = list[Math.floor(Math.random() * list.length)];
    // Show the subject in the child's language (e.g. "Pinguin", not "penguin");
    // the English original still drives the AI prompt + theme. Mirror the
    // daily-word button: do NOT dispatch 'input' (that listener clears
    // _pendingEnglishSubject), which previously leaked English to non-EN kids.
    subjectInput.value = getTranslatedSubject(subject, getCurrentLang());
    _pendingEnglishSubject = subject;
    subjectInput.focus();
    pulseDraw();
  });
  refreshWeekScenePill();
}

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
    // Creating/sharing a challenge → credit the Challenger sticker.
    try { toastNewBadges(recordChallengeCreated().newBadges); } catch {}
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
subjectInput.addEventListener('input', () => { _pendingSeedOverride = null; _pendingEnglishSubject = null; _pendingIsDaily = false; });

if (dailyWordRow && dailyWordBtn && dailyWordValue) {
  dailyWordValue.textContent = getTranslatedDailyWord(dailyWord, getCurrentLang());
  dailyWordRow.hidden = false;
  dailyWordBtn.addEventListener('click', () => {
    subjectInput.value = getTranslatedDailyWord(dailyWord, getCurrentLang());
    _pendingEnglishSubject = dailyWord; // use English original for the AI prompt
    _pendingSeedOverride = dailySeed;
    _pendingIsDaily = true; // finishing this credits the Daily Star sticker/mission
    subjectInput.focus();
    pulseDraw(); // A1: guide user to click Draw instead of auto-submitting
  });
}

// Populate hero-daily-proxy for the landing quick pills row
const heroDailyProxy = document.getElementById('hero-daily-proxy');
const heroDailyText  = document.getElementById('hero-daily-text');
if (heroDailyProxy && heroDailyText) {
  heroDailyText.textContent = getTranslatedDailyWord(dailyWord, getCurrentLang());
  heroDailyProxy.hidden = false;
  heroDailyProxy.addEventListener('click', () => {
    subjectInput.value = getTranslatedDailyWord(dailyWord, getCurrentLang());
    _pendingEnglishSubject = dailyWord;
    _pendingIsDaily = true; // finishing this credits the Daily Star sticker/mission
    subjectInput.focus();
    pulseDraw();
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

try {
  renderLegend();
  applyTranslations();
  loadFromShare();
} catch (e) {
  console.error('[Lalabuba] Startup error:', e);
} finally {
  // Always hide the native splash screen — launchAutoHide is false, so if
  // anything above throws the app would appear permanently frozen otherwise.
  if (window.Capacitor?.isNativePlatform?.()) {
    window.Capacitor?.Plugins?.SplashScreen?.hide({ fadeOutDuration: 300 })?.catch(() => {});
    setTimeout(initOnboarding, 500);
  }
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
    // This artwork was already saved & counted when first completed; re-finishing
    // it from the Journal must not re-count stats/badges or duplicate the gallery
    // entry. (drawBaseImage just reset this to false — restore the "already
    // recorded" truth here, after the restore.)
    state.completionRecorded = true;
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

// ─── Journal access + progress affordances ───────────────────────────────────
(function initJournalAffordances() {
  const journalBtn = document.getElementById('journal-btn');
  if (journalBtn) {
    journalBtn.addEventListener('click', () => {
      clearJournalDirty();
      openGalleryModal(continueArtwork);
    });
  }
  const rewardsTeaser = document.getElementById('rewards-teaser');
  if (rewardsTeaser) {
    rewardsTeaser.addEventListener('click', () => {
      clearJournalDirty();
      openGalleryModal(continueArtwork);
    });
  }
  // Restore the "new sticker waiting" dot across sessions.
  let dirty = false;
  try { dirty = localStorage.getItem(JOURNAL_DIRTY_KEY) === '1'; } catch {}
  if (dirty) {
    const dot = document.getElementById('journal-dot');
    if (dot) dot.hidden = false;
  }
  refreshDaysColoredPill();
  refreshJournalCount();
})();

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

