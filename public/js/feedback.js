/**
 * User feedback → POST /api/feedback (stored first-party, shown on /admin/stats).
 *   • Picture rating 😍/🙂/😕 in the completion celebration (kids, no text).
 *   • "⭐ Rate Lalabuba" in the footer: grown-ups' 1–5 ★ + optional comment.
 * Same consent rule as js/t.js: the community ID is sent only with analytics
 * consent; otherwise the server counts the rater with its daily anonymous hash.
 */
import { t } from './i18n.js';
import { state } from './state.js';
import { difficultySelect } from './dom.js';

function consentedInstallId() {
  try {
    const p = JSON.parse(localStorage.getItem('lala_cookie_consent') || 'null');
    if (!p?.analytics) return undefined;
    const id = localStorage.getItem('lalabuba-community-id');
    return id && /^[0-9a-f-]{36}$/.test(id) ? id : undefined;
  } catch { return undefined; }
}

async function postFeedback(payload) {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      iid: consentedInstallId(),
      lang: (document.documentElement.lang || '').slice(0, 2) || undefined,
    }),
  });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}

// ── Picture rating (celebration) ─────────────────────────────────────────────
const rateBox = document.getElementById('celebration-rate');

/** Called each time the celebration opens: fresh, unrated row for this picture. */
export function resetPictureRating() {
  if (!rateBox) return;
  // Nothing to attach a rating to (e.g. restored artwork without a server image).
  rateBox.hidden = !state.lastImageUrl;
  rateBox.classList.remove('rated');
  rateBox.querySelectorAll('.rate-btn').forEach(b => { b.classList.remove('selected'); b.disabled = false; });
  const thanks = rateBox.querySelector('.celebration-rate-thanks');
  if (thanks) thanks.hidden = true;
}

if (rateBox) {
  rateBox.addEventListener('click', (e) => {
    const btn = e.target.closest('.rate-btn');
    if (!btn || !state.lastImageUrl) return;
    rateBox.querySelectorAll('.rate-btn').forEach(b => b.classList.toggle('selected', b === btn));
    rateBox.classList.add('rated');
    rateBox.querySelector('.celebration-rate-thanks').hidden = false;
    // Fire-and-forget: a lost rating must never interrupt the celebration.
    postFeedback({
      kind: 'picture',
      rating: Number(btn.dataset.rate),
      image: state.lastImageUrl,
      difficulty: difficultySelect?.value,
    }).catch(() => {});
  });
}

// ── Site rating modal (footer) ───────────────────────────────────────────────
const modal   = document.getElementById('feedback-modal');
const form    = document.getElementById('feedback-form');
const stars   = modal ? [...modal.querySelectorAll('.feedback-star')] : [];
const comment = document.getElementById('feedback-comment');
const msg     = document.getElementById('feedback-msg');
const send    = document.getElementById('feedback-send');
let chosen = 0;

function paintStars(n) {
  stars.forEach(s => {
    const on = Number(s.dataset.star) <= n;
    s.classList.toggle('on', on);
    s.setAttribute('aria-checked', String(Number(s.dataset.star) === n));
  });
}

function openFeedback() {
  if (!modal) return;
  chosen = 0;
  paintStars(0);
  comment.value = '';
  msg.textContent = '';
  msg.classList.remove('error');
  send.disabled = false;
  form.hidden = false;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  window.lalaTrack?.('feedback_open');
  stars[0]?.focus();
}

function closeFeedback() {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

if (modal) {
  document.getElementById('feedback-btn')?.addEventListener('click', openFeedback);
  document.getElementById('feedback-close').addEventListener('click', closeFeedback);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeFeedback(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeFeedback(); });
  stars.forEach(s => {
    s.addEventListener('click', () => { chosen = Number(s.dataset.star); paintStars(chosen); msg.textContent = ''; });
    s.addEventListener('mouseenter', () => paintStars(Number(s.dataset.star)));
    s.addEventListener('mouseleave', () => paintStars(chosen));
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.classList.remove('error');
    if (!chosen) { msg.textContent = t('feedbackPickStars'); msg.classList.add('error'); return; }
    send.disabled = true;
    try {
      await postFeedback({
        kind: 'site',
        rating: chosen,
        comment: comment.value.trim() || undefined,
        website: form.elements.website.value || undefined,
      });
      msg.textContent = t('feedbackThanks');
      setTimeout(closeFeedback, 1800);
    } catch {
      msg.textContent = t('feedbackError');
      msg.classList.add('error');
      send.disabled = false;
    }
  });
}
