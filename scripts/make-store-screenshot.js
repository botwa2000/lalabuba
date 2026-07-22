#!/usr/bin/env node
// Composites a raw adb screencap PNG into an app-store screenshot:
// - Adds a solid gradient banner at the bottom with bold caption text
// - Optionally frames in a device shell
// Usage: node make-store-screenshot.js <input.png> <output.png> "<caption>" [subtitle]

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const [,, inputPath, outputPath, caption, subtitle] = process.argv;
if (!inputPath || !outputPath || !caption) {
  console.error('Usage: node make-store-screenshot.js <input.png> <output.png> "<caption>" [subtitle]');
  process.exit(1);
}

async function run() {
  const img = sharp(inputPath);
  const meta = await img.metadata();
  const W = meta.width;
  const H = meta.height;

  // Banner is 18% of height for phones, 14% for landscape tablets
  const isLandscape = W > H;
  const bannerFrac = isLandscape ? 0.13 : 0.17;
  const bannerH = Math.round(H * bannerFrac);

  // Font sizes scale with width
  const titleSize  = Math.round(W * 0.055);
  const subSize    = Math.round(W * 0.033);
  const pad        = Math.round(W * 0.06);

  // Purple→violet gradient matching app brand
  // SVG banner overlay
  const titleLines = wrapText(caption, Math.floor((W - pad*2) / (titleSize * 0.55)));
  const titleLineH = Math.round(titleSize * 1.25);
  const subY = titleLines.length * titleLineH + Math.round(titleSize * 0.5);
  const contentH = subY + (subtitle ? subSize * 1.4 : 0) + Math.round(titleSize * 0.3);
  const actualBannerH = Math.max(bannerH, Math.round(contentH + pad));

  const titleSvgLines = titleLines.map((line, i) =>
    `<text x="${W/2}" y="${Math.round(pad * 0.8 + titleLineH * i + titleSize)}"
      font-family="Fredoka, Arial Rounded MT Bold, Arial, sans-serif"
      font-size="${titleSize}" font-weight="700" fill="white"
      text-anchor="middle" dominant-baseline="auto"
      paint-order="stroke" stroke="rgba(0,0,0,0.18)" stroke-width="${Math.round(titleSize*0.06)}">${escXml(line)}</text>`
  ).join('\n');

  const subSvg = subtitle
    ? `<text x="${W/2}" y="${Math.round(pad * 0.8 + subY + subSize)}"
        font-family="Nunito, Arial, sans-serif"
        font-size="${subSize}" font-weight="600" fill="rgba(255,255,255,0.88)"
        text-anchor="middle" dominant-baseline="auto">${escXml(subtitle)}</text>`
    : '';

  const svgOverlay = `<svg width="${W}" height="${actualBannerH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#7C4DFF"/>
      <stop offset="100%" stop-color="#A855F7"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${actualBannerH}" fill="url(#bg)"/>
  ${titleSvgLines}
  ${subSvg}
</svg>`;

  const bannerBuf = Buffer.from(svgOverlay);

  await img
    .composite([{
      input: bannerBuf,
      top: H - actualBannerH,
      left: 0,
    }])
    .png({ compressionLevel: 6 })
    .toFile(outputPath);

  console.log(`✓ ${path.basename(outputPath)} — ${W}×${H}, banner ${actualBannerH}px`);
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

function escXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

run().catch(e => { console.error(e); process.exit(1); });
