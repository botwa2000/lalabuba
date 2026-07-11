#!/usr/bin/env node
/**
 * Lalabuba — Add playful marketing banners to existing app store screenshots.
 *
 * Overlays a gradient banner (arch top edge + headline + tagline) onto the
 * bottom portion of each screenshot. Reads existing PNGs, writes enhanced
 * versions to -v2 directories at the same dimensions (App Store constraints met).
 *
 * Usage:  node store-assets/add-banners.js
 */
'use strict';
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const ROOT = path.join(__dirname, '..');
const esc  = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ─── Banner copy per screen ────────────────────────────────────────────────────
const SCREENS = {
  '1-create': {
    en: { h: 'Dream It. Draw It.',    s: 'Type it — AI draws it instantly!' },
    de: { h: 'Zeichne es. Male es.',  s: 'KI zeichnet deine Idee sofort!' },
    grad: ['#5c35cc', '#a020c0'],
  },
  '2-color': {
    en: { h: 'Color It Your Way!',    s: 'Tap numbered regions to fill them!' },
    de: { h: 'Male auf deine Art!',   s: 'Tippe Felder an und male los!' },
    grad: ['#0d47a1', '#006064'],
  },
  '3-rewards': {
    en: { h: 'Earn Awesome Rewards!', s: 'Unlock packs, stickers & badges!' },
    de: { h: 'Tolle Belohnungen!',    s: 'Entsperre Stiftsets & Abzeichen!' },
    grad: ['#bf360c', '#e65100'],
  },
  '4-stickers': {
    en: { h: 'Collect Every Badge!',  s: 'New achievements every session!' },
    de: { h: 'Abzeichen sammeln!',    s: 'Neue Erfolge bei jeder Malsitzung!' },
    grad: ['#880e4f', '#c2185b'],
  },
  '5-mascot': {
    en: { h: 'Dress Your Penguin!',   s: 'Decorate with your earned stickers!' },
    de: { h: 'Pinguin anziehen!',     s: 'Dekoriere mit verdienten Stickern!' },
    grad: ['#1b5e20', '#006064'],
  },
};

// ─── SVG banner builder ────────────────────────────────────────────────────────
function makeBanner(w, bh, screenKey, lang) {
  const scr  = SCREENS[screenKey];
  const copy = scr[lang] || scr.en;
  const [c1, c2] = scr.grad;

  // Convex arch: sides sit at y=archRise; peak at y=0 (center of top edge)
  const archRise = Math.round(bh * 0.26);
  const ap = [
    `M0,${archRise}`,
    `C${w*0.20},${archRise*0.06} ${w*0.80},${archRise*0.06} ${w},${archRise}`,
    `L${w},${bh} L0,${bh} Z`,
  ].join(' ');

  // Font sizes — clamp to bh (landscape) and adaptively shrink for long headlines
  // Arial Black avg char width ≈ 0.62 × fontSize; allow 90% of image width
  const hSizeMax  = Math.round(Math.min(w * 0.080, bh * 0.27));
  const hSizeSafe = Math.round((w * 0.90) / (copy.h.length * 0.62));
  const hSize     = Math.min(hSizeMax, hSizeSafe);
  const sSize     = Math.round(Math.min(w * 0.042, bh * 0.15));

  // Text Y — within the flat area below the arch
  const flatTop = archRise;
  const flatH   = bh - archRise;
  const hY = flatTop + Math.round(flatH * 0.38);
  const sY = flatTop + Math.round(flatH * 0.74);

  // Semi-transparent white bubbles for playful texture
  const bubbles = [
    [w*0.04,  bh*0.52, w*0.025],
    [w*0.96,  bh*0.48, w*0.020],
    [w*0.92,  bh*0.80, w*0.014],
    [w*0.07,  bh*0.82, w*0.011],
    [w*0.50,  archRise*0.50, w*0.016],
    [w*0.30,  archRise*0.75, w*0.009],
    [w*0.70,  archRise*0.70, w*0.009],
  ].map(([cx,cy,r]) =>
    `<circle cx="${Math.round(cx)}" cy="${Math.round(cy)}" r="${Math.round(r)}" fill="rgba(255,255,255,0.18)"/>`
  ).join('\n    ');

  // 4-pointed star shapes for sparkle decoration
  function star(cx, cy, r, op) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    const i = Math.round(r * 0.35);
    return `<path d="M${cx},${cy-r} L${cx+i},${cy-i} L${cx+r},${cy} L${cx+i},${cy+i} L${cx},${cy+r} L${cx-i},${cy+i} L${cx-r},${cy} L${cx-i},${cy-i} Z" fill="white" opacity="${op}"/>`;
  }
  const rs = Math.round(w * 0.020);
  const stars = [
    star(w*0.12, bh*0.38, rs,       0.30),
    star(w*0.88, bh*0.44, rs*0.75,  0.24),
    star(w*0.94, bh*0.73, rs*0.55,  0.18),
    star(w*0.06, bh*0.76, rs*0.55,  0.16),
  ].join('\n    ');

  // Subtle white shine stripe at top of arch peak
  const shinePath = `M0,${archRise} C${w*0.20},${archRise*0.06} ${w*0.80},${archRise*0.06} ${w},${archRise} C${w*0.80},${archRise*0.24} ${w*0.20},${archRise*0.24} 0,${archRise} Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${bh}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <path d="${ap}" fill="url(#bg)"/>
  <path d="${shinePath}" fill="rgba(255,255,255,0.07)"/>
  ${bubbles}
  ${stars}
  <text x="${w/2}" y="${hY}"
    font-family="Arial Black,Arial,Helvetica Neue,sans-serif"
    font-weight="900" font-size="${hSize}" fill="white"
    text-anchor="middle" dominant-baseline="middle"
  >${esc(copy.h)}</text>
  <text x="${w/2}" y="${sY}"
    font-family="Arial,Helvetica Neue,sans-serif"
    font-weight="400" font-size="${sSize}" fill="rgba(255,255,255,0.90)"
    text-anchor="middle" dominant-baseline="middle"
  >${esc(copy.s)}</text>
</svg>`;
}

// ─── Per-file processing ───────────────────────────────────────────────────────
async function processFile(inPath, outPath, screenKey, lang) {
  const { width: w, height: h } = await sharp(inPath).metadata();
  const isLandscape = w > h;
  // Landscape banners are taller in proportion since height is the short dimension
  const bannerH = Math.round(h * (isLandscape ? 0.27 : 0.17));

  const svg = Buffer.from(makeBanner(w, bannerH, screenKey, lang), 'utf8');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  await sharp(inPath)
    .composite([{ input: svg, left: 0, top: h - bannerH }])
    .png({ compressionLevel: 7 })
    .toFile(outPath);

  const rel = path.relative(ROOT, outPath).replace(/\\/g, '/');
  process.stdout.write(`  ✓ ${rel}\n`);
}

async function processDir(inDir, outDir, lang) {
  if (!fs.existsSync(inDir)) return;
  const files = fs.readdirSync(inDir).filter(f => f.endsWith('.png') && SCREENS[f.replace('.png','')]);
  for (const f of files)
    await processFile(path.join(inDir, f), path.join(outDir, f), f.replace('.png',''), lang);
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const iosSizes = [
    'iphone_6_9','iphone_6_9_landscape',
    'iphone_6_5','iphone_6_5_landscape',
    'ipad_13','ipad_13_landscape',
  ];
  const playSizes = [
    'phone','phone_landscape',
    'tablet_7','tablet_7_landscape',
    'tablet_10','tablet_10_landscape',
  ];

  for (const lang of ['en','de']) {
    console.log(`\n── App Store ${lang.toUpperCase()} ──────────────────────────`);
    for (const sz of iosSizes)
      await processDir(
        path.join(ROOT,'app-store-assets',lang,sz),
        path.join(ROOT,'app-store-assets-v2',lang,sz), lang);

    console.log(`── Play Store ${lang.toUpperCase()} ─────────────────────────`);
    for (const sz of playSizes)
      await processDir(
        path.join(ROOT,'store-assets/play-store-listing/screenshots',lang,sz),
        path.join(ROOT,'store-assets-v2/play-store-listing/screenshots',lang,sz), lang);
  }
  console.log('\n✅  All banners generated.');
}

main().catch(e => { console.error(e); process.exit(1); });
