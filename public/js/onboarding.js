// First-time onboarding tutorial overlay.
// Shows once to new users; gated by localStorage.

import { t } from './i18n.js';

const KEY = 'lalabuba-onboarded';

function getSlides() {
  return [
    {
      emoji: null,
      showLogo: true,
      title: t('onboardTitle1') || 'Welcome to Lalabuba!',
      body:  t('onboardBody1')  || "Type any word and we'll turn it into a unique coloring page just for you.",
    },
    {
      emoji: '🖌️',
      showLogo: false,
      title: t('onboardTitle2') || 'Tap to color',
      body:  t('onboardBody2')  || 'Pick a color from the palette, then tap any region of the drawing to fill it.',
    },
    {
      emoji: '🏆',
      showLogo: false,
      title: t('onboardTitle3') || 'Challenge a friend!',
      body:  t('onboardBody3')  || 'Share your coloring page and race to see who finishes it first.',
    },
  ];
}

export function initOnboarding() {
  if (localStorage.getItem(KEY)) return;

  const SLIDES = getSlides();
  let current = 0;

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'App tutorial');

  function close() {
    localStorage.setItem(KEY, '1');
    overlay.classList.add('ob-exit');
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
  }

  function goTo(idx) {
    current = idx;
    const slide = SLIDES[current];
    const isLast = current === SLIDES.length - 1;
    const canSkip = current > 0;
    const skipLabel = t('onboardSkip') || 'Skip';
    const nextLabel = isLast ? (t('onboardStart') || "Let's go!") : (t('onboardNext') || 'Next →');

    const dots = SLIDES.map((_, i) =>
      `<span class="ob-dot${i === current ? ' ob-dot--active' : ''}"></span>`
    ).join('');

    overlay.innerHTML = `
      <div class="ob-card ob-slide-in">
        <div class="ob-visual">
          ${slide.showLogo
            ? '<img class="ob-logo" src="/icon-512.png" alt="Lalabuba" />'
            : `<span class="ob-emoji">${slide.emoji}</span>`}
        </div>
        <h2 class="ob-title">${slide.title}</h2>
        <p class="ob-body">${slide.body}</p>
        <div class="ob-dots">${dots}</div>
        <div class="ob-actions">
          ${canSkip
            ? `<button class="ob-btn ob-btn--skip" type="button">${skipLabel}</button>`
            : '<span></span>'}
          <button class="ob-btn ob-btn--next" type="button">${nextLabel}</button>
        </div>
      </div>
    `;

    overlay.querySelector('.ob-btn--next').addEventListener('click', () => {
      if (isLast) { close(); } else { goTo(current + 1); }
    });
    if (canSkip) {
      overlay.querySelector('.ob-btn--skip').addEventListener('click', close);
    }
  }

  goTo(0);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('ob-visible'));
}
