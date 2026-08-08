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
  { n: '01_home',      src: 'phone_new_01_home.png',      cap: 'Draw Anything You Imagine',       sub: 'Just type a word — AI creates it instantly!' },
  { n: '02_coloring',  src: 'phone_new_02_coloring.png',  cap: 'Color by Number or Freestyle',    sub: 'Tap to fill, paint, or doodle freely' },
  { n: '03_journal',   src: 'phone_new_03_journal.png',   cap: 'Your Art Journal & Achievements', sub: 'Save masterpieces, earn badges' },
  { n: '04_explore',   src: 'phone_new_04_explore.png',   cap: 'Hundreds of Ready-to-Color Pics', sub: 'Unicorns, dragons, cats and more' },
  { n: '05_community', src: 'phone_new_05_community.png', cap: 'Share & Discover Art Together',   sub: 'See what kids around the world create' },
  { n: '06_treehouse', src: 'phone_new_06_treehouse.png', cap: 'Earn Rewards & Unlock Surprises', sub: 'Crayon packs, stickers, companions & more' },
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
    for (const { n, src: srcFile, cap, sub } of CAPTIONS) {
      const src  = path.join(RAW,   srcFile);
      const tmp  = path.join(RAW,   `_tmp_ios_phone_${n}.png`);
      const dest = path.join(FINAL, `final_ios_phone_${n}.png`);
      await resizeAndComposite(src, tmp, dest, 1320, 2868, cap, sub);
    }
  } else if (mode === 'ipad') {
    // iPad Pro 12.9" landscape: 2732×2048 (from 2560×1600 tablet land raws, scale-to-height + center-crop width)
    console.log('\n=== iPad Pro 12.9" landscape (2732×2048) ===');
    const ipadSrcs = [
      'tablet_land_01_home.png',
      'tablet_land_02_coloring.png',
      'tablet_land_03_journal.png',
      'tablet_land_04_explore.png',
      'tablet_land_05_community.png',
      'tablet_land_06_treehouse.png',
    ];
    // gravity per screenshot: 'left' preserves the left edge (titles/nav); 'centre' for content-centred shots
    const ipadGravity = ['left', 'left', 'left', 'left', 'left', 'left'];
    for (let i = 0; i < CAPTIONS.length; i++) {
      const { n, cap, sub } = CAPTIONS[i];
      const src  = path.join(RAW,   ipadSrcs[i]);
      const tmp  = path.join(RAW,   `_tmp_ios_ipad_${n}.png`);
      const dest = path.join(FINAL, `final_ios_ipad_${n}.png`);
      await resizeAndComposite(src, tmp, dest, 2732, 2048, cap, sub, ipadGravity[i]);
    }
  } else if (mode === 'android-phone') {
    // Android phone: 1080×1920 (9:16)
    console.log('\n=== Android phone (1080×1920) ===');
    for (const { n, src: srcFile, cap, sub } of CAPTIONS) {
      const src  = path.join(RAW,   srcFile);
      const tmp  = path.join(RAW,   `_tmp_android_phone_${n}.png`);
      const dest = path.join(FINAL, `final_android_phone_${n}.png`);
      await resizeAndComposite(src, tmp, dest, 1080, 1920, cap, sub);
    }
  } else if (mode === 'android-tablet') {
    // Android tablet landscape: 2560×1600
    console.log('\n=== Android tablet landscape (2560×1600) ===');
    const tabletSrcs = [
      'tablet_land_01_home.png',
      'tablet_land_02_coloring.png',
      'tablet_land_03_journal.png',
      'tablet_land_04_explore.png',
      'tablet_land_05_community.png',
      'tablet_land_06_treehouse.png',
    ];
    for (let i = 0; i < CAPTIONS.length; i++) {
      const { n, cap, sub } = CAPTIONS[i];
      const src  = path.join(RAW,   tabletSrcs[i]);
      const tmp  = path.join(RAW,   `_tmp_android_tablet_${n}.png`);
      const dest = path.join(FINAL, `final_android_tablet_${n}.png`);
      await resizeAndComposite(src, tmp, dest, 2560, 1600, cap, sub, 'left');
    }
  } else {
    console.error('Usage: node make-ios-screenshots.js iphone|ipad|android-phone|android-tablet');
    process.exit(1);
  }
}

const mode = process.argv[2];
run(mode).catch(e => { console.error(e); process.exit(1); });
