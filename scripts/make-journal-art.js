'use strict';
// Crops the canvas drawing area from existing screenshots and saves them
// as lalabuba_TIMESTAMP.png files to push to the device journal.
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const RAW = path.resolve(__dirname, '..', 'store_assets', 'raw');
const OUT = path.resolve(__dirname, '..', 'store_assets', 'journal_art');
fs.mkdirSync(OUT, { recursive: true });

// Crops to extract just the drawing canvas (no header/toolbar) from a portrait screenshot
// phone_port_06_canvas.png is 1080×2400; canvas occupies approx y=175 to y=1250
async function cropCanvas(srcFile, outFile, { left=0, top, width, height }) {
  await sharp(path.join(RAW, srcFile))
    .extract({ left, top, width, height })
    .resize(1080, 1080, { fit: 'cover', position: 'center' })
    .png()
    .toFile(path.join(OUT, outFile));
  console.log(`✓ ${outFile}`);
}

async function main() {
  // Dragon canvas — already partially colored (red wings), skip header (ends at y=279)
  await cropCanvas('phone_port_06_canvas.png', 'art1.png', {
    left: 0, top: 280, width: 1080, height: 960,
  });

  // Same dragon, slightly lower crop to show body + claws
  await cropCanvas('phone_port_06_canvas.png', 'art2.png', {
    left: 0, top: 420, width: 1080, height: 820,
  });

  // Red unicorn — full body, skip status bar + app header (ends at y=280)
  await cropCanvas('phone_port_02_coloring.png', 'art3.png', {
    left: 0, top: 280, width: 1080, height: 780,
  });

  // Red unicorn — upper-body / face zoom for variety, same header skip
  await cropCanvas('phone_port_02_coloring.png', 'art4.png', {
    left: 0, top: 280, width: 1080, height: 550,
  });

  console.log('\nDone. Files in store_assets/journal_art/');
}

main().catch(e => { console.error(e); process.exit(1); });
