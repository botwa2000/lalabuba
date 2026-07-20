// Mobile palette QA — renders the coloring state on mobile by intercepting
// the generate-image API with a real gallery image (no Turnstile needed).
// Usage: node scripts/mobile-palette-qa.js

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const CHROME  = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, '..', 'public', 'mockups');
const UA      = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// A real lalabuba coloring image to inject as the "generated" image
const MOCK_IMG_URL = 'https://lalabuba.com/img/g/cat-easy-793562427.jpg';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile-portrait',  width: 390,  height: 844 },
  { name: 'mobile-landscape', width: 844,  height: 390 },
];

async function snap(page, label) {
  const file = path.join(OUT_DIR, `${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  saved: ${label}.png`);
  return file;
}

async function run() {
  // Fetch the mock image once upfront
  const tmpBrowser = await chromium.launch({ executablePath: CHROME, headless: true });
  const tmpCtx = await tmpBrowser.newContext();
  const tmpPage = await tmpCtx.newPage();
  const imgResp = await tmpPage.request.get(MOCK_IMG_URL);
  const imgBody = await imgResp.body();
  const imgType = imgResp.headers()['content-type'] || 'image/jpeg';
  await tmpBrowser.close();
  console.log(`Fetched mock image: ${imgBody.length} bytes (${imgType})`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

  for (const vp of VIEWPORTS) {
    console.log(`\n── ${vp.name} (${vp.width}×${vp.height}) ──`);

    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true, hasTouch: true, deviceScaleFactor: 2,
      userAgent: UA,
    });
    const page = await ctx.newPage();
    page.on('pageerror', () => {});
    page.on('console',   () => {});

    // Intercept generate-image → return real gallery image, bypass Turnstile
    await page.route('**/api/generate-image', route => route.fulfill({
      status: 200,
      contentType: imgType,
      headers: { 'X-Image-Seed': '99999' },
      body: imgBody,
    }));

    await page.goto('https://lalabuba.com/en/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Dismiss cookie banner if present
    const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("No thanks"), #cookie-accept');
    await cookieBtn.first().click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Hero screenshot
    await snap(page, `pal-${vp.name}--01-hero`);

    // Fill subject and submit
    await page.fill('#subject', 'cat', { force: true });
    await page.evaluate(() => {
      const form = document.getElementById('generator-form');
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    try {
      // Step 1: wait for canvas to appear + loading overlay to clear (image delivered)
      await page.waitForFunction(() => {
        const c = document.getElementById('preview-canvas');
        const ov = document.getElementById('loading-overlay');
        return c && !c.hidden && c.width > 100
          && (!ov || ov.style.display === 'none' || ov.style.display === '');
      }, null, { timeout: 90000 });

      // Step 2: wait for segmentation worker to finish (numbers btn enabled)
      await page.waitForFunction(() => {
        const btn = document.getElementById('canvas-numbers-btn');
        return !btn || !btn.disabled;
      }, null, { timeout: 90000 });

      await page.waitForTimeout(2000); // settle after worker

      // Full coloring state — canvas + palette
      await snap(page, `pal-${vp.name}--02-coloring`);

      // Scroll to bottom to see action buttons
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      await snap(page, `pal-${vp.name}--03-coloring-scrolled`);

    } catch (e) {
      console.log(`  ✗ timeout: ${e.message}`);
      await snap(page, `pal-${vp.name}--02-coloring-TIMEOUT`);
    }

    await ctx.close();
  }

  await browser.close();
  console.log('\nDone. Screenshots in:', OUT_DIR);
}

run().catch(console.error);
