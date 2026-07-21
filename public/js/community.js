/**
 * Community features — device identity, API client, gallery tab, leaderboard,
 * parental consent gate, community share flow, emoji reactions, notifications,
 * template variations, post-completion share prompt, weekly theme, daily filter.
 *
 * Loaded as a standalone ES module from index.html; does not depend on main.js.
 */

import { t } from './i18n.js';
import { getProgress, mergeFromServer } from './progress.js';

// ── Inline styles for dynamic community UI elements ──────────────────────────

(function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    .lightbox-reaction-bar{display:flex;gap:8px;padding:8px 0 4px;flex-wrap:wrap}
    .reaction-btn{display:flex;align-items:center;gap:4px;padding:6px 12px;border:1.5px solid var(--border,#ddd);border-radius:20px;background:var(--bg,#fff);cursor:pointer;font-size:1rem;color:inherit;transition:all .15s;min-width:52px;justify-content:center}
    .reaction-btn.active{border-color:#7c4dff;background:#ede9ff;color:#7c4dff}
    .reaction-count{font-size:.78rem;font-weight:600;min-width:14px;text-align:center}
    .community-notif-banner{display:flex;align-items:center;gap:10px;padding:10px 14px;margin:0 0 10px;background:#ede9ff;border-radius:10px;font-size:.88rem;color:#4a148c;animation:slideDown .25s ease}
    .community-notif-banner button{margin-left:auto;background:none;border:none;cursor:pointer;font-size:1.1rem;color:#4a148c;padding:0 4px}
    .weekly-theme-banner{display:flex;align-items:center;gap:10px;padding:10px 14px;margin:0 0 12px;background:linear-gradient(135deg,#7c4dff22,#ea80fc22);border:1.5px solid #7c4dff44;border-radius:10px;font-size:.88rem;color:var(--text)}
    .weekly-theme-banner strong{color:#7c4dff}
    .community-variations-row{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:.84rem;color:var(--muted)}
    .community-variations-row button{background:none;border:none;cursor:pointer;color:#7c4dff;font-size:.84rem;text-decoration:underline;padding:0}
    .post-completion-prompt{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:1200;background:var(--surface,#fff);border:2px solid #7c4dff;border-radius:16px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,.18);display:flex;flex-direction:column;align-items:center;gap:10px;max-width:320px;width:90%;animation:slideUp .3s ease}
    .post-completion-prompt .pcp-emoji{font-size:2rem}
    .post-completion-prompt .pcp-msg{font-size:.95rem;font-weight:600;text-align:center;color:var(--text)}
    .post-completion-prompt .pcp-btns{display:flex;gap:8px;width:100%}
    .post-completion-prompt .pcp-share{flex:1;padding:8px 12px;background:#7c4dff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600}
    .post-completion-prompt .pcp-dismiss{padding:8px 12px;background:none;border:1.5px solid var(--border,#ddd);border-radius:8px;cursor:pointer;font-size:.9rem;color:var(--muted)}
    .lightbox-variations-view{display:none;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;margin-top:10px}
    .lightbox-variations-view.open{display:flex}
    .var-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px}
    .var-thumb{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer}
    @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideUp{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}
  `;
  document.head.appendChild(s);
})();

// ── Device identity ─────────────────────────────────────────────────────────

export function getCommunityId() {
  let id = localStorage.getItem("lalabuba-community-id");
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem("lalabuba-community-id", id);
  }
  return id;
}

// ── API client ───────────────────────────────────────────────────────────────

const API_BASE = "";

async function apiGet(path) {
  const r = await fetch(API_BASE + path, {
    headers: { "X-Device-ID": getCommunityId() },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function apiPost(path, body, extra = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Device-ID": getCommunityId(),
    ...extra,
  };
  const r = await fetch(API_BASE + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || `HTTP ${r.status}`), { code: data.code, status: r.status });
  return data;
}

// ── Toast helper ─────────────────────────────────────────────────────────────

const toastEl = document.getElementById("community-toast");
let toastTimer;
function showToast(msg, durationMs = 2800) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("visible"), durationMs);
}

// ── Config ────────────────────────────────────────────────────────────────────

let _config = null;
async function getConfig() {
  if (_config) return _config;
  try {
    const r = await fetch("/api/community/config");
    if (r.ok) _config = await r.json();
  } catch { /* offline — feature gates default open */ }
  return _config || {};
}

// ── Community modal ───────────────────────────────────────────────────────────

const communityPanel = document.getElementById("community-gallery-panel");
const communityModal = document.getElementById("community-modal");

let _notificationsChecked = false;
let _ownNickname = null;

async function _getOwnNickname() {
  if (_ownNickname !== null) return _ownNickname;
  try {
    const p = await apiGet('/api/community/profile');
    _ownNickname = p.hasNickname ? (p.nickname || '') : '';
  } catch { _ownNickname = ''; }
  return _ownNickname;
}

export function openCommunityModal() {
  if (!communityModal) return;
  communityModal.classList.remove('hidden');
  communityModal.setAttribute('aria-hidden', 'false');
  _removeCommunityTabDot();
  initCommunityGalleryOnce();
  if (!_notificationsChecked) {
    _notificationsChecked = true;
    checkNotifications();
  }
}

function closeCommunityModal() {
  if (!communityModal) return;
  communityModal.classList.add('hidden');
  communityModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('close-community-modal')?.addEventListener('click', closeCommunityModal);
communityModal?.addEventListener('click', e => { if (e.target === communityModal) closeCommunityModal(); });

// ── Notifications ─────────────────────────────────────────────────────────────

function _addCommunityTabDot() {
  const navBtn = document.getElementById('community-nav-btn');
  if (!navBtn || navBtn.querySelector('.comm-tab-dot')) return;
  navBtn.style.position = 'relative';
  const dot = document.createElement('span');
  dot.className = 'comm-tab-dot';
  dot.style.cssText =
    'position:absolute;top:4px;right:6px;width:8px;height:8px;' +
    'background:#e74c3c;border-radius:50%;pointer-events:none;';
  navBtn.appendChild(dot);
}

function _removeCommunityTabDot() {
  document.querySelector('.comm-tab-dot')?.remove();
}

async function checkNotifications() {
  try {
    const data = await apiGet("/api/community/notifications");
    if (data.newReactions > 0 && communityPanel) {
      showNotificationBanner(data.newReactions, data.details || []);
      _addCommunityTabDot();
    }
  } catch { /* offline */ }
}

function showNotificationBanner(count, details) {
  // Remove any existing banner first.
  communityPanel?.querySelector(".community-notif-banner")?.remove();

  const subject = details[0]?.subject || "";
  const msg = subject
    ? `🌟 ${count} new reaction${count > 1 ? "s" : ""} on "${subject}" and more!`
    : `🌟 ${count} new reaction${count > 1 ? "s" : ""} on your artwork${count > 1 ? "s" : ""}!`;

  const banner = document.createElement("div");
  banner.className = "community-notif-banner";
  banner.innerHTML = `<span>${escHtml(msg)}</span><button aria-label="Dismiss">✕</button>`;
  banner.querySelector("button").addEventListener("click", () => banner.remove());

  // Insert before the grid (or at the top of the community panel content).
  const communityGrid = document.getElementById("community-grid");
  if (communityGrid) {
    communityPanel.insertBefore(banner, communityGrid.previousElementSibling || communityGrid);
  } else {
    communityPanel.prepend(banner);
  }
}

// ── Weekly theme banner ───────────────────────────────────────────────────────

let _weeklyTheme = null;

async function loadWeeklyTheme() {
  if (_weeklyTheme !== null) return _weeklyTheme;
  try {
    const data = await fetch("/api/community/weekly-theme").then(r => r.json());
    _weeklyTheme = data;
    return data;
  } catch {
    _weeklyTheme = { active: false };
    return _weeklyTheme;
  }
}

async function showWeeklyThemeBanner() {
  const theme = await loadWeeklyTheme();
  if (!theme?.active || !communityPanel) return;

  // Don't show twice.
  if (communityPanel.querySelector(".weekly-theme-banner")) return;

  const banner = document.createElement("div");
  banner.className = "weekly-theme-banner";
  banner.innerHTML = `<span>${escHtml(theme.themeEmoji || "🎨")}</span> <span>This week's theme: <strong>${escHtml(theme.themeWord)}</strong></span><button class="cf-btn" style="margin-left:auto;padding:4px 10px;font-size:.8rem" data-type="theme">Show all →</button>`;

  const themeFilterBtn = banner.querySelector("button");
  themeFilterBtn?.addEventListener("click", () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    themeFilterBtn.classList.add("active");
    currentFilter = "theme";
    nextPage = 0;
    allPagesLoaded = false;
    if (communityGridEl) communityGridEl.innerHTML = "";
    if (communityEmpty) communityEmpty.hidden = true;
    loadNextPage();
  });

  const communityGridEl = document.getElementById("community-grid");
  if (communityGridEl) {
    communityPanel.insertBefore(banner, communityGridEl.previousElementSibling || communityGridEl);
  } else {
    communityPanel.prepend(banner);
  }
}

// ── Community gallery ─────────────────────────────────────────────────────────

const communityGridEl   = document.getElementById("community-grid");
const communitySentinel = document.getElementById("community-sentinel");
const communityEmpty    = document.getElementById("community-empty");
const filterBtns        = document.querySelectorAll(".cf-btn");

let currentFilter    = "all";
let nextPage         = 0;
let isLoading        = false;
let allPagesLoaded   = false;
let galleryInitDone  = false;

let lightboxArtwork = null;

function initCommunityGalleryOnce() {
  if (galleryInitDone) return;
  galleryInitDone = true;

  // Inject "Daily 🎯" filter chip into the filter bar.
  injectDailyFilterChip();

  loadNextPage();
  showWeeklyThemeBanner();

  if (communitySentinel && "IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !isLoading && !allPagesLoaded) loadNextPage();
    }, { threshold: 0.1 }).observe(communitySentinel);
  }
}

function injectDailyFilterChip() {
  if (!filterBtns.length) return;
  const container = filterBtns[0]?.parentElement;
  if (!container || container.querySelector('[data-type="daily"]')) return;

  const btn = document.createElement("button");
  btn.className = "cf-btn";
  btn.dataset.type = "daily";
  btn.textContent = t('communityFilterDaily');
  container.appendChild(btn);

  btn.addEventListener("click", () => {
    if (btn.dataset.type === currentFilter) return;
    document.querySelectorAll(".cf-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter  = "daily";
    nextPage       = 0;
    allPagesLoaded = false;
    if (communityGridEl) communityGridEl.innerHTML = "";
    if (communityEmpty) communityEmpty.hidden = true;
    loadNextPage();
  });
}

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.type === currentFilter) return;
    document.querySelectorAll(".cf-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter   = btn.dataset.type;
    nextPage        = 0;
    allPagesLoaded  = false;
    if (communityGridEl) communityGridEl.innerHTML = "";
    if (communityEmpty) communityEmpty.hidden = true;
    loadNextPage();
  });
});

async function loadNextPage() {
  if (isLoading || allPagesLoaded) return;
  isLoading = true;

  if (nextPage === 0 && communityGridEl) {
    communityGridEl.innerHTML = Array(4).fill(0)
      .map(() => `<div class="community-card-skeleton"></div>`).join("");
  }

  try {
    const qs  = new URLSearchParams({ page: nextPage });
    if (currentFilter === "daily") {
      qs.set("daily", "1");
    } else if (currentFilter === "theme") {
      qs.set("theme", "1");
    } else if (currentFilter !== "all") {
      qs.set("type", currentFilter);
    }

    const res = await fetch(`/api/community/gallery?${qs}`, {
      headers: { "X-Device-ID": getCommunityId() },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (nextPage === 0 && communityGridEl) communityGridEl.innerHTML = "";

    if (data.artworks.length === 0 && nextPage === 0) {
      if (communityEmpty) communityEmpty.hidden = false;
    } else {
      if (communityEmpty) communityEmpty.hidden = true;
      appendArtworks(data.artworks);
    }

    allPagesLoaded = data.nextPage === null;
    nextPage = data.nextPage ?? nextPage;
  } catch (e) {
    if (nextPage === 0 && communityGridEl) {
      communityGridEl.innerHTML = `<p class="community-empty" style="display:block">${t('communityGalleryLoadErrorWeb')}</p>`;
    }
  } finally {
    isLoading = false;
  }
}

function emojiReactionSummary(aw) {
  const parts = [];
  if (aw.fireCount)      parts.push(`🔥${aw.fireCount}`);
  if (aw.heartCount)     parts.push(`❤️${aw.heartCount}`);
  if (aw.laughCount)     parts.push(`😂${aw.laughCount}`);
  if (aw.celebrateCount) parts.push(`🎉${aw.celebrateCount}`);
  if (!parts.length) return "✨";
  return parts.slice(0, 2).join(" ");
}

function appendArtworks(artworks) {
  if (!communityGridEl) return;
  for (const aw of artworks) {
    const card = document.createElement("div");
    card.className = "community-card";
    card.setAttribute("role", "listitem");
    card.dataset.id = aw.id;

    const subject = aw.subject || "Artwork";
    const nick    = aw.nickname || "Colorist";
    const avatar  = aw.avatarIndex ?? 1;
    const emojiSummary = emojiReactionSummary(aw);

    card.innerHTML = `
      <img src="${aw.imageUrl}" alt="${escHtml(subject)} coloring" loading="lazy" />
      <div class="community-card-info">
        <div class="community-card-subject">${escHtml(subject)}</div>
        <div class="community-card-meta">
          <span class="community-card-avatar">${AVATAR_LIST[avatar] || "🐧"}</span>
          <span class="community-card-nick">${escHtml(nick)}</span>
        </div>
        <div class="community-card-stars">${emojiSummary}</div>
      </div>`;

    if (aw.recolorCount > 0) {
      const badge = document.createElement("div");
      badge.className = "community-card-badge";
      badge.textContent = `👥 ${aw.recolorCount}`;
      card.querySelector(".community-card-info").appendChild(badge);
    }

    card.addEventListener("click", () => openLightbox(aw));
    communityGridEl.appendChild(card);
  }
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const AVATAR_LIST = [
  "🐉","🐧","🐻","🦄","🐯","🦊","🐰","🐬",
  "🦅","🐺","🐼","🐨","🐆","🦉","🦜","🐹",
  "🦔","🦦","🐿️","🦘",
];

// ── Community lightbox ────────────────────────────────────────────────────────

const communityLightbox  = document.getElementById("community-lightbox");
const lightboxImg        = document.getElementById("lightbox-community-img");
const lightboxStarBtn    = document.getElementById("lightbox-star-btn");
const lightboxColorBtn   = document.getElementById("lightbox-color-btn");
const lightboxReportBtn  = document.getElementById("lightbox-report-btn");
const closeLightboxBtn   = document.getElementById("close-lightbox-btn");

let lightboxCurrentReaction = null;
let _pendingParentArtworkId = null;

// Inject reaction buttons (run once after DOM is ready).
let _reactionBar = null;
let _variationsRow = null;
let _variationsView = null;

function ensureReactionUI() {
  if (_reactionBar) return;

  // Hide the legacy star button — we replace it with emoji reactions.
  if (lightboxStarBtn) lightboxStarBtn.style.display = "none";

  _reactionBar = document.createElement("div");
  _reactionBar.id = "lightbox-reaction-bar";
  _reactionBar.className = "lightbox-reaction-bar";
  _reactionBar.innerHTML = [
    { emoji: "🔥", key: "fire",      id: "react-fire"      },
    { emoji: "❤️", key: "heart",     id: "react-heart"     },
    { emoji: "😂",  key: "laugh",     id: "react-laugh"     },
    { emoji: "🎉", key: "celebrate", id: "react-celebrate" },
  ].map(r =>
    `<button class="reaction-btn" data-reaction="${r.key}" aria-label="${r.key}">${r.emoji}<span class="reaction-count" id="${r.id}">0</span></button>`
  ).join("");

  if (lightboxStarBtn) {
    lightboxStarBtn.parentNode.insertBefore(_reactionBar, lightboxStarBtn);
  } else if (communityLightbox) {
    const card = communityLightbox.querySelector(".modal-card") || communityLightbox;
    card.appendChild(_reactionBar);
  }

  // Wire reaction button clicks.
  _reactionBar.querySelectorAll(".reaction-btn").forEach(btn => {
    btn.addEventListener("click", () => handleReactionClick(btn.dataset.reaction));
  });

  // Variations row (template artworks).
  _variationsRow = document.createElement("div");
  _variationsRow.className = "community-variations-row";
  _variationsRow.hidden = true;
  _variationsRow.innerHTML = `<span id="lightbox-recolor-count">👥 0 people colored this</span><button id="lightbox-see-versions">See their versions →</button>`;

  _variationsView = document.createElement("div");
  _variationsView.className = "lightbox-variations-view";
  _variationsView.innerHTML = '<div class="var-grid" id="variations-grid"></div>';

  if (_reactionBar?.parentNode) {
    _reactionBar.parentNode.insertBefore(_variationsRow, _reactionBar.nextSibling);
    _reactionBar.parentNode.insertBefore(_variationsView, _variationsRow.nextSibling);
  }

  document.getElementById("lightbox-see-versions")?.addEventListener("click", async () => {
    if (!lightboxArtwork) return;
    const view = _variationsView;
    if (!view) return;
    const isOpen = view.classList.contains("open");
    if (isOpen) { view.classList.remove("open"); return; }
    view.classList.add("open");
    const grid = document.getElementById("variations-grid");
    if (!grid) return;
    grid.innerHTML = "<p style='text-align:center;padding:10px'>⏳</p>";
    try {
      const data = await fetch(`/api/community/artwork/${lightboxArtwork.id}/variations`).then(r => r.json());
      if (!data.variations?.length) {
        grid.innerHTML = "<p style='text-align:center;color:var(--muted);font-size:.85rem'>No colorings shared yet</p>";
        return;
      }
      grid.innerHTML = data.variations.map(v =>
        `<img class="var-thumb" src="${escHtml(v.imageUrl)}" alt="variation" loading="lazy" title="${escHtml(v.nickname || 'Colorist')}" />`
      ).join("");
    } catch {
      grid.innerHTML = "<p style='text-align:center;color:var(--muted);font-size:.85rem'>Could not load</p>";
    }
  });
}

async function handleReactionClick(reaction) {
  if (!lightboxArtwork || !reaction) return;
  try {
    const res = await apiPost(`/api/community/react/${lightboxArtwork.id}`, { reaction });
    lightboxCurrentReaction = res.reacted ? reaction : null;
    lightboxArtwork = { ...lightboxArtwork, fireCount: res.fireCount, heartCount: res.heartCount, laughCount: res.laughCount, celebrateCount: res.celebrateCount, starCount: res.totalCount };
    updateReactionDisplay(res);

    // Update card in grid.
    const card = communityGridEl?.querySelector(`[data-id="${lightboxArtwork.id}"]`);
    if (card) {
      const starsEl = card.querySelector(".community-card-stars");
      if (starsEl) starsEl.textContent = emojiReactionSummary(lightboxArtwork);
    }
  } catch (e) {
    showToast(t('communityStarError'));
  }
}

function updateReactionDisplay(counts) {
  if (!_reactionBar) return;
  const map = { fire: counts.fireCount, heart: counts.heartCount, laugh: counts.laughCount, celebrate: counts.celebrateCount };
  _reactionBar.querySelectorAll(".reaction-btn").forEach(btn => {
    const key = btn.dataset.reaction;
    const countEl = btn.querySelector(".reaction-count");
    if (countEl) countEl.textContent = map[key] || 0;
    btn.classList.toggle("active", lightboxCurrentReaction === key);
  });
}

function openLightbox(artwork) {
  ensureReactionUI();
  lightboxArtwork = artwork;
  lightboxCurrentReaction = null;
  _variationsView?.classList.remove("open");

  if (lightboxImg) lightboxImg.src = artwork.imageUrl;

  // Reaction counts from artwork data (reactions already loaded in gallery response).
  updateReactionDisplay({
    fireCount:      artwork.fireCount      || 0,
    heartCount:     artwork.heartCount     || 0,
    laughCount:     artwork.laughCount     || 0,
    celebrateCount: artwork.celebrateCount || 0,
  });

  // Color button (template artworks).
  if (lightboxColorBtn) {
    const isTemplate = artwork.shareType === "template";
    lightboxColorBtn.hidden = !isTemplate;
    lightboxColorBtn.dataset.seed    = artwork.seed    || "";
    lightboxColorBtn.dataset.subject = artwork.subject || "";
    lightboxColorBtn.dataset.artworkId = artwork.id;
  }

  // Variations counter for templates.
  if (_variationsRow) {
    const isTemplate = artwork.shareType === "template";
    _variationsRow.hidden = !isTemplate;
    const countEl = document.getElementById("lightbox-recolor-count");
    if (countEl) countEl.textContent = `👥 ${artwork.recolorCount || 0} ${(artwork.recolorCount || 0) === 1 ? "person" : "people"} colored this`;
  }

  if (communityLightbox) {
    communityLightbox.hidden = false;
    communityLightbox.setAttribute("aria-hidden", "false");
  }
}

function closeLightbox() {
  lightboxArtwork = null;
  _pendingParentArtworkId = null;
  _variationsView?.classList.remove("open");
  if (communityLightbox) {
    communityLightbox.hidden = true;
    communityLightbox.setAttribute("aria-hidden", "true");
  }
}

closeLightboxBtn?.addEventListener("click", closeLightbox);
communityLightbox?.addEventListener("click", e => { if (e.target === communityLightbox) closeLightbox(); });

lightboxReportBtn?.addEventListener("click", async () => {
  if (!lightboxArtwork) return;
  try {
    await apiPost(`/api/community/report/${lightboxArtwork.id}`, {});
    showToast(t('communityReportedWeb'));
    closeLightbox();
  } catch (e) {
    showToast(t('communityReportErrorWeb'));
  }
});

lightboxColorBtn?.addEventListener("click", () => {
  if (!lightboxArtwork) return;
  _pendingParentArtworkId = lightboxArtwork.id;
  const imgUrl  = lightboxArtwork.imageUrl || "";
  const subject = lightboxArtwork.subject  || "";
  const diff    = lightboxArtwork.difficulty || "medium";
  const url = `/?s=1&img=${encodeURIComponent(imgUrl)}&q=${encodeURIComponent(subject)}&d=${diff}&parentId=${lightboxArtwork.id}`;
  window.location.href = url;
});

// Restore parentArtworkId from URL on page load (set by "Color it!" button above).
(function restorePendingParent() {
  const sp = new URLSearchParams(window.location.search);
  const pid = sp.get("parentId");
  if (pid) _pendingParentArtworkId = parseInt(pid) || null;
})();

// ── Leaderboard ───────────────────────────────────────────────────────────────

const leaderboardModal    = document.getElementById("leaderboard-modal");
const closeLeaderboardBtn = document.getElementById("close-leaderboard-btn");
const leaderboardList     = document.getElementById("leaderboard-list");
const leaderboardEmpty    = document.getElementById("leaderboard-empty");
const communityLbBtn      = document.getElementById("community-lb-btn");

let currentLbType = "weekly";

// Inject "Most Loved" tab into the leaderboard tab bar.
(function injectMostLovedTab() {
  const lbTabBtns = document.querySelectorAll(".lb-tab");
  const container = lbTabBtns[0]?.parentElement;
  if (!container || container.querySelector('[data-type="mostloved"]')) return;
  const btn = document.createElement("button");
  btn.className = "lb-tab";
  btn.dataset.type = "mostloved";
  btn.textContent = t('communityMostLoved');
  btn.setAttribute("role", "tab");
  btn.setAttribute("aria-selected", "false");
  container.appendChild(btn);
})();

function getLbTabBtns() {
  return Array.from(document.querySelectorAll(".lb-tab"));
}

function openLeaderboard() {
  if (!leaderboardModal) return;
  leaderboardModal.classList.remove("hidden");
  leaderboardModal.setAttribute("aria-hidden", "false");
  loadLeaderboard(currentLbType);
}

function closeLeaderboard() {
  if (!leaderboardModal) return;
  leaderboardModal.classList.add("hidden");
  leaderboardModal.setAttribute("aria-hidden", "true");
}

communityLbBtn?.addEventListener("click", openLeaderboard);
closeLeaderboardBtn?.addEventListener("click", closeLeaderboard);
leaderboardModal?.addEventListener("click", e => { if (e.target === leaderboardModal) closeLeaderboard(); });

leaderboardModal?.addEventListener("click", e => {
  const btn = e.target.closest(".lb-tab");
  if (!btn) return;
  getLbTabBtns().forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
  btn.classList.add("active");
  btn.setAttribute("aria-selected", "true");
  currentLbType = btn.dataset.type;
  loadLeaderboard(currentLbType);
});

async function loadLeaderboard(type) {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = `<li class="community-empty" style="display:block">${t('communityLoadingLb')}</li>`;
  if (leaderboardEmpty) leaderboardEmpty.hidden = true;
  try {
    const [data, ownNickname] = await Promise.all([
      fetch(`/api/community/leaderboard?type=${type}`).then(r => r.json()),
      _getOwnNickname(),
    ]);
    leaderboardList.innerHTML = "";
    if (!data.entries || !data.entries.length) {
      if (leaderboardEmpty) leaderboardEmpty.hidden = false;
      return;
    }
    for (const entry of data.entries) {
      const li = document.createElement("li");
      const isOwn = ownNickname && entry.nickname === ownNickname;
      li.className = "lb-entry" + (isOwn ? " lb-entry--own" : "");
      const rankMedal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank;
      let scoreLabel;
      if (type === "weekly") {
        scoreLabel = t('communityLbScoreWeekly', entry.weeklyCompleted || 0, entry.weeklyStars || 0);
      } else if (type === "mostloved") {
        scoreLabel = `💖 ${entry.totalLove || 0} reactions · 🖼️ ${entry.totalShared || 0}`;
      } else {
        scoreLabel = t('communityLbScoreAllTime', entry.totalShared || 0);
      }

      li.innerHTML = `
        <span class="lb-rank">${rankMedal}</span>
        <span class="lb-avatar">${AVATAR_LIST[entry.avatarIndex] || "🐧"}</span>
        <div class="lb-info">
          <div class="lb-nick">${escHtml(entry.nickname || "Colorist")}</div>
          <div class="lb-score">${escHtml(scoreLabel)}</div>
        </div>`;
      leaderboardList.appendChild(li);
    }
  } catch (e) {
    if (leaderboardList) leaderboardList.innerHTML = `<li class="community-empty" style="display:block">${t('leaderboardLoadError')}</li>`;
  }
}

// ── Parental consent gate ─────────────────────────────────────────────────────

const consentModal     = document.getElementById("consent-modal");
const consentCheckbox  = document.getElementById("consent-checkbox");
const consentConfirmBtn = document.getElementById("consent-confirm-btn");
const consentCancelBtn  = document.getElementById("consent-cancel-btn");

let _consentResolve = null;
let _consentReject  = null;

consentCheckbox?.addEventListener("change", () => {
  if (consentConfirmBtn) consentConfirmBtn.disabled = !consentCheckbox.checked;
});
consentConfirmBtn?.addEventListener("click", () => {
  if (consentModal) { consentModal.classList.add("hidden"); consentModal.setAttribute("aria-hidden", "true"); }
  if (consentCheckbox) consentCheckbox.checked = false;
  if (consentConfirmBtn) consentConfirmBtn.disabled = true;
  _consentResolve?.();
});
consentCancelBtn?.addEventListener("click", () => {
  if (consentModal) { consentModal.classList.add("hidden"); consentModal.setAttribute("aria-hidden", "true"); }
  if (consentCheckbox) consentCheckbox.checked = false;
  if (consentConfirmBtn) consentConfirmBtn.disabled = true;
  _consentReject?.(new Error("cancelled"));
});

function requireParentalConsent() {
  return new Promise((resolve, reject) => {
    _consentResolve = resolve;
    _consentReject  = reject;
    if (consentModal) { consentModal.classList.remove("hidden"); consentModal.setAttribute("aria-hidden", "false"); }
  });
}

// ── Nickname picker ───────────────────────────────────────────────────────────

const nicknameModal     = document.getElementById("nickname-modal");
const nicknameSelect    = document.getElementById("nickname-select");
const avatarGrid        = document.getElementById("avatar-grid");
const nicknameConfirmBtn = document.getElementById("nickname-confirm-btn");
const nicknameCancelBtn  = document.getElementById("nickname-cancel-btn");

let _nicknameResolve = null;
let _nicknameReject  = null;
let selectedAvatarIdx = 1;

async function populateNicknameModal() {
  if (!nicknameSelect || nicknameSelect.options.length > 1) return;
  try {
    const data = await fetch("/api/community/nicknames").then(r => r.json());
    const opts = data.nicknames.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join("");
    nicknameSelect.innerHTML = `<option value="">${t('nicknameModalTitle')}</option>${opts}`;

    if (avatarGrid) {
      avatarGrid.innerHTML = data.avatars.map((emoji, i) =>
        `<button class="avatar-btn${i === selectedAvatarIdx ? " selected" : ""}" data-idx="${i}" aria-label="${emoji}" type="button">${emoji}</button>`
      ).join("");
      avatarGrid.querySelectorAll(".avatar-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          avatarGrid.querySelectorAll(".avatar-btn").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
          selectedAvatarIdx = parseInt(btn.dataset.idx);
        });
      });
    }
  } catch { /* offline */ }
}

nicknameCancelBtn?.addEventListener("click", () => {
  if (nicknameModal) { nicknameModal.classList.add("hidden"); nicknameModal.setAttribute("aria-hidden", "true"); }
  _nicknameReject?.(new Error("cancelled"));
});
nicknameConfirmBtn?.addEventListener("click", async () => {
  const nickname = nicknameSelect?.value?.trim();
  if (!nickname) { showToast(t('communityPickNickFirst')); return; }
  if (nicknameModal) { nicknameModal.classList.add("hidden"); nicknameModal.setAttribute("aria-hidden", "true"); }
  _nicknameResolve?.({ nickname, avatarIndex: selectedAvatarIdx });
});

function requireNickname() {
  return new Promise(async (resolve, reject) => {
    _nicknameResolve = resolve;
    _nicknameReject  = reject;
    await populateNicknameModal();
    if (nicknameModal) { nicknameModal.classList.remove("hidden"); nicknameModal.setAttribute("aria-hidden", "false"); }
  });
}

// ── Share type picker ─────────────────────────────────────────────────────────

const LAST_SHARE_TYPE_KEY = "lalabuba-last-share-type";

const shareTypeModal   = document.getElementById("share-type-modal");
const shareTypeOptions = document.querySelectorAll(".share-type-option");
const shareTypeCancelEl = document.getElementById("share-type-cancel");

let _shareTypeResolve = null;
let _shareTypeReject  = null;

shareTypeOptions.forEach(btn => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;
    localStorage.setItem(LAST_SHARE_TYPE_KEY, type);
    if (shareTypeModal) { shareTypeModal.classList.add("hidden"); shareTypeModal.setAttribute("aria-hidden", "true"); }
    _shareTypeResolve?.(type);
  });
});
shareTypeCancelEl?.addEventListener("click", () => {
  if (shareTypeModal) { shareTypeModal.classList.add("hidden"); shareTypeModal.setAttribute("aria-hidden", "true"); }
  _shareTypeReject?.(new Error("cancelled"));
});

function pickShareType(hasDrawCanvas, forceShow = false) {
  // If user has a remembered share type and this isn't a forced picker, use it.
  const lastType = localStorage.getItem(LAST_SHARE_TYPE_KEY);
  if (lastType && !forceShow) {
    // Validate: freehand only if draw canvas exists.
    if (lastType !== "freehand" || hasDrawCanvas) {
      return Promise.resolve(lastType);
    }
  }
  return new Promise((resolve, reject) => {
    _shareTypeResolve = resolve;
    _shareTypeReject  = reject;
    const freeBnt = document.getElementById("share-type-freehand");
    if (freeBnt) freeBnt.disabled = !hasDrawCanvas;
    if (shareTypeModal) { shareTypeModal.classList.remove("hidden"); shareTypeModal.setAttribute("aria-hidden", "false"); }
  });
}

// ── Post-completion share prompt ──────────────────────────────────────────────

let _pcpShown = false;
let _pcpEl = null;
let _pcpTimer = null;

function showPostCompletionPrompt() {
  if (_pcpShown) return;
  _pcpShown = true;

  if (_pcpEl) _pcpEl.remove();

  const prompt = document.createElement("div");
  prompt.className = "post-completion-prompt";
  prompt.innerHTML = `
    <span class="pcp-emoji">🌟</span>
    <span class="pcp-msg">${escHtml(t('communityPcpMsg'))}</span>
    <div class="pcp-btns">
      <button class="pcp-share">${escHtml(t('communityPcpShare'))}</button>
      <button class="pcp-dismiss">${escHtml(t('communityPcpDismiss'))}</button>
    </div>`;

  document.body.appendChild(prompt);
  _pcpEl = prompt;

  prompt.querySelector(".pcp-share").addEventListener("click", () => {
    dismissPrompt();
    communityShareBtn?.click();
  });
  prompt.querySelector(".pcp-dismiss").addEventListener("click", dismissPrompt);

  _pcpTimer = setTimeout(dismissPrompt, 10_000);
}

function dismissPrompt() {
  clearTimeout(_pcpTimer);
  if (_pcpEl) { _pcpEl.remove(); _pcpEl = null; }
}

// Reset on each new image generation so the prompt can show again.
const _previewCanvasForPrompt = document.getElementById("preview-canvas");
if (_previewCanvasForPrompt) {
  let _prevHidden = _previewCanvasForPrompt.hidden;
  new MutationObserver(() => {
    const nowHidden = _previewCanvasForPrompt.hidden;
    if (_prevHidden && !nowHidden) {
      // New image appeared — allow the prompt to show again on next completion.
      _pcpShown = false;
    }
    _prevHidden = nowHidden;
  }).observe(_previewCanvasForPrompt, { attributes: true, attributeFilter: ["hidden"] });
}

// ── Community share button ────────────────────────────────────────────────────

const communityShareBtn = document.getElementById("community-share-btn");

communityShareBtn?.addEventListener("click", () => doShare());

async function doShare(autoShareType = null) {
  const canvas    = document.getElementById("preview-canvas");
  const drawCanvas = document.getElementById("draw-canvas");
  if (!canvas || canvas.hidden) { showToast(t('communityDrawFirst')); return; }

  if (communityShareBtn) {
    communityShareBtn.disabled = true;
    communityShareBtn.textContent = t('communitySharing');
  }

  try {
    // 1. Check profile.
    let profile;
    try {
      profile = await apiGet("/api/community/profile");
      if (profile.hasNickname && profile.nickname) _ownNickname = profile.nickname;
    }
    catch (e) { profile = { sharingEnabled: false, hasNickname: false }; }

    // 2. Parental consent if first time.
    let consentHeader = {};
    if (!profile.sharingEnabled) {
      await requireParentalConsent();
      consentHeader = { "X-Parental-Consent": "yes" };
    }

    // 3. Nickname if first time.
    if (!profile.hasNickname) {
      const { nickname, avatarIndex } = await requireNickname();
      await apiPost("/api/community/profile", { nickname, avatarIndex }, consentHeader);
      consentHeader = {};
    }

    // 4. Pick share type (auto-skip if remembered or caller provides type).
    const hasDrawCanvas = drawCanvas && !drawCanvas.hidden;
    const shareType = autoShareType || await pickShareType(hasDrawCanvas);

    // 5. Capture canvas.
    let imageData;
    if (shareType === "freehand" && hasDrawCanvas) {
      const offscreen = document.createElement("canvas");
      offscreen.width  = canvas.width;
      offscreen.height = canvas.height;
      const ctx = offscreen.getContext("2d");
      ctx.drawImage(canvas, 0, 0);
      ctx.drawImage(drawCanvas, 0, 0);
      imageData = offscreen.toDataURL("image/jpeg", 0.82);
    } else {
      imageData = canvas.toDataURL("image/jpeg", 0.82);
    }

    // 6. Read subject / difficulty from DOM.
    const subjectInput = document.getElementById("subject-input") || document.querySelector("[name=subject]");
    const subject   = subjectInput?.value?.trim() || "";
    const diffBtns  = document.querySelectorAll(".difficulty-btn.active, .diff-pill.active, .chip--selected[data-difficulty]");
    const difficulty = diffBtns[0]?.dataset?.difficulty || diffBtns[0]?.dataset?.value || "medium";

    // 7. Upload (include parentArtworkId if coloring a community template).
    const body = { shareType, subject, difficulty, imageData };
    if (_pendingParentArtworkId) body.parentArtworkId = _pendingParentArtworkId;

    await apiPost("/api/community/artwork", body, consentHeader);

    showToast(t('communitySharedToast'));
    _pendingParentArtworkId = null;

    // Refresh community gallery next time.
    galleryInitDone = false;
    nextPage = 0;
    allPagesLoaded = false;

  } catch (e) {
    if (e.message === "cancelled") {
      // User cancelled — no toast.
    } else if (e.code === "SHARE_LIMIT") {
      showToast(e.message || t('communityShareLimitReached'));
    } else if (e.code === "PARENTAL_CONSENT_REQUIRED") {
      showToast(t('communityParentalNeeded'));
    } else {
      console.error("[community] share error:", e.message);
      showToast(t('communityShareError'));
    }
  } finally {
    if (communityShareBtn) {
      communityShareBtn.disabled = false;
      communityShareBtn.textContent = t('communityShareBtn');
    }
  }
}

// ── Enable share button when image generates ──────────────────────────────────

const previewCanvas = document.getElementById("preview-canvas");
if (previewCanvas && communityShareBtn) {
  new MutationObserver(() => {
    communityShareBtn.disabled = previewCanvas.hidden;
  }).observe(previewCanvas, { attributes: true, attributeFilter: ["hidden"] });
}

// ── Progress sync to server ───────────────────────────────────────────────────

function getAuthHeaders() {
  const token = localStorage.getItem('lalabuba-access-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function syncProgressToServer(progress) {
  try {
    const p = progress || getProgress();
    const res = await apiPost("/api/community/progress", {
      totalCompleted:      p.totalCompleted      || 0,
      totalGenerated:      p.totalGenerated      || 0,
      currentStreak:       p.streak              || 0,
      longestStreak:       p.longestStreak       || 0,
      lastActiveDate:      p.lastColoredDay      || null,
      daysColored:         p.daysColored         || 0,
      easyCompleted:       p.easyCompleted       || 0,
      mediumCompleted:     p.mediumCompleted     || 0,
      hardCompleted:       p.hardCompleted       || 0,
      extremeCompleted:    p.extremeCompleted    || 0,
      maxColorUses:        p.maxColorUses        || 0,
      numbersCompleted:    0,
      freeColorCompleted:  0,
      freeTextCreations:   p.freeTextCreations   || 0,
      drawPenUses:         p.drawPenUses         || 0,
      saves:               p.saves               || 0,
      shares:              p.shares              || 0,
      challengesCreated:   p.challengesCreated   || 0,
      dailyWordsCompleted: p.dailyWordsCompleted || 0,
      uniqueSubjects:      p.uniqueSubjects      || 0,
      badges:              p.badges              || [],
      palettesUsed:        p.palettesUsed        || [],
      themesColored:       p.themesColored       || [],
      subjects:            p.subjects            || {},
    }, getAuthHeaders());

    if (res && res.progress) {
      const merged = mergeFromServer(res.progress);
      if (merged) {
        window.dispatchEvent(new CustomEvent('lalabuba:progressMerged', { detail: merged }));
      }
    }

    // Show post-completion prompt after a short delay (UX: let any celebration settle first).
    setTimeout(() => {
      if (!previewCanvas?.hidden) showPostCompletionPrompt();
    }, 1800);

    if (!localStorage.getItem('lalabuba-access-token') && (p.totalCompleted === 1)) {
      _suggestSignIn();
    }
  } catch {
    // Best-effort.
  }
}

export async function loadProgressFromServer() {
  try {
    const headers = { 'X-Device-ID': getCommunityId(), ...getAuthHeaders() };
    const r = await fetch('/api/community/progress', { headers });
    if (!r.ok) return;
    const data = await r.json();
    if (data.progress) {
      const merged = mergeFromServer(data.progress);
      if (merged) {
        window.dispatchEvent(new CustomEvent('lalabuba:progressMerged', { detail: merged }));
      }
    }
  } catch {
    // Best-effort.
  }
}

const _SYNC_SUGGESTED_KEY = 'lalabuba-sync-suggested';
function _suggestSignIn() {
  try {
    if (localStorage.getItem(_SYNC_SUGGESTED_KEY)) return;
    localStorage.setItem(_SYNC_SUGGESTED_KEY, '1');
  } catch { return; }
  showToast(t('progressSyncSignInPrompt') || '🔄 Sign in to keep your progress on all devices', 5000);
}

window.addEventListener('lalabuba:login', () => {
  loadProgressFromServer().catch(() => {});
});

if (localStorage.getItem('lalabuba-access-token')) {
  loadProgressFromServer().catch(() => {});
}

// ── Family panel ──────────────────────────────────────────────────────────────

const familyToggleBtn    = document.getElementById('family-panel-toggle');
const familyPanelBody    = document.getElementById('family-panel-body');
const familyLoadingEl    = document.getElementById('family-loading');
const familyNoFamilyEl   = document.getElementById('family-no-family');
const familyInFamilyEl   = document.getElementById('family-in-family');
const familyCreateBtn    = document.getElementById('family-create-btn');
const familyJoinOpenBtn  = document.getElementById('family-join-open-btn');
const familyJoinForm     = document.getElementById('family-join-form');
const familyCodeInput    = document.getElementById('family-code-input');
const familyJoinSubmit   = document.getElementById('family-join-submit-btn');
const familyCodeCopyBtn  = document.getElementById('family-code-copy-btn');
const familyCodeValue    = document.getElementById('family-code-value');
const familyMemberCount  = document.getElementById('family-member-count');
const familyViewBtn      = document.getElementById('family-view-btn');
const familyLeaveBtn     = document.getElementById('family-leave-btn');
const familyModal        = document.getElementById('family-modal');
const familyMembersList  = document.getElementById('family-members-list');
const closeFamilyModal   = document.getElementById('close-family-modal-btn');

let _familyData = null;

function _showFamilyState(loading, noFamily, inFamily) {
  if (familyLoadingEl)  { familyLoadingEl.hidden  = !loading; }
  if (familyNoFamilyEl) { familyNoFamilyEl.hidden  = !noFamily; }
  if (familyInFamilyEl) { familyInFamilyEl.hidden  = !inFamily; }
}

async function _loadFamilyState() {
  _showFamilyState(true, false, false);
  try {
    const data = await apiGet('/api/community/family');
    if (data.inFamily) {
      _familyData = data;
      if (familyCodeValue) familyCodeValue.textContent = data.familyCode || '';
      if (familyMemberCount) {
        const n = data.memberCount || 0;
        familyMemberCount.textContent = typeof t('familyMembersCount') === 'function'
          ? t('familyMembersCount')(n)
          : `${n}`;
      }
      _showFamilyState(false, false, true);
    } else {
      _familyData = false;
      _showFamilyState(false, true, false);
    }
  } catch {
    _showFamilyState(false, true, false);
  }
}

familyToggleBtn?.addEventListener('click', () => {
  const isOpen = familyPanelBody && !familyPanelBody.hidden;
  if (familyPanelBody) familyPanelBody.hidden = isOpen;
  if (familyToggleBtn) familyToggleBtn.setAttribute('aria-expanded', String(!isOpen));
  if (!isOpen && _familyData === null) _loadFamilyState();
});

familyCreateBtn?.addEventListener('click', async () => {
  try { await requireParentalConsent(); } catch { return; }
  familyCreateBtn.disabled = true;
  try {
    const res = await apiPost('/api/community/family', { action: 'create' }, { 'X-Parental-Consent': 'yes' });
    _familyData = res;
    if (familyCodeValue) familyCodeValue.textContent = res.familyCode || '';
    if (familyMemberCount) {
      const n = 1;
      familyMemberCount.textContent = typeof t('familyMembersCount') === 'function'
        ? t('familyMembersCount')(n) : `${n}`;
    }
    _showFamilyState(false, false, true);
    showToast(t('familyCreated') + ' ' + res.familyCode);
  } catch (e) {
    showToast(t('familyLoadError'));
  } finally {
    familyCreateBtn.disabled = false;
  }
});

familyJoinOpenBtn?.addEventListener('click', () => {
  if (familyJoinForm) familyJoinForm.hidden = !familyJoinForm.hidden;
  if (!familyJoinForm?.hidden) familyCodeInput?.focus();
});

familyCodeInput?.addEventListener('input', (e) => {
  const el = e.target;
  el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

familyJoinSubmit?.addEventListener('click', async () => {
  const code = familyCodeInput?.value?.trim().toUpperCase();
  if (!code || code.length !== 6) { showToast(t('familyJoinPlaceholder')); return; }
  try { await requireParentalConsent(); } catch { return; }
  familyJoinSubmit.disabled = true;
  try {
    const res = await apiPost('/api/community/family', { action: 'join', familyCode: code }, { 'X-Parental-Consent': 'yes' });
    _familyData = res;
    if (familyCodeValue) familyCodeValue.textContent = code;
    if (familyMemberCount) {
      const n = res.memberCount || 0;
      familyMemberCount.textContent = typeof t('familyMembersCount') === 'function'
        ? t('familyMembersCount')(n) : `${n}`;
    }
    _showFamilyState(false, false, true);
    showToast(t('familyJoined'));
  } catch (e) {
    showToast(t('familyLoadError'));
  } finally {
    familyJoinSubmit.disabled = false;
  }
});

familyCodeCopyBtn?.addEventListener('click', async () => {
  const code = familyCodeValue?.textContent?.trim();
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    showToast(t('familyCopied'));
  } catch {
    showToast(code);
  }
});

familyLeaveBtn?.addEventListener('click', async () => {
  if (!confirm(t('familyLeaveConfirm'))) return;
  familyLeaveBtn.disabled = true;
  try {
    await apiPost('/api/community/family', { action: 'leave' });
    _familyData = false;
    _showFamilyState(false, true, false);
  } catch {
    showToast(t('familyLoadError'));
  } finally {
    familyLeaveBtn.disabled = false;
  }
});

familyViewBtn?.addEventListener('click', async () => {
  if (!familyModal || !familyMembersList) return;
  familyModal.classList.remove('hidden');
  familyModal.setAttribute('aria-hidden', 'false');
  familyMembersList.innerHTML = '<p style="text-align:center;padding:20px">⏳</p>';
  try {
    const data = await apiGet('/api/community/family');
    if (!data.inFamily || !data.members?.length) {
      familyMembersList.innerHTML = '<p style="text-align:center;color:var(--muted)">No members yet</p>';
      return;
    }
    familyMembersList.innerHTML = data.members.map(m => {
      const avatarEmoji = AVATAR_LIST[m.avatarIndex ?? 0] || '🐧';
      const artThumbs = (m.recentArtworks || []).map(a =>
        `<img class="family-member-art-thumb" src="${escHtml(a.imageUrl)}" alt="artwork" loading="lazy" />`
      ).join('');
      return `<div class="family-member-card">
        <span class="family-member-avatar">${avatarEmoji}</span>
        <div class="family-member-info">
          <p class="family-member-name">${escHtml(m.nickname || '?')}</p>
          <p class="family-member-stats">🎨 ${m.totalCompleted || 0} · 🔥 ${m.currentStreak || 0}</p>
          ${artThumbs ? `<div class="family-member-artworks">${artThumbs}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch {
    familyMembersList.innerHTML = `<p style="text-align:center;color:var(--muted)">${escHtml(t('familyLoadError'))}</p>`;
  }
});

closeFamilyModal?.addEventListener('click', () => {
  if (familyModal) { familyModal.classList.add('hidden'); familyModal.setAttribute('aria-hidden', 'true'); }
});
familyModal?.addEventListener('click', (e) => {
  if (e.target === familyModal) { familyModal.classList.add('hidden'); familyModal.setAttribute('aria-hidden', 'true'); }
});
