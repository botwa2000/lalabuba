// One-off render check for sticker resize/rotate on the web. Seeds a scene with
// placed stickers carrying scale (s) + rotation (r), opens the scenes modal, and
// screenshots it so we can confirm the transform renders. Screenshot is deleted
// by the caller after inspection.
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://localhost:3055';
const OUT = process.argv[3] || 'C:/Users/Alexa/lalabuba/public/mockups/scenes-transform.png';

const seed = {
  v: 1,
  unlocked: ['m_tree', 'm_fox', 'm_butterfly', 'm_bee', 'm_tulip', 'm_sun'],
  placed: {
    meadow: [
      { d: 'm_tree', x: 0.30, y: 0.58, s: 2.4, r: 0.35 },
      { d: 'm_fox', x: 0.66, y: 0.52, s: 1.0, r: 0 },
      { d: 'm_butterfly', x: 0.5, y: 0.3, s: 1.7, r: -0.6 },
      { d: 'm_sun', x: 0.82, y: 0.2, s: 0.6, r: 0 },
    ],
  },
  art: [],
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => {
    localStorage.setItem('lalabuba-scenes-v1', JSON.stringify(s));
  }, seed);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);

  await page.evaluate(() => document.getElementById('gallery-btn')?.click());
  await page.waitForSelector('#mascot-card', { timeout: 5000 });
  await page.evaluate(() => document.getElementById('mascot-card')?.click());
  await page.waitForSelector('#scene-stage .scene-sticker', { timeout: 5000 });
  await page.waitForTimeout(400);

  // Report the computed transforms so we have a non-visual assertion too.
  const transforms = await page.$$eval('#scene-stage .scene-sticker', (els) =>
    els.map((e) => getComputedStyle(e).transform));
  console.log('STICKER_COUNT=' + transforms.length);
  transforms.forEach((t, i) => console.log(`t${i}=${t}`));

  await page.screenshot({ path: OUT });
  console.log('SHOT=' + OUT);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
