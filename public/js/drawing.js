import { state } from './state.js';
import { drawCanvas, drawCtx, clearPencilBtn, previewCanvas } from './dom.js';
import { activePalette } from './ui.js';
import { setStatus } from './ui.js';
import { t } from './i18n.js';
import { recordDrawPenUse } from './progress.js';
import { freehandKeepsPaint, maskAssistFor } from './completion-core.js';

export function getActivePencilColor() {
  if (state.selectedPaletteIndex === -1) return state.customColor;
  return activePalette()[state.selectedPaletteIndex]?.color ?? '#000000';
}

// Cached per-stroke — snapshotted at touchstart so touchmove never forces a reflow.
// Invalidated at stroke end; a new snapshot is taken at the next touchstart.
let _cachedRect = null;

function getPencilPos(e) {
  const rect = _cachedRect || (_cachedRect = drawCanvas.getBoundingClientRect());
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * (drawCanvas.width  / rect.width),
    y: (src.clientY - rect.top)  * (drawCanvas.height / rect.height),
  };
}

function getBrushSize() {
  return state.colorMode === 'brush' ? 22 : 5;
}

function isDrawingActive() {
  return state.colorMode === 'pencil' || state.colorMode === 'brush';
}

// ── Masked "stay-in-the-lines" freehand ──────────────────────────────────────
// We paint live (unmasked) for instant feedback, then on stroke END wipe any
// paint that landed on a black line, and — in assist mode (Easy/Medium) — any
// paint that left the shape the stroke began in. Scoped to the stroke's bounding
// box so earlier strokes elsewhere are untouched, and only that small area is
// read back (cheap on the low-end devices kids use). The decision itself lives
// in completion-core.freehandKeepsPaint (pure + unit-tested).
let _strokeStartRegion = null; // region id at the stroke's first point
let _strokeAssist = false;     // stay-in-shape clamp on for this stroke?
let _strokeBox = null;         // {x0,y0,x1,y1} in draw-canvas px

function _expandBox(x, y) {
  const r = getBrushSize();
  if (!_strokeBox) {
    _strokeBox = { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
  } else {
    _strokeBox.x0 = Math.min(_strokeBox.x0, x - r);
    _strokeBox.y0 = Math.min(_strokeBox.y0, y - r);
    _strokeBox.x1 = Math.max(_strokeBox.x1, x + r);
    _strokeBox.y1 = Math.max(_strokeBox.y1, y + r);
  }
}

// Wipe disallowed paint within the finished stroke's bounding box.
function _maskStroke() {
  if (!state.regionMap || !state.lineMask || !_strokeBox) return;
  const W = drawCanvas.width, H = drawCanvas.height;
  const x0 = Math.max(0, Math.floor(_strokeBox.x0));
  const y0 = Math.max(0, Math.floor(_strokeBox.y0));
  const x1 = Math.min(W, Math.ceil(_strokeBox.x1));
  const y1 = Math.min(H, Math.ceil(_strokeBox.y1));
  const bw = x1 - x0, bh = y1 - y0;
  if (bw <= 0 || bh <= 0) return;
  const img = drawCtx.getImageData(x0, y0, bw, bh);
  const d = img.data, rm = state.regionMap, lm = state.lineMask;
  let changed = false;
  for (let yy = 0; yy < bh; yy++) {
    for (let xx = 0; xx < bw; xx++) {
      const o = (yy * bw + xx) * 4;
      if (d[o + 3] === 0) continue;
      const gi = (y0 + yy) * W + (x0 + xx);
      if (!freehandKeepsPaint(lm[gi] === 1, rm[gi], _strokeStartRegion ?? -1, _strokeAssist)) {
        d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; d[o + 3] = 0;
        changed = true;
      }
    }
  }
  if (changed) drawCtx.putImageData(img, x0, y0);
}

function pencilStart(e) {
  _cachedRect = drawCanvas.getBoundingClientRect(); // snapshot once per stroke
  state.pencilDrawing = true;
  state.hasFreehand = true; // gate: draw-layer reads only happen once freehand is used
  const { x, y } = getPencilPos(e);
  const size = getBrushSize();
  // Record where the stroke began so masking can keep it in that shape.
  _strokeBox = null;
  _strokeAssist = maskAssistFor(document.getElementById('difficulty-select')?.value);
  _strokeStartRegion = state.regionMap
    ? (state.regionMap[Math.round(y) * drawCanvas.width + Math.round(x)] ?? -1)
    : -1;
  _expandBox(x, y);
  drawCtx.globalCompositeOperation = 'source-over';
  drawCtx.fillStyle = getActivePencilColor();
  drawCtx.beginPath();
  drawCtx.arc(x, y, size / 2, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.beginPath();
  drawCtx.moveTo(x, y);
}

function pencilMove(e) {
  if (!state.pencilDrawing) return;
  const { x, y } = getPencilPos(e);
  _expandBox(x, y);
  drawCtx.globalCompositeOperation = 'source-over';
  drawCtx.strokeStyle = getActivePencilColor();
  drawCtx.lineWidth = getBrushSize();
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  drawCtx.lineTo(x, y);
  drawCtx.stroke();
  drawCtx.beginPath();
  drawCtx.moveTo(x, y);
}

let paintEndCallback = null;
export function setPaintEndCallback(cb) { paintEndCallback = cb; }

// Fired after ANY freehand stroke ends (pencil or brush), so free-mode coverage
// completion can re-check whether enough areas are now coloured.
let strokeEndCallback = null;
export function setStrokeEndCallback(cb) { strokeEndCallback = cb; }

function pencilEnd() {
  if (!state.pencilDrawing) return;
  state.pencilDrawing = false;
  _cachedRect = null; // release so next stroke re-snapshots after any scroll/resize
  _maskStroke(); // wipe paint on lines / outside the shape before anything reads it
  if (state.colorMode === 'brush' && paintEndCallback) {
    paintEndCallback();
  }
  if (strokeEndCallback) strokeEndCallback();
}

export function updateDrawCanvasMode() {
  const active = isDrawingActive();
  drawCanvas.classList.toggle('pencil-active', active);
  previewCanvas.style.pointerEvents = active ? 'none' : '';
}

export function initDrawingTool() {
  clearPencilBtn.addEventListener('click', () => {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    state.hasFreehand = false; // layer wiped — no freehand to scan
  });

  drawCanvas.addEventListener('mousedown', (e) => { if (isDrawingActive()) pencilStart(e); });
  drawCanvas.addEventListener('mousemove', (e) => { if (isDrawingActive()) pencilMove(e); });
  drawCanvas.addEventListener('mouseup',   pencilEnd);
  drawCanvas.addEventListener('mouseleave', pencilEnd);
  drawCanvas.addEventListener('touchstart',  (e) => { if (isDrawingActive()) { e.preventDefault(); pencilStart(e); } }, { passive: false });
  drawCanvas.addEventListener('touchmove',   (e) => { if (isDrawingActive()) { e.preventDefault(); pencilMove(e); } }, { passive: false });
  drawCanvas.addEventListener('touchend',    pencilEnd);
  // touchcancel fires on Samsung/Android when palm-rejection or a system gesture
  // interrupts the stroke. Without this, state.pencilDrawing stays true and the
  // next stroke starts in a corrupted context (wrong region, unmasked paint).
  drawCanvas.addEventListener('touchcancel', pencilEnd);
}

// Credit the Free Drawer sticker on first pencil/brush use. Called from main.js
// when the user activates a freehand mode so the sticker is awarded regardless
// of which tool they pick.
export function creditDrawPenSticker() {
  try {
    const { newBadges } = recordDrawPenUse();
    return newBadges ?? [];
  } catch {
    return [];
  }
}
