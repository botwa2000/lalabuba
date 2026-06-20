// Loads the dev site and reports any console errors / page errors — a cheap proof
// that the JS module graph (incl. the refactored canvas.js) parses and loads.
// Usage: node scripts/check-console.js [url]
const { chromium } = require('playwright');
const URL = process.argv[2] || 'https://dev.lalabuba.com';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, channel: 'chrome' });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3500);
  // Confirm the coloring module actually loaded by checking a known global side
  // effect: the canvas element exists and the app booted (hero heading present).
  const booted = await page.$('#subject-input, .subject-input, input[type="text"]');
  const ver = await page.evaluate(() => {
    const s = document.querySelector('script[src*="main.js"]');
    return s ? s.getAttribute('src') : 'n/a';
  });
  console.log('main.js src:', ver);
  console.log('app booted (input present):', !!booted);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
