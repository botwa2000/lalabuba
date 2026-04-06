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

export async function saveArtwork({ subject, difficulty, colorCount, previewCanvas, drawCanvas }) {
  const db = await openDB();
  // Composite both canvases into one JPEG
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

export async function openGalleryModal() {
  const modal = document.getElementById('gallery-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '<p class="gallery-loading">…</p>';

  const items = await listArtworks();
  if (!items.length) {
    grid.innerHTML = `<p class="gallery-empty">${t('galleryEmpty')}</p>`;
    return;
  }

  grid.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.innerHTML = `
      <img class="gallery-thumb" src="${item.jpeg}" alt="${item.subject}" loading="lazy">
      <div class="gallery-label">${item.subject}</div>
      <button class="gallery-delete" data-id="${item.id}" aria-label="Delete">✕</button>
    `;
    card.querySelector('.gallery-thumb').addEventListener('click', () => openLightbox(item.jpeg, item.subject));
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

export function initGalleryHandlers() {
  const btn = document.getElementById('gallery-btn');
  if (btn) btn.addEventListener('click', openGalleryModal);

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
