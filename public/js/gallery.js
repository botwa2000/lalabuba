// gallery.js — local gallery using IndexedDB
// Stores completed colored artworks as JPEG thumbnails.

const DB_NAME = 'lalabuba-gallery';
const DB_VERSION = 1;
const STORE = 'artworks';
const MAX_ENTRIES = 60;

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
    id: Date.now(),
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
import { BADGES, getProgress } from './progress.js';

// Render the masterpiece-count line + the earned/locked sticker shelf.
function renderJournalProgress() {
  let p;
  try { p = getProgress(); } catch { p = null; }

  const statsEl = document.getElementById('journal-stats');
  if (statsEl) {
    statsEl.textContent = p ? t('journalStats', p.totalCompleted || 0, p.streak || 0) : '';
  }

  const shelf = document.getElementById('sticker-shelf');
  if (shelf) {
    const earned = new Set(p ? p.badges : []);
    shelf.innerHTML = BADGES.map((b) => {
      const has = earned.has(b.id);
      const cap = `${b.id.charAt(0).toUpperCase()}${b.id.slice(1)}`;
      const title = t(`badge${cap}Title`);
      const desc  = has ? t(`badge${cap}Desc`) : t('journalLocked');
      return `<div class="sticker-chip ${has ? 'earned' : 'locked'}" title="${title} — ${desc}">
        <span class="sticker-chip-emoji">${has ? b.emoji : '🔒'}</span>
        <span class="sticker-chip-name">${title}</span>
      </div>`;
    }).join('');
  }
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
