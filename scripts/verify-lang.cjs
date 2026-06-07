const { chromium } = require('playwright');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const lang = process.argv[2] || 'ru';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await b.newContext({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('https://lalabuba.com/?cb=lang', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.evaluate((l) => localStorage.setItem('lalabuba-lang', l), lang);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2800);
  const texts = await p.evaluate(() => ({
    htmlLang: document.documentElement.getAttribute('lang'),
    surprise: document.getElementById('surprise-button')?.textContent.trim(),
    todayPill: document.getElementById('hero-daily-proxy')?.textContent.trim(),
    orPick: document.querySelector('[data-i18n="orPickSomething"]')?.textContent.trim(),
    heading: document.querySelector('[data-i18n="heroHeading"]')?.textContent.trim(),
    draw: document.getElementById('generate-button')?.textContent.trim(),
  }));
  console.log('LANG=' + lang, JSON.stringify(texts, null, 2));
  await p.screenshot({ path: `../public/mockups/lang-${lang}.png` });
  await b.close();
})();
