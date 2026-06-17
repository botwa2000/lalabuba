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
import { getMascotDecor, toggleMascotSticker, setMascotPos, clearMascot } from './mascot.js';

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
  renderMascotCard(earned);
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

// ── Mascot entry card ───────────────────────────────────────────────────────
function renderMascotCard(earned) {
  const card = document.getElementById('mascot-card');
  if (!card) return;
  card.innerHTML = `
    <span class="mc-emoji">🐧</span>
    <span class="mc-body">
      <span class="mc-title">${esc(t('mascotCardTitle'))}</span>
      <span class="mc-sub">${esc(t('mascotCardSubtitle'))}</span>
    </span>
    <span class="mc-chev">›</span>
  `;
  card.hidden = false;
  card.onclick = () => openMascotModal();
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

// ── Mascot decorate view ────────────────────────────────────────────────────
function openMascotModal() {
  const el = document.getElementById('mascot-modal');
  if (!el) return;
  let earnedBadges = [];
  try { earnedBadges = BADGES.filter((b) => new Set(getProgress().badges).has(b.id)); } catch {}
  const emojiOf = Object.fromEntries(BADGES.map((b) => [b.id, b.emoji]));

  function render() {
    const decor = getMascotDecor();
    const placed = Object.entries(decor)
      .map(([id, pos]) => `<span class="mascot-sticker" data-id="${id}" style="left:${pos[0] * 100}%;top:${pos[1] * 100}%">${emojiOf[id] || '⭐'}</span>`)
      .join('');
    const hasPlaced = Object.keys(decor).length > 0;
    const tray = earnedBadges.length
      ? earnedBadges.map((b) => {
          const on = Object.prototype.hasOwnProperty.call(decor, b.id);
          return `<button class="mascot-tray-item ${on ? 'on' : ''}" type="button" data-id="${b.id}">${b.emoji}</button>`;
        }).join('')
      : `<p class="mascot-tray-empty">${esc(t('mascotTrayEmpty'))}</p>`;

    el.innerHTML = `
      <div class="mascot-modal-card">
        <div class="mascot-modal-head">
          <h3>${esc(t('mascotTitle'))}</h3>
          <div class="mascot-head-actions">
            ${hasPlaced ? `<button class="mascot-clear" type="button">${esc(t('mascotClear'))}</button>` : ''}
            <button class="mascot-close" type="button" aria-label="Close">✕</button>
          </div>
        </div>
        <div class="mascot-stage" id="mascot-stage">
          <span class="mascot-penguin">🐧</span>
          ${placed}
          ${(!hasPlaced && earnedBadges.length) ? `<span class="mascot-hint">${esc(t('mascotHint'))}</span>` : ''}
        </div>
        <div class="mascot-tray">${tray}</div>
      </div>`;

    el.querySelector('.mascot-close').addEventListener('click', closeMascot);
    const clearBtn = el.querySelector('.mascot-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => { clearMascot(); render(); });
    el.querySelectorAll('.mascot-tray-item').forEach((b) => {
      b.addEventListener('click', () => { toggleMascotSticker(b.dataset.id); render(); });
    });
    wireDrag();
  }

  function wireDrag() {
    const stage = el.querySelector('#mascot-stage');
    if (!stage) return;
    el.querySelectorAll('.mascot-sticker').forEach((st) => {
      let dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        e.preventDefault();
        const pt = e.touches ? e.touches[0] : e;
        const r = stage.getBoundingClientRect();
        const nx = (pt.clientX - r.left) / r.width;
        const ny = (pt.clientY - r.top) / r.height;
        st.style.left = Math.min(96, Math.max(4, nx * 100)) + '%';
        st.style.top = Math.min(96, Math.max(4, ny * 100)) + '%';
      };
      const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        const pt = (e.changedTouches ? e.changedTouches[0] : e);
        const r = stage.getBoundingClientRect();
        setMascotPos(st.dataset.id, (pt.clientX - r.left) / r.width, (pt.clientY - r.top) / r.height);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };
      const onDown = (e) => {
        dragging = true;
        e.preventDefault();
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
      };
      st.addEventListener('mousedown', onDown);
      st.addEventListener('touchstart', onDown, { passive: false });
    });
  }

  function closeMascot() {
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

  const lb = document.getElementById('gallery-lightbox');
  if (lb) lb.addEventListener('click', () => {
    lb.classList.add('hidden'); lb.setAttribute('aria-hidden', 'true');
  });
}
