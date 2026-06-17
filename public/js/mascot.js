// mascot.js — local-only "decorate your penguin" state. Stores which earned
// stickers the child placed on the mascot and where (normalized 0..1 within the
// stage). Web twin of the Flutter mascot.dart. Persisted as { "<badgeId>": [x, y] }.

const KEY = 'lalabuba-mascot-decor-v1';

export function getMascotDecor() {
  try {
    const j = JSON.parse(localStorage.getItem(KEY));
    if (j && typeof j === 'object') return j;
  } catch { /* ignore */ }
  return {};
}

function persist(m) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

// Add the sticker (staggered placement) if absent, else remove it. Returns the
// updated decor map.
export function toggleMascotSticker(id) {
  const m = getMascotDecor();
  if (Object.prototype.hasOwnProperty.call(m, id)) {
    delete m[id];
  } else {
    const n = Object.keys(m).length;
    const dx = Math.min(0.95, Math.max(0.05, 0.30 + (n % 3) * 0.18));
    const dy = Math.min(0.95, Math.max(0.05, 0.22 + (Math.floor(n / 3) % 3) * 0.20));
    m[id] = [dx, dy];
  }
  persist(m);
  return m;
}

// Update a placed sticker's position (clamped). Persists immediately (the web
// drag handler calls this on pointerup).
export function setMascotPos(id, nx, ny) {
  const m = getMascotDecor();
  if (!Object.prototype.hasOwnProperty.call(m, id)) return m;
  m[id] = [
    Math.min(0.96, Math.max(0.04, nx)),
    Math.min(0.96, Math.max(0.04, ny)),
  ];
  persist(m);
  return m;
}

export function clearMascot() {
  persist({});
  return {};
}
