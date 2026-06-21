// gallery.js — local gallery using IndexedDB
// Stores completed colored artworks as JPEG thumbnails.

const DB_NAME = 'lalabuba-gallery';
const DB_VERSION = 1;
const STORE = 'artworks';
const MAX_ENTRIES = 60;

// Disambiguates artwork ids saved within the same millisecond (see saveArtwork).
let _idCounter = 0;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('created', 'created', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveArtwork({ subject, difficulty, colorCount, previewCanvas, drawCanvas, lineArtDataUrl, fillDataUrl, completedRegions }) {
  const db = await openDB();
  // Composite both canvases into one JPEG thumbnail
  const tmp = document.createElement('canvas');
  tmp.width = previewCanvas.width; tmp.height = previewCanvas.height;
  const ctx = tmp.getContext('2d');
  ctx.drawImage(previewCanvas, 0, 0);
  if (drawCanvas) ctx.drawImage(drawCanvas, 0, 0);
  const jpeg = tmp.toDataURL('image/jpeg', 0.75);

  const entry = {
    // Unique, still chronologically-ordered key. Plain Date.now() collided when
    // two artworks were saved in the same millisecond (fast "Again" loops), so
    // the second silently overwrote the first via put(). The sub-ms counter keeps
    // ids monotonically increasing and numeric (preserves getAll key ordering).
    id: Date.now() * 1000 + (_idCounter++ % 1000),
    subject: subject || '?',
    difficulty: difficulty || 'medium',
    colorCount: colorCount || 12,
    created: new Date().toISOString(),
    jpeg,
    // Restoration data (present on new saves only)
    lineArtDataUrl: lineArtDataUrl || null,
    fillDataUrl: fillDataUrl || null,
    completedRegions: completedRegions || [],
  };

  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });

  // Trim to MAX_ENTRIES (delete oldest)
  const all = await listArtworks(db);
  if (all.length > MAX_ENTRIES) {
    const toDelete = all.slice(MAX_ENTRIES);
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const a of toDelete) store.delete(a.id);
  }
  return entry.id;
}

export async function listArtworks(db) {
  if (!db) db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('created').getAll();
    req.onsuccess = () => res(req.result.reverse()); // newest first
    req.onerror = () => rej(req.error);
  });
}

export async function deleteArtwork(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

// ── Gallery modal UI ─────────────────────────────────────────────────────────

import { t } from './i18n.js';
import { BADGES, GROUPS, badgesIn, getProgress } from './progress.js';
import { CRAYON_PACKS, PALETTES, isPackUnlocked, packById } from './data.js';
import { getDailyMission, missionProgressCount, missionIsDone } from './daily-mission.js';
import {
  SCENES, scenesUnlocked, isSceneUnlocked, sceneById,
  decosForScene, unlockedDecosForScene, placedIn,
  placeDeco, removeDeco, transformDeco, clearScene, decoById,
  STICKER_MIN_SCALE, STICKER_MAX_SCALE,
  artStickers, placeArt, artById,
} from './scenes.js';
import { pop, playPlace, playRemove } from './fx.js';

const cap = (id) => `${id.charAt(0).toUpperCase()}${id.slice(1)}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Group display metadata (emoji + i18n key), parity with Flutter ──
const GROUP_META = {
  milestones: { emoji: '🏆', key: 'groupMilestonesTitle' },
  streaks:    { emoji: '🔥', key: 'groupStreaksTitle' },
  explorer:   { emoji: '🧭', key: 'groupExplorerTitle' },
  creativity: { emoji: '🎨', key: 'groupCreativityTitle' },
  sharing:    { emoji: '📤', key: 'groupSharingTitle' },
};

// Render the masterpiece line, daily mission, mascot card, crayon packs and the
// grouped sticker album. Mirrors the Flutter Rewards screen.
function renderJournalProgress() {
  let p;
  try { p = getProgress(); } catch { p = null; }
  const total = p ? (p.totalCompleted || 0) : 0;
  const earned = new Set(p ? p.badges : []);

  const statsEl = document.getElementById('journal-stats');
  if (statsEl) {
    statsEl.textContent = p ? t('journalStats', total, p.streak || 0) : '';
  }

  renderDailyMission(p);
  renderScenesCard(total);
  renderCrayonPacks(total);
  renderStickerAlbum(p, earned);

  // "Next sticker" hint — closest masterpiece-count milestone still to earn.
  const nextEl = document.getElementById('journal-next');
  if (nextEl) {
    const milestones = [
      { n: 1, emoji: '🌟' }, { n: 5, emoji: '🖐️' }, { n: 10, emoji: '🔟' },
      { n: 25, emoji: '🎨' }, { n: 50, emoji: '🏆' }, { n: 100, emoji: '💯' },
    ];
    const next = milestones.find((m) => m.n > total);
    if (next) {
      nextEl.textContent = t('journalNext', next.n - total, next.emoji);
      nextEl.hidden = false;
    } else {
      nextEl.hidden = true;
    }
  }
}

// ── Daily mission card ──────────────────────────────────────────────────────
function renderDailyMission(p) {
  const card = document.getElementById('daily-mission-card');
  if (!card) return;
  let m;
  try { m = getDailyMission(); } catch { m = null; }
  if (!m || !p) { card.hidden = true; return; }
  const done = missionIsDone(m, p);
  const count = missionProgressCount(m, p);
  const showProgress = m.def.amount > 1 && !done;
  card.classList.toggle('done', done);
  card.innerHTML = `
    <div class="dm-emoji">${m.def.emoji}</div>
    <div class="dm-body">
      <div class="dm-title">${esc(t('missionTitle'))}</div>
      <div class="dm-text">${esc(t(`mission${cap(m.def.id)}Text`))}</div>
      ${showProgress ? `<div class="dm-progress">${esc(t('missionProgress', count, m.def.amount))}</div>` : ''}
    </div>
    ${done ? `<div class="dm-badge">${esc(t('missionDoneBadge'))}</div>` : ''}
  `;
  card.hidden = false;
}

// ── Scenes entry card ───────────────────────────────────────────────────────
function renderScenesCard(total) {
  const card = document.getElementById('mascot-card'); // reuses the same slot/id
  if (!card) return;
  const open = scenesUnlocked(total).length;
  card.innerHTML = `
    <span class="mc-emoji">🏞️</span>
    <span class="mc-body">
      <span class="mc-title">${esc(t('scenesCardTitle'))}</span>
      <span class="mc-sub">${esc(t('scenesCardSubtitle', open, SCENES.length))}</span>
    </span>
    <span class="mc-chev">›</span>
  `;
  card.hidden = false;
  card.onclick = () => openScenesModal();
}

// ── Crayon packs section ────────────────────────────────────────────────────
function renderCrayonPacks(total) {
  const wrap = document.getElementById('crayon-packs');
  if (!wrap) return;
  const current = (document.getElementById('palette-select') || {}).value || 'classic';
  const unlockedCount = CRAYON_PACKS.filter((pk) => isPackUnlocked(total, pk.id)).length;

  const tiles = CRAYON_PACKS.map((pk) => {
    const unlocked = isPackUnlocked(total, pk.id);
    const inUse = current === pk.id;
    const remaining = Math.max(1, pk.unlockAt - total);
    const preview = (PALETTES[pk.id] || []).slice(0, 6)
      .map((c) => `<span class="cp-dot" style="background:${c.color}"></span>`).join('');
    const footer = unlocked
      ? `<span class="cp-use ${inUse ? 'in-use' : ''}">${esc(t(inUse ? 'crayonInUse' : 'crayonUse'))}</span>`
      : `<span class="cp-locked">${esc(t('crayonLockedHint', remaining))}</span>`;
    return `<div class="crayon-pack-tile ${unlocked ? '' : 'locked'} ${inUse ? 'in-use' : ''}" data-pack="${pk.id}" data-unlocked="${unlocked ? '1' : '0'}">
      <div class="cp-head"><span class="cp-emoji">${pk.emoji}</span><span class="cp-name">${esc(t(`pack${cap(pk.id)}Name`))}</span></div>
      <div class="cp-dots">${preview}</div>
      <div class="cp-foot">${footer}</div>
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="rewards-section-head">
      <span class="rsh-title">${esc(t('crayonPacksHeader'))}</span>
      <span class="rsh-count">${esc(t('stickerCount', unlockedCount, CRAYON_PACKS.length))}</span>
    </div>
    <div class="crayon-pack-grid">${tiles}</div>
  `;
  wrap.querySelectorAll('.crayon-pack-tile[data-unlocked="1"]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const sel = document.getElementById('palette-select');
      if (sel) { sel.value = tile.dataset.pack; sel.dispatchEvent(new Event('change')); }
      renderCrayonPacks(total); // refresh in-use highlight
    });
  });
}

// ── Grouped sticker album ───────────────────────────────────────────────────
function renderStickerAlbum(p, earned) {
  const shelf = document.getElementById('sticker-shelf');
  if (!shelf) return;
  const totalEarned = BADGES.filter((b) => earned.has(b.id)).length;

  let html = `
    <div class="rewards-section-head">
      <span class="rsh-title">${esc(t('rewardsStickersHeader'))}</span>
      <span class="rsh-count">${esc(t('stickerCount', totalEarned, BADGES.length))}</span>
    </div>`;
  if (totalEarned === 0) {
    html += `<p class="album-empty-hint">${esc(t('rewardsEmptyHint'))}</p>`;
  }

  for (const group of GROUPS) {
    const meta = GROUP_META[group] || { emoji: '⭐', key: 'rewardsStickersHeader' };
    const list = badgesIn(group);
    const got = list.filter((b) => earned.has(b.id)).length;
    const tiles = list.map((b) => {
      const has = earned.has(b.id);
      return `<button class="sticker-tile ${has ? 'earned' : 'locked'}" type="button" data-badge="${b.id}" data-earned="${has ? '1' : '0'}">
        <span class="st-art">${has ? b.emoji : '🔒'}</span>
        <span class="st-name">${esc(t(`badge${cap(b.id)}Title`))}</span>
      </button>`;
    }).join('');
    html += `
      <div class="album-group">
        <div class="album-group-head">
          <span class="agh-emoji">${meta.emoji}</span>
          <span class="agh-title">${esc(t(meta.key))}</span>
          <span class="agh-count">${esc(t('stickerCount', got, list.length))}</span>
        </div>
        <div class="album-group-grid">${tiles}</div>
      </div>`;
  }
  shelf.innerHTML = html;
  shelf.querySelectorAll('.sticker-tile').forEach((tile) => {
    tile.addEventListener('click', () => {
      openStickerDetail(tile.dataset.badge, tile.dataset.earned === '1');
    });
  });
}

// ── Sticker detail popup ────────────────────────────────────────────────────
function openStickerDetail(badgeId, earned) {
  const el = document.getElementById('sticker-detail');
  if (!el) return;
  const b = BADGES.find((x) => x.id === badgeId);
  if (!b) return;
  el.innerHTML = `
    <div class="sd-backdrop"></div>
    <div class="sd-card" role="document">
      <div class="sd-art ${earned ? 'earned' : 'locked'}">${earned ? b.emoji : '🔒'}</div>
      <h4 class="sd-title">${esc(t(`badge${cap(b.id)}Title`))}</h4>
      <p class="sd-desc">${esc(t(`badge${cap(b.id)}Desc`))}</p>
      <span class="sd-status ${earned ? 'earned' : 'locked'}">${esc(t(earned ? 'stickerEarnedLabel' : 'stickerLockedLabel'))}</span>
      <button class="sd-close" type="button">${esc(t('stickerCloseBtn'))}</button>
    </div>`;
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  const close = () => { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); };
  el.querySelector('.sd-close').addEventListener('click', close);
  el.querySelector('.sd-backdrop').addEventListener('click', close);
}

// ── Sticker Scenes editor ────────────────────────────────────────────────────
// Pick a scene, then fill its big backdrop with decorations you've unlocked by
// coloring. Decorations are reusable (tap the tray to drop one, drag to move,
// long-press / double-tap to remove). Reuses #mascot-modal as the host element.
function openScenesModal() {
  const el = document.getElementById('mascot-modal');
  if (!el) return;
  let total = 0;
  try { total = getProgress().totalCompleted || 0; } catch {}
  // Default to the first unlocked scene that already has placements, else the first.
  let current = (scenesUnlocked(total)[0] || SCENES[0]).id;
  for (const s of scenesUnlocked(total)) { if (placedIn(s.id).length) { current = s.id; break; } }

  function render() {
    const scene = sceneById(current);
    const placed = placedIn(current);
    const trayDecos = unlockedDecosForScene(current);
    const arts = artStickers();
    const allInScene = decosForScene(current).length;
    const hasItems = trayDecos.length || arts.length;

    const tabs = SCENES.map((s) => {
      const unlocked = isSceneUnlocked(total, s.id);
      const need = Math.max(1, s.unlockAt - total);
      return `<button class="scene-tab ${s.id === current ? 'active' : ''} ${unlocked ? '' : 'locked'}"
        type="button" data-scene="${s.id}" ${unlocked ? '' : 'disabled'}
        title="${unlocked ? esc(t(`scene${cap(s.id)}Name`)) : esc(t('sceneLockedHint', need))}">
        <span class="scene-tab-emoji">${unlocked ? s.emoji : '🔒'}</span>
        <span class="scene-tab-name">${unlocked ? esc(t(`scene${cap(s.id)}Name`)) : esc(t('sceneLockedShort', need))}</span>
      </button>`;
    }).join('');

    // transform combines centering + scale + rotation; inline style overrides the
    // base CSS translate so pinch/twist render live.
    const xform = (it) => {
      const s = typeof it.s === 'number' ? it.s : 1;
      const r = typeof it.r === 'number' ? it.r : 0;
      return `translate(-50%,-50%) scale(${s}) rotate(${r}rad)`;
    };
    const stickers = placed.map((it, i) => {
      if (it.a) {
        const a = artById(it.a);
        if (!a) return ''; // pruned art sticker → skip silently
        return `<span class="scene-sticker scene-sticker--art" data-index="${i}" style="left:${it.x * 100}%;top:${it.y * 100}%;transform:${xform(it)}"><img src="${a.thumb}" alt="${esc(t('artStickerAlt'))}" draggable="false"></span>`;
      }
      const d = decoById(it.d);
      return `<span class="scene-sticker" data-index="${i}" style="left:${it.x * 100}%;top:${it.y * 100}%;transform:${xform(it)}">${d ? d.emoji : '⭐'}</span>`;
    }).join('');

    // Tray: the child's own art first (placeable in ANY scene), then this scene's
    // unlocked emoji decorations.
    const artTray = arts.length
      ? `<div class="scene-tray-head">${esc(t('sceneTrayMyArt'))}</div>
         <div class="scene-tray scene-tray--art">${arts.map((a) =>
            `<button class="scene-tray-item scene-tray-item--art" type="button" data-art="${a.id}"><img src="${a.thumb}" alt="${esc(t('artStickerAlt'))}" draggable="false"></button>`).join('')}</div>`
      : '';
    const decoTray = `<div class="scene-tray-head">${esc(t('sceneTrayHead', trayDecos.length, allInScene))}</div>
         <div class="scene-tray">${trayDecos.length
            ? trayDecos.map((d) => `<button class="scene-tray-item" type="button" data-deco="${d.id}">${d.emoji}</button>`).join('')
            : `<p class="scene-tray-empty">${esc(t('sceneTrayEmpty'))}</p>`}</div>`;

    el.innerHTML = `
      <div class="scenes-modal-card">
        <div class="scenes-modal-head">
          <h3>${esc(t('scenesTitle'))}</h3>
          <div class="scenes-head-actions">
            ${placed.length ? `<button class="scene-clear" type="button">${esc(t('sceneClear'))}</button>` : ''}
            <button class="scenes-close" type="button" aria-label="Close">✕</button>
          </div>
        </div>
        <div class="scene-tabs">${tabs}</div>
        <div class="scene-stage" id="scene-stage" style="background:linear-gradient(180deg, ${scene.bg[0]}, ${scene.bg[1]})">
          ${stickers}
          ${(!placed.length && hasItems) ? `<span class="scene-hint">${esc(t('sceneHint'))}</span>` : ''}
          ${(!hasItems) ? `<span class="scene-hint">${esc(t('sceneEarnHint'))}</span>` : ''}
        </div>
        <div class="scene-tray-wrap">
          ${artTray}
          ${decoTray}
        </div>
      </div>`;

    el.querySelector('.scenes-close').addEventListener('click', close);
    const clearBtn = el.querySelector('.scene-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => { clearScene(current); render(); });
    el.querySelectorAll('.scene-tab:not(.locked)').forEach((b) => {
      b.addEventListener('click', () => { current = b.dataset.scene; render(); });
    });
    el.querySelectorAll('.scene-tray-item[data-deco]').forEach((b) => {
      b.addEventListener('click', () => { placeDeco(current, b.dataset.deco); render(); popLast(); });
    });
    el.querySelectorAll('.scene-tray-item[data-art]').forEach((b) => {
      b.addEventListener('click', () => { placeArt(current, b.dataset.art); render(); popLast(); });
    });
    wireDrag();
  }

  // After a placement re-renders the stage, pop the just-added sticker (it's the
  // last one) and play the soft placement cue.
  function popLast() {
    const all = el.querySelectorAll('.scene-sticker');
    const last = all[all.length - 1];
    if (last) pop(last);
    try { playPlace(); } catch { /* ignore */ }
  }

  // One finger drags; two fingers pinch-resize + twist-rotate (Pointer Events so
  // mouse + multitouch share one path); double-tap removes. Parity with the
  // Flutter scale gesture. `touch-action:none` on .scene-sticker keeps the
  // browser from stealing the gesture for scroll/zoom.
  function wireDrag() {
    const stage = el.querySelector('#scene-stage');
    if (!stage) return;
    const placedArr = placedIn(current);
    el.querySelectorAll('.scene-sticker').forEach((st) => {
      const index = Number(st.dataset.index);
      const it = placedArr[index] || {};
      const pointers = new Map(); // pointerId → {x,y}
      let moved = false, lastTap = 0;
      // live transform, seeded from the stored placement
      let curX = it.x ?? 0.5, curY = it.y ?? 0.5;
      let curS = typeof it.s === 'number' ? it.s : 1;
      let curR = typeof it.r === 'number' ? it.r : 0;
      // two-finger gesture baselines
      let baseDist = 1, baseAng = 0, baseS = 1, baseR = 0;
      let baseMidX = 0, baseMidY = 0, baseCurX = 0.5, baseCurY = 0.5;
      const clamp = (v) => Math.min(0.96, Math.max(0.04, v));
      const pts = () => [...pointers.values()];

      const applyLive = () => {
        st.style.left = (curX * 100) + '%';
        st.style.top = (curY * 100) + '%';
        st.style.transform = `translate(-50%,-50%) scale(${curS}) rotate(${curR}rad)`;
      };

      const seed2 = () => {
        const [p1, p2] = pts();
        baseDist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
        baseAng = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        baseS = curS; baseR = curR;
        baseMidX = (p1.x + p2.x) / 2; baseMidY = (p1.y + p2.y) / 2;
        baseCurX = curX; baseCurY = curY;
      };

      const onDown = (e) => {
        try { st.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        e.preventDefault();
        if (pointers.size === 2) seed2();
      };
      const onMove = (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        e.preventDefault();
        moved = true;
        const r = stage.getBoundingClientRect();
        if (pointers.size >= 2) {
          const [p1, p2] = pts();
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
          const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          curS = Math.min(STICKER_MAX_SCALE, Math.max(STICKER_MIN_SCALE, baseS * (dist / baseDist)));
          curR = baseR + (ang - baseAng);
          const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
          curX = clamp(baseCurX + (midX - baseMidX) / r.width);
          curY = clamp(baseCurY + (midY - baseMidY) / r.height);
        } else {
          const p = pointers.get(e.pointerId);
          curX = clamp((p.x - r.left) / r.width);
          curY = clamp((p.y - r.top) / r.height);
        }
        applyLive();
      };
      const onUp = (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        try { st.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        if (pointers.size > 0) return; // wait for the last finger to lift
        const now = Date.now();
        if (!moved) {
          if (now - lastTap < 320) { removeDeco(current, index); try { playRemove(); } catch {} render(); return; }
          lastTap = now;
          return;
        }
        transformDeco(current, index, { x: curX, y: curY, s: curS, r: curR });
        moved = false;
      };
      st.addEventListener('pointerdown', onDown);
      st.addEventListener('pointermove', onMove);
      st.addEventListener('pointerup', onUp);
      st.addEventListener('pointercancel', onUp);
    });
  }

  function close() {
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  }

  render();
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
}

export async function openGalleryModal(onContinue) {
  const modal = document.getElementById('gallery-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  renderJournalProgress();

  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '<p class="gallery-loading">…</p>';

  const items = await listArtworks();
  const printBookBtn = document.getElementById('print-book-btn');
  if (printBookBtn) printBookBtn.hidden = !items.length;
  if (!items.length) {
    grid.innerHTML = `<p class="gallery-empty">${t('galleryEmpty')}</p>`;
    return;
  }

  grid.innerHTML = '';
  for (const item of items) {
    const canContinue = !!(item.lineArtDataUrl && item.fillDataUrl);
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.innerHTML = `
      <img class="gallery-thumb" src="${item.jpeg}" alt="${item.subject}" loading="lazy">
      <div class="gallery-label">${item.subject}</div>
      ${canContinue ? `<button class="gallery-continue" aria-label="${t('galleryContinue')}">🖌️</button>` : ''}
      <button class="gallery-delete" aria-label="Delete">✕</button>
    `;
    card.querySelector('.gallery-thumb').addEventListener('click', () => openLightbox(item.jpeg, item.subject));
    if (canContinue) {
      card.querySelector('.gallery-continue').addEventListener('click', (e) => {
        e.stopPropagation();
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        if (onContinue) onContinue(item);
      });
    }
    card.querySelector('.gallery-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteArtwork(item.id);
      card.remove();
      if (!grid.querySelector('.gallery-card')) {
        grid.innerHTML = `<p class="gallery-empty">${t('galleryEmpty')}</p>`;
      }
    });
    grid.appendChild(card);
  }
}

// Build a printable "coloring book" from every saved page and open the browser
// print dialog (the user can Save as PDF). No PDF library — just a print window.
async function buildPrintBook() {
  let items = [];
  try { items = await listArtworks(); } catch { items = []; }
  if (!items.length) { try { alert(t('printBookEmpty')); } catch {} return; }
  const w = window.open('', '_blank');
  if (!w) return; // popup blocked
  const title = t('printBookTitle');
  const pages = items.map((it) =>
    `<figure class="pb-page"><img src="${it.jpeg}" alt="${esc(it.subject || '')}"><figcaption>${esc(it.subject || '')}</figcaption></figure>`
  ).join('');
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
    '<style>' +
    '@page { margin: 12mm; }' +
    'body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #222; }' +
    'h1 { text-align: center; font-size: 30px; margin: 16px 0 24px; }' +
    '.pb-page { page-break-inside: avoid; break-inside: avoid; text-align: center; margin: 0 0 16mm; }' +
    '.pb-page img { max-width: 100%; max-height: 225mm; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,.12); }' +
    'figcaption { font-size: 18px; font-weight: 700; margin-top: 8px; text-transform: capitalize; }' +
    '</style></head><body><h1>🎨 ' + esc(title) + '</h1>' + pages +
    '<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};<\/script>' +
    '</body></html>';
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function openLightbox(src, alt) {
  const lb = document.getElementById('gallery-lightbox');
  if (!lb) return;
  const img = lb.querySelector('.lightbox-img');
  if (img) { img.src = src; img.alt = alt; }
  lb.classList.remove('hidden');
  lb.setAttribute('aria-hidden', 'false');
}

export function initGalleryHandlers(onContinue) {
  const btn = document.getElementById('gallery-btn');
  if (btn) btn.addEventListener('click', () => openGalleryModal(onContinue));

  const closeBtn = document.getElementById('close-gallery-modal');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    const modal = document.getElementById('gallery-modal');
    if (modal) { modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); }
  });

  const printBookBtn = document.getElementById('print-book-btn');
  if (printBookBtn) printBookBtn.addEventListener('click', () => buildPrintBook());

  const lb = document.getElementById('gallery-lightbox');
  if (lb) lb.addEventListener('click', () => {
    lb.classList.add('hidden'); lb.setAttribute('aria-hidden', 'true');
  });
}
