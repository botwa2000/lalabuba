#!/usr/bin/env node
/**
 * stage-coloring-library.js
 *
 * Re-fetches curated coloring-page images from the Lalabuba production server
 * and places them under docs/coloring-page-library/<topic>/.
 *
 * Usage:
 *   node scripts/stage-coloring-library.js [--dry-run]
 *
 * Requirements:
 *   - SSH access to root@91.99.212.17 with ~/.ssh/id_rsa
 *   - scp available in PATH
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER = 'root@91.99.212.17';
const REMOTE_BASE = '/opt/lalabuba/data/images/g';
const SSH_KEY = path.join(process.env.HOME || process.env.USERPROFILE, '.ssh', 'id_rsa');
const LOCAL_BASE = path.join(__dirname, '..', 'docs', 'coloring-page-library');

const DRY_RUN = process.argv.includes('--dry-run');

// Manifest: topic -> list of filenames
const MANIFEST = {
  dragon: [
    'dragon-easy-623847419.jpg',
    'dragon-easy-3432101.png',
    'dragon-easy-1921767026.png',
    'dragon-easy-606891940.png',
    'dragon-medium-1082603457.jpg',
    'dragon-medium-547907138.jpg',
  ],
  unicorn: [
    'unicorn-easy-282889560.jpg',
    'unicorn-easy-50020884.jpg',
    'unicorn-easy-1891235349.jpg',
    'unicorn-easy-393016513.jpg',
    'unicorn-medium-253360542.png',
    'unicorn-medium-941031651.png',
  ],
  butterfly: [
    'butterfly-easy-1087886754.jpg',
    'butterfly-easy-351931874.png',
    'butterfly-easy-1240505651.png',
    'butterfly-easy-1652670679.png',
    'butterfly-medium-707218382.png',
    'butterfly-medium-1087673704.jpg',
  ],
  dinosaur: [
    'dinosaur-easy-1704707776.png',
    'dinosaur-easy-1864331858.jpg',
    'dinosaur-easy-1143919799.jpg',
    'dinosaur-easy-703039409.png',
    'dinosaur-medium-493223028.png',
    'dinosaur-medium-879954863.png',
  ],
  cat: [
    'cat-easy-1167994531.png',
    'cat-easy-793562427.jpg',
    'cat-easy-1916293497.jpg',
    'cat-easy-1005447403.png',
    'cat-medium-711358812.jpg',
    'cat-medium-47283809.png',
  ],
  princess: [
    'princess-easy-1600326199.png',
    'princess-easy-1914427651.jpg',
    'princess-easy-315278375.png',
    'princess-easy-271230198.jpg',
    'princess-medium-315697513.png',
    'princess-medium-982184198.jpg',
  ],
  mermaid: [
    'mermaid-easy-1801571385.jpg',
    'mermaid-easy-1755871068.png',
    'mermaid-easy-1969590692.jpg',
    'mermaid-easy-1087201082.jpg',
    'mermaid-medium-1245785830.png',
    'mermaid-medium-360170231.png',
  ],
  rocket: [
    'rocket-easy-168378974.jpg',
    'rocket-easy-147083632.png',
    'rocket-easy-916953364.jpg',
    'rocket-easy-1224668489.png',
    'rocket-medium-1091024784.png',
    'rocket-medium-1100389314.jpg',
  ],
};

let copied = 0;
let skipped = 0;
let failed = 0;

for (const [topic, files] of Object.entries(MANIFEST)) {
  const destDir = path.join(LOCAL_BASE, topic);

  if (!DRY_RUN) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  for (const filename of files) {
    const destFile = path.join(destDir, filename);

    if (fs.existsSync(destFile)) {
      console.log(`  skip  ${topic}/${filename} (already exists)`);
      skipped++;
      continue;
    }

    const src = `${SERVER}:${REMOTE_BASE}/${filename}`;
    // Use forward slashes for scp destination even on Windows
    const dest = destDir.replace(/\\/g, '/');
    const cmd = `scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${src}" "${dest}/"`;

    if (DRY_RUN) {
      console.log(`  [dry]  ${cmd}`);
      copied++;
      continue;
    }

    try {
      execSync(cmd, { stdio: 'pipe' });
      console.log(`  copy  ${topic}/${filename}`);
      copied++;
    } catch (err) {
      console.error(`  FAIL  ${topic}/${filename}: ${err.message}`);
      failed++;
    }
  }
}

console.log(`\nDone: ${copied} copied, ${skipped} skipped, ${failed} failed.`);
if (failed > 0) process.exit(1);
