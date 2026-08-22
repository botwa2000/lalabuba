#!/usr/bin/env node
// make-social-carousel.js — Instagram how-to carousel (5 slides, 1080×1350 each)
// Slides:
//   01_hook     — hero colored image (grab-scroll hook)
//   02_step1    — App home screenshot "Type What You Want"
//   03_step2    — Generating state screenshot "AI Creates It Instantly"
//   04_step3    — Canvas/coloring screenshot "Color It Your Way"
//   05_cta      — 4-image results montage "Free · No Account · No Ads"
//
// Usage: node scripts/make-social-carousel.js

'use strict';
const sharp  = require('../node_modules/sharp');
const path   = require('path');
const fs     = require('fs');

const ROOT = path.join(__dirname, '..');
const LIB  = path.join(ROOT, 'docs', 'coloring-page-library');
const OUT  = path.join(ROOT, 'docs', 'social-content', 'carousels', 'how-it-works');

const W = 1080, H = 1350; // Instagram carousel 4:5
const RAW = path.join(ROOT, 'store_assets', 'raw');

fs.mkdirSync(OUT, { recursive: true });

// ─── Color palette ────────────────────────────────────────────────────────────
const PALETTE = [
  [255, 213,  79], [77, 182, 172], [240, 120, 130],
  [129, 199, 132], [100, 181, 246], [206, 147, 216],
  [255, 171,  64], [161, 216, 132],
];

function autoColorize(rawBuf, width, height) {
  const n    = width * height;
  const pix  = new Uint8ClampedArray(rawBuf.buffer, rawBuf.byteOffset, rawBuf.length);
  const out  = Buffer.from(rawBuf);
  const vis  = new Uint8Array(n);
  const q    = new Int32Array(n);
  let colorIdx = 0;

  function isWhite(idx) {
    const o = idx << 2;
    return 0.299 * pix[o] + 0.587 * pix[o+1] + 0.114 * pix[o+2] >= 190;
  }
  function isLine(idx) {
    const o = idx << 2;
    return 0.299 * pix[o] + 0.587 * pix[o+1] + 0.114 * pix[o+2] < 130;
  }

  for (let i = 0; i < n; i++) {
    if (vis[i]) continue;
    vis[i] = 1;
    if (!isWhite(i)) continue;
    let head = 0, tail = 0;
    q[tail++] = i;
    const region = [];
    while (head < tail) {
      const idx = q[head++];
      region.push(idx);
      const x = idx % width, y = (idx - x) / width;
      for (const nb of [x>0?idx-1:-1, x<width-1?idx+1:-1, y>0?idx-width:-1, y<height-1?idx+width:-1]) {
        if (nb >= 0 && !vis[nb]) { vis[nb] = 1; if (isWhite(nb)) q[tail++] = nb; }
      }
    }
    if (region.length >= 400) {
      const [cr,cg,cb] = PALETTE[colorIdx++ % PALETTE.length];
      for (const idx of region) { const o=idx<<2; out[o]=cr; out[o+1]=cg; out[o+2]=cb; out[o+3]=255; }
    }
  }
  for (let i = 0; i < n; i++) {
    if (isLine(i)) { const o=i<<2; out[o]=pix[o]; out[o+1]=pix[o+1]; out[o+2]=pix[o+2]; out[o+3]=255; }
  }
  return out;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function svgSlideOverlay({ topLabel, headline, subtext, showPill, accentHex = '#4A90D9', badgeRight = false }) {
  const parts = [];
  // Top label pill (step indicator or hook tag)
  if (topLabel) {
    const bw = topLabel.length * 18 + 60;
    const bx = badgeRight ? W - bw - 40 : 40;
    parts.push(`
      <rect x="${bx}" y="40" width="${bw}" height="50" rx="25" fill="${esc(accentHex)}" opacity="0.92"/>
      <text x="${bx + bw / 2}" y="72" font-family="Segoe UI, Arial, sans-serif" font-size="26"
        font-weight="700" fill="white" text-anchor="middle">${esc(topLabel)}</text>`);
  }
  // Bottom gradient band
  if (headline) {
    parts.push(`
      <defs>
        <linearGradient id="btm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.72"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${H - 280}" width="${W}" height="280" fill="url(#btm)"/>
      <text x="60" y="${H - 200}" font-family="Segoe UI, Arial, sans-serif" font-size="52"
        font-weight="800" fill="white">${esc(headline)}</text>`);
    if (subtext) {
      parts.push(`
        <text x="60" y="${H - 130}" font-family="Segoe UI, Arial, sans-serif" font-size="34"
          font-weight="400" fill="rgba(255,255,255,0.88)">${esc(subtext)}</text>`);
    }
  }
  // Bottom pill
  if (showPill) {
    parts.push(`
      <rect x="${(W-320)/2}" y="${H - 70}" width="320" height="50" rx="25" fill="${esc(accentHex)}" opacity="0.9"/>
      <text x="${W/2}" y="${H - 38}" font-family="Segoe UI, Arial, sans-serif" font-size="24"
        font-weight="700" fill="white" text-anchor="middle">🖍 lalabuba.com</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
}

// ─── Slide builders ───────────────────────────────────────────────────────────

// Slide 1: Hook — large colored coloring page (dinosaur)
async function makeSlide01() {
  const srcPath = path.join(LIB, 'dinosaur', 'dinosaur-easy-1704707776.png');
  const meta    = await sharp(srcPath).metadata();
  const srcW = meta.width, srcH = meta.height;
  // Scale to fit within W×(H-200) leaving 200px for text band at bottom
  const imgArea = H - 200;
  const scale   = Math.min(W / srcW, imgArea / srcH);
  const dispW   = Math.round(srcW * scale);
  const dispH   = Math.round(srcH * scale);
  const offsetX = Math.round((W - dispW) / 2);
  const offsetY = 0;

  const rawBuf     = await sharp(srcPath)
    .resize(dispW, dispH, { fit: 'fill' })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .ensureAlpha().raw().toBuffer();
  const coloredRaw = autoColorize(rawBuf, dispW, dispH);
  const coloredBuf = await sharp(coloredRaw, { raw: { width: dispW, height: dispH, channels: 4 } })
    .png({ compressionLevel: 5 }).toBuffer();

  const overlay = svgSlideOverlay({
    topLabel: '🎨 FREE COLORING APP',
    headline: 'Turn Any Idea Into',
    subtext:  'a Coloring Page — Instantly!',
    showPill: true,
    accentHex: '#2E7D32',
  });

  const outPath = path.join(OUT, 'slide_01_hook.png');
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 245, b: 230 } } })
    .composite([
      { input: coloredBuf,                         top: offsetY, left: offsetX },
      { input: Buffer.from(overlay), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 6 }).toFile(outPath);
  console.log(`  ✓ slide_01_hook.png`);
}

// Helper: load a Flutter phone screenshot, crop to 4:5 ratio from top, scale to W×appArea
async function phoneScreenshotBuf(filename, appAreaH) {
  const src  = path.join(RAW, filename);
  const meta = await sharp(src).metadata();
  // Crop to 4:5 ratio from top (removes bottom navigation / blank space)
  const cropH = Math.round(meta.width * (H / W)); // width × (1350/1080) = same 4:5 ratio
  const useCropH = Math.min(cropH, meta.height);
  const cropped = await sharp(src)
    .extract({ left: 0, top: 0, width: meta.width, height: useCropH })
    .png().toBuffer();
  // Scale to fit in W×appAreaH
  const scaleF = Math.min(W / meta.width, appAreaH / useCropH);
  const appW   = Math.round(meta.width  * scaleF);
  const appH   = Math.round(useCropH    * scaleF);
  return { buf: await sharp(cropped).resize(appW, appH, { fit: 'fill' }).png().toBuffer(), appW, appH };
}

// Slide 2: Step 1 — home UI with "cat doing yoga" typed (Flutter screenshot)
async function makeSlide02() {
  const appArea = H - 180;
  const { buf, appW, appH } = await phoneScreenshotBuf('phone_gen_loading.png', appArea);
  const appX = Math.round((W - appW) / 2);
  const appY = 0;

  const overlay = svgSlideOverlay({
    topLabel: 'Step 1',
    headline: 'Type What You Want',
    subtext:  'Any word, any idea — just type it!',
    showPill: true,
    accentHex: '#1565C0',
  });

  const outPath = path.join(OUT, 'slide_02_type.png');
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 235, g: 244, b: 255 } } })
    .composite([
      { input: buf, top: appY, left: appX },
      { input: Buffer.from(overlay), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 6 }).toFile(outPath);
  console.log(`  ✓ slide_02_type.png`);
}

// Slide 3: Step 2 — loading/generating state (Flutter screenshot)
async function makeSlide03() {
  const appArea = H - 180;
  const { buf, appW, appH } = await phoneScreenshotBuf('phone_coloring_canvas.png', appArea);
  const appX = Math.round((W - appW) / 2);
  const appY = 0;

  const overlay = svgSlideOverlay({
    topLabel: 'Step 2',
    headline: 'AI Creates It Instantly',
    subtext:  'Unique coloring page in seconds',
    showPill: true,
    accentHex: '#6A1B9A',
  });

  const outPath = path.join(OUT, 'slide_03_generate.png');
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 245, g: 238, b: 255 } } })
    .composite([
      { input: buf, top: appY, left: appX },
      { input: Buffer.from(overlay), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 6 }).toFile(outPath);
  console.log(`  ✓ slide_03_generate.png`);
}

// Slide 4: Step 3 — coloring canvas (Flutter screenshot)
async function makeSlide04() {
  // appArea reduced (H-260 vs H-180) so canvas bottom clears the gradient band (starts at H-280)
  // badge moved right so it doesn't overlap the app's back button (top-left of screenshot)
  const appArea = H - 260;
  const { buf, appW, appH } = await phoneScreenshotBuf('phone_coloring_progress.png', appArea);
  const appX = Math.round((W - appW) / 2);
  const appY = 0;

  const overlay = svgSlideOverlay({
    topLabel:   'Step 3',
    headline:   'Color It Your Way',
    subtext:    'Tap to fill · Paint free · Save & share',
    showPill:   true,
    accentHex:  '#E65100',
    badgeRight: true,
  });

  const outPath = path.join(OUT, 'slide_04_color.png');
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 248, b: 238 } } })
    .composite([
      { input: buf, top: appY, left: appX },
      { input: Buffer.from(overlay), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 6 }).toFile(outPath);
  console.log(`  ✓ slide_04_color.png`);
}

// Slide 5: Results montage (2×2 grid) + CTA
async function makeSlide05() {
  // Pick 4 colored images from library
  const sources = [
    { topic: 'dinosaur', src: 'dinosaur-easy-1704707776.png' },
    { topic: 'cat',      src: 'cat-easy-1005447403.png' },
    { topic: 'unicorn',  src: 'unicorn-easy-282889560.jpg' },
    { topic: 'rocket',   src: 'rocket-easy-1224668489.png' },
  ];

  const CELL  = 520; // each cell in the 2×2 grid
  const GAP   = 20;
  const GRID_W = 2 * CELL + GAP;
  const GRID_H = 2 * CELL + GAP;
  const gridX  = Math.round((W - GRID_W) / 2);
  const gridY  = 160;

  const layers = [];

  // Background
  // Grid overlay with rounded cells is handled by composites

  for (let i = 0; i < sources.length; i++) {
    const { topic, src } = sources[i];
    const srcPath = path.join(LIB, topic, src);
    const meta    = await sharp(srcPath).metadata();

    const scale   = CELL / Math.max(meta.width, meta.height);
    const dW      = Math.round(meta.width  * scale);
    const dH      = Math.round(meta.height * scale);

    const rawBuf     = await sharp(srcPath)
      .resize(dW, dH, { fit: 'fill' })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .ensureAlpha().raw().toBuffer();
    const coloredRaw = autoColorize(rawBuf, dW, dH);
    const cellBuf    = await sharp(coloredRaw, { raw: { width: dW, height: dH, channels: 4 } })
      .flatten({ background: { r: 255, g: 245, b: 230 } })
      .resize(CELL, CELL, { fit: 'contain', background: { r: 255, g: 245, b: 230 } })
      .png().toBuffer();

    const col = i % 2, row = Math.floor(i / 2);
    const cx  = gridX + col * (CELL + GAP);
    const cy  = gridY + row * (CELL + GAP);
    layers.push({ input: cellBuf, top: cy, left: cx });
  }

  // Text overlay
  const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <text x="${W/2}" y="110" font-family="Segoe UI, Arial, sans-serif" font-size="52"
      font-weight="800" fill="#1A1A2E" text-anchor="middle">Kids Love It!</text>
    <text x="${W/2}" y="${gridY + GRID_H + 70}" font-family="Segoe UI, Arial, sans-serif" font-size="38"
      font-weight="700" fill="#333" text-anchor="middle">✅ 100% Free</text>
    <text x="${W/2}" y="${gridY + GRID_H + 120}" font-family="Segoe UI, Arial, sans-serif" font-size="30"
      font-weight="400" fill="#555" text-anchor="middle">No account · No ads · Instant</text>
    <rect x="${(W-340)/2}" y="${H-90}" width="340" height="60" rx="30" fill="#2E7D32"/>
    <text x="${W/2}" y="${H-50}" font-family="Segoe UI, Arial, sans-serif" font-size="26"
      font-weight="700" fill="white" text-anchor="middle">🖍 Try Free at lalabuba.com</text>
  </svg>`;
  layers.push({ input: Buffer.from(textSvg), top: 0, left: 0 });

  const outPath = path.join(OUT, 'slide_05_cta.png');
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 250, b: 245 } } })
    .composite(layers)
    .png({ compressionLevel: 6 }).toFile(outPath);
  console.log(`  ✓ slide_05_cta.png`);
}

// ─── Entry ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n── Slide 01 (hook / colored art) ──');
  await makeSlide01();

  console.log('\n── Slide 05 (results montage) ──');
  await makeSlide05();

  console.log('\n── Slides 02-04 (Flutter phone screenshots) ──');
  await makeSlide02();
  await makeSlide03();
  await makeSlide04();

  console.log(`\nDone. Slides saved to docs/social-content/carousels/how-it-works/`);
}

main().catch(e => { console.error(e); process.exit(1); });
