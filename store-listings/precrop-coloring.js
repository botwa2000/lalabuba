'use strict';
// Pre-crops the phone coloring screenshot to the canvas area only,
// saves as a new source for the tablet 02_coloring composite.
const sharp = require('sharp');
const path  = require('path');

const RAW = path.resolve(__dirname, '..', 'store_assets', 'raw');

async function main() {
  // phone_port_02_coloring.png is 1080×2400
  // Canvas area: y=348 to y=1300 (unicorn head through body, avoiding toolbar)
  // This is a 1080×952 crop showing the colored unicorn prominently
  await sharp(path.join(RAW, 'phone_port_02_coloring.png'))
    .extract({ left: 0, top: 348, width: 1080, height: 952 })
    .toFile(path.join(RAW, 'tablet_land_02_coloring_canvas.png'));
  console.log('✓ Created tablet_land_02_coloring_canvas.png (1080×952 canvas crop)');
}

main().catch(e => { console.error(e); process.exit(1); });
