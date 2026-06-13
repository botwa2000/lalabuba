#!/usr/bin/env node
/**
 * Generates the Android Play Store app icon 512×512 px from scratch.
 * No iOS assets used.
 */
const sharp = require('sharp');
const path  = require('path');
const OUT   = path.join(__dirname, 'play-store-listing');

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   style="stop-color:#7c4dff"/>
      <stop offset="100%" style="stop-color:#c03aff"/>
    </linearGradient>
    <linearGradient id="brush" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   style="stop-color:#ffe082"/>
      <stop offset="100%" style="stop-color:#ffb300"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>

  <!-- Background square (Play Store rounds corners automatically) -->
  <rect width="512" height="512" fill="url(#bg)"/>

  <!-- Subtle radial glow -->
  <radialGradient id="glow" cx="50%" cy="40%" r="60%">
    <stop offset="0%"   style="stop-color:#ffffff;stop-opacity:0.18"/>
    <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0"/>
  </radialGradient>
  <rect width="512" height="512" fill="url(#glow)"/>

  <!-- Color palette circles — decorative background -->
  <circle cx="80"  cy="420" r="54" fill="#ff4757" opacity="0.35"/>
  <circle cx="432" cy="420" r="54" fill="#26c281" opacity="0.35"/>
  <circle cx="80"  cy="92"  r="38" fill="#ffca28" opacity="0.25"/>
  <circle cx="432" cy="92"  r="38" fill="#1e90ff" opacity="0.25"/>

  <!-- Paintbrush — main icon element -->
  <!-- Handle -->
  <rect x="220" y="52" width="72" height="260" rx="36" fill="url(#brush)" filter="url(#shadow)"/>
  <!-- Ferrule (metal band) -->
  <rect x="214" y="292" width="84" height="36" rx="6" fill="#bdbdbd"/>
  <rect x="214" y="308" width="84" height="6"  rx="3" fill="#9e9e9e"/>
  <!-- Bristle body -->
  <path d="M218,328 Q180,360 172,420 Q196,432 256,436 Q316,432 340,420 Q332,360 294,328 Z"
        fill="white" filter="url(#shadow)"/>
  <!-- Bristle paint tip — colorful blob -->
  <ellipse cx="256" cy="430" rx="72" ry="28" fill="#ff6b6b"/>
  <ellipse cx="232" cy="440" rx="36" ry="18" fill="#ff4757" opacity="0.8"/>
  <ellipse cx="280" cy="442" rx="32" ry="16" fill="#ff7043" opacity="0.8"/>

  <!-- Number badge: "1 2 3" to signal color-by-number -->
  <rect x="88" y="188" width="100" height="46" rx="23" fill="white" opacity="0.92"/>
  <text x="138" y="219" text-anchor="middle" font-family="Arial Black,Arial" font-size="28" font-weight="900" fill="#7c4dff">1 2 3</text>

  <!-- Small color swatches row at bottom -->
  <rect x="72"  y="462" width="52" height="28" rx="14" fill="#ff4757"/>
  <rect x="134" y="462" width="52" height="28" rx="14" fill="#ffca28"/>
  <rect x="196" y="462" width="52" height="28" rx="14" fill="#26c281"/>
  <rect x="258" y="462" width="52" height="28" rx="14" fill="#1e90ff"/>
  <rect x="320" y="462" width="52" height="28" rx="14" fill="#f06292"/>
  <rect x="382" y="462" width="58" height="28" rx="14" fill="#7c4dff" opacity="0.7"/>
</svg>`;

(async () => {
  await sharp(Buffer.from(svg))
    .resize(512, 512)
    .png()
    .toFile(path.join(OUT, 'app-icon-512.png'));
  console.log('✓ app-icon-512.png (512×512, fresh)');
})();
