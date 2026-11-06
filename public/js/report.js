// 🚩 Report picture: lets anyone flag the AI picture on the canvas without leaving
// the page. Same endpoint and the same four preset reasons as the apps. No free text:
// this is a children's product.
import { state } from './state.js';
import { t } from './i18n.js';
import { getCommunityId, showToast } from './community.js';

const modal = document.getElementById('report-modal');
const button = document.getElementById('report-picture-btn');
const reported = new Set(); // one report per picture per page load

function pictureKey() {
  return `${state.lastSeed ?? ''}|${state.lastImageUrl ?? ''}|${state.lastSubject ?? ''}`;
}

function close() {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  button.focus();
}

function open() {
  if (reported.has(pictureKey())) {
    showToast(t('reportPictureThanks'));
    return;
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.querySelector('.report-reason')?.focus();
}

async function send(reason) {
  const key = pictureKey();
  close();
  try {
    const res = await fetch('/api/community/report-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-ID': getCommunityId() },
      body: JSON.stringify({
        reason,
        subject: state.lastSubject || 'unknown',
        seed: state.lastSeed,
        imageUrl: state.lastImageUrl,
        source: state.lastSource,
        platform: 'web',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    reported.add(key);
    showToast(t('reportPictureThanks'), 5000);
  } catch {
    showToast(t('reportPictureError'));
  }
}

export function initReportPicture() {
  if (!modal || !button) return;
  button.addEventListener('click', open);
  document.getElementById('close-report-modal')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) { close(); return; }
    const reason = e.target.closest('.report-reason')?.dataset.reason;
    if (reason) send(reason);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });
}
