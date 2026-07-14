/**
 * Community features — device identity, API client, gallery tab, leaderboard,
 * parental consent gate, community share flow, nickname/avatar picker.
 *
 * Loaded as a standalone ES module from index.html; does not depend on main.js.
 * Interacts with the DOM via getElementById / querySelector.
 */

import { t } from './i18n.js';

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

// ── Gallery modal tab switching ───────────────────────────────────────────────

const galleryTabBtns     = document.querySelectorAll(".gallery-tab");
const galleryGrid        = document.getElementById("gallery-grid");
const communityPanel     = document.getElementById("community-gallery-panel");

// Elements below the tab line that belong to the journal tab only (need show/hide).
const journalOnlyEls     = [
  "journal-stats", "daily-mission-card", "mascot-card", "crayon-packs",
  "sticker-shelf", "journal-next", "print-book-btn",
].map(id => document.getElementById(id)).filter(Boolean);

function showJournalTab() {
  galleryGrid?.removeAttribute("hidden");
  journalOnlyEls.forEach(el => {
    // Restore the element's original visibility (hidden attr was managed by gallery.js).
    // We only un-hide the outer wrapper — gallery.js handles inner visibility.
    el.style.display = "";
  });
  if (communityPanel) communityPanel.hidden = true;
}

function showCommunityTab() {
  galleryGrid?.setAttribute("hidden", "");
  journalOnlyEls.forEach(el => { el.style.display = "none"; });
  if (communityPanel) communityPanel.hidden = false;
  initCommunityGalleryOnce();
}

galleryTabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    galleryTabBtns.forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    if (btn.dataset.tab === "journal") {
      showJournalTab();
    } else {
      showCommunityTab();
    }
  });
});

// Re-show journal tab whenever gallery modal opens (reset state).
const galleryModal = document.getElementById("gallery-modal");
const galleryModalObserver = new MutationObserver(() => {
  if (!galleryModal?.classList.contains("hidden")) {
    // Modal just opened — ensure journal tab is active.
    galleryTabBtns.forEach(b => {
      const isJournal = b.dataset.tab === "journal";
      b.classList.toggle("active", isJournal);
      b.setAttribute("aria-selected", isJournal ? "true" : "false");
    });
    showJournalTab();
  }
});
if (galleryModal) {
  galleryModalObserver.observe(galleryModal, { attributes: true, attributeFilter: ["class"] });
}

// ── Community gallery ─────────────────────────────────────────────────────────

const communityGrid     = document.getElementById("community-grid");
const communitySentinel = document.getElementById("community-sentinel");
const communityEmpty    = document.getElementById("community-empty");
const filterBtns        = document.querySelectorAll(".cf-btn");

let currentFilter    = "all";
let nextPage         = 0;
let isLoading        = false;
let allPagesLoaded   = false;
let galleryInitDone  = false;

// Track the currently-open lightbox artwork for star/report actions.
let lightboxArtwork = null;

function initCommunityGalleryOnce() {
  if (galleryInitDone) return;
  galleryInitDone = true;
  loadNextPage();

  // Infinite scroll — load when sentinel enters viewport.
  if (communitySentinel && "IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !isLoading && !allPagesLoaded) loadNextPage();
    }, { threshold: 0.1 }).observe(communitySentinel);
  }
}

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.type === currentFilter) return;
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter   = btn.dataset.type;
    nextPage        = 0;
    allPagesLoaded  = false;
    if (communityGrid) communityGrid.innerHTML = "";
    if (communityEmpty) communityEmpty.hidden = true;
    loadNextPage();
  });
});

async function loadNextPage() {
  if (isLoading || allPagesLoaded) return;
  isLoading = true;

  // Show skeletons on first load.
  if (nextPage === 0 && communityGrid) {
    communityGrid.innerHTML = Array(4).fill(0)
      .map(() => `<div class="community-card-skeleton"></div>`).join("");
  }

  try {
    const qs  = new URLSearchParams({ page: nextPage, type: currentFilter });
    const res = await fetch(`/api/community/gallery?${qs}`, {
      headers: { "X-Device-ID": getCommunityId() },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (nextPage === 0 && communityGrid) communityGrid.innerHTML = "";

    if (data.artworks.length === 0 && nextPage === 0) {
      if (communityEmpty) communityEmpty.hidden = false;
    } else {
      if (communityEmpty) communityEmpty.hidden = true;
      appendArtworks(data.artworks);
    }

    allPagesLoaded = data.nextPage === null;
    nextPage = data.nextPage ?? nextPage;
  } catch (e) {
    if (nextPage === 0 && communityGrid) {
      communityGrid.innerHTML = `<p class="community-empty" style="display:block">${t('communityGalleryLoadErrorWeb')}</p>`;
    }
  } finally {
    isLoading = false;
  }
}

function appendArtworks(artworks) {
  if (!communityGrid) return;
  for (const aw of artworks) {
    const card = document.createElement("div");
    card.className = "community-card";
    card.setAttribute("role", "listitem");
    card.dataset.id = aw.id;

    const subject = aw.subject || "Artwork";
    const nick    = aw.nickname || "Colorist";
    const avatar  = aw.avatarIndex ?? 1;

    card.innerHTML = `
      <img src="${aw.imageUrl}" alt="${escHtml(subject)} coloring" loading="lazy" />
      <div class="community-card-info">
        <div class="community-card-subject">${escHtml(subject)}</div>
        <div class="community-card-meta">
          <span class="community-card-avatar">${AVATAR_LIST[avatar] || "🐧"}</span>
          <span class="community-card-nick">${escHtml(nick)}</span>
        </div>
        <div class="community-card-stars">⭐ ${aw.starCount || 0}</div>
      </div>`;

    card.addEventListener("click", () => openLightbox(aw));
    communityGrid.appendChild(card);
  }
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Avatar emoji list (matches lib/avatar.js).
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

let lightboxStarred = false;

function openLightbox(artwork) {
  lightboxArtwork = artwork;
  lightboxStarred = false;

  if (lightboxImg) lightboxImg.src = artwork.imageUrl;
  if (lightboxStarBtn) lightboxStarBtn.textContent = `⭐ ${artwork.starCount || 0}`;
  if (lightboxColorBtn) {
    const isTemplate = artwork.shareType === "template";
    lightboxColorBtn.hidden = !isTemplate;
    lightboxColorBtn.dataset.seed = artwork.seed || "";
    lightboxColorBtn.dataset.subject = artwork.subject || "";
  }

  if (communityLightbox) {
    communityLightbox.hidden = false;
    communityLightbox.setAttribute("aria-hidden", "false");
  }
}

function closeLightbox() {
  lightboxArtwork = null;
  if (communityLightbox) {
    communityLightbox.hidden = true;
    communityLightbox.setAttribute("aria-hidden", "true");
  }
}

closeLightboxBtn?.addEventListener("click", closeLightbox);
communityLightbox?.addEventListener("click", e => { if (e.target === communityLightbox) closeLightbox(); });

lightboxStarBtn?.addEventListener("click", async () => {
  if (!lightboxArtwork) return;
  try {
    const res = await apiPost(`/api/community/star/${lightboxArtwork.id}`, {});
    lightboxStarred = res.starred;
    if (lightboxStarBtn) {
      lightboxStarBtn.textContent = `⭐ ${res.starCount}`;
      lightboxStarBtn.classList.toggle("starred", res.starred);
    }
    // Update count in grid card.
    const card = communityGrid?.querySelector(`[data-id="${lightboxArtwork.id}"]`);
    if (card) {
      const starsEl = card.querySelector(".community-card-stars");
      if (starsEl) starsEl.textContent = `⭐ ${res.starCount}`;
    }
  } catch (e) {
    showToast(t('communityStarError'));
  }
});

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
  const seed    = lightboxArtwork.seed;
  const subject = lightboxArtwork.subject;
  const url = `/?s=1&seed=${encodeURIComponent(seed || "")}&q=${encodeURIComponent(subject || "")}`;
  window.location.href = url;
});

// ── Leaderboard ───────────────────────────────────────────────────────────────

const leaderboardModal   = document.getElementById("leaderboard-modal");
const closeLeaderboardBtn = document.getElementById("close-leaderboard-btn");
const leaderboardList    = document.getElementById("leaderboard-list");
const leaderboardEmpty   = document.getElementById("leaderboard-empty");
const lbTabBtns          = document.querySelectorAll(".lb-tab");
const communityLbBtn     = document.getElementById("community-lb-btn");

let currentLbType = "weekly";

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

lbTabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    lbTabBtns.forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    currentLbType = btn.dataset.type;
    loadLeaderboard(currentLbType);
  });
});

async function loadLeaderboard(type) {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = `<li class="community-empty" style="display:block">${t('communityLoadingLb')}</li>`;
  if (leaderboardEmpty) leaderboardEmpty.hidden = true;
  try {
    const data = await fetch(`/api/community/leaderboard?type=${type}`).then(r => r.json());
    leaderboardList.innerHTML = "";
    if (!data.entries || !data.entries.length) {
      if (leaderboardEmpty) leaderboardEmpty.hidden = false;
      return;
    }
    const myUuid = getCommunityId();
    for (const entry of data.entries) {
      const li = document.createElement("li");
      li.className = "lb-entry";
      const rankMedal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank;
      const scoreLabel = type === "weekly"
        ? t('communityLbScoreWeekly', entry.weeklyCompleted || 0, entry.weeklyStars || 0)
        : t('communityLbScoreAllTime', entry.totalCompleted || 0);

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
    nicknameSelect.innerHTML = `<option value="">Pick a nickname…</option>${opts}`;

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
  } catch { /* offline — user can retry */ }
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

const shareTypeModal   = document.getElementById("share-type-modal");
const shareTypeOptions = document.querySelectorAll(".share-type-option");
const shareTypeCancelEl = document.getElementById("share-type-cancel");

let _shareTypeResolve = null;
let _shareTypeReject  = null;

shareTypeOptions.forEach(btn => {
  btn.addEventListener("click", () => {
    if (shareTypeModal) { shareTypeModal.classList.add("hidden"); shareTypeModal.setAttribute("aria-hidden", "true"); }
    _shareTypeResolve?.(btn.dataset.type);
  });
});
shareTypeCancelEl?.addEventListener("click", () => {
  if (shareTypeModal) { shareTypeModal.classList.add("hidden"); shareTypeModal.setAttribute("aria-hidden", "true"); }
  _shareTypeReject?.(new Error("cancelled"));
});

function pickShareType(hasDrawCanvas) {
  return new Promise((resolve, reject) => {
    _shareTypeResolve = resolve;
    _shareTypeReject  = reject;
    const freeBnt = document.getElementById("share-type-freehand");
    if (freeBnt) freeBnt.disabled = !hasDrawCanvas;
    if (shareTypeModal) { shareTypeModal.classList.remove("hidden"); shareTypeModal.setAttribute("aria-hidden", "false"); }
  });
}

// ── Community share button ────────────────────────────────────────────────────

const communityShareBtn = document.getElementById("community-share-btn");

communityShareBtn?.addEventListener("click", async () => {
  const canvas    = document.getElementById("preview-canvas");
  const drawCanvas = document.getElementById("draw-canvas");
  if (!canvas || canvas.hidden) { showToast(t('communityDrawFirst')); return; }

  communityShareBtn.disabled = true;
  communityShareBtn.textContent = t('communitySharing');

  try {
    // 1. Check profile — need parental consent + nickname.
    let profile;
    try {
      profile = await apiGet("/api/community/profile");
    } catch (e) {
      profile = { sharingEnabled: false, hasNickname: false };
    }

    // 2. First time — require parental consent.
    let consentHeader = {};
    if (!profile.sharingEnabled) {
      await requireParentalConsent();
      consentHeader = { "X-Parental-Consent": "yes" };
    }

    // 3. If no nickname yet, require one first.
    if (!profile.hasNickname) {
      const { nickname, avatarIndex } = await requireNickname();
      await apiPost("/api/community/profile", { nickname, avatarIndex }, consentHeader);
      consentHeader = {}; // already applied
    }

    // 4. Pick share type.
    const hasDrawCanvas = drawCanvas && !drawCanvas.hidden;
    const shareType = await pickShareType(hasDrawCanvas);

    // 5. Capture canvas image.
    let imageData;
    if (shareType === "freehand" && hasDrawCanvas) {
      // Merge draw canvas onto preview canvas for the composite.
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

    // 6. Read subject / difficulty / seed from DOM (set by generate.js on currentImage).
    const subjectInput = document.getElementById("subject-input") || document.querySelector("[name=subject]");
    const subject   = subjectInput?.value?.trim() || "";
    const diffBtns  = document.querySelectorAll(".difficulty-btn.active, .diff-pill.active, .chip--selected[data-difficulty]");
    const difficulty = diffBtns[0]?.dataset?.difficulty || diffBtns[0]?.dataset?.value || "medium";

    // 7. Upload.
    const res = await apiPost("/api/community/artwork", {
      shareType,
      subject,
      difficulty,
      imageData,
    }, consentHeader);

    showToast(t('communitySharedToast'));

    // Refresh community gallery next time it opens.
    galleryInitDone = false;
    nextPage = 0;
    allPagesLoaded = false;

  } catch (e) {
    if (e.message === "cancelled") {
      // User cancelled — no toast needed.
    } else if (e.code === "SHARE_LIMIT") {
      showToast(e.message || t('communityShareLimitReached'));
    } else if (e.code === "PARENTAL_CONSENT_REQUIRED") {
      showToast(t('communityParentalNeeded'));
    } else {
      console.error("[community] share error:", e.message);
      showToast(t('communityShareError'));
    }
  } finally {
    communityShareBtn.disabled = false;
    communityShareBtn.textContent = t('communityShareBtn');
  }
});

// ── Enable share button when image generates ──────────────────────────────────
// The preview canvas switches from hidden to visible; watch for that.

const previewCanvas = document.getElementById("preview-canvas");
if (previewCanvas && communityShareBtn) {
  new MutationObserver(() => {
    communityShareBtn.disabled = previewCanvas.hidden;
  }).observe(previewCanvas, { attributes: true, attributeFilter: ["hidden"] });
}

// ── Progress sync to server ───────────────────────────────────────────────────
// Called by main.js after recordCompletion so web users appear on the leaderboard.
// Fire-and-forget: never blocks the completion flow; all errors are swallowed.

export async function syncProgressToServer(progress) {
  try {
    await apiPost("/api/community/progress", {
      totalCompleted: progress.totalCompleted || 0,
      currentStreak:  progress.streak || 0,
      longestStreak:  progress.longestStreak || 0,
      lastActiveDate: progress.lastColoredDay || null,
    });
  } catch {
    // Best-effort: leaderboard sync is not critical to the coloring experience.
  }
}
