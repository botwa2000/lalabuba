#!/usr/bin/env node
// Resize Android raw screenshots to iOS App Store dimensions and composite banners
// iPhone 6.9" Pro Max: 1320×2868 (portrait)
// iPad Pro 12.9":      2048×2732 (portrait)

const sharp = require('sharp');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAW  = path.join(__dirname, '..', 'store_assets', 'raw');
const FINAL = path.join(__dirname, '..', 'store_assets', 'final');
const SCRIPT = path.join(__dirname, 'make-store-screenshot.js');

const CAPTIONS = [
  { n: '01_home',      cap: 'Draw Anything You Imagine',       sub: 'Just type a word — AI creates it instantly!' },
  { n: '02_coloring',  cap: 'Color by Number or Freestyle',    sub: 'Tap to fill, one region at a time' },
  { n: '03_completed', cap: 'Save Art & Earn Achievements',    sub: 'Your masterpieces, always there' },
  { n: '04_explore',   cap: 'Hundreds of Ready-to-Color Pics', sub: 'Unicorns, dragons, cats and more' },
  { n: '05_community', cap: 'Share & Discover Art Together',   sub: 'See what artists are creating' },
];

async function resizeAndComposite(inputPath, tmpPath, finalPath, targetW, targetH, caption, subtitle, gravity) {
  // Resize with cover. iPhone (≈same ratio): centre crop. iPad (wider): north crop so banner covers the trimmed bottom.
  await sharp(inputPath)
    .resize(targetW, targetH, { fit: 'cover', position: gravity || 'centre' })
    .png({ compressionLevel: 6 })
    .toFile(tmpPath);

  // Add branded banner
  execSync(`node "${SCRIPT}" "${tmpPath}" "${finalPath}" "${caption}" "${subtitle}"`, { stdio: 'inherit' });
  fs.unlinkSync(tmpPath);
}

async function run(mode) {
  if (mode === 'iphone') {
    // iPhone 6.9" Pro Max: 1320×2868
    console.log('\n=== iPhone 6.9" (1320×2868) ===');
    for (const { n, cap, sub } of CAPTIONS) {
      const src  = path.join(RAW,   `phone_port_${n}.png`);
      const tmp  = path.join(RAW,   `_tmp_ios_phone_${n}.png`);
      const dest = path.join(FINAL, `final_ios_phone_${n}.png`);
      await resizeAndComposite(src, tmp, dest, 1320, 2868, cap, sub);
    }
  } else if (mode === 'ipad') {
    // iPad Pro 12.9" landscape: 2732×2048 (from 2560×1600 tablet land raws, scale-to-height + center-crop width)
    console.log('\n=== iPad Pro 12.9" landscape (2732×2048) ===');
    const ipadSrcs = [
      'tablet_land_01_home_clean.png',
      'tablet_land_canvas_inprogress.png',
      'tablet_land_canvas_completed.png',
      'tablet_land_gallery_unicorn.png',
      'tablet_land_community.png',
    ];
    // gravity per screenshot: 'left' preserves the left edge (titles/nav); 'centre' for content-centred shots
    const ipadGravity = ['left', 'left', 'centre', 'centre', 'left'];
    for (let i = 0; i < CAPTIONS.length; i++) {
      const { n, cap, sub } = CAPTIONS[i];
      const src  = path.join(RAW,   ipadSrcs[i]);
      const tmp  = path.join(RAW,   `_tmp_ios_ipad_${n}.png`);
      const dest = path.join(FINAL, `final_ios_ipad_${n}.png`);
      await resizeAndComposite(src, tmp, dest, 2732, 2048, cap, sub, ipadGravity[i]);
    }
  } else {
    console.error('Usage: node make-ios-screenshots.js iphone|ipad');
    process.exit(1);
  }
}

const mode = process.argv[2];
run(mode).catch(e => { console.error(e); process.exit(1); });
