// store-listings/generate.js
// Run from project root: node store-listings/generate.js
'use strict';
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const ROOT = path.resolve(__dirname, '..');
const RAW  = path.join(ROOT, 'store_assets', 'raw');
const OUT  = path.join(ROOT, 'store-listings');

// ─── Text helpers ─────────────────────────────────────────────────────────────
function escXml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function wrap(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length <= maxChars) { cur = test; }
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ─── Overlay SVG ─────────────────────────────────────────────────────────────
// textFrac: 0.5 = vertically centred in overlay (default)
function makeOverlay(w, h, titleLines, subLines, tPx, sPx, textFrac = 0.5) {
  const lhT = tPx * 1.22;
  const lhS = sPx * 1.38;
  const gap = tPx * 0.45;
  const totalH = titleLines.length * lhT + gap + subLines.length * lhS;
  let y = (h * textFrac - totalH / 2) + tPx * 0.82;

  const elems = [];
  for (const line of titleLines) {
    elems.push(`  <text x="${w/2}" y="${Math.round(y)}" text-anchor="middle"
      font-family="Arial,Helvetica,sans-serif" font-size="${tPx}" font-weight="700"
      fill="#ffffff" stroke="#00000044" stroke-width="${Math.max(1, Math.round(tPx * 0.06))}"
      paint-order="stroke">${escXml(line)}</text>`);
    y += lhT;
  }
  y += gap;
  for (const line of subLines) {
    elems.push(`  <text x="${w/2}" y="${Math.round(y)}" text-anchor="middle"
      font-family="Arial,Helvetica,sans-serif" font-size="${sPx}"
      fill="rgba(255,255,255,0.88)">${escXml(line)}</text>`);
    y += lhS;
  }

  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000000" stop-opacity="0"/>
      <stop offset="32%"  stop-color="#2d0e99" stop-opacity="0.36"/>
      <stop offset="100%" stop-color="#2d0e99" stop-opacity="0.76"/>
    </linearGradient>
    <filter id="ts" x="-5%" y="-25%" width="110%" height="150%">
      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#000000" flood-opacity="0.70"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <g filter="url(#ts)">
${elems.join('\n')}
  </g>
</svg>`);
}

// ─── Screens ─────────────────────────────────────────────────────────────────
// Each screen has:
//   name, phone, tablet — raw source filenames (in store_assets/raw/)
//   title, subtitle     — overlay text
//   positions           — optional { phone, tablet } crop anchor override
//                         'top' (default) | 'center' | 'left' | 'right'
const SCREENS = [
  {
    name:      '01_home',
    phone:     'phone_port_01_home.png',
    tablet:    'tablet_land_home_fresh.png',
    positions: { tablet: 'left' },
    title:     'Any picture, unique for your child.',
    subtitle:  'Type any idea — AI makes a one-of-a-kind drawing in seconds',
  },
  {
    name:      '02_coloring',
    phone:     'phone_port_02_coloring.png',
    tablet:    'tablet_land_02_coloring_canvas.png',
    positions: { tablet: 'top' },
    title:     'Tap a number. Pick a color. Done.',
    subtitle:  'No instructions needed — kids just get it',
  },
  {
    name:      '03_explore',
    phone:     'phone_port_04_explore.png',
    tablet:    'tablet_land_explore_hub.png',
    positions: { tablet: 'left' },
    title:     'Thousands of topics. All free.',
    subtitle:  'Dragons, unicorns, space — pick anything and start coloring',
  },
  {
    name:      '04_rewards',
    phone:     'phone_port_04_treehouse.png',
    tablet:    'tablet_land_rewards.png',
    positions: { tablet: 'left' },
    title:     'Color more, unlock more.',
    subtitle:  'Earn badges, crayon packs, and a pet companion as you go',
  },
  {
    name:          '05_mascot',
    phone:         'phone_port_05_mascot.png',
    tablet:        'tablet_land_mascot.png',
    positions:     { tablet: 'left' },
    title:         'Pick a pet. Dress it up.',
    subtitle:      'Unlock hats, accessories, and expressions for your companion',
    ovFracOverride: { tablet: 0.50, phone: 0.45 },
  },
  {
    name:      '06_scenes',
    phone:     'phone_port_06_canvas.png',
    tablet:    'tablet_land_scenes.png',
    positions: { tablet: 'left' },
    title:     'Bring your art to life.',
    subtitle:  'Place your colored art as stickers in magical scenes',
  },
  {
    name:      '07_journal',
    phone:     'phone_port_07_journal.png',
    tablet:    'tablet_land_07_journal.png',
    positions: { tablet: 'left' },
    title:     'Every masterpiece saved.',
    subtitle:  'Flip back through your art and watch your collection grow',
  },
  {
    name:      '08_community',
    phone:     'phone_port_08_community.png',
    tablet:    'tablet_land_community.png',
    positions: { tablet: 'left' },
    title:     'Share art with kids everywhere.',
    subtitle:  'See what others made, share your own, get inspired',
  },
];

// ─── Output targets ───────────────────────────────────────────────────────────
//   dir        output subfolder (under store-listings/)
//   w, h       final pixel dimensions
//   src        'phone' or 'tablet' — which raw file to use
//   ovFrac     fraction of height used by the gradient overlay
//   tPx/sPx    title / subtitle font size in px
//   tCh/sCh    max chars per line for word-wrap
const TARGETS = [
  // Google Play — phone portrait 9:16
  { dir: 'google-play/phone',  w: 1080, h: 1920, src: 'phone',  ovFrac: 0.27, tPx: 52, sPx: 28, tCh: 30, sCh: 43 },
  // Google Play — 10" tablet landscape
  { dir: 'google-play/tablet', w: 2560, h: 1600, src: 'tablet', ovFrac: 0.27, tPx: 78, sPx: 43, tCh: 36, sCh: 60 },
  // App Store — iPhone 6.7" Pro Max (also accepted for 6.5")
  { dir: 'app-store/iphone',   w: 1290, h: 2796, src: 'phone',  ovFrac: 0.23, tPx: 64, sPx: 36, tCh: 35, sCh: 60 },
  // App Store — iPad Pro 12.9" landscape (matches tablet landscape source, minimal crop)
  { dir: 'app-store/ipad',     w: 2732, h: 2048, src: 'tablet', ovFrac: 0.27, tPx: 78, sPx: 43, tCh: 36, sCh: 60 },
];

// ─── Core composite ───────────────────────────────────────────────────────────
async function composite(srcPath, target, screen) {
  const { w, h, dir, tPx, sPx, tCh, sCh, src } = target;
  const ovFrac = screen.ovFracOverride?.[src] ?? target.ovFrac;

  const srcMeta = await sharp(srcPath).metadata();
  const srcIsLandscape = srcMeta.width > srcMeta.height;
  const targetIsPortrait = h > w;

  let baseBuffer;
  let ovH;
  let textFrac;

  if (srcIsLandscape && targetIsPortrait) {
    // Cover-crop the landscape source into the upper portion of the portrait frame,
    // keeping the left edge (position:'left') and accepting a right-side crop.
    // Dynamic height: as tall as possible while keeping ≥55% of source width visible.
    // This shows 52-60% of the portrait frame as real content vs 29-35% with full-width letterbox.
    const minWidthFrac = 0.55;
    const maxByWidth = Math.round((w * srcMeta.height) / (minWidthFrac * srcMeta.width));
    const screenH = Math.min(maxByWidth, Math.round(h * 0.60));
    ovH = Math.round(h * ovFrac);
    // Blurred fill covers the FULL remaining space (screenH → h) so the gradient's
    // transparent top fades in over colour, not bare black canvas.
    const fillH = h - screenH;

    const scaledBuf = await sharp(srcPath)
      .resize(w, screenH, { fit: 'cover', position: 'left' })
      .png()
      .toBuffer();

    const fillBuf = await sharp(srcPath)
      .resize(w, fillH, { fit: 'cover', position: 'bottom' })
      .blur(22)
      .modulate({ brightness: 0.70 })
      .png()
      .toBuffer();

    const layers = [
      { input: scaledBuf, top: 0,       left: 0 },
      { input: fillBuf,   top: screenH, left: 0 },
    ];

    baseBuffer = await sharp({
      create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
    })
      .composite(layers)
      .png()
      .toBuffer();

    textFrac = 0.5;
  } else {
    // Normal cover-crop for same-orientation or portrait-to-portrait
    const position = screen.positions?.[src] ?? 'top';
    baseBuffer = await sharp(srcPath)
      .resize(w, h, { fit: 'cover', position })
      .png()
      .toBuffer();
    ovH = Math.round(h * ovFrac);
    textFrac = 0.5;        // centre text in the overlay (original behaviour)
  }

  const overlay = makeOverlay(
    w, ovH,
    wrap(screen.title, tCh),
    wrap(screen.subtitle, sCh),
    tPx, sPx, textFrac
  );

  const outFile = path.join(OUT, dir, `${screen.name}.png`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  await sharp(baseBuffer)
    .composite([{ input: overlay, top: h - ovH, left: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(outFile);

  return outFile;
}

// ─── Entry point ─────────────────────────────────────────────────────────────
async function main() {
  console.log('Generating store listing screenshots...\n');

  for (const screen of SCREENS) {
    console.log(`▸ ${screen.name}  "${screen.title}"`);
    for (const target of TARGETS) {
      const rawFile = screen[target.src];
      const srcPath = path.join(RAW, rawFile);
      if (!fs.existsSync(srcPath)) {
        console.log(`    ⚠ SKIP ${target.dir} — missing: ${rawFile}`);
        continue;
      }
      const out = await composite(srcPath, target, screen);
      console.log(`    ✓ ${path.relative(ROOT, out)}`);
    }
  }

  console.log('\n✓ All done. Output in store-listings/');
}

main().catch(e => { console.error(e); process.exit(1); });
