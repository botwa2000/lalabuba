#!/usr/bin/env node
"use strict";
/**
 * Generate Google Play developer page assets for Bonifatus.
 *
 * Output:
 *   android/play-store-assets/developer-icon.png  — 512 × 512
 *   android/play-store-assets/header-image.jpg    — 4096 × 2304
 *
 * Run: node android/generate-play-assets.js
 */

const sharp = require("sharp");
const path  = require("path");
const fs    = require("fs");

const OUT = path.join(__dirname, "play-store-assets");
fs.mkdirSync(OUT, { recursive: true });

// ─── App portfolio ────────────────────────────────────────────────────────────
const APPS = [
  { name: "Lalabuba",  letter: "L", c1: "#7c4dff", c2: "#e040fb", sub: "AI Coloring Pages"  },
  { name: "Bonistock", letter: "S", c1: "#00b09b", c2: "#00e5c9", sub: "Stock Tracker"       },
  { name: "Bonidoc",   letter: "D", c1: "#1e90ff", c2: "#6c5ce7", sub: "Smart Documents"     },
  { name: "Taxalex",   letter: "T", c1: "#2d6a4f", c2: "#52b788", sub: "Tax Calculator"      },
  { name: "Bonifatus", letter: "B", c1: "#f7971e", c2: "#ffd200", sub: "Your Digital Life"   },
];

// ─── 1. Developer Icon — 512 × 512 ───────────────────────────────────────────
const iconSvg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="ibg" cx="38%" cy="32%" r="80%">
      <stop offset="0%" stop-color="#9a6dff"/>
      <stop offset="100%" stop-color="#2d0b7a"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" fill="url(#ibg)"/>

  <!-- Soft inner glow ring -->
  <circle cx="256" cy="230" r="175" fill="rgba(255,255,255,0.07)"/>
  <circle cx="256" cy="230" r="155" fill="rgba(255,255,255,0.04)"/>

  <!-- Large B monogram -->
  <text x="256" y="330"
        font-family="Arial Black,Arial,sans-serif"
        font-size="265" font-weight="900"
        text-anchor="middle"
        fill="white">B</text>

  <!-- Brand name -->
  <text x="256" y="458"
        font-family="Arial,sans-serif"
        font-size="40" font-weight="700"
        text-anchor="middle"
        fill="rgba(255,255,255,0.60)">BONIFATUS</text>
</svg>`;

// ─── 2. Header Image — 4096 × 2304 ───────────────────────────────────────────
// 5 cards: CX=148, CW=560, CG=230 → positions 148, 938, 1728, 2518, 3308, right edge 3868 (+228px margin)
const CX = 148, CW = 560, CH = 620, CG = 230, CY = 1430;

const gradDefs = APPS.map((a, i) => `
    <linearGradient id="g${i}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${a.c1}"/>
      <stop offset="100%" stop-color="${a.c2}"/>
    </linearGradient>`).join("");

const cards = APPS.map((app, i) => {
  const x  = CX + i * (CW + CG);
  const mx = x + CW / 2;
  return `
  <rect x="${x}" y="${CY}" width="${CW}" height="${CH}" rx="56" fill="url(#g${i})"/>
  <text x="${mx}" y="${CY + 205}"
        font-family="Arial Black,Arial,sans-serif" font-size="150" font-weight="900"
        text-anchor="middle" fill="white">${app.letter}</text>
  <text x="${mx}" y="${CY + 385}"
        font-family="Arial,sans-serif" font-size="52" font-weight="700"
        text-anchor="middle" fill="white">${app.name}</text>
  <text x="${mx}" y="${CY + 460}"
        font-family="Arial,sans-serif" font-size="36" font-weight="400"
        text-anchor="middle" fill="rgba(255,255,255,0.75)">${app.sub}</text>`;
}).join("\n");

const headerSvg = `<svg width="4096" height="2304" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f0529"/>
      <stop offset="100%" stop-color="#0a1628"/>
    </linearGradient>
    <radialGradient id="aura" cx="80%" cy="12%" r="55%">
      <stop offset="0%" stop-color="#7c4dff" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#7c4dff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="aura2" cx="10%" cy="90%" r="35%">
      <stop offset="0%" stop-color="#00b09b" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#00b09b" stop-opacity="0"/>
    </radialGradient>
    ${gradDefs}
  </defs>

  <!-- Background -->
  <rect width="4096" height="2304" fill="url(#sky)"/>
  <rect width="4096" height="2304" fill="url(#aura)"/>
  <rect width="4096" height="2304" fill="url(#aura2)"/>

  <!-- Decorative background circles -->
  <circle cx="3760" cy="280"  r="680" fill="rgba(124,77,255,0.07)"/>
  <circle cx="3920" cy="520"  r="420" fill="rgba(124,77,255,0.05)"/>
  <circle cx="90"   cy="2220" r="360" fill="rgba(0,176,155,0.06)"/>

  <!-- BONIFATUS heading -->
  <text x="200" y="542"
        font-family="Arial Black,Arial,sans-serif"
        font-size="310" font-weight="900"
        fill="white">BONIFATUS</text>

  <!-- Coloured accent underline (uses Lalabuba gradient) -->
  <rect x="200" y="585" width="2180" height="8" rx="4" fill="url(#g0)" opacity="0.58"/>

  <!-- Tagline -->
  <text x="200" y="742"
        font-family="Arial,sans-serif" font-size="94" font-weight="300"
        fill="rgba(255,255,255,0.50)">Smart apps for everyday life</text>

  <!-- App cards -->
  ${cards}
</svg>`;

// ─── Generate ─────────────────────────────────────────────────────────────────
async function main() {
  process.stdout.write("Generating developer-icon.png (512x512)... ");
  await sharp(Buffer.from(iconSvg))
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, "developer-icon.png"));
  console.log("done");

  process.stdout.write("Generating header-image.jpg (4096x2304)...  ");
  await sharp(Buffer.from(headerSvg))
    .jpeg({ quality: 83 })
    .toFile(path.join(OUT, "header-image.jpg"));
  console.log("done");

  // Print file sizes
  for (const f of ["developer-icon.png", "header-image.jpg"]) {
    const { size } = fs.statSync(path.join(OUT, f));
    console.log(`  ${f}: ${(size / 1024).toFixed(0)} KB`);
  }
  console.log(`\nFiles saved to android/play-store-assets/`);
}

main().catch(err => { console.error(err); process.exit(1); });
