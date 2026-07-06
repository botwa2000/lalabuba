import { state } from './state.js';
import { t } from './i18n.js';
import { subjectInput, difficultySelect } from './dom.js';
import { setStatus, showLoading, hideLoading, activePalette, showCanvasError } from './ui.js';
import { renderGeneratedImage } from './canvas.js';
import { SIZE_DIMS } from './data.js';
import { recordGeneration } from './progress.js';

export function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function svgShell(body) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">`,
    `<rect width="1024" height="1024" fill="white"/>`,
    `<g fill="none" stroke="#111" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">`,
    body,
    `</g>`,
    `</svg>`,
  ].join("");
}

export function buildDemoImage(subject) {
  const normalized = subject.toLowerCase();

  if (normalized.includes("butterfly")) {
    return svgDataUrl(svgShell(`
      <ellipse cx="360" cy="390" rx="170" ry="210"/>
      <ellipse cx="664" cy="390" rx="170" ry="210"/>
      <ellipse cx="390" cy="670" rx="150" ry="180"/>
      <ellipse cx="634" cy="670" rx="150" ry="180"/>
      <line x1="512" y1="240" x2="512" y2="790"/>
      <circle cx="512" cy="215" r="48"/>
      <line x1="490" y1="170" x2="450" y2="120"/>
      <line x1="534" y1="170" x2="574" y2="120"/>
      <circle cx="322" cy="382" r="48"/>
      <circle cx="700" cy="382" r="48"/>
      <circle cx="402" cy="676" r="42"/>
      <circle cx="622" cy="676" r="42"/>
    `));
  }

  if (normalized.includes("rocket")) {
    return svgDataUrl(svgShell(`
      <path d="M512 140 C610 220 646 370 632 560 L392 560 C378 370 414 220 512 140 Z"/>
      <path d="M432 560 L330 710 L430 690 L470 820 L512 730"/>
      <path d="M592 560 L694 710 L594 690 L554 820 L512 730"/>
      <path d="M452 560 L452 860 L572 860 L572 560"/>
      <circle cx="512" cy="350" r="72"/>
      <path d="M452 860 Q512 960 572 860"/>
    `));
  }

  if (normalized.includes("cat")) {
    return svgDataUrl(svgShell(`
      <circle cx="512" cy="390" r="210"/>
      <path d="M350 250 L414 120 L470 250"/>
      <path d="M554 250 L610 120 L674 250"/>
      <circle cx="438" cy="380" r="22"/>
      <circle cx="586" cy="380" r="22"/>
      <path d="M470 470 Q512 510 554 470"/>
      <path d="M512 420 L480 462 L544 462 Z"/>
      <line x1="450" y1="455" x2="336" y2="430"/>
      <line x1="450" y1="485" x2="330" y2="490"/>
      <line x1="574" y1="455" x2="688" y2="430"/>
      <line x1="574" y1="485" x2="694" y2="490"/>
      <path d="M404 600 Q512 720 620 600"/>
    `));
  }

  if (normalized.includes("turtle")) {
    return svgDataUrl(svgShell(`
      <ellipse cx="512" cy="540" rx="240" ry="185"/>
      <circle cx="512" cy="280" r="76"/>
      <ellipse cx="248" cy="448" rx="96" ry="48" transform="rotate(-35 248 448)"/>
      <ellipse cx="776" cy="448" rx="96" ry="48" transform="rotate(35 776 448)"/>
      <ellipse cx="268" cy="648" rx="88" ry="42" transform="rotate(30 268 648)"/>
      <ellipse cx="756" cy="648" rx="88" ry="42" transform="rotate(-30 756 648)"/>
      <polygon points="512,430 552,452 552,496 512,518 472,496 472,452"/>
      <polygon points="432,496 472,518 472,562 432,584 392,562 392,518"/>
      <polygon points="592,496 632,518 632,562 592,584 552,562 552,518"/>
      <polygon points="512,518 552,540 552,584 512,606 472,584 472,540"/>
      <polygon points="432,584 472,606 472,650 432,672 392,650 392,606"/>
      <polygon points="592,584 632,606 632,650 592,672 552,650 552,606"/>
      <circle cx="492" cy="258" r="16"/>
    `));
  }

  if (normalized.includes("castle")) {
    return svgDataUrl(svgShell(`
      <rect x="250" y="330" width="524" height="470"/>
      <rect x="210" y="260" width="120" height="180"/>
      <rect x="694" y="260" width="120" height="180"/>
      <rect x="320" y="250" width="90" height="120"/>
      <rect x="614" y="250" width="90" height="120"/>
      <path d="M450 800 L450 610 Q512 530 574 610 L574 800"/>
      <rect x="342" y="430" width="90" height="90"/>
      <rect x="592" y="430" width="90" height="90"/>
      <line x1="250" y1="330" x2="774" y2="330"/>
    `));
  }

  return svgDataUrl(svgShell(`
    <circle cx="512" cy="360" r="180"/>
    <ellipse cx="512" cy="690" rx="250" ry="170"/>
    <circle cx="430" cy="330" r="34"/>
    <circle cx="594" cy="330" r="34"/>
    <path d="M420 430 Q512 510 604 430"/>
    <circle cx="512" cy="690" r="56"/>
    <circle cx="398" cy="690" r="44"/>
    <circle cx="626" cy="690" r="44"/>
  `));
}

export async function generatePage(subject, seedOverride = null, isPreDefined = false) {
  // Transition to coloring layout immediately so canvas & loading overlay are visible
  document.querySelector('.app')?.classList.remove('app-hero');
  // Auto-collapse sidebar so canvas gets full width on first draw
  const cp = document.querySelector('.config-panel');
  if (cp) {
    cp.classList.add('collapsed');
    cp.classList.remove('mobile-open');
    const toggleBtn = document.getElementById('panel-toggle');
    if (toggleBtn) toggleBtn.textContent = '▶';
  }
  const difficulty = difficultySelect.value;
  setStatus(t('generating', subject, difficulty));
  showLoading();
  await new Promise(r => requestAnimationFrame(r));
  try {
    const imageUrl = await requestGeneratedImage(subject, difficulty, seedOverride, isPreDefined);
    await renderGeneratedImage(imageUrl);
    try { recordGeneration(); } catch { /* progress is best-effort */ }
    // Clear undo stack for new image
    state.undoStack = [];
    const undoBtn = document.getElementById('undo-button');
    if (undoBtn) undoBtn.disabled = true;
    setStatus(t('done'));
    // Show coloring hint and challenge strip
    const coloringHint = document.getElementById('coloring-hint');
    if (coloringHint) coloringHint.hidden = false;
    const challengeStrip = document.getElementById('challenge-strip');
    if (challengeStrip) challengeStrip.hidden = false;
    document.getElementById('regen-button').disabled = false;
  } catch (err) {
    const msg = err.message || t('genFailed');
    setStatus(msg, true);
    showCanvasError(msg); // visible in the canvas area even when the panel/status bar is closed (mobile)
  } finally {
    hideLoading();
  }
}

export async function requestGeneratedImage(subject, difficulty = "medium", seedOverride = null, isPreDefined = false) {
  const provider = 'backend';
  const seed = (seedOverride !== null && Number.isFinite(seedOverride))
    ? Math.floor(seedOverride)
    : Math.floor(Math.random() * 2_000_000_000);
  state.lastSeed = seed;

  if (provider === "demo") {
    return buildDemoImage(subject);
  }

  if (provider === "direct") {
    // Browser-to-Pollinations direct path is intentionally disabled.
    // Reason: the browser TLS handshake can trigger OS certificate-selection
    // dialogs on machines with client certs (enterprise, MDM). All requests
    // go through the backend (server-to-server) where no such prompts occur.
    // Fall through to the backend block below.
  }

  if (provider === "backend" || provider === "direct") {
    // Capacitor 4+ uses https://localhost on Android (not capacitor://), so
    // protocol sniffing fails. Use Capacitor.isNativePlatform() instead.
    const isNative = window.Capacitor?.isNativePlatform?.() ||
                     window.location.protocol === 'capacitor:' ||
                     window.location.protocol === 'ionic:';
    const apiBase = isNative ? 'https://lalabuba.com' : '';
    // 75-second hard timeout — prevents an infinite hang if the network is
    // blocked (e.g. Google Play test environment) while being generous enough
    // not to kill a slow-but-working FREE generation. A novel subject is served
    // by Pollinations' free queue in ~45s (cache hits ~1-2s); the server gives
    // Pollinations up to 50s, so the client must wait longer than that or it
    // would clip the free result and (worse) trigger a paid fallback. 45s was
    // too short and caused false "timed out" failures. (Flutter/native allows
    // 90s.) AbortController is supported on all Android WebViews (minSdk 24 /
    // Chrome 56+).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 75000);
    let response;
    try {
      response = await fetch(`${apiBase}/api/generate-image`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          difficulty,
          artStyle: state.artStyle || 'structured',
          size: state.selectedSize,
          seed,
          width:  (SIZE_DIMS[state.selectedSize] || SIZE_DIMS.medium).w,
          height: (SIZE_DIMS[state.selectedSize] || SIZE_DIMS.medium).h,
          turnstileToken: state.turnstileToken || undefined,
        }),
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(t('genTimeout'));
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let message = `Image request failed (${response.status}).`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch { /* keep generic message */ }
      throw new Error(message);
    }

    // Server echoes the seed and (when Blob is configured) a persistent image URL.
    const echoedSeed = response.headers.get('X-Image-Seed');
    if (echoedSeed) state.lastSeed = parseInt(echoedSeed, 10);
    state.lastImageUrl = response.headers.get('X-Image-Url') || null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      const text = await response.text().catch(() => '');
      throw new Error(`Server returned non-image response (${contentType}): ${text.slice(0, 120)}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) throw new Error("Server returned an empty image. Please try again.");
    return URL.createObjectURL(blob);
  }

  throw new Error(`Unknown provider: ${provider}`);
}
