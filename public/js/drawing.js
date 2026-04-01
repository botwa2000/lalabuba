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

function pencilStart(e) {
  state.pencilDrawing = true;
  const { x, y } = getPencilPos(e);
  drawCtx.beginPath();
  drawCtx.moveTo(x, y);
  // Draw a dot for single tap.
  drawCtx.globalCompositeOperation = 'source-over';
  drawCtx.fillStyle = getActivePencilColor();
  drawCtx.beginPath();
  drawCtx.arc(x, y, 3, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.beginPath();
  drawCtx.moveTo(x, y);
}

function pencilMove(e) {
  if (!state.pencilDrawing) return;
  const { x, y } = getPencilPos(e);
  drawCtx.globalCompositeOperation = 'source-over';
  drawCtx.strokeStyle = getActivePencilColor();
  drawCtx.lineWidth = 5;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  drawCtx.lineTo(x, y);
  drawCtx.stroke();
  drawCtx.beginPath();
  drawCtx.moveTo(x, y);
}

function pencilEnd() { state.pencilDrawing = false; }

export function initDrawingTool() {
  pencilBtn.addEventListener('click', () => {
    state.pencilMode = !state.pencilMode;
    pencilBtn.classList.toggle('active', state.pencilMode);
    drawCanvas.classList.toggle('pencil-active', state.pencilMode);
    previewCanvas.style.pointerEvents = state.pencilMode ? 'none' : '';
    if (state.pencilMode) setStatus(t('pencilMode'));
  });

  clearPencilBtn.addEventListener('click', () => {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  });

  drawCanvas.addEventListener('mousedown', (e) => { if (state.pencilMode) pencilStart(e); });
  drawCanvas.addEventListener('mousemove', (e) => { if (state.pencilMode) pencilMove(e); });
  drawCanvas.addEventListener('mouseup',   pencilEnd);
  drawCanvas.addEventListener('mouseleave', pencilEnd);
  drawCanvas.addEventListener('touchstart', (e) => { if (state.pencilMode) { e.preventDefault(); pencilStart(e); } }, { passive: false });
  drawCanvas.addEventListener('touchmove',  (e) => { if (state.pencilMode) { e.preventDefault(); pencilMove(e); } }, { passive: false });
  drawCanvas.addEventListener('touchend',   pencilEnd);
}
