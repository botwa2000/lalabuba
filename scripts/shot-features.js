// Visual check of the 6 richness features against the local dev server.
// Seeds progress + scene state (including a couple of "My Art" stickers generated
// on the fly) and captures: the hero (voice + scene-of-week pills) and the Sticker
// Scenes modal (My Art tray + a placed art sticker). Output → public/mockups/feat-*.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = process.argv[2] || 'http://localhost:3000';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.join(__dirname, '..', 'public', 'mockups');
fs.mkdirSync(OUT, { recursive: true });

const PROG = {
  totalCompleted: 62, totalGenerated: 90, streak: 8, longestStreak: 14,
  daysColored: 30, badges: ['first', 'five', 'ten'], today: { day: null, generated: 0, completed: 0 },
  palettesUsed: ['classic'], themesColored: ['animal', 'nature'], subjects: {},
};

const VPS = [
  { name: 'mobile', w: 390, h: 844, dsf: 2, mobile: true },
  { name: 'desktop', w: 1200, h: 900, dsf: 1, mobile: false },
];

async function run() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  for (const vp of VPS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dsf,
      isMobile: vp.mobile, hasTouch: vp.mobile,
    });
    await ctx.addInitScript((prog) => {
      try {
        localStorage.setItem('lalabuba-progress-v1', prog);
        localStorage.setItem('lalabuba-lang', 'en');
        localStorage.setItem('lala_cookie_consent', JSON.stringify({ analytics: false, ts: 1700000000000 }));
        // Build two "My Art" thumbnails on the fly so the My Art tray renders.
        const mkThumb = (c1, c2) => {
          const cv = document.createElement('canvas'); cv.width = 120; cv.height = 120;
          const x = cv.getContext('2d');
          x.fillStyle = c1; x.fillRect(0, 0, 120, 120);
          x.fillStyle = c2; x.beginPath(); x.arc(60, 60, 38, 0, Math.PI * 2); x.fill();
          x.strokeStyle = '#222'; x.lineWidth = 4; x.stroke();
          return cv.toDataURL('image/png');
        };
        const SCN = {
          v: 1,
          unlocked: ['m_tree', 'm_pine', 'm_tulip', 'm_sunflower', 'm_butterfly', 'm_bee', 'm_bunny', 'm_fox', 'm_sun', 'm_rainbow'],
          art: [
            { id: 'art_1_a', thumb: mkThumb('#ffe08a', '#ff7043'), theme: 'animal', ts: 1 },
            { id: 'art_2_b', thumb: mkThumb('#bfe3ff', '#26c281'), theme: 'nature', ts: 2 },
          ],
          placed: {
            meadow: [
              { d: 'm_sun', x: 0.84, y: 0.16 }, { d: 'm_rainbow', x: 0.3, y: 0.18 },
              { d: 'm_tree', x: 0.18, y: 0.62 }, { d: 'm_fox', x: 0.86, y: 0.84 },
              { a: 'art_1_a', x: 0.5, y: 0.5 }, { d: 'm_butterfly', x: 0.62, y: 0.4 },
            ],
          },
        };
        localStorage.setItem('lalabuba-scenes-v1', JSON.stringify(SCN));
      } catch (e) {}
      const css = '#turnstile-widget,#turnstile-instruction,.cf-turnstile,#cookie-banner{display:none !important;}';
      const inject = () => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); };
      if (document.head) inject(); else document.addEventListener('DOMContentLoaded', inject);
    }, JSON.stringify(PROG));

    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  PAGEERROR:', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('  CONSOLE-ERR:', m.text()); });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Hero — shows the scene-of-week pill (+ voice pill where supported).
    await page.screenshot({ path: path.join(OUT, `feat-${vp.name}-hero.png`) });

    // Open the Journal, then the Scenes card → My Art tray + placed art sticker.
    await page.evaluate(() => { const m = document.getElementById('gallery-modal'); if (m) m.classList.remove('hidden'); const b = document.getElementById('journal-btn'); if (b) b.click(); });
    await page.waitForTimeout(700);
    const opened = await page.evaluate(() => { const c = document.getElementById('mascot-card'); if (c) { c.click(); return true; } return false; });
    console.log(`${vp.name}: scenes card click → ${opened}`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `feat-${vp.name}-scenes.png`) });

    console.log(`  ✓ ${vp.name} captured`);
    await ctx.close();
  }
  await browser.close();
  console.log('Done.');
}
run().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
