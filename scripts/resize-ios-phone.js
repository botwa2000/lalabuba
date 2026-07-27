#!/usr/bin/env node
// Resize Android phone screenshots to iPhone 6.9" (1290x2796) for iOS App Store
const sharp = require('sharp');
const path = require('path');

const IOS_W = 1290, IOS_H = 2796;
const RAW = path.join(__dirname, '../store_assets/raw');

const SHOTS = [
  { src: 'phone_port_01_home.png',      dst: 'ios_phone_01_home.png' },
  { src: 'phone_port_02_coloring.png',  dst: 'ios_phone_02_coloring.png' },
  { src: 'phone_port_07_journal.png',   dst: 'ios_phone_03_journal.png' },
  { src: 'phone_port_04_explore.png',   dst: 'ios_phone_04_explore.png' },
  { src: 'phone_port_08_community.png', dst: 'ios_phone_05_community.png' },
  { src: 'phone_port_04_treehouse.png', dst: 'ios_phone_06_treehouse.png' },
];

(async () => {
  for (const { src, dst } of SHOTS) {
    await sharp(path.join(RAW, src))
      .resize(IOS_W, IOS_H, { fit: 'cover', position: 'top' })
      .png({ compressionLevel: 6 })
      .toFile(path.join(RAW, dst));
    console.log(`✓ ${dst}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
