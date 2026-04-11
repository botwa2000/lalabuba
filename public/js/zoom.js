// zoom.js — pinch-to-zoom + pan for the canvas frame
// Applies CSS transform to the canvasFrame element.
// Exports getCanvasCoords() so main.js can convert click coords correctly.

let scale = 1;
let panX = 0;
let panY = 0;
let canvasFrame = null;
let _canvas = null;

// Pan mode: when true, mouse drag moves the image instead of coloring
let panMode = false;

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function applyTransform() {
  if (!canvasFrame) return;
  canvasFrame.style.transformOrigin = '0 0';
  canvasFrame.style.transform = `scale(${scale}) translate(${panX}px, ${panY}px)`;
}

function _updatePanCursor() {
  if (!_canvas) return;
  if (panMode) {
    _canvas.style.cursor = 'grab';
  } else {
    _canvas.style.cursor = '';
  }
}

function _updateZoomButtons() {
  const inBtn  = document.getElementById('zoom-in-btn');
  const outBtn = document.getElementById('zoom-out-btn');
  const panBtn = document.getElementById('zoom-pan-btn');
  if (inBtn)  inBtn.disabled  = scale >= MAX_SCALE;
  if (outBtn) outBtn.disabled = scale <= MIN_SCALE;
  if (panBtn) {
    const zoomed = scale > MIN_SCALE;
    panBtn.disabled = !zoomed;
    // Auto-exit pan mode when zoomed back to 1×
    if (!zoomed && panMode) {
      panMode = false;
      panBtn.classList.remove('active');
      panBtn.setAttribute('aria-pressed', 'false');
      _updatePanCursor();
    }
  }
}

export function isPanMode() { return panMode; }

export function resetZoom() {
  scale = 1; panX = 0; panY = 0;
  applyTransform();
  panMode = false;
  const panBtn = document.getElementById('zoom-pan-btn');
  if (panBtn) {
    panBtn.classList.remove('active');
    panBtn.setAttribute('aria-pressed', 'false');
    panBtn.disabled = true;
  }
  _updatePanCursor();
}

export function zoomIn() {
  scale = clamp(scale * 1.25, MIN_SCALE, MAX_SCALE);
  applyTransform();
  _updateZoomButtons();
}

export function zoomOut() {
  scale = clamp(scale / 1.25, MIN_SCALE, MAX_SCALE);
  if (scale <= MIN_SCALE) { scale = MIN_SCALE; panX = 0; panY = 0; }
  applyTransform();
  _updateZoomButtons();
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
    _updateZoomButtons();
  }, { passive: false });

  // ── Mouse drag-to-pan (active when panMode = true) ─────────────────────────
  let mouseDragging = false;
  let mouseDragStart = null;
  let panAtDragStart = null;

  canvas.addEventListener('mousedown', (e) => {
    if (!panMode || scale <= MIN_SCALE) return;
    e.preventDefault(); // prevent text selection during drag
    mouseDragging = true;
    mouseDragStart = { x: e.clientX, y: e.clientY };
    panAtDragStart = { x: panX, y: panY };
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!mouseDragging) return;
    panX = panAtDragStart.x + (e.clientX - mouseDragStart.x) / scale;
    panY = panAtDragStart.y + (e.clientY - mouseDragStart.y) / scale;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    if (!mouseDragging) return;
    mouseDragging = false;
    if (panMode) canvas.style.cursor = 'grab';
  });

  // ── Pan button toggle ──────────────────────────────────────────────────────
  document.getElementById('zoom-pan-btn')?.addEventListener('click', () => {
    if (scale <= MIN_SCALE) return; // safety: can't pan when at 1×
    panMode = !panMode;
    const btn = document.getElementById('zoom-pan-btn');
    btn?.classList.toggle('active', panMode);
    btn?.setAttribute('aria-pressed', String(panMode));
    _updatePanCursor();
  });

  // ── Touch: pinch-to-zoom + drag-to-pan ────────────────────────────────────
  let touches = {};
  let initDist = null;
  let initScale = 1;
  let initPan = { x: 0, y: 0 };
  let initMid = { x: 0, y: 0 };
  let lastMid = { x: 0, y: 0 };
  let tapCount = 0;
  let tapTimer = null;
  // Single-finger pan tracking
  let panTouch = null;
  let panTouchStartPan = null;

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
      // Single-finger pan when zoomed in
      if (scale > MIN_SCALE) {
        panTouch = { id: ts[0].identifier, x: ts[0].clientX, y: ts[0].clientY };
        panTouchStartPan = { x: panX, y: panY };
      } else {
        panTouch = null;
      }
    }
    if (ts.length === 2) {
      panTouch = null; // cancel 1-finger pan when second finger joins
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
    // Single-finger pan when zoomed in
    if (ts.length === 1 && panTouch && scale > MIN_SCALE) {
      e.preventDefault();
      panX = panTouchStartPan.x + (ts[0].clientX - panTouch.x) / scale;
      panY = panTouchStartPan.y + (ts[0].clientY - panTouch.y) / scale;
      applyTransform();
      return;
    }
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
    if (e.touches.length === 0) panTouch = null;
    if (scale <= MIN_SCALE) { scale = MIN_SCALE; panX = 0; panY = 0; applyTransform(); }
    _updateZoomButtons();
  });

  // ── +/− zoom buttons ──────────────────────────────────────────────────────
  document.getElementById('zoom-in-btn')?.addEventListener('click', () => zoomIn());
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => zoomOut());
  document.getElementById('zoom-reset-btn')?.addEventListener('click', () => { resetZoom(); _updateZoomButtons(); });
}
