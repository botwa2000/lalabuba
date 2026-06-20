// One-off visual check of the Sticker Scenes editor against the local dev server.
// Seeds rich progress + scene state, opens the journal, opens the scenes modal,
// and captures the meadow + each scene tab. Output → public/mockups/scenes-*.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = process.argv[2] || 'http://localhost:3000';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.join(__dirname, '..', 'public', 'mockups');
fs.mkdirSync(OUT, { recursive: true });

const PROG = {
  totalCompleted: 62, totalGenerated: 90, streak: 8, longestStreak: 14,
  daysColored: 30, badges: ['first','five','ten'], today: { day: null, generated: 0, completed: 0 },
  palettesUsed: ['classic'], themesColored: ['animal','nature'], subjects: {},
};
// Unlock a spread of decorations + place some in meadow & ocean for a full look.
const SCN = {
  v: 1,
  unlocked: ['m_tree','m_pine','m_tulip','m_sunflower','m_blossom','m_mushroom','m_rainbow','m_sun','m_butterfly','m_bee','m_ladybug','m_bunny','m_fox','m_bird',
             'o_fish','o_tropfish','o_octopus','o_crab','o_turtle','o_dolphin','o_whale','o_shell','o_coral','o_star',
             's_rocket','s_planet','s_moon','s_star','s_comet','s_ufo','s_alien'],
  placed: {
    meadow: [
      { d:'m_sun', x:0.83, y:0.16 }, { d:'m_rainbow', x:0.30, y:0.18 },
      { d:'m_tree', x:0.18, y:0.62 }, { d:'m_pine', x:0.40, y:0.68 }, { d:'m_tree', x:0.82, y:0.64 },
      { d:'m_tulip', x:0.12, y:0.86 }, { d:'m_sunflower', x:0.62, y:0.84 }, { d:'m_mushroom', x:0.50, y:0.90 },
      { d:'m_butterfly', x:0.55, y:0.40 }, { d:'m_bee', x:0.70, y:0.45 }, { d:'m_bunny', x:0.30, y:0.86 }, { d:'m_fox', x:0.88, y:0.86 },
    ],
    ocean: [
      { d:'o_whale', x:0.30, y:0.40 }, { d:'o_fish', x:0.62, y:0.30 }, { d:'o_tropfish', x:0.78, y:0.55 },
      { d:'o_octopus', x:0.22, y:0.72 }, { d:'o_crab', x:0.55, y:0.86 }, { d:'o_turtle', x:0.80, y:0.80 },
      { d:'o_coral', x:0.40, y:0.90 }, { d:'o_star', x:0.15, y:0.30 },
    ],
  },
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
    await ctx.addInitScript(([prog, scn]) => {
      try {
        localStorage.setItem('lalabuba-progress-v1', prog);
        localStorage.setItem('lalabuba-scenes-v1', scn);
        localStorage.setItem('lalabuba-lang', 'en');
        localStorage.setItem('lala_cookie_consent', JSON.stringify({ analytics: false, ts: 1700000000000 }));
      } catch (e) {}
      const css = '#turnstile-widget,#turnstile-instruction,.cf-turnstile,#cookie-banner{display:none !important;}';
      const inject = () => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); };
      if (document.head) inject(); else document.addEventListener('DOMContentLoaded', inject);
    }, [JSON.stringify(PROG), JSON.stringify(SCN)]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  PAGEERROR:', e.message));
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    // open journal then the scenes card
    await page.evaluate(() => { const m = document.getElementById('gallery-modal'); if (m) m.classList.remove('hidden'); const b = document.getElementById('journal-btn'); if (b) b.click(); });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `scenes-${vp.name}-card.png`) });
    const opened = await page.evaluate(() => { const c = document.getElementById('mascot-card'); if (c) { c.click(); return true; } return false; });
    console.log(`${vp.name}: scenes card click → ${opened}`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `scenes-${vp.name}-meadow.png`) });
    // switch to ocean tab
    await page.evaluate(() => { const b = document.querySelector('.scene-tab[data-scene="ocean"]'); if (b) b.click(); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `scenes-${vp.name}-ocean.png`) });
    // switch to space tab (unlocked decos, no placements → earn/place hint)
    await page.evaluate(() => { const b = document.querySelector('.scene-tab[data-scene="space"]'); if (b) b.click(); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `scenes-${vp.name}-space.png`) });
    console.log(`  ✓ ${vp.name} captured`);
    await ctx.close();
  }
  await browser.close();
  console.log('Done.');
}
run().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
