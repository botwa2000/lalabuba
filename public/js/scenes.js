// scenes.js — "Sticker Scenes": collectible fill-able scenes that replace the
// single lonely penguin. A scene is a big backdrop you fill with themed
// decorations (trees, fish, cars, planets…). Decorations are EARNED by coloring
// (theme-matched to what the child drew) and, once unlocked, are reusable forever
// — no currency, no shop, no scarcity, nothing consumable (parent-safe).
//
// Local-only, like the rest of progress. Stored under `lalabuba-scenes-v1`:
//   { v:1, unlocked:[decoId…], placed:{ sceneId:[{d:decoId,x,y}…] } }
// Placements are an ARRAY per scene so the same decoration can be placed many
// times; drag/remove address an entry by its index.
//
// Kept in lock-step with the Flutter twin (scenes.dart): same scene ids, deco
// ids, themes, unlock thresholds and award logic. Never rename an existing id —
// it would orphan what a child has unlocked/placed.

import { themesOf } from './progress.js';

const KEY = 'lalabuba-scenes-v1';

// ── Scene catalogue ──────────────────────────────────────────────────────────
// id, emoji (picker chip), unlockAt (totalCompleted threshold; 0 = from start),
// bg [topColor, bottomColor] gradient. Name/strings resolve via `scene<Id>Name`.
export const SCENES = [
  { id: 'meadow',  emoji: '🌳', unlockAt: 0,  bg: ['#bfe3ff', '#cdeeb0'] },
  { id: 'iceberg', emoji: '🐧', unlockAt: 0,  bg: ['#d6f0ff', '#eef9ff'] },
  { id: 'ocean',   emoji: '🌊', unlockAt: 10, bg: ['#aee6f2', '#4fb3d4'] },
  { id: 'city',    emoji: '🏙️', unlockAt: 25, bg: ['#ffe0a8', '#ffc0cf'] },
  { id: 'space',   emoji: '🚀', unlockAt: 50, bg: ['#241a52', '#4a356f'] },
];

// ── Decoration catalogue ─────────────────────────────────────────────────────
// id, emoji, scene, theme. `theme` is one of progress.js's themes
// (animal/vehicle/food/nature/people/fantasy) or '' (generic — always eligible
// for the drip). Decorations are tappable emoji; they need no per-item i18n.
export const DECORATIONS = [
  // Meadow
  { id: 'm_tree',      emoji: '🌳', scene: 'meadow', theme: 'nature' },
  { id: 'm_pine',      emoji: '🌲', scene: 'meadow', theme: 'nature' },
  { id: 'm_tulip',     emoji: '🌷', scene: 'meadow', theme: 'nature' },
  { id: 'm_sunflower', emoji: '🌻', scene: 'meadow', theme: 'nature' },
  { id: 'm_blossom',   emoji: '🌸', scene: 'meadow', theme: 'nature' },
  { id: 'm_mushroom',  emoji: '🍄', scene: 'meadow', theme: 'nature' },
  { id: 'm_rainbow',   emoji: '🌈', scene: 'meadow', theme: 'nature' },
  { id: 'm_sun',       emoji: '☀️', scene: 'meadow', theme: 'nature' },
  { id: 'm_butterfly', emoji: '🦋', scene: 'meadow', theme: 'animal' },
  { id: 'm_bee',       emoji: '🐝', scene: 'meadow', theme: 'animal' },
  { id: 'm_ladybug',   emoji: '🐞', scene: 'meadow', theme: 'animal' },
  { id: 'm_bunny',     emoji: '🐰', scene: 'meadow', theme: 'animal' },
  { id: 'm_fox',       emoji: '🦊', scene: 'meadow', theme: 'animal' },
  { id: 'm_bird',      emoji: '🐦', scene: 'meadow', theme: 'animal' },
  // Iceberg (the penguin's home — brand mascot lives here)
  { id: 'i_penguin',   emoji: '🐧', scene: 'iceberg', theme: 'animal' },
  { id: 'i_fish',      emoji: '🐟', scene: 'iceberg', theme: 'animal' },
  { id: 'i_whale',     emoji: '🐳', scene: 'iceberg', theme: 'animal' },
  { id: 'i_polarbear', emoji: '🐻‍❄️', scene: 'iceberg', theme: 'animal' },
  { id: 'i_seal',      emoji: '🦭', scene: 'iceberg', theme: 'animal' },
  { id: 'i_snowman',   emoji: '⛄', scene: 'iceberg', theme: '' },
  { id: 'i_snowflake', emoji: '❄️', scene: 'iceberg', theme: 'nature' },
  { id: 'i_ice',       emoji: '🧊', scene: 'iceberg', theme: '' },
  { id: 'i_snow',      emoji: '🌨️', scene: 'iceberg', theme: 'nature' },
  { id: 'i_star',      emoji: '⭐', scene: 'iceberg', theme: '' },
  // Ocean
  { id: 'o_fish',     emoji: '🐠', scene: 'ocean', theme: 'animal' },
  { id: 'o_tropfish', emoji: '🐟', scene: 'ocean', theme: 'animal' },
  { id: 'o_octopus',  emoji: '🐙', scene: 'ocean', theme: 'animal' },
  { id: 'o_crab',     emoji: '🦀', scene: 'ocean', theme: 'animal' },
  { id: 'o_turtle',   emoji: '🐢', scene: 'ocean', theme: 'animal' },
  { id: 'o_dolphin',  emoji: '🐬', scene: 'ocean', theme: 'animal' },
  { id: 'o_whale',    emoji: '🐳', scene: 'ocean', theme: 'animal' },
  { id: 'o_shark',    emoji: '🦈', scene: 'ocean', theme: 'animal' },
  { id: 'o_shell',    emoji: '🐚', scene: 'ocean', theme: 'nature' },
  { id: 'o_coral',    emoji: '🪸', scene: 'ocean', theme: 'nature' },
  { id: 'o_star',     emoji: '🌟', scene: 'ocean', theme: '' },
  { id: 'o_wave',     emoji: '🌊', scene: 'ocean', theme: 'nature' },
  // City
  { id: 'c_building', emoji: '🏢', scene: 'city', theme: '' },
  { id: 'c_house',    emoji: '🏠', scene: 'city', theme: '' },
  { id: 'c_shop',     emoji: '🏪', scene: 'city', theme: '' },
  { id: 'c_car',      emoji: '🚗', scene: 'city', theme: 'vehicle' },
  { id: 'c_taxi',     emoji: '🚕', scene: 'city', theme: 'vehicle' },
  { id: 'c_bus',      emoji: '🚌', scene: 'city', theme: 'vehicle' },
  { id: 'c_bike',     emoji: '🚲', scene: 'city', theme: 'vehicle' },
  { id: 'c_police',   emoji: '🚓', scene: 'city', theme: 'vehicle' },
  { id: 'c_light',    emoji: '🚦', scene: 'city', theme: '' },
  { id: 'c_person',   emoji: '🧍', scene: 'city', theme: 'people' },
  { id: 'c_dog',      emoji: '🐕', scene: 'city', theme: 'animal' },
  { id: 'c_tree',     emoji: '🌳', scene: 'city', theme: 'nature' },
  // Space
  { id: 's_rocket',    emoji: '🚀', scene: 'space', theme: 'vehicle' },
  { id: 's_planet',    emoji: '🪐', scene: 'space', theme: '' },
  { id: 's_moon',      emoji: '🌙', scene: 'space', theme: '' },
  { id: 's_star',      emoji: '⭐', scene: 'space', theme: '' },
  { id: 's_comet',     emoji: '☄️', scene: 'space', theme: '' },
  { id: 's_ufo',       emoji: '🛸', scene: 'space', theme: 'vehicle' },
  { id: 's_alien',     emoji: '👽', scene: 'space', theme: 'fantasy' },
  { id: 's_astronaut', emoji: '👨‍🚀', scene: 'space', theme: 'people' },
  { id: 's_galaxy',    emoji: '🌌', scene: 'space', theme: '' },
  { id: 's_sparkle',   emoji: '✨', scene: 'space', theme: '' },
  { id: 's_satellite', emoji: '🛰️', scene: 'space', theme: 'vehicle' },
];

const DECO_BY_ID = Object.fromEntries(DECORATIONS.map((d) => [d.id, d]));
export function decoById(id) { return DECO_BY_ID[id]; }
export function sceneById(id) { return SCENES.find((s) => s.id === id); }
export function decosForScene(sceneId) { return DECORATIONS.filter((d) => d.scene === sceneId); }

// Scenes the child can currently open (threshold met), in catalogue order.
export function scenesUnlocked(totalCompleted) {
  return SCENES.filter((s) => (totalCompleted || 0) >= s.unlockAt);
}
export function isSceneUnlocked(totalCompleted, id) {
  const s = sceneById(id);
  return !!s && (totalCompleted || 0) >= s.unlockAt;
}
// Scenes whose threshold is EXACTLY met by this completion (to celebrate).
export function scenesUnlockedAt(totalCompleted) {
  return SCENES.filter((s) => s.unlockAt > 0 && s.unlockAt === totalCompleted);
}

// ── Scene of the week ─────────────────────────────────────────────────────────
// A gentle weekly theme to chase: the featured scene rotates every 7 days and
// grants a bonus decoration when the child colors something. `ts` is injectable
// for tests; defaults to now.
export function weekScene(ts) {
  const time = typeof ts === 'number' ? ts : Date.now();
  const week = Math.floor(time / (7 * 24 * 60 * 60 * 1000));
  return SCENES[((week % SCENES.length) + SCENES.length) % SCENES.length];
}
// A few English subject hints per scene — clicking the weekly pill drops one into
// the prompt so coloring it actually fills the featured scene.
export const SCENE_SUBJECTS = {
  meadow:  ['butterfly', 'flower', 'rabbit', 'fox', 'tree', 'bee', 'ladybug'],
  iceberg: ['penguin', 'polar bear', 'seal', 'snowman', 'whale', 'snowflake'],
  ocean:   ['fish', 'octopus', 'dolphin', 'turtle', 'crab', 'shark', 'seahorse'],
  city:    ['car', 'bus', 'house', 'dog', 'bicycle', 'fire truck', 'train'],
  space:   ['rocket', 'planet', 'astronaut', 'alien', 'star', 'moon', 'comet'],
};

// ── Persistent state ─────────────────────────────────────────────────────────
// `art` is the child's OWN finished coloring pages, captured as small thumbnails
// and usable as stickers in ANY scene (the "your art becomes your sticker" loop).
// Adding the field to fresh() means v1 states upgrade transparently (the spread
// below fills it in) — no migration needed.
function fresh() { return { v: 1, unlocked: [], placed: {}, art: [] }; }

// Keep at most this many art stickers (most recent) to stay well under the
// localStorage quota — each thumbnail is a ~120px PNG data URL (a few KB).
const ART_CAP = 24;

export function getScenesState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch { s = null; }
  const st = s && typeof s === 'object' ? { ...fresh(), ...s } : fresh();
  if (!Array.isArray(st.unlocked)) st.unlocked = [];
  if (!st.placed || typeof st.placed !== 'object') st.placed = {};
  if (!Array.isArray(st.art)) st.art = [];
  return st;
}
function persist(st) {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore quota/private mode */ }
}

export function isDecoUnlocked(id) { return getScenesState().unlocked.includes(id); }
export function unlockedDecosForScene(sceneId) {
  const have = new Set(getScenesState().unlocked);
  return decosForScene(sceneId).filter((d) => have.has(d.id));
}
export function placedIn(sceneId) {
  const arr = getScenesState().placed[sceneId];
  return Array.isArray(arr) ? arr : [];
}

// ── Art stickers (the child's own finished pages) ─────────────────────────────
// Newest first, so the tray shows the latest masterpiece at the front.
export function artStickers() {
  const arr = getScenesState().art;
  return Array.isArray(arr) ? [...arr].reverse() : [];
}
export function artById(id) {
  return getScenesState().art.find((a) => a && a.id === id) || null;
}

// ── Placement ────────────────────────────────────────────────────────────────
// Append a decoration to a scene at a staggered default position (the child then
// drags it). Duplicates allowed. Returns the updated placed-array for the scene.
export function placeDeco(sceneId, decoId) {
  const st = getScenesState();
  if (!st.unlocked.includes(decoId)) return placedIn(sceneId);
  const arr = Array.isArray(st.placed[sceneId]) ? st.placed[sceneId] : [];
  const n = arr.length;
  const x = Math.min(0.9, Math.max(0.1, 0.22 + (n % 4) * 0.18));
  const y = Math.min(0.9, Math.max(0.1, 0.25 + (Math.floor(n / 4) % 3) * 0.22));
  arr.push({ d: decoId, x, y });
  st.placed[sceneId] = arr;
  persist(st);
  return arr;
}
// Place one of the child's own art stickers in a scene. Stored as { a:artId, x, y }
// (vs emoji decorations' { d:decoId, x, y }) so rendering can branch on the key.
export function placeArt(sceneId, artId) {
  const st = getScenesState();
  if (!st.art.some((a) => a && a.id === artId)) return placedIn(sceneId);
  const arr = Array.isArray(st.placed[sceneId]) ? st.placed[sceneId] : [];
  const n = arr.length;
  const x = Math.min(0.9, Math.max(0.1, 0.22 + (n % 4) * 0.18));
  const y = Math.min(0.9, Math.max(0.1, 0.25 + (Math.floor(n / 4) % 3) * 0.22));
  arr.push({ a: artId, x, y });
  st.placed[sceneId] = arr;
  persist(st);
  return arr;
}
export function moveDeco(sceneId, index, nx, ny) {
  const st = getScenesState();
  const arr = st.placed[sceneId];
  if (!Array.isArray(arr) || !arr[index]) return;
  arr[index].x = Math.min(0.96, Math.max(0.04, nx));
  arr[index].y = Math.min(0.96, Math.max(0.04, ny));
  persist(st);
}
export function removeDeco(sceneId, index) {
  const st = getScenesState();
  const arr = st.placed[sceneId];
  if (!Array.isArray(arr)) return;
  arr.splice(index, 1);
  st.placed[sceneId] = arr;
  persist(st);
}
export function clearScene(sceneId) {
  const st = getScenesState();
  st.placed[sceneId] = [];
  persist(st);
}

// ── The earn loop ────────────────────────────────────────────────────────────
// Called after a completion is recorded. Unlocks decorations themed to what the
// child drew (theme-matched drip) plus seeds any scene that just unlocked, so a
// new scene is never empty. Returns { newDecos:[deco…], newScenes:[scene…] }.
function pick(arr) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }

export function awardForCompletion(subject, totalCompleted) {
  const st = getScenesState();
  const have = new Set(st.unlocked);
  const newDecos = [];
  const add = (d) => { if (d && !have.has(d.id)) { have.add(d.id); st.unlocked.push(d.id); newDecos.push(d); } };

  // 1) Seed any scene that just crossed its unlock threshold with its first 3 decos.
  const newScenes = scenesUnlockedAt(totalCompleted);
  for (const sc of newScenes) decosForScene(sc.id).slice(0, 3).forEach(add);

  // 2) Drip from scenes the child can currently open.
  const openScenes = new Set(scenesUnlocked(totalCompleted).map((s) => s.id));
  const pool = DECORATIONS.filter((d) => openScenes.has(d.scene) && !have.has(d.id));
  const themes = themesOf(subject);

  // First completion ever: give a generous starter so there's plenty to place.
  const want = (totalCompleted <= 1) ? 3 : 2;

  // Prefer a theme-matched decoration first (the "you drew an animal → here's an
  // animal" link), then top up with random picks from the open pool.
  if (themes.length) {
    const themed = pool.filter((d) => themes.includes(d.theme) && !have.has(d.id));
    add(pick(themed));
  }
  let guard = 0;
  while (newDecos.length < want && guard++ < 20) {
    const rest = pool.filter((d) => !have.has(d.id));
    if (!rest.length) break;
    add(pick(rest));
  }

  // Scene-of-the-week bonus: one extra decoration from this week's featured scene
  // (when it's open) so the weekly theme genuinely rewards play.
  try {
    const wk = weekScene();
    if (openScenes.has(wk.id)) add(pick(DECORATIONS.filter((d) => d.scene === wk.id && !have.has(d.id))));
  } catch { /* ignore */ }

  persist(st);
  return { newDecos, newScenes };
}

// Capture a just-finished coloring page as a reusable art sticker. `thumb` is a
// small PNG data URL of the colored page; `subject` drives a best-effort theme
// tag; `ts` is a caller-supplied timestamp (Date.now()) for ordering + id. Caps
// to the most recent ART_CAP and prunes placements that referenced a dropped
// sticker. Returns the new entry, or null when there's no thumbnail.
export function addArtSticker({ subject = '', thumb = null, ts = 0 } = {}) {
  if (!thumb) return null;
  const st = getScenesState();
  const theme = (themesOf(subject) || [])[0] || '';
  const id = `art_${ts}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  st.art.push({ id, thumb, theme, ts });
  if (st.art.length > ART_CAP) {
    const dropped = new Set(st.art.slice(0, st.art.length - ART_CAP).map((a) => a.id));
    st.art = st.art.slice(st.art.length - ART_CAP);
    for (const sid of Object.keys(st.placed)) {
      const arr = st.placed[sid];
      if (Array.isArray(arr)) st.placed[sid] = arr.filter((p) => !(p && p.a && dropped.has(p.a)));
    }
  }
  persist(st);
  return st.art[st.art.length - 1];
}
