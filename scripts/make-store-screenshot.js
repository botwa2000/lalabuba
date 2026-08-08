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

  const isLandscape = W > H;

  // Font sizes scale with width — unchanged
  const titleSize  = Math.round(W * 0.055);
  const subSize    = Math.round(W * 0.033);
  // Tighter padding so banner is compact
  const pad        = Math.round(W * 0.026);

  const titleLines = wrapText(caption, Math.floor((W - pad*2) / (titleSize * 0.55)));
  const titleLineH = Math.round(titleSize * 1.15);
  const subY = titleLines.length * titleLineH + Math.round(titleSize * 0.28);
  const contentH = subY + (subtitle ? subSize * 1.25 : 0) + Math.round(titleSize * 0.2);
  // Compact banner: just enough for content + small top/bottom pad
  const actualBannerH = Math.round(contentH + pad * 2.2);

  // Vertical gradient: transparent at top → rich purple at bottom
  // Text sits in the opaque zone with heavy shadow for legibility
  const shadowBlur = Math.round(titleSize * 0.25);
  const strokeW    = Math.round(titleSize * 0.09);

  const titleSvgLines = titleLines.map((line, i) =>
    `<text x="${W/2}" y="${Math.round(pad * 1.1 + titleLineH * i + titleSize)}"
      font-family="Fredoka, Arial Rounded MT Bold, Arial, sans-serif"
      font-size="${titleSize}" font-weight="700" fill="white"
      text-anchor="middle" dominant-baseline="auto"
      filter="url(#shadow)"
      paint-order="stroke" stroke="rgba(30,0,80,0.55)" stroke-width="${strokeW}">${escXml(line)}</text>`
  ).join('\n');

  const subSvg = subtitle
    ? `<text x="${W/2}" y="${Math.round(pad * 1.1 + subY + subSize)}"
        font-family="Nunito, Arial, sans-serif"
        font-size="${subSize}" font-weight="700" fill="white"
        text-anchor="middle" dominant-baseline="auto"
        filter="url(#shadow)"
        paint-order="stroke" stroke="rgba(30,0,80,0.45)" stroke-width="${Math.round(strokeW*0.7)}">${escXml(subtitle)}</text>`
    : '';

  const svgOverlay = `<svg width="${W}" height="${actualBannerH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="rgba(60,0,160,0)"/>
      <stop offset="38%"  stop-color="rgba(70,0,170,0.62)"/>
      <stop offset="100%" stop-color="rgba(80,0,185,0.91)"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-30%" width="140%" height="160%">
      <feDropShadow dx="0" dy="${Math.round(titleSize*0.04)}" stdDeviation="${shadowBlur}"
        flood-color="rgba(0,0,0,0.95)" flood-opacity="1"/>
    </filter>
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
