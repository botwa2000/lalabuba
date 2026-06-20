// Focused screenshot: the cookie consent banner on a fresh mobile context
// (no stored consent → banner shows). Verifies the oversized-banner fix.
// Usage: node scripts/shot-cookie.js [url]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.argv[2] || 'https://dev.lalabuba.com';
const OUT = path.join(__dirname, '..', 'public', 'mockups');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, channel: 'chrome' });
  // Fresh context = empty localStorage → the consent banner appears.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // Give the page + the banner's slide-up animation time to settle.
  await page.waitForTimeout(3000);
  const banner = await page.$('#cookie-banner');
  if (banner) {
    const box = await banner.boundingBox();
    console.log('banner box:', JSON.stringify(box));
  } else {
    console.log('no #cookie-banner found');
  }
  const file = path.join(OUT, 'cookie-mobile.png');
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
