import { state } from './state.js';
import { drawCanvas, drawCtx, pencilBtn, clearPencilBtn, previewCanvas } from './dom.js';
import { activePalette } from './ui.js';
import { setStatus } from './ui.js';
import { t } from './i18n.js';

export function getActivePencilColor() {
  if (state.selectedPaletteIndex === -1) return state.customColor;
  return activePalette()[state.selectedPaletteIndex]?.color ?? '#000000';
}

function getPencilPos(e) {
  const rect = drawCanvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * (drawCanvas.width  / rect.width),
    y: (src.clientY - rect.top)  * (drawCanvas.height / rect.height),
  };
}

function getBrushSize() {
  return state.colorMode === 'paint' ? 22 : 5;
}

function isDrawingActive() {
  return state.pencilMode || state.colorMode === 'paint';
}

function pencilStart(e) {
  state.pencilDrawing = true;
  const { x, y } = getPencilPos(e);
  const size = getBrushSize();
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

function pencilEnd() {
  if (!state.pencilDrawing) return;
  state.pencilDrawing = false;
  if (state.colorMode === 'paint' && paintEndCallback) {
    paintEndCallback();
  }
}

export function updateDrawCanvasMode() {
  const active = isDrawingActive();
  drawCanvas.classList.toggle('pencil-active', active);
  previewCanvas.style.pointerEvents = active ? 'none' : '';
}

export function initDrawingTool() {
  pencilBtn.addEventListener('click', () => {
    state.pencilMode = !state.pencilMode;
    pencilBtn.classList.toggle('active', state.pencilMode);
    updateDrawCanvasMode();
    if (state.pencilMode) setStatus(t('pencilMode'));
  });

  clearPencilBtn.addEventListener('click', () => {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  });

  drawCanvas.addEventListener('mousedown', (e) => { if (isDrawingActive()) pencilStart(e); });
  drawCanvas.addEventListener('mousemove', (e) => { if (isDrawingActive()) pencilMove(e); });
  drawCanvas.addEventListener('mouseup',   pencilEnd);
  drawCanvas.addEventListener('mouseleave', pencilEnd);
  drawCanvas.addEventListener('touchstart', (e) => { if (isDrawingActive()) { e.preventDefault(); pencilStart(e); } }, { passive: false });
  drawCanvas.addEventListener('touchmove',  (e) => { if (isDrawingActive()) { e.preventDefault(); pencilMove(e); } }, { passive: false });
  drawCanvas.addEventListener('touchend',   pencilEnd);
}
