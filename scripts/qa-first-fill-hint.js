// Functional QA for the first-fill hint (growth plan L12, public/js/first-fill-hint.js).
// Drives the real page in Chrome: a gallery picture is opened (generation and
// Turnstile are stubbed like screenshot-qa.js, so no AI call), then checks
//   1. the colour of the largest numbered area is already selected,
//   2. "Tap here!" shows on that area (localised),
//   3. one tap on the marker fills the area, the hint goes, sparkles fly,
//      and first_fill is sent once,
//   4. a new picture brings the hint back; free colour mode gets it too.
// /api/t is answered here (never reaches the stats).
//
//   $env:NODE_PATH = "C:\Users\Alexa\lalabuba\scripts\node_modules"
//   node scripts/qa-first-fill-hint.js https://dev.lalabuba.com [--shots]
const { chromium } = require('playwright');
const path = require('path');

const TARGET = process.argv.find((a) => a.startsWith('http')) || 'https://lalabuba.com';
const SHOTS = process.argv.includes('--shots');
const OUT = path.join(__dirname, '..', 'public', 'mockups');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false, lang: 'en', difficulty: 'easy' },
  { name: 'mobile-portrait', width: 390, height: 844, mobile: true, lang: 'de', difficulty: 'easy' },
  { name: 'mobile-375', width: 375, height: 667, mobile: true, lang: 'pl', difficulty: 'medium' },
  { name: 'mobile-landscape', width: 844, height: 390, mobile: true, lang: 'en', difficulty: 'easy' },
];
const LABEL = { en: 'Tap here!', de: 'Hier tippen!', pl: 'Dotknij tutaj!' };

let failures = 0;
const check = (n, c, extra = '') => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${extra ? ' — ' + extra : ''}`); if (!c) failures++; };

async function fixture(ctx, topic) {
  // Gallery pictures are only published on prod (dev's gallery is empty).
  const origin = 'https://lalabuba.com';
  const list = await (await ctx.request.get(`${origin}/api/gallery?topic=${topic}`)).json();
  const entry = (list.easy || list.medium || [])[0];
  const img = await ctx.request.get(origin + entry.url);
  return { body: await img.body(), type: img.headers()['content-type'] || 'image/png' };
}

async function draw(page, subject) {
  await page.evaluate(() => { const p = document.getElementById('config-panel'); if (p) p.classList.remove('collapsed'); });
  await page.fill('#subject', subject, { force: true });
  await page.evaluate(() => document.getElementById('generator-form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await page.waitForFunction(() => {
    const c = document.getElementById('preview-canvas');
    const btn = document.getElementById('canvas-numbers-btn');
    return c && !c.hidden && btn && !btn.disabled;
  }, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
}

// Hint + state as the page sees it (same module instances as main.js).
const probe = (page) => page.evaluate(async () => {
  const { state } = await import('/js/state.js');
  const { findRegionAt, firstHintTarget } = await import('/js/canvas.js');
  const el = document.getElementById('tap-here-hint');
  const r = el.getBoundingClientRect();
  const c = document.getElementById('preview-canvas').getBoundingClientRect();
  const active = [...document.querySelectorAll('#legend-list .color-swatch')].findIndex((b) => b.classList.contains('active'));
  // The numbered area under the marker and the colour it needs.
  const cv = document.getElementById('preview-canvas');
  const px = Math.round((r.left - c.left) / c.width * cv.width);
  const py = Math.round((r.top - c.top) / c.height * cv.height);
  // What a tap at the marker resolves to — the page's own lookup (it snaps off outlines).
  const id = findRegionAt(px, py);
  const target = firstHintTarget();
  const label = el.querySelector('.tap-here-label');
  const lr = label.getBoundingClientRect();
  return {
    visible: !el.hidden && getComputedStyle(el).display !== 'none',
    x: r.left, y: r.top, canvas: { l: c.left, t: c.top, r: c.right, b: c.bottom },
    label: label.textContent, labelBox: { l: lr.left, r: lr.right, t: lr.top, b: lr.bottom }, vw: innerWidth,
    selected: state.selectedPaletteIndex, activeSwatch: active,
    needs: id > 0 && state.regionColorMap?.has(id) ? state.regionColorMap.get(id) : null,
    regionId: id, targetId: target?.id ?? null, filled: state.firstFillTracked, targetDone: null, done: state.completedRegions.size,
    freeMode: state.isFreeMode, pointerEvents: getComputedStyle(el.querySelector('.tap-here-ring')).pointerEvents,
  };
});

async function run() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  for (const vp of VIEWPORTS) {
    console.log(`\n── ${vp.name} ${vp.width}×${vp.height} · ${vp.lang} · ${vp.difficulty} ──`);
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile,
      deviceScaleFactor: vp.mobile ? 2 : 1, userAgent: vp.mobile ? MOBILE_UA : undefined,
    });
    await ctx.addInitScript((lang) => {
      localStorage.setItem('lala_cookie_consent', JSON.stringify({ analytics: false, ts: Date.now() }));
      localStorage.setItem('lalabuba-lang', lang);
    }, vp.lang);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const events = [];
    await page.route('**/api/t', async (route) => {
      try { for (const e of JSON.parse(route.request().postData() || '{}').events || []) events.push(e.e); } catch {}
      return route.fulfill({ status: 204, body: '' });
    });
    await page.route('**/turnstile/v0/api.js*', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile = { getResponse: () => 'qa', reset() {}, render() {} };
             setTimeout(() => window.onTurnstileSuccess && window.onTurnstileSuccess('qa'), 50);`,
    }));
    let pic = await fixture(ctx, 'cat');
    await page.route('**/api/generate-image', (route) => route.fulfill({
      status: 200, contentType: pic.type, body: pic.body,
      headers: { 'X-Image-Seed': '1', 'Access-Control-Expose-Headers': 'X-Image-Seed' },
    }));

    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const heroHint = await page.evaluate(() => { const el = document.getElementById('tap-here-hint'); return !!el && !el.hidden; });
    check('hero: no hint before a picture', !heroHint);
    await page.evaluate((d) => { const s = document.getElementById('difficulty-select'); s.value = d; s.dispatchEvent(new Event('change')); }, vp.difficulty);

    // ── 1–2: picture opens with the right colour selected and the hint on its area
    await draw(page, 'cat');
    let p = await probe(page);
    check('hint visible on the picture', p.visible);
    check('label localised', p.label === LABEL[vp.lang], `"${p.label}"`);
    check('marker inside the picture', p.x >= p.canvas.l && p.x <= p.canvas.r && p.y >= p.canvas.t && p.y <= p.canvas.b);
    check('label not clipped by the viewport', p.labelBox.l >= 0 && p.labelBox.r <= p.vw, JSON.stringify(p.labelBox));
    check('marker sits on a numbered area', p.needs != null, `region ${p.regionId}`);
    check('a tap at the marker lands in the hinted area itself', p.regionId === p.targetId, `tap → ${p.regionId}, hinted ${p.targetId}`);
    const hinted = p.targetId;
    check('that area\'s colour is pre-selected', p.selected === p.needs && p.activeSwatch === p.needs, `selected ${p.selected}, swatch ${p.activeSwatch}, needs ${p.needs}`);
    check('marker never takes the tap', p.pointerEvents === 'none');
    if (SHOTS) await page.screenshot({ path: path.join(OUT, `hint-${vp.name}--1-open.png`) });

    // ── 3: one tap on the marker = first colour
    const sparkles = page.waitForFunction(() => [...document.body.children].some((n) => n.tagName === 'SPAN' && /✨|⭐|🌟|💫/.test(n.textContent)), null, { timeout: 3000 }).then(() => true, () => false);
    if (vp.mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
    const sparkled = await sparkles;
    await page.waitForTimeout(400);
    let q = await probe(page);
    const hintedDone = await page.evaluate(async (id) => (await import('/js/state.js')).state.completedRegions.has(id), hinted);
    check('tap on the marker fills the hinted area (first try, no "wrong colour")', q.filled && hintedDone, `done ${q.done}`);
    check('hint gone after the first fill', !q.visible);
    check('sparkle on the first fill', sparkled);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, `hint-${vp.name}--2-after-tap.png`) });
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(300);
    // A second fill must not re-show anything or send first_fill twice.
    const second = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.numberRegions?.find((r) => !state.completedRegions.has(r._mapId ?? r.id)) || null;
    });
    if (second) {
      const pt = await page.evaluate(([x, y]) => {
        const c = document.getElementById('preview-canvas'); const r = c.getBoundingClientRect();
        return { x: r.left + x / c.width * r.width, y: r.top + y / c.height * r.height };
      }, [second.x, second.y]);
      if (vp.mobile) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(300);
    }
    q = await probe(page);
    check('hint stays hidden for the rest of the picture', !q.visible);

    // ── 4: next picture → hint again; free colour mode → hint, any colour fills
    pic = await fixture(ctx, 'dog');
    await draw(page, 'dog');
    p = await probe(page);
    check('new picture: hint back, colour pre-selected', p.visible && !p.filled && p.selected === p.needs, `selected ${p.selected}, needs ${p.needs}`);
    await page.locator('#go-free-btn').dispatchEvent('click');
    await page.waitForTimeout(800);
    p = await probe(page);
    check('free mode: hint shown', p.freeMode && p.visible);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, `hint-${vp.name}--3-free.png`) });
    if (vp.mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(500);
    q = await probe(page);
    check('free mode: tap fills, hint gone', q.filled && !q.visible);

    // Beacon batches are sent on a timer / page hide: force a flush.
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(800);
    const ff = events.filter((e) => e === 'first_fill').length;
    const po = events.filter((e) => e === 'picture_open').length;
    check('first_fill sent once per picture', ff === 2, `first_fill ${ff}, picture_open ${po}`);
    check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
}
run().catch((e) => { console.error(e); process.exit(1); });
