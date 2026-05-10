// Comprehensive screenshot script — all critical viewports + states
const puppeteer = require('C:/Users/Alexa/AppData/Local/npm-cache/_npx/7d92d9a2d2ccc630/node_modules/puppeteer');
const EXEC = 'C:/Users/Alexa/.cache/puppeteer/chrome/win64-148.0.7778.97/chrome-win64/chrome.exe';
const OUT = 'C:/Users/Alexa/OneDrive/Dev/lalabuba/screenshots/audit';
const fs = require('fs');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  // S26 Ultra landscape (CSS viewport ~1040x480)
  { w: 1040, h: 480, name: 's26-land' },
  // S26 Ultra portrait
  { w: 480, h: 1040, name: 's26-port' },
  // Standard phone landscape (iPhone 15 landscape)
  { w: 844, h: 390, name: 'iphone-land' },
  // Standard phone portrait
  { w: 390, h: 844, name: 'iphone-port' },
  // Tablet landscape
  { w: 1024, h: 768, name: 'tablet-land' },
  // Desktop
  { w: 1280, h: 800, name: 'desktop' },
];

async function shoot(page, name, label) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${label}`);
}

async function injectColorState(page) {
  // Step 1: reveal hint + zoom so layout settles before we size the canvas bitmap
  await page.evaluate(() => {
    document.getElementById('preview-stage')?.classList.remove('empty');
    document.getElementById('coloring-hint')?.removeAttribute('hidden');
    document.getElementById('zoom-controls')?.removeAttribute('hidden');
    document.querySelectorAll('.action-btn, .mode-btn').forEach(b => b.disabled = false);
    ['download-button','print-button','share-button','share-artwork-btn'].forEach(id => {
      const el = document.getElementById(id); if (el) el.disabled = false;
    });
    document.body.offsetHeight; // force reflow so CSS layout settles
  });
  await new Promise(r => setTimeout(r, 150));

  // Step 2: unhide canvas, wait two frames for CSS to settle, then size bitmap to match
  const canvasSize = await page.evaluate(() => new Promise(resolve => {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) { resolve(300); return; }
    canvas.hidden = false;
    // Two rAF passes: first triggers layout, second reads stable dimensions
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const r = canvas.getBoundingClientRect();
      resolve(Math.min(Math.round(r.width) || 300, Math.round(r.height) || 300, 400));
    }));
  }));

  await page.evaluate((size) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
      <rect width="100" height="100" fill="white"/>
      <g fill="none" stroke="#111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="50" cy="38" r="22"/>
        <rect x="28" y="60" width="44" height="32"/>
        <line x1="38" y1="60" x2="38" y2="92"/>
        <line x1="62" y1="60" x2="62" y2="92"/>
      </g>
    </svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const canvas = document.getElementById('preview-canvas');
    const img = new Image();
    img.onload = () => {
      canvas.width  = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.src = url;
  }, canvasSize);
  await new Promise(r => setTimeout(r, 350));
}

async function injectColors(page) {
  // Populate the palette strip with 12 test color swatches
  await page.evaluate(() => {
    const colors = ['#e63946','#f4a261','#2a9d8f','#e9c46a','#264653','#457b9d',
                    '#a8dadc','#f1faee','#6d6875','#b5838d','#e5989b','#ffb4a2'];
    const list = document.getElementById('legend-list');
    if (!list) return;
    list.innerHTML = '';
    // ERASE tool
    const eraseItem = document.createElement('li');
    eraseItem.className = 'legend-tool-item';
    eraseItem.innerHTML = `<button class="tool-btn erase-btn" type="button">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 20H7L3 16l10-10 7 7-3 3"/>
        <path d="M6.2 6.2l11.6 11.6"/>
      </svg>
      ERASE
    </button>`;
    list.appendChild(eraseItem);
    // Sep
    const sep = document.createElement('li');
    sep.className = 'legend-sep';
    list.appendChild(sep);
    // Color swatches
    colors.forEach((c, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<button class="color-swatch${i===0?' active':''}" style="--c:${c}" type="button" aria-label="Color ${i+1}"></button>`;
      list.appendChild(li);
    });
    // Sep + custom color
    const sep2 = document.createElement('li');
    sep2.className = 'legend-sep';
    list.appendChild(sep2);
    const pickerItem = document.createElement('li');
    pickerItem.className = 'legend-tool-item';
    pickerItem.innerHTML = `<button class="tool-btn picker-btn" type="button" style="--c:#e63946">
      <span class="picker-label">CUSTOM COLOUR</span>
      <span class="picker-dot" style="background:#e63946"></span>
    </button>`;
    list.appendChild(pickerItem);
  });
  await new Promise(r => setTimeout(r, 100));
}

async function showCookieBanner(page) {
  await page.evaluate(() => {
    const b = document.getElementById('cookie-banner');
    if (b) { b.hidden = false; b.classList.add('cookie-banner--visible'); }
  });
  await new Promise(r => setTimeout(r, 200));
}

const GOTO_OPTS = { waitUntil: 'domcontentloaded', timeout: 15000 };

async function loadFresh(page, vp) {
  await page.setViewport({ width: vp.w, height: vp.h });
  await page.goto('http://localhost:3000', GOTO_OPTS);
  await new Promise(r => setTimeout(r, 400)); // let fonts/CSS settle
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: EXEC,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const vp of VIEWPORTS) {
    console.log(`\n▶ ${vp.name} (${vp.w}×${vp.h})`);
    const page = await browser.newPage();

    // --- STATE 1: Empty (no image)
    await loadFresh(page, vp);
    await shoot(page, `${vp.name}-1-empty`, '1-empty');

    // --- STATE 2: Empty + cookie banner
    await loadFresh(page, vp);
    await showCookieBanner(page);
    await shoot(page, `${vp.name}-2-cookie`, '2-cookie banner');

    // --- STATE 3: With generated image + palette
    await loadFresh(page, vp);
    await injectColors(page);
    await injectColorState(page);
    await shoot(page, `${vp.name}-3-with-image`, '3-with image');

    // --- STATE 4: With image + Paint mode active
    await loadFresh(page, vp);
    await injectColors(page);
    await injectColorState(page);
    await page.evaluate(() => {
      document.getElementById('mode-paint-btn')?.classList.add('active');
      document.getElementById('mode-tap-btn')?.classList.remove('active');
    });
    await shoot(page, `${vp.name}-4-paint-mode`, '4-paint mode');

    await page.close();
  }

  await browser.close();
  console.log('\n✅ All screenshots done → screenshots/audit/');
})();
