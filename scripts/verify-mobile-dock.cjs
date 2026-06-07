const { chromium } = require('playwright');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36' });
  const p = await ctx.newPage();
  await p.goto('https://lalabuba.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  try { await p.click('text=No thanks', { timeout: 3000 }); } catch {}
  await p.evaluate(() => {
    const s = document.getElementById('provider-select'); if (s) { s.value = 'demo'; s.dispatchEvent(new Event('change')); }
    // pre-seed Turnstile token so the submit doesn't block on the 30s poll in headless
    if (window.onTurnstileSuccess) window.onTurnstileSuccess('dummy-token');
  });
  await p.fill('#subject', 'butterfly', { force: true });
  await p.evaluate(() => { const btn = document.getElementById('generate-button'); if (btn) btn.click(); });
  await p.waitForFunction(() => !document.querySelector('.app').classList.contains('app-hero'), { timeout: 40000 });
  await p.waitForTimeout(2500);

  const layout = await p.evaluate(() => {
    const vh = window.innerHeight, vw = window.innerWidth;
    const dock = document.querySelector('.palette-sidebar');
    const dr = dock ? dock.getBoundingClientRect() : null;
    const swatches = dock ? dock.querySelectorAll('.color-swatch') : [];
    const sw0 = swatches[0] ? swatches[0].getBoundingClientRect() : null;
    const canvas = document.getElementById('preview-canvas');
    const cr = canvas ? canvas.getBoundingClientRect() : null;
    const actions = document.querySelector('.canvas-actions');
    // count action buttons currently visible (offsetParent !== null)
    const allBtns = actions ? [...actions.querySelectorAll('button')] : [];
    const visibleBtns = allBtns.filter(btn => btn.offsetParent !== null).map(btn => btn.id || btn.textContent.trim().slice(0,8));
    return {
      vh, vw,
      pageScrollable: document.documentElement.scrollHeight > window.innerHeight + 1,
      dockBottomAtViewportBottom: dr ? Math.round(dr.bottom) : null,
      dockOnScreen: dr ? (dr.top < vh && dr.bottom > 0 && dr.width > 0) : null,
      swatchCount: swatches.length,
      swatch0: sw0 ? { w: Math.round(sw0.w || sw0.width), h: Math.round(sw0.height) } : null,
      canvasVisible: cr ? (cr.width > 0 && cr.bottom <= vh + 1) : null,
      canvas: cr ? { w: Math.round(cr.width), h: Math.round(cr.height), bottom: Math.round(cr.bottom) } : null,
      visibleToolbarButtons: visibleBtns,
    };
  });

  await p.screenshot({ path: '../public/mockups/mobile-portrait--08-dock-default.png' });
  // tap More → secondary buttons appear
  await p.click('#more-actions-btn');
  await p.waitForTimeout(400);
  const afterMore = await p.evaluate(() => {
    const actions = document.querySelector('.canvas-actions');
    const visible = [...actions.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => b.id).filter(Boolean);
    return { showMore: actions.classList.contains('show-more'), visibleCount: visible.length, visible };
  });
  await p.screenshot({ path: '../public/mockups/mobile-portrait--07-dock.png' });

  console.log('LAYOUT   ', JSON.stringify(layout, null, 2));
  console.log('AFTERMORE', JSON.stringify(afterMore));
  await b.close();
})();
