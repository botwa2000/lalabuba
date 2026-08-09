#!/usr/bin/env node
// Fix iOS screenshots: replace Android status-bar icons with clean iOS bar.
// Input:  store_assets/raw/ios_*.png
// Output: store_assets/final/final_ios_*.png
// Requires: sharp (in repo root node_modules)

'use strict';
const path  = require('path');
const fs    = require('fs');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const RAW_DIR   = path.join(__dirname, '..', 'store_assets', 'raw');
const FINAL_DIR = path.join(__dirname, '..', 'store_assets', 'final');
if (!fs.existsSync(FINAL_DIR)) fs.mkdirSync(FINAL_DIR, { recursive: true });

// ERASE heights — how many rows to blank out from y=0
const SB_PHONE = 110;   // 1290×2796 iPhone
// iPad: Android bar is at y≈168-204 inside a ~165px Flutter safe-area.
// Erase all of y=0-229 to clear both the padding and the bar.
const SB_IPAD  = 230;

// DRAW heights — height of the iOS status bar SVG overlaid at y=0
// Kept at iOS-standard proportions: ~44pt ×2x = 88px for iPad 2x.
const DRAW_PHONE = SB_PHONE;   // phone erase and draw heights are the same
const DRAW_IPAD  = 88;         // iPad: draw a compact iOS bar at the top

function toHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Icons-only SVG — no background rect (background handled by sharp {create})
function makeStatusBarSvg(W, sbH, bgHex, iconHex) {
  const s    = sbH / 44;                    // 44pt = canonical iOS status bar height
  const padX = Math.round(16 * s);
  const midY = Math.round(sbH * 0.56);      // vertical centre of icon row
  const lw   = (1.5 * s).toFixed(1);
  const fs   = Math.round(17 * s);          // font size px

  // ── Battery dimensions & positions ──────────────────────────────────────
  const batW  = Math.round(25 * s);
  const batH  = Math.round(12 * s);
  const nubW  = Math.round(3  * s);
  const nubH  = Math.round(6  * s);
  const ip    = Math.round(2  * s);         // inner padding of battery fill
  const br    = (2.5 * s).toFixed(1);       // corner radius
  const nubBr = (1   * s).toFixed(1);

  // Positions (right-to-left)
  const nubRX  = W - padX;
  const nubLX  = nubRX - nubW;
  const batRX  = nubLX;
  const batLX  = batRX - batW;
  const batY   = midY - Math.round(batH / 2);
  const nubY   = midY - Math.round(nubH / 2);

  // ── WiFi ────────────────────────────────────────────────────────────────
  const wGap  = Math.round(7 * s);
  const wSz   = Math.round(16 * s);
  const wifiCX = batLX - wGap - Math.round(wSz / 2);
  const wBot  = midY + Math.round(wSz * 0.28);

  // ── Signal bars ─────────────────────────────────────────────────────────
  const bW    = Math.round(3 * s);
  const bGap  = Math.round(2 * s);
  const maxBH = Math.round(14 * s);
  const barsW = 4 * bW + 3 * bGap;
  const sigRX = wifiCX - Math.round(wSz / 2) - wGap;
  const sigLX = sigRX - barsW;

  // ── Build WiFi arc paths ──────────────────────────────────────────────
  function wifiArc(arcR) {
    const a1 = Math.PI * 1.2;
    const a2 = Math.PI * 1.8;
    const x1 = (wifiCX + arcR * Math.cos(a1)).toFixed(1);
    const y1 = (wBot   + arcR * Math.sin(a1)).toFixed(1);
    const x2 = (wifiCX + arcR * Math.cos(a2)).toFixed(1);
    const y2 = (wBot   + arcR * Math.sin(a2)).toFixed(1);
    return `M ${x1} ${y1} A ${arcR.toFixed(1)} ${arcR.toFixed(1)} 0 0 1 ${x2} ${y2}`;
  }

  // ── Signal bar rects ──────────────────────────────────────────────────
  const barRects = [0, 1, 2, 3].map(i => {
    const bh = Math.round(maxBH * (i + 1) / 4);
    const by = midY + Math.round(maxBH / 2) - bh;
    const bx = sigLX + i * (bW + bGap);
    return `<rect x="${bx}" y="${by}" width="${bW}" height="${bh}" rx="${(1 * s).toFixed(1)}" fill="${iconHex}"/>`;
  }).join('');

  const dotR = (1.5 * s).toFixed(1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${sbH}">
  <!-- transparent background — background erase done via sharp {create} -->
  <!-- time -->
  <text x="${padX}" y="${midY}"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif"
    font-size="${fs}" font-weight="600" fill="${iconHex}" dominant-baseline="middle">9:41</text>
  <!-- signal bars -->
  ${barRects}
  <!-- wifi arcs -->
  <path d="${wifiArc(wSz / 2)}" stroke="${iconHex}" stroke-width="${lw}" stroke-linecap="round" fill="none"/>
  <path d="${wifiArc(wSz / 2 * 2 / 3)}" stroke="${iconHex}" stroke-width="${lw}" stroke-linecap="round" fill="none"/>
  <path d="${wifiArc(wSz / 2 * 1 / 3)}" stroke="${iconHex}" stroke-width="${lw}" stroke-linecap="round" fill="none"/>
  <circle cx="${wifiCX}" cy="${wBot}" r="${dotR}" fill="${iconHex}"/>
  <!-- battery nub -->
  <rect x="${nubLX}" y="${nubY}" width="${nubW}" height="${nubH}" rx="${nubBr}" fill="${iconHex}"/>
  <!-- battery body outline -->
  <rect x="${batLX}" y="${batY}" width="${batW}" height="${batH}" rx="${br}" ry="${br}"
    fill="none" stroke="${iconHex}" stroke-width="${lw}"/>
  <!-- battery fill (100%) -->
  <rect x="${batLX + ip}" y="${batY + ip}" width="${batW - ip * 2}" height="${batH - ip * 2}"
    rx="${(1.5 * s).toFixed(1)}" fill="${iconHex}"/>
</svg>`;
}

async function fixScreenshot(srcFile) {
  const basename = path.basename(srcFile, '.png');
  const isIpad   = basename.includes('ipad');
  const sbH      = isIpad ? SB_IPAD  : SB_PHONE;   // erase height
  const drawH    = isIpad ? DRAW_IPAD : DRAW_PHONE; // icon draw height

  // Read entire image as raw RGBA — direct pixel manipulation is the most reliable
  // way to overwrite the status bar, bypassing any compositing blend ambiguity.
  const { data, info } = await sharp(srcFile)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const CH = 4; // ensureAlpha guarantees 4 channels

  // Sample background from horizontal centre of status bar (no icons there)
  const sampleIdx = (Math.floor(sbH * 0.35) * W + Math.floor(W / 2)) * CH;
  const [r, g, b] = [data[sampleIdx], data[sampleIdx + 1], data[sampleIdx + 2]];
  const bgHex     = toHex(r, g, b);
  const lum       = 0.299 * r + 0.587 * g + 0.114 * b;
  const iconHex   = lum > 128 ? '#000000' : '#FFFFFF';

  // Overwrite every pixel in the top sbH rows directly in the buffer
  for (let y = 0; y < sbH; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * CH;
      data[i]     = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  // Encode modified buffer back to PNG, then composite iOS icons SVG on top
  const erasedBuf = await sharp(data, { raw: { width: W, height: H, channels: CH } })
    .png().toBuffer();

  const iconsSvg = makeStatusBarSvg(W, drawH, bgHex, iconHex);

  const outName = `final_${basename}.png`;
  await sharp(erasedBuf)
    .composite([{ input: Buffer.from(iconsSvg), top: 0, left: 0 }])
    .png()
    .toFile(path.join(FINAL_DIR, outName));

  console.log(`✓ ${outName}  ${W}×${H}  erase=${sbH}  draw=${drawH}  bg=${bgHex}  icons=${iconHex}`);
}

async function main() {
  const files = fs.readdirSync(RAW_DIR)
    .filter(f => /^ios_.+\.png$/.test(f))
    .sort()
    .map(f => path.join(RAW_DIR, f));

  if (!files.length) {
    console.error('No ios_*.png files found in store_assets/raw/');
    process.exit(1);
  }
  for (const f of files) await fixScreenshot(f);
  console.log(`\nDone — ${files.length} files → store_assets/final/`);
}

main().catch(e => { console.error(e); process.exit(1); });
