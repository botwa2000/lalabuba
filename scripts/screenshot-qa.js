// Playwright QA screenshot tool for lalabuba
// Usage: node scripts/screenshot-qa.js [url]
//
// Captures hero state + coloring state at desktop, mobile-portrait, mobile-landscape.
// Coloring state uses the built-in demo provider (no API, no Turnstile) with subject "butterfly".
// No production code changes required.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const TARGET_URL = process.argv[2] || 'https://lalabuba.com';
const OUT_DIR = path.join(__dirname, '..', 'public', 'mockups');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const VIEWPORTS = [
  { name: 'desktop',          width: 1440, height: 900,  mobile: false, touch: false, scale: 1 },
  { name: 'mobile-portrait',  width: 390,  height: 844,  mobile: true,  touch: true,  scale: 2 },
  { name: 'mobile-landscape', width: 844,  height: 390,  mobile: true,  touch: true,  scale: 2 },
];

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function snap(page, label) {
  const file = path.join(OUT_DIR, `${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${label}.png`);
  return file;
}

async function run() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const vp of VIEWPORTS) {
    console.log(`\n── ${vp.name} (${vp.width}×${vp.height}) ──`);

    const ctx = await browser.newContext({
      viewport:          { width: vp.width, height: vp.height },
      isMobile:          vp.mobile,
      hasTouch:          vp.touch,
      deviceScaleFactor: vp.scale,
      userAgent:         vp.mobile ? MOBILE_UA : undefined,
    });

    const page = await ctx.newPage();

    // Suppress console noise from the page
    page.on('console', () => {});
    page.on('pageerror', () => {});

    // ── Hero state ─────────────────────────────────────────────────────────
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for fonts + layout to settle
    await page.waitForTimeout(2000);
    await snap(page, `${vp.name}--01-hero`);

    // ── Switch to demo mode (no API, no Turnstile) ─────────────────────────
    // 1. Fake window.Capacitor.isNativePlatform() → getTurnstileToken() returns null immediately
    // 2. Set provider-select to "demo" → requestGeneratedImage() returns SVG data URL synchronously
    await page.evaluate(() => {
      // Bypass Turnstile check in getTurnstileToken()
      window.Capacitor = { isNativePlatform: () => true, Plugins: { SplashScreen: { hide: () => Promise.resolve() } } };
      // Switch to demo provider (hidden select, always present in DOM)
      const sel = document.getElementById('provider-select');
      if (sel) { sel.value = 'demo'; sel.dispatchEvent(new Event('change')); }
    });

    // ── Coloring state: fill subject and click Draw! ───────────────────────
    // In landscape headless, screen.height != viewport height so isPhoneLandscape()
    // may return false — force the sidebar open and use fill({force:true}).
    await page.evaluate(() => {
      const panel = document.getElementById('config-panel');
      if (panel) panel.classList.remove('collapsed');
    });
    await page.fill('#subject', 'butterfly', { force: true });

    // Submit the form — try native click first, fall back to JS form submit
    const submitted = await page.evaluate(() => {
      const form = document.getElementById('generator-form');
      const btn  = document.getElementById('generate-button');
      if (form && !btn?.disabled) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    });
    if (!submitted) await page.click('#generate-button', { force: true });

    // Wait for canvas to show the rendered demo SVG
    try {
      await page.waitForFunction(() => {
        const c = document.getElementById('preview-canvas');
        return c && !c.hidden && c.width > 100 && !document.getElementById('loading-overlay')?.style.display?.includes('flex');
      }, { timeout: 12000 });

      // Let number overlays and legend render
      await page.waitForTimeout(1500);
      await snap(page, `${vp.name}--02-coloring`);

      // ── Coloring state: numbers OFF ──────────────────────────────────────
      const numsBtn = await page.$('#canvas-numbers-btn');
      if (numsBtn) {
        await numsBtn.click();
        await page.waitForTimeout(500);
        await snap(page, `${vp.name}--03-coloring-no-numbers`);

        // Restore numbers on
        await numsBtn.click();
        await page.waitForTimeout(300);
      }

      // ── Coloring state: Free! mode activated ─────────────────────────────
      const freeBtn = await page.$('#go-free-btn');
      if (freeBtn) {
        // Click directly activate (no undo history yet so no confirmation dialog)
        await freeBtn.click();
        await page.waitForTimeout(600);
        await snap(page, `${vp.name}--04-free-mode`);
      }

    } catch (err) {
      console.log(`  ✗ coloring state timed out: ${err.message}`);
      await snap(page, `${vp.name}--02-coloring-FAILED`);
    }

    await ctx.close();
  }

  await browser.close();
  console.log('\nAll screenshots saved to:', OUT_DIR);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
