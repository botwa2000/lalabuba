// First-time onboarding tutorial overlay (native app only)
// Shows once on fresh install; gated by localStorage.

const KEY = 'lalabuba-onboarded';

const SLIDES = [
  {
    emoji: null,
    showLogo: true,
    title: 'Welcome to Lalabuba!',
    body: 'Type any word and we\'ll turn it into a unique coloring page just for you.',
  },
  {
    emoji: '🖌️',
    showLogo: false,
    title: 'Tap to color',
    body: 'Pick a color from the palette, then tap any region of the drawing to fill it.',
  },
  {
    emoji: '🏆',
    showLogo: false,
    title: 'Challenge a friend!',
    body: 'Share your coloring page and race to see who finishes it first.',
  },
];

export function initOnboarding() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  if (localStorage.getItem(KEY)) return;

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
            ? '<button class="ob-btn ob-btn--skip" type="button">Skip</button>'
            : '<span></span>'}
          <button class="ob-btn ob-btn--next" type="button">
            ${isLast ? "Let's go!" : 'Next →'}
          </button>
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
