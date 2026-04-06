// zoom.js — pinch-to-zoom + pan for the canvas frame
// Applies CSS transform to the canvasFrame element.
// Exports getCanvasCoords() so main.js can convert click coords correctly.

let scale = 1;
let panX = 0;
let panY = 0;
let canvasFrame = null;
let _canvas = null;

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function applyTransform() {
  if (!canvasFrame) return;
  canvasFrame.style.transformOrigin = '0 0';
  canvasFrame.style.transform = `scale(${scale}) translate(${panX}px, ${panY}px)`;
}

function resetZoom() {
  scale = 1; panX = 0; panY = 0;
  applyTransform();
}

// Convert a click event's client coords to canvas pixel coords, accounting for zoom/pan.
export function getCanvasCoords(event) {
  if (!_canvas) return { x: event.clientX, y: event.clientY };
  const rect = _canvas.getBoundingClientRect();
  // rect already reflects the CSS transform, so we can use it directly
  const x = Math.floor((event.clientX - rect.left) * (_canvas.width / rect.width));
  const y = Math.floor((event.clientY - rect.top)  * (_canvas.height / rect.height));
  return { x, y };
}

export function initZoom(frame, canvas) {
  canvasFrame = frame;
  _canvas = canvas;

  // ── Mouse wheel zoom ───────────────────────────────────────────────────────
  frame.parentElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const prevScale = scale;
    scale = clamp(scale * delta, MIN_SCALE, MAX_SCALE);
    if (scale === MIN_SCALE) { panX = 0; panY = 0; }
    applyTransform();
  }, { passive: false });

  // ── Touch: pinch-to-zoom + drag-to-pan ────────────────────────────────────
  let touches = {};
  let initDist = null;
  let initScale = 1;
  let initPan = { x: 0, y: 0 };
  let initMid = { x: 0, y: 0 };
  let lastMid = { x: 0, y: 0 };
  let tapCount = 0;
  let tapTimer = null;

  function getTouches(e) {
    return Array.from(e.touches).slice(0, 2);
  }
  function midpoint(t0, t1) {
    return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
  }
  function dist(t0, t1) {
    const dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }

  canvas.addEventListener('touchstart', (e) => {
    const ts = getTouches(e);
    if (ts.length === 1) {
      // Double-tap to reset
      tapCount++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapCount = 0; }, 350);
      if (tapCount >= 2) { tapCount = 0; resetZoom(); return; }
    }
    if (ts.length === 2) {
      e.preventDefault();
      initDist = dist(ts[0], ts[1]);
      initScale = scale;
      initMid = midpoint(ts[0], ts[1]);
      initPan = { x: panX, y: panY };
      lastMid = initMid;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    const ts = getTouches(e);
    if (ts.length === 2 && initDist) {
      e.preventDefault();
      const newDist = dist(ts[0], ts[1]);
      const newMid = midpoint(ts[0], ts[1]);
      scale = clamp(initScale * (newDist / initDist), MIN_SCALE, MAX_SCALE);
      // Pan: translate by mid-point movement divided by scale
      const dx = (newMid.x - initMid.x) / scale;
      const dy = (newMid.y - initMid.y) / scale;
      panX = initPan.x + dx;
      panY = initPan.y + dy;
      applyTransform();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initDist = null;
    if (scale <= MIN_SCALE) { scale = MIN_SCALE; panX = 0; panY = 0; applyTransform(); }
  });
}
