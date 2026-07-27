#!/usr/bin/env node
// Resize tablet landscape screenshots to iPad Pro 13" landscape (2732x2048) for iOS App Store
const sharp = require('sharp');
const path = require('path');

const IPAD_W = 2732, IPAD_H = 2048;
const RAW = path.join(__dirname, '../store_assets/raw');

const SHOTS = [
  { src: 'tablet_land_home_fresh.png',    dst: 'ios_ipad_01_home.png' },
  { src: 'tablet_land_canvas_fresh.png',  dst: 'ios_ipad_02_coloring.png' },
  { src: 'tablet_land_explore_hub.png',   dst: 'ios_ipad_03_explore.png' },
  { src: 'tablet_land_07_journal.png',    dst: 'ios_ipad_04_journal.png' },
  { src: 'tablet_land_community.png',     dst: 'ios_ipad_05_community.png' },
  { src: 'tablet_land_rewards.png',       dst: 'ios_ipad_06_treehouse.png' },
];

(async () => {
  for (const { src, dst } of SHOTS) {
    await sharp(path.join(RAW, src))
      .resize(IPAD_W, IPAD_H, { fit: 'contain', background: { r: 248, g: 247, b: 252, alpha: 1 } })
      .png({ compressionLevel: 6 })
      .toFile(path.join(RAW, dst));
    console.log(`✓ ${dst}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
