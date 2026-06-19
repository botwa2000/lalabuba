// fx.js — shared "delight" layer: sound + sparkle + pop/bounce. Used by the
// completion animation (canvas.js/main.js) and the Sticker Scenes editor
// (gallery.js). No asset files — cues are synthesized with WebAudio, so it works
// fully offline. Every effect degrades to a silent no-op when the browser lacks
// the API (old WebViews, reduced-motion, sound muted), so callers never guard.
//
// Sound is opt-OUT (default on) and persisted under `lalabuba-sound-v1`. A single
// AudioContext is created lazily on the first cue (must follow a user gesture, so
// the first cue after a tap/click is what unlocks audio on iOS/Safari).

const SOUND_KEY = 'lalabuba-sound-v1';

export function isSoundOn() {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}
export function setSoundOn(on) {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
}
export function toggleSound() { const next = !isSoundOn(); setSoundOn(next); return next; }

// Respect the OS "reduce motion" preference for the *visual* effects only — sound
// is governed solely by the user's own toggle.
function reducedMotion() {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
}

// ── Sound ────────────────────────────────────────────────────────────────────
let _ac = null;
function audioCtx() {
  if (_ac) return _ac;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    _ac = AC ? new AC() : null;
  } catch { _ac = null; }
  return _ac;
}

// Play a short sequence of notes. Each note: { f: freqHz, t?: startOffsetSec, d?: durSec }.
function tones(notes, { type = 'sine', gain = 0.12 } = {}) {
  if (!isSoundOn()) return;
  const ctx = audioCtx();
  if (!ctx) return;
  try { if (ctx.state === 'suspended') ctx.resume(); } catch { /* ignore */ }
  const t0 = ctx.currentTime;
  for (const n of notes) {
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = n.f;
      const start = t0 + (n.t || 0);
      const dur = n.d || 0.12;
      // Quick attack, exponential release — soft, bell-ish, never harsh for kids.
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.03);
    } catch { /* ignore a single bad note */ }
  }
}

// Named cues used across the app.
export function playFill()     { tones([{ f: 680, d: 0.09 }], { type: 'triangle', gain: 0.06 }); }
export function playPlace()    { tones([{ f: 523.25, d: 0.08 }, { f: 784, t: 0.05, d: 0.10 }], { type: 'sine', gain: 0.09 }); }
export function playRemove()   { tones([{ f: 440, d: 0.07 }, { f: 330, t: 0.05, d: 0.09 }], { type: 'sine', gain: 0.07 }); }
export function playUnlock()   { tones([{ f: 587.33, d: 0.10 }, { f: 880, t: 0.10, d: 0.18 }], { type: 'sine', gain: 0.11 }); }
export function playComplete() {
  // Rising C-major arpeggio resolving up an octave — the "you did it!" fanfare.
  tones([
    { f: 523.25, t: 0.00, d: 0.14 }, // C5
    { f: 659.25, t: 0.12, d: 0.14 }, // E5
    { f: 783.99, t: 0.24, d: 0.16 }, // G5
    { f: 1046.5, t: 0.38, d: 0.30 }, // C6
  ], { type: 'triangle', gain: 0.13 });
}

// ── Visuals (Web Animations API — no CSS file needed) ─────────────────────────

// A short "pop in" used when a sticker lands in a scene.
export function pop(el) {
  if (!el || !el.animate || reducedMotion()) return;
  try {
    el.animate(
      [
        { transform: 'scale(0.2)', opacity: 0 },
        { transform: 'scale(1.18)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' },
    );
  } catch { /* ignore */ }
}

// A gentle happy wiggle/zoom — used on the canvas the moment a page is finished.
export function bounce(el) {
  if (!el || !el.animate || reducedMotion()) return;
  try {
    el.animate(
      [
        { transform: 'scale(1) rotate(0deg)' },
        { transform: 'scale(1.04) rotate(-1.2deg)', offset: 0.3 },
        { transform: 'scale(0.99) rotate(1deg)', offset: 0.6 },
        { transform: 'scale(1) rotate(0deg)' },
      ],
      { duration: 720, easing: 'ease-in-out' },
    );
  } catch { /* ignore */ }
}

// Burst of sparkle particles flying out from a viewport point (cx, cy).
// Particles are fixed-position spans appended to <body>, animated with WAAPI and
// removed when done — no leftover DOM, no CSS dependency.
const SPARKLES = ['✨', '⭐', '🌟', '💫'];
export function sparkleBurst(cx, cy, count = 10) {
  if (reducedMotion() || typeof document === 'undefined') return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.textContent = SPARKLES[i % SPARKLES.length];
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText =
      'position:fixed;left:' + cx + 'px;top:' + cy + 'px;' +
      'font-size:' + (14 + ((i * 7) % 12)) + 'px;pointer-events:none;z-index:3000;' +
      'will-change:transform,opacity;transform:translate(-50%,-50%);';
    document.body.appendChild(s);
    // Deterministic-but-varied spread (no Math.random needed for nice fan-out).
    const ang = (Math.PI * 2 * i) / count + (i % 2 ? 0.4 : -0.3);
    const dist = 46 + ((i * 13) % 38);
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 18; // bias upward, like real sparks
    if (!s.animate) { setTimeout(() => s.remove(), 50); continue; }
    const anim = s.animate(
      [
        { transform: 'translate(-50%,-50%) scale(0.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1) rotate(${dx}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx * 1.25}px), calc(-50% + ${dy * 1.25 + 26}px)) scale(0.5) rotate(${dx * 1.4}deg)`, opacity: 0 },
      ],
      { duration: 760 + ((i * 37) % 260), easing: 'cubic-bezier(.2,.7,.3,1)' },
    );
    anim.onfinish = () => s.remove();
    anim.oncancel = () => s.remove();
  }
}

// Convenience: burst at the centre of an element's bounding box.
export function sparkleAt(el, count = 10) {
  if (!el || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  sparkleBurst(r.left + r.width / 2, r.top + r.height / 2, count);
}
