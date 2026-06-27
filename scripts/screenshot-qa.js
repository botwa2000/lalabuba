// Playwright QA screenshot tool for lalabuba
// Usage: node scripts/screenshot-qa.js [url] [--real]
//
// Default mode: demo provider (SVG turtle, no API, no Turnstile).
// --real mode: blocks Cloudflare Turnstile script, uses local dev server (http://localhost:3000)
//   which has empty TURNSTILE_SECRET_KEY so null tokens pass. Calls real AI providers.
//   Subject: "crab" Hard — representative complex image. Waits up to 90s for generation.
//   Also tests "toggle Numbers AFTER generation" (the user-reported bug path).
//
// Viewports captured: desktop (1440×900), mobile-portrait (390×844), mobile-landscape (844×390).

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const REAL_MODE = process.argv.includes('--real');
const TARGET_URL = process.argv.find(a => a.startsWith('http')) || (REAL_MODE ? 'http://localhost:3000' : 'https://lalabuba.com');
const OUT_DIR = path.join(__dirname, '..', 'public', 'mockups');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const VIEWPORTS = [
  { name: 'desktop',          width: 1440, height: 900,  mobile: false, touch: false, scale: 1 },
  { name: 'mobile-portrait',  width: 390,  height: 844,  mobile: true,  touch: true,  scale: 2 },
  { name: 'mobile-landscape', width: 844,  height: 390,  mobile: true,  touch: true,  scale: 2 },
];

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// How long to wait for image generation:
//   demo mode: SVG is synchronous — 1500ms is plenty
//   real mode: Novita/Pollinations can take 30–90s
const GEN_TIMEOUT_MS = REAL_MODE ? 90000 : 12000;
const POST_GEN_SETTLE_MS = REAL_MODE ? 4000 : 1500; // extra settle for worker segmentation

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
    console.log(`\n── ${vp.name} (${vp.width}×${vp.height}) [${REAL_MODE ? 'REAL API' : 'demo'}] ──`);

    const ctx = await browser.newContext({
      viewport:          { width: vp.width, height: vp.height },
      isMobile:          vp.mobile,
      hasTouch:          vp.touch,
      deviceScaleFactor: vp.scale,
      userAgent:         vp.mobile ? MOBILE_UA : undefined,
    });

    const page = await ctx.newPage();
    page.on('console', () => {});
    page.on('pageerror', () => {});

    // ── Real-mode: block Cloudflare Turnstile so getTurnstileToken() returns null
    // immediately instead of waiting 15s. Server has empty TURNSTILE_SECRET_KEY so
    // null tokens pass in local dev.
    if (REAL_MODE) {
      await page.route('**/challenges.cloudflare.com/**', route => route.abort());
    }

    // ── Hero state ─────────────────────────────────────────────────────────
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await snap(page, `${vp.name}--01-hero`);

    // ── Configure provider and settings ──────────────────────────────────────
    await page.evaluate((realMode) => {
      if (!realMode) {
        // Demo mode: bypass Turnstile + switch to demo provider
        window.Capacitor = { isNativePlatform: () => true, Plugins: { SplashScreen: { hide: () => Promise.resolve() } } };
        const sel = document.getElementById('provider-select');
        if (sel) { sel.value = 'demo'; sel.dispatchEvent(new Event('change')); }
      }
      // Hard difficulty to exercise complex region detection
      const diff = document.getElementById('difficulty-select');
      if (diff) { diff.value = 'hard'; diff.dispatchEvent(new Event('change')); }
      // Numbers ON before generation (pre-selected path)
      const nums = document.getElementById('show-numbers');
      if (nums && !nums.checked) { nums.checked = true; nums.dispatchEvent(new Event('change')); }
    }, REAL_MODE);

    // Force sidebar open (landscape headless)
    await page.evaluate(() => {
      const panel = document.getElementById('config-panel');
      if (panel) panel.classList.remove('collapsed');
    });

    const subject = REAL_MODE ? 'crab' : 'turtle';
    await page.fill('#subject', subject, { force: true });

    // Submit
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

    // ── Wait for image + worker segmentation to complete ────────────────────
    // In real mode we also wait for canvas-numbers-btn to be re-enabled, which
    // happens in the .finally() block after the worker finishes. This proves the
    // full pipeline (image → segmentation → proper badges) works end-to-end.
    try {
      // Step 1: wait for canvas to render + loading overlay to clear.
      // NOTE: waitForFunction(fn, arg, options) — pass null as arg so the third
      // parameter is treated as options (timeout). Omitting arg passes the options
      // object as arg instead, which uses the default 30s timeout.
      await page.waitForFunction(() => {
        const c = document.getElementById('preview-canvas');
        return c && !c.hidden && c.width > 100 &&
               !document.getElementById('loading-overlay')?.style.display?.includes('flex');
      }, null, { timeout: GEN_TIMEOUT_MS });

      // Step 2: wait for canvas-numbers-btn to be enabled.
      // In v241+ this fires when the background segmentation worker finishes —
      // that's when regionMap is ready and proper badges can be drawn.
      // Hard AI images can take 60–90 s for trapped-ball + watershed on 1024².
      await page.waitForFunction(() => {
        const btn = document.getElementById('canvas-numbers-btn');
        return btn && !btn.disabled;
      }, null, { timeout: 90000 });

      // Settle (numbers overlay drawn)
      await page.waitForTimeout(POST_GEN_SETTLE_MS);
      await snap(page, `${vp.name}--02-coloring`);

      // ── Test: Numbers OFF ─────────────────────────────────────────────────
      const numsCount = await page.locator('#canvas-numbers-btn').count();
      if (numsCount > 0) {
        await page.locator('#canvas-numbers-btn').dispatchEvent('click');
        await page.waitForTimeout(500);
        await snap(page, `${vp.name}--03-coloring-no-numbers`);

        // ── Test: Toggle Numbers BACK ON (the user-reported bug path) ─────
        // This is the exact scenario that was broken: Numbers was OFF, image
        // already generated + worker done, user clicks Numbers. v239+v241 fix:
        // should immediately show proper numbered badges (not all "1").
        await page.locator('#canvas-numbers-btn').dispatchEvent('click');
        await page.waitForTimeout(800);
        await snap(page, `${vp.name}--03b-numbers-toggled-on-after-gen`);
      }

      // ── Test: Free! mode ──────────────────────────────────────────────────
      const freeCount = await page.locator('#go-free-btn').count();
      if (freeCount > 0) {
        await page.locator('#go-free-btn').dispatchEvent('click');
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
  if (REAL_MODE) console.log('Real-API mode: screenshots show actual AI-generated images.');
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
