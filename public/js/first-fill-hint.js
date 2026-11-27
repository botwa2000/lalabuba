// first-fill-hint.js — growth plan L12 (CP1, 2026-11-26): only 5 of 24 opened
// pictures got a first colour. Every picture now opens with the colour of its
// largest area already selected, a gentle pulsing "Tap here!" marks that area,
// and the first colour gets a small sparkle. The hint goes away for good on the
// first fill of the picture (tap, paint or pencil) and comes back on the next one.
//
// The marker lives inside .canvas-frame, so it follows pinch-zoom/pan, and has
// pointer-events: none, so the tap reaches the canvas underneath.
import { state } from './state.js';
import { firstHintTarget } from './canvas.js';
import { renderLegend } from './ui.js';
import { sparkleBurst } from './fx.js';

let lastPress = null; // viewport point of the last press on the picture

const hintEl = () => document.getElementById('tap-here-hint');
const canvasEl = () => document.getElementById('preview-canvas');

export function initFirstFillHint() {
  const frame = document.querySelector('.canvas-frame');
  if (frame) {
    frame.addEventListener('pointerdown', (e) => { lastPress = { x: e.clientX, y: e.clientY }; },
      { capture: true, passive: true });
  }
}

/** Called after every canvas redraw (canvas.js setRedrawHook). */
export function updateTapHint() {
  const el = hintEl();
  const canvas = canvasEl();
  if (!el || !canvas) return;
  // Hidden while the regions are still being found (~1–2 s on phones): before
  // that the areas are placeholders and the marker would jump once they land.
  if (state.firstFillTracked || !state.paintedImageData || canvas.hidden || state.isSegmenting) { el.hidden = true; return; }
  const target = firstHintTarget();
  if (!target) { el.hidden = true; return; }

  // Open with a colour that works here: the colour this area needs. Until the
  // child picks one themselves (then theirs always wins).
  if (target.colorIndex != null && !state.colourPickedByUser &&
      (state.selectedPaletteIndex !== target.colorIndex || state.eraseMode)) {
    state.eraseMode = false;
    state.selectedPaletteIndex = target.colorIndex;
    renderLegend();
  }

  const fx = target.x / canvas.width;
  const fy = target.y / canvas.height;
  el.style.left = `${(fx * 100).toFixed(2)}%`;
  el.style.top = `${(fy * 100).toFixed(2)}%`;
  // Keep the label inside the picture near its edges.
  el.classList.toggle('tap-here-hint--below', fy < 0.2);
  el.classList.toggle('tap-here-hint--start', fx < 0.18);
  el.classList.toggle('tap-here-hint--end', fx > 0.82);
  el.hidden = false;
}

/** The first colour of the current picture went in: hide the hint, small sparkle. */
export function celebrateFirstFill() {
  const el = hintEl();
  let point = lastPress;
  if (!point && el && !el.hidden) {
    const r = el.getBoundingClientRect();
    point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (el) el.hidden = true;
  if (point) sparkleBurst(point.x, point.y, 8);
}
