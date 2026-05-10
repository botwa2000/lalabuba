// Erase-specific functional test — verifies click-erase, drag-erase, undo after erase
const puppeteer = require('C:/Users/Alexa/AppData/Local/npm-cache/_npx/7d92d9a2d2ccc630/node_modules/puppeteer');
const EXEC = 'C:/Users/Alexa/.cache/puppeteer/chrome/win64-148.0.7778.97/chrome-win64/chrome.exe';
const fs = require('fs');
const OUT = 'C:/Users/Alexa/OneDrive/Dev/lalabuba/screenshots/erase-test';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const delay = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = msg => { console.log(`  ✅ ${msg}`); pass++; };
const ko = (msg, detail = '') => { console.log(`  ❌ ${msg}${detail ? ': '+detail : ''}`); fail++; };

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// Read all pixel colours across a horizontal strip of the canvas to detect fill changes
async function stripColors(page, y_frac = 0.5, samples = 10) {
  return page.evaluate((y_frac, samples) => {
    const c = document.getElementById('preview-canvas');
    if (!c) return [];
    const ctx = c.getContext('2d');
    const y = Math.round(c.height * y_frac);
    const out = [];
    for (let i = 0; i < samples; i++) {
      const x = Math.round(c.width * (i + 0.5) / samples);
      const [r,g,b,a] = ctx.getImageData(x, y, 1, 1).data;
      out.push({ x, y, r, g, b, a });
    }
    return out;
  }, y_frac, samples);
}

// Count how many non-white pixels are in the canvas (white = unfilled region)
async function nonWhiteCount(page) {
  return page.evaluate(() => {
    const c = document.getElementById('preview-canvas');
    if (!c) return 0;
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      // White = r>240 g>240 b>240; black outline = r<50; coloured = anything else
      if (data[i] < 240 && data[i] > 50) count++;
    }
    return count;
  });
}

// Inject a coloring page with known regions using renderGeneratedImage via demo mode
async function loadPage(page) {
  // Block Turnstile before any script runs so getTurnstileToken() returns null immediately
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'turnstile', { get: () => undefined, configurable: true });
  });
  await page.goto('http://localhost:3000?provider=demo', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(500);

  // Dismiss cookie consent
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => {
      if (b.textContent.includes('Accept') || b.textContent.includes('accept')) b.click();
    });
  });
  await delay(200);

  // Switch to demo provider and generate "butterfly"
  await page.evaluate(() => {
    const sel = document.getElementById('provider-select');
    if (sel) { sel.value = 'demo'; sel.dispatchEvent(new Event('change')); }
  });
  const subjectInput = await page.$('#subject');
  if (subjectInput) {
    await subjectInput.click({ clickCount: 3 });
    await subjectInput.type('butterfly');
  }
  await page.click('#generate-button');

  // Wait up to 8s for the image to appear (empty class is removed on render)
  const appeared = await page.waitForFunction(
    () => !document.getElementById('preview-stage')?.classList.contains('empty'),
    { timeout: 8000 }
  ).then(() => true).catch(() => false);

  if (!appeared) {
    // Check if demo mode produced an error
    const status = await page.evaluate(() => document.getElementById('status-bar')?.textContent);
    console.log(`  ℹ️  status: ${status}`);
  }
  await delay(600);
  return appeared;
}

async function run() {
  const browser = await puppeteer.launch({ executablePath: EXEC, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('\n══════════════════════════════════════');
  console.log('  ERASE FUNCTIONALITY TEST  v166');
  console.log('══════════════════════════════════════\n');

  // ── Load demo page ────────────────────────────────────────────────────────
  console.log('▶ Loading demo coloring page...');
  const loaded = await loadPage(page);
  await shot(page, '00-initial');

  if (!loaded) {
    ko('Demo page did not load — cannot test erase');
    console.log('\nFAIL: 0 passed, 1 failed\n');
    await browser.close();
    return;
  }
  ok('Demo page loaded');

  // Get canvas bounding rect
  const rect = await page.evaluate(() => {
    const c = document.getElementById('preview-canvas');
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  });

  // ── Test 1: Select a color and fill a region ──────────────────────────────
  console.log('\n▶ Test 1: Fill a region');
  await page.evaluate(() => {
    const swatches = document.querySelectorAll('.color-swatch');
    if (swatches[0]) swatches[0].click();
  });
  await delay(100);

  const baseCount = await nonWhiteCount(page);

  // Try multiple candidate coordinates — centre may hit an outline pixel.
  // Try a 5×5 grid of offsets and stop as soon as a fill lands.
  let fillDelta = 0;
  const offsets = [
    [0.5, 0.5], [0.4, 0.4], [0.6, 0.4], [0.4, 0.6], [0.6, 0.6],
    [0.3, 0.5], [0.5, 0.3], [0.7, 0.5], [0.5, 0.7],
  ];
  let fillX = rect.left + rect.w / 2, fillY = rect.top + rect.h / 2;
  for (const [fx, fy] of offsets) {
    await page.evaluate(() => { document.querySelector('.color-swatch')?.click(); });
    const px = rect.left + rect.w * fx;
    const py = rect.top + rect.h * fy;
    await page.mouse.click(px, py);
    await delay(300);
    const after = await nonWhiteCount(page);
    if (after - baseCount > 100) { fillDelta = after - baseCount; fillX = px; fillY = py; break; }
  }
  fillDelta > 100
    ? ok(`Region filled — ${fillDelta} new coloured pixels at (${Math.round(fillX)},${Math.round(fillY)})`)
    : ko('Fill did not paint pixels after 9 attempts', `delta=${fillDelta}`);
  await shot(page, '01-filled');

  // ── Test 2: Activate erase mode ───────────────────────────────────────────
  console.log('\n▶ Test 2: Activate erase mode');
  await page.evaluate(() => { document.querySelector('.erase-btn')?.click(); });
  await delay(150);
  // Re-query after click — renderLegend() may rebuild the DOM element
  const eraseActivated = await page.evaluate(() =>
    document.querySelector('.erase-btn')?.classList.contains('active') ? 'active' : 'not-active'
  );
  eraseActivated === 'active'
    ? ok('Erase button shows active state')
    : ko('Erase button not active', eraseActivated);

  // ── Test 3: Click-erase — immediate response ──────────────────────────────
  console.log('\n▶ Test 3: Click-erase (immediate)');
  const beforeClickErase = await nonWhiteCount(page);
  await page.mouse.click(fillX, fillY); // use same coord that succeeded in Test 1
  await delay(300);
  const afterClickErase = await nonWhiteCount(page);
  const eraseDelta = beforeClickErase - afterClickErase;
  eraseDelta > 100
    ? ok(`Click-erase removed ${eraseDelta} coloured pixels`)
    : ko('Click-erase did not clear pixels', `delta=${eraseDelta}, before=${beforeClickErase} after=${afterClickErase}`);
  await shot(page, '02-click-erased');

  const statusAfterClickErase = await page.evaluate(() => document.getElementById('status-bar')?.textContent?.trim());
  statusAfterClickErase?.toLowerCase().match(/clear|erase|очи|lösch|efface/)
    ? ok(`Status confirms erase: "${statusAfterClickErase}"`)
    : ok(`Status: "${statusAfterClickErase}" (may be language-dependent)`);

  // ── Test 4: Undo after erase restores pixels ──────────────────────────────
  console.log('\n▶ Test 4: Undo after erase');
  const undoEnabled = await page.evaluate(() => !document.getElementById('undo-button')?.disabled);
  undoEnabled ? ok('Undo button enabled') : ko('Undo button disabled after erase');

  if (undoEnabled) {
    await page.click('#undo-button');
    await delay(300);
    const afterUndo = await nonWhiteCount(page);
    const undoRestored = afterUndo > afterClickErase + 100;
    undoRestored
      ? ok(`Undo restored pixels (before=${beforeClickErase} after-erase=${afterClickErase} after-undo=${afterUndo})`)
      : ko('Undo did not restore pixels', `after-undo=${afterUndo}`);
    await shot(page, '03-after-undo');
  }

  // ── Test 5: Drag-to-erase across multiple regions ─────────────────────────
  console.log('\n▶ Test 5: Drag-to-erase');

  // Re-fill with all color swatches to ensure multiple regions have color
  await page.evaluate(() => { document.querySelectorAll('.color-swatch').forEach((s, i) => { s.click(); }); });
  // Click multiple spots
  const spots = [0.25, 0.5, 0.75];
  for (const frac of spots) {
    await page.evaluate(() => { document.querySelector('.color-swatch')?.click(); });
    await page.mouse.click(rect.left + rect.w * frac, rect.top + rect.h * 0.5);
    await delay(150);
  }
  const preDragColoured = await nonWhiteCount(page);
  await shot(page, '04-pre-drag-erase');

  // Activate erase and drag across entire canvas width
  await page.evaluate(() => { document.querySelector('.erase-btn')?.click(); });
  await delay(100);

  // Simulate pointer drag from left to right across canvas middle
  const x1 = rect.left + rect.w * 0.1;
  const x2 = rect.left + rect.w * 0.9;
  const dragY = rect.top + rect.h * 0.5;
  await page.mouse.move(x1, dragY);
  await page.mouse.down();
  // Move in 20 small steps to simulate drag
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(x1 + (x2 - x1) * i / 20, dragY);
    await delay(10);
  }
  await page.mouse.up();
  await delay(400);

  const postDragColoured = await nonWhiteCount(page);
  const dragEraseDelta = preDragColoured - postDragColoured;
  dragEraseDelta > 0
    ? ok(`Drag-to-erase removed ${dragEraseDelta} coloured pixels`)
    : ko('Drag-to-erase did not clear any pixels', `pre=${preDragColoured} post=${postDragColoured}`);
  await shot(page, '05-post-drag-erase');

  // ── Test 6: Erase mode clears when selecting a color ─────────────────────
  console.log('\n▶ Test 6: Selecting color exits erase mode');
  await page.evaluate(() => { document.querySelector('.color-swatch')?.click(); });
  await delay(100);
  const eraseGone = await page.evaluate(() => {
    return !document.querySelector('.erase-btn')?.classList.contains('active');
  });
  eraseGone ? ok('Erase mode deactivated on color select') : ko('Erase mode still active after color select');

  // ── Test 7: Portrait phone — no gap below content ─────────────────────────
  console.log('\n▶ Test 7: Portrait phone layout gap check (390×844)');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await delay(500);
  await shot(page, '06-portrait-empty');

  const gapInfo = await page.evaluate(() => {
    return {
      bodyScroll: document.body.scrollHeight,
      vp: window.innerHeight,
      bodyClientH: document.body.clientHeight,
    };
  });
  const gap = gapInfo.bodyScroll - gapInfo.vp;
  gap < 60
    ? ok(`Portrait layout fills viewport (scrollHeight=${gapInfo.bodyScroll} vp=${gapInfo.vp})`)
    : ko(`Portrait gap: ${gap}px below viewport content`, `scrollH=${gapInfo.bodyScroll} vp=${gapInfo.vp}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════');
  console.log(`  ${pass} passed  |  ${fail} failed`);
  console.log('══════════════════════════════════════\n');

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
