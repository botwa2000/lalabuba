#!/usr/bin/env node
// make-social-carousel.js — Instagram/Pinterest "How it works" carousel (v2)
//
// v2 fixes three defects found in v1 (see docs/social-content/manifest.md and
// the 2026-09-20 rewrite notes):
//   1. The old bottom gradient band laid the headline ON TOP of the screenshot,
//      slicing through the idea-card grid on one slide and the coloring canvas
//      on another — the two slides whose entire job was showing the product
//      working. Fixed: strict header-zone (solid color, text) / content-zone
//      (screenshot, always fully visible, never occluded) split.
//   2. Text rendered via SVG <text font-family="..."> depends on host fonts.
//      Fixed: all text goes through scripts/social-lib.js's renderText(),
//      which loads a bundled .ttf directly via sharp/Pango — see that file's
//      header comment for the full investigation.
//   3. SVG <text> never wrapped; long headlines could overflow silently.
//      Fixed: renderText()'s wrapping uses Pango's real text-layout engine,
//      and every headline is checked with assertFits() against its safe box.
//
// Emits BOTH target sizes for every slide (per spec: never crop one ratio into
// another — regenerate at each ratio instead):
//   - Instagram carousel : 1080×1350 (4:5)  → carousels/how-it-works-v2/ig/
//   - Pinterest ratio     : 1000×1500 (2:3)  → carousels/how-it-works-v2/pin/
//
// Usage: node scripts/make-social-carousel.js
'use strict';
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');
const { FONTS, renderText, assertFits, drawCallout } = require('./social-lib');

const ROOT = path.join(__dirname, '..');
const LIB  = path.join(ROOT, 'docs', 'coloring-page-library');
const RAW  = path.join(ROOT, 'store_assets', 'raw');
const OUT_BASE = path.join(ROOT, 'docs', 'social-content', 'carousels', 'how-it-works-v2');

// Two target sizes, same layout logic, different absolute pixels.
const SIZES = [
  { key: 'ig',  W: 1080, H: 1350, dir: path.join(OUT_BASE, 'ig') },
  { key: 'pin', W: 1000, H: 1500, dir: path.join(OUT_BASE, 'pin') },
];

// Brand palette — reused verbatim from make-social-pins.js PINS[].accentHex.
// Do not invent new colours.
const ACCENT = {
  hook:  '#2E7D32', // deep green
  step1: '#1565C0', // deep blue
  step2: '#6A1B9A', // deep purple
  step3: '#E65100', // deep orange
  cta:   '#2E7D32', // deep green (bookends the hook)
};

const PALETTE = [
  [255, 213,  79], [77, 182, 172], [240, 120, 130],
  [129, 199, 132], [100, 181, 246], [206, 147, 216],
  [255, 171,  64], [161, 216, 132],
];

function autoColorize(rawBuf, width, height) {
  const n = width * height;
  const pix = new Uint8ClampedArray(rawBuf.buffer, rawBuf.byteOffset, rawBuf.length);
  const out = Buffer.from(rawBuf);
  const vis = new Uint8Array(n);
  const q = new Int32Array(n);
  let colorIdx = 0;
  const isWhite = idx => { const o = idx << 2; return 0.299*pix[o]+0.587*pix[o+1]+0.114*pix[o+2] >= 190; };
  const isLine  = idx => { const o = idx << 2; return 0.299*pix[o]+0.587*pix[o+1]+0.114*pix[o+2] < 130; };
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

// ─── Shared chrome: header zone + footer pill ──────────────────────────────
// Layout fractions (of H), same for both sizes:
//   0                → HEADER_F           : header zone (solid accent, headline+subtext)
//   HEADER_F         → SAFE_BOTTOM_F      : content zone (screenshot/art, always uncropped)
//   SAFE_BOTTOM_F    → H                  : reserved unsafe margin (IG bottom-UI overlay zone) — footer pill lives just above it
const HEADER_F = 0.26;
const SAFE_BOTTOM_F = 0.852; // ≈1150/1350 — "no essential text below this" per platform spec
const MARGIN = 60; // px, safe-area rule: all text ≥60px from every edge

async function headerZone(W, H, accentHex, { topLabel, headline, subtext }) {
  const headerH = Math.round(H * HEADER_F);
  const layers = [
    { input: await sharp({ create: { width: W, height: headerH, channels: 3, background: hexToRgb(accentHex) } }).png().toBuffer(), top: 0, left: 0 },
  ];

  let cursorY = MARGIN;

  if (topLabel) {
    const { buffer, width, height } = await renderText(topLabel, FONTS.bodyExtraBold, 20, '#ffffff');
    const padX = 18, padY = 10;
    const pillBuf = await sharp({
      create: { width: width + padX * 2, height: height + padY * 2, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.22 } }
    }).png().toBuffer();
    layers.push({ input: pillBuf, top: cursorY, left: MARGIN });
    layers.push({ input: buffer, top: cursorY + padY, left: MARGIN + padX });
    cursorY += height + padY * 2 + 24;
  }

  const headlineSize = W >= 1080 ? 56 : 52;
  const headlineMaxW = W - MARGIN * 2;
  const headlineRes = await renderText(headline, FONTS.displayBold, headlineSize, '#ffffff', { maxWidth: headlineMaxW });
  assertFits(headlineRes, headlineMaxW, headerH - (cursorY - MARGIN) - MARGIN, `headline "${headline}" (${W}x${H})`);
  layers.push({ input: headlineRes.buffer, top: cursorY, left: MARGIN });
  cursorY += headlineRes.height + 14;

  if (subtext) {
    const subSize = W >= 1080 ? 30 : 28;
    const subMaxW = W - MARGIN * 2;
    const subRes = await renderText(subtext, FONTS.bodySemi, subSize, '#F2F2F2', { maxWidth: subMaxW });
    assertFits(subRes, subMaxW, headerH - (cursorY - MARGIN) - MARGIN, `subtext "${subtext}" (${W}x${H})`);
    layers.push({ input: subRes.buffer, top: cursorY, left: MARGIN });
  }

  return { layers, headerH };
}

async function footerPill(W, H, accentHex) {
  const { buffer, width, height } = await renderText('🖍 lalabuba.com', FONTS.bodyExtraBold, 24, '#ffffff');
  const padX = 30, padY = 16;
  const pillW = width + padX * 2, pillH = height + padY * 2;
  const { roundedRectShadow } = require('./social-lib');
  const { buffer: boxBuf, pad } = await roundedRectShadow(pillW, pillH, pillH / 2, accentHex);
  const safeBottom = Math.round(H * SAFE_BOTTOM_F);
  const pillY = safeBottom - pillH - 20; // sits just above the unsafe zone
  const pillX = Math.round((W - pillW) / 2);
  return [
    { input: boxBuf, top: pillY - pad, left: pillX - pad },
    { input: buffer, top: pillY + padY, left: pillX + padX },
  ];
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Fit `contentBuf` (dW×dH) into the content zone [0,headerH]–[W,safeBottom],
// uniformly scaled, NEVER cropped, centered. Returns a composite layer plus
// the on-canvas rect it occupies (so callers can position callouts against it).
async function placeInContentZone(contentBuf, dW, dH, W, H, headerH, { padding = 40, cardBg = null } = {}) {
  const safeBottom = Math.round(H * SAFE_BOTTOM_F);
  const cardPad = 18;
  const shadowPad = 24; // must match roundedRectShadow's internal `pad`
  // Reserve room for the card's own padding + shadow blur margin BEFORE fitting,
  // so the card (fitW + cardPad*2 + shadowPad*2) never exceeds the canvas —
  // sharp's composite() requires every layer buffer to be <= canvas size, it
  // does not auto-crop an oversized one even if centered within bounds.
  const reserve = cardBg ? (cardPad + shadowPad) * 2 : 0;
  // Every slide also draws a footer pill anchored near safeBottom (see
  // footerPill()) — reserve its height so a tall/narrow content crop can
  // never grow the card into that space. Found by direct visual inspection:
  // a tall portrait screenshot crop (slideStep3) hit exactly this, and the
  // footer pill silently painted over the bottom rows of the card.
  const FOOTER_RESERVE = 100;
  const zoneW = W - padding * 2 - reserve;
  const zoneH = safeBottom - headerH - padding * 2 - reserve - FOOTER_RESERVE;
  const scale = Math.min(zoneW / dW, zoneH / dH, 1); // never upscale past native size either
  const fitW = Math.round(dW * scale), fitH = Math.round(dH * scale);
  const x = Math.round((W - fitW) / 2);
  const y = headerH + Math.round((safeBottom - headerH - fitH) / 2);

  const layers = [];
  if (cardBg) {
    const { roundedRectShadow } = require('./social-lib');
    const { buffer: cardBuf, pad } = await roundedRectShadow(fitW + cardPad * 2, fitH + cardPad * 2, 20, cardBg);
    layers.push({ input: cardBuf, top: y - cardPad - pad, left: x - cardPad - pad });
  }
  const resized = await sharp(contentBuf).resize(fitW, fitH, { fit: 'fill' }).png().toBuffer();
  layers.push({ input: resized, top: y, left: x });

  return { layers, rect: { x, y, w: fitW, h: fitH, scale } };
}

// ─── Screenshot source loader ──────────────────────────────────────────────
// Crops a specific y-range chosen BY INSPECTION for each source (see commit
// message / manifest for the reviewed screenshots) so the crop line never
// falls across meaningful UI (idea cards, canvas, palette) — the whole point
// of this rewrite. Never a generic "top N%" crop.
async function loadScreenshotCrop(filename, cropTop, cropBottom) {
  const src = path.join(RAW, filename);
  const meta = await sharp(src).metadata();
  const h = Math.min(cropBottom, meta.height) - cropTop;
  const buf = await sharp(src)
    .extract({ left: 0, top: cropTop, width: meta.width, height: h })
    .png().toBuffer();
  return { buf, w: meta.width, h, srcW: meta.width, srcH: meta.height };
}

// Map a point in the ORIGINAL screenshot's pixel space to its position inside
// a content-zone rect, given the crop window used and the rect's fit scale.
function mapSourcePoint(srcX, srcY, cropTop, rect) {
  return {
    x: rect.x + Math.round(srcX * rect.scale),
    y: rect.y + Math.round((srcY - cropTop) * rect.scale),
  };
}

// ─── Slide builders (one function per slide, called once per SIZE) ────────

async function slideHook(W, H) {
  const srcPath = path.join(LIB, 'dinosaur', 'dinosaur-easy-1704707776.png');
  const meta = await sharp(srcPath).metadata();
  const { layers: headerLayers, headerH } = await headerZone(W, H, ACCENT.hook, {
    topLabel: '🎨 FREE COLORING APP',
    headline: 'Type Any Idea.',
    subtext: 'Get a Coloring Page — Instantly!',
  });

  const rawBuf = await sharp(srcPath).resize(meta.width, meta.height)
    .flatten({ background: { r: 255, g: 255, b: 255 } }).ensureAlpha().raw().toBuffer();
  const coloredRaw = autoColorize(rawBuf, meta.width, meta.height);
  const coloredBuf = await sharp(coloredRaw, { raw: { width: meta.width, height: meta.height, channels: 4 } }).png().toBuffer();

  const { layers: contentLayers } = await placeInContentZone(coloredBuf, meta.width, meta.height, W, H, headerH, { padding: 50, cardBg: '#ffffff' });
  const footer = await footerPill(W, H, ACCENT.hook);

  return { bg: '#FFF5E6', layers: [...headerLayers, ...contentLayers, ...footer] };
}

async function slideStep1(W, H) {
  // phone_gen_loading.png (1440×3120 native): crop to y=2800, BEFORE the
  // bottom nav bar (native y≈2830+). Verified by cropping and viewing the
  // actual region (not eyeballing): the "Numbers: By Number" chip row spans
  // native y≈2640-2780 — an earlier CROP_BOTTOM=2650 cut straight through it
  // (silently dropping the app's headline color-by-number feature from the
  // slide, landing in a blank gap right after "Colors" by coincidence so it
  // LOOKED clean but wasn't complete). Row 1 of idea cards is fully visible;
  // row 2 is inherently partly covered by the app's own input-panel overlay
  // IN THE SOURCE SCREENSHOT ITSELF (confirmed by inspecting the raw file).
  const CROP_TOP = 0, CROP_BOTTOM = 2800;
  const { buf, srcW } = await loadScreenshotCrop('phone_gen_loading.png', CROP_TOP, CROP_BOTTOM);
  const cropH = CROP_BOTTOM - CROP_TOP;

  const { layers: headerLayers, headerH } = await headerZone(W, H, ACCENT.step1, {
    topLabel: 'STEP 1',
    headline: 'Type What You Want',
    subtext: 'Any word, any idea — just type it!',
  });
  const { layers: contentLayers, rect } = await placeInContentZone(buf, srcW, cropH, W, H, headerH, { padding: 30, cardBg: '#ffffff' });

  // Callout on the input field (source coords, native pixels: field spans
  // roughly y 1920-2045, full width — point at its horizontal center).
  const pt = mapSourcePoint(720, 1980, CROP_TOP, rect);
  const callout = await drawCallout({
    text: 'Type anything!', x: pt.x - 90, y: pt.y - 78, maxTextWidth: 220,
    accentHex: ACCENT.step1, sizePt: 22, arrowDir: 'down',
  });

  const footer = await footerPill(W, H, ACCENT.step1);
  return { bg: '#EBF4FF', layers: [...headerLayers, ...contentLayers, ...callout.layers, ...footer] };
}

async function slideStep2(W, H) {
  // phone_coloring_canvas.png (1440×3120 native): crop to header + loading
  // animation (y=1650) — the pencil/dots/"Loading..." text sit around
  // y 1060-1500; excludes the toolbar/palette below, which belongs to step 3.
  const CROP_TOP = 0, CROP_BOTTOM = 1650;
  const { buf, srcW } = await loadScreenshotCrop('phone_coloring_canvas.png', CROP_TOP, CROP_BOTTOM);
  const cropH = CROP_BOTTOM - CROP_TOP;

  const { layers: headerLayers, headerH } = await headerZone(W, H, ACCENT.step2, {
    topLabel: 'STEP 2',
    headline: 'AI Draws It Instantly',
    subtext: 'A brand-new picture every time',
  });
  const { layers: contentLayers, rect } = await placeInContentZone(buf, srcW, cropH, W, H, headerH, { padding: 30, cardBg: '#ffffff' });

  // Target the pencil/dots loading cluster (native y≈1084-1334) but place the
  // callout ABOVE it, in the large empty white space (native y 0-1060) —
  // pointing down onto the cluster — instead of below, where it would
  // overlap the "Loading..." text at native y≈1495 (confirmed by visual
  // inspection: an earlier version placed the box below and it clipped that
  // text).
  const pt = mapSourcePoint(720, 1200, CROP_TOP, rect);
  const callout = await drawCallout({
    text: 'Never the same twice', x: pt.x - 120, y: pt.y - 180, maxTextWidth: 240,
    accentHex: ACCENT.step2, sizePt: 22, arrowDir: 'down',
  });

  const footer = await footerPill(W, H, ACCENT.step2);
  return { bg: '#F5EEFF', layers: [...headerLayers, ...contentLayers, ...callout.layers, ...footer] };
}

async function slideStep3(W, H) {
  // phone_coloring_progress.png (1440×3120 native): crop to y=3050. Verified
  // by pixel-scanning the source column-by-column (not eyeballing displayed
  // coordinates, which was wrong once already — see git history): canvas
  // spans native y≈565-2005, the toolbar/mode-button rows sit at
  // y≈2380-2575, the FIRST color-swatch row only starts at y≈2620 (much
  // lower than the earlier estimate of ~1927 that caused this crop to cut
  // the swatch row in half), and the zoom/print/save pill row ends by
  // y≈3018. CROP_BOTTOM=3050 clears all of it with a small margin.
  const CROP_TOP = 0, CROP_BOTTOM = 3050;
  const { buf, srcW } = await loadScreenshotCrop('phone_coloring_progress.png', CROP_TOP, CROP_BOTTOM);
  const cropH = CROP_BOTTOM - CROP_TOP;

  const { layers: headerLayers, headerH } = await headerZone(W, H, ACCENT.step3, {
    topLabel: 'STEP 3',
    headline: 'Color By Number',
    subtext: 'Tap to fill · Paint free · Save & share',
  });
  const { layers: contentLayers, rect } = await placeInContentZone(buf, srcW, cropH, W, H, headerH, { padding: 30, cardBg: '#ffffff' });

  // Region "1" (monkey's nose badge), native source coords ≈ (662, 1181).
  const pt = mapSourcePoint(662, 1181, CROP_TOP, rect);
  const callout = await drawCallout({
    text: 'Tap a number to fill it', x: pt.x + 40, y: pt.y - 20, maxTextWidth: 230,
    accentHex: ACCENT.step3, sizePt: 22, arrowDir: 'left',
  });

  const footer = await footerPill(W, H, ACCENT.step3);
  return { bg: '#FFF6EC', layers: [...headerLayers, ...contentLayers, ...callout.layers, ...footer] };
}

async function slideCta(W, H) {
  const sources = [
    { topic: 'dinosaur', src: 'dinosaur-easy-1704707776.png' },
    { topic: 'cat',      src: 'cat-easy-1005447403.png' },
    { topic: 'unicorn',  src: 'unicorn-easy-282889560.jpg' },
    { topic: 'rocket',   src: 'rocket-easy-1224668489.png' },
  ];

  const { layers: headerLayers, headerH } = await headerZone(W, H, ACCENT.cta, {
    headline: 'Kids Love It!',
    subtext: 'Free · No account · No ads',
  });

  const safeBottom = Math.round(H * SAFE_BOTTOM_F);
  // Reserve room for the footer pill (see FOOTER_RESERVE in
  // placeInContentZone) — this grid doesn't go through that helper but hits
  // the identical bug: without this, the grid fills all the way to
  // safeBottom and the pill paints over the bottom row's images. Must shrink
  // the actual BOTTOM BOUND used for centering (not just pad the zoneH used
  // to size cells) — centering an unchanged [headerH, safeBottom] span only
  // gives the grid back HALF of any reserved slack as a gap below it, which
  // wasn't enough room for the pill (confirmed by visual inspection: an
  // earlier version that only shrank zoneH still overlapped the pill).
  const FOOTER_RESERVE = 100;
  const gridBottom = safeBottom - FOOTER_RESERVE;
  const zoneW = W - 80, zoneH = gridBottom - headerH - 40;
  const gap = 16;
  const cell = Math.floor((Math.min(zoneW, zoneH) - gap) / 2);
  const gridW = cell * 2 + gap, gridH = cell * 2 + gap;
  const gridX = Math.round((W - gridW) / 2);
  const gridY = headerH + Math.round((gridBottom - headerH - gridH) / 2);

  const layers = [];
  for (let i = 0; i < sources.length; i++) {
    const { topic, src } = sources[i];
    const srcPath = path.join(LIB, topic, src);
    const meta = await sharp(srcPath).metadata();
    const rawBuf = await sharp(srcPath).flatten({ background: { r: 255, g: 255, b: 255 } }).ensureAlpha().raw().toBuffer();
    const coloredRaw = autoColorize(rawBuf, meta.width, meta.height);
    const cellBuf = await sharp(coloredRaw, { raw: { width: meta.width, height: meta.height, channels: 4 } })
      .resize(cell, cell, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .png().toBuffer();
    const col = i % 2, row = Math.floor(i / 2);
    layers.push({ input: cellBuf, top: gridY + row * (cell + gap), left: gridX + col * (cell + gap) });
  }

  const footer = await footerPill(W, H, ACCENT.cta);
  return { bg: '#FFFAF5', layers: [...headerLayers, ...layers, ...footer] };
}

// ─── Entry ──────────────────────────────────────────────────────────────────
const SLIDES = [
  { name: 'slide_01_hook',  build: slideHook },
  { name: 'slide_02_step1', build: slideStep1 },
  { name: 'slide_03_step2', build: slideStep2 },
  { name: 'slide_04_step3', build: slideStep3 },
  { name: 'slide_05_cta',   build: slideCta },
];

async function main() {
  for (const size of SIZES) {
    fs.mkdirSync(size.dir, { recursive: true });
    console.log(`\n═══ ${size.key} (${size.W}×${size.H}) ═══`);
    for (const slide of SLIDES) {
      const { bg, layers } = await slide.build(size.W, size.H);
      if (process.env.DEBUG_LAYERS) {
        for (const l of layers) {
          const m = await sharp(l.input).metadata();
          console.log(`    layer top=${l.top} left=${l.left} w=${m.width} h=${m.height} -> right=${l.left+m.width} bottom=${l.top+m.height}`);
        }
      }
      const outPath = path.join(size.dir, `${slide.name}.png`);
      await sharp({ create: { width: size.W, height: size.H, channels: 3, background: hexToRgb(bg) } })
        .composite(layers)
        .png({ compressionLevel: 6 })
        .toFile(outPath);
      const stat = fs.statSync(outPath);
      console.log(`  ✓ ${slide.name}.png (${Math.round(stat.size / 1024)} KB)`);
    }
  }
  console.log(`\nDone. Slides saved under docs/social-content/carousels/how-it-works-v2/{ig,pin}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
