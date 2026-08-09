#!/usr/bin/env node
// make-social-pins.js — Pinterest pin compositor (1000×1500 px)
// Layout: accent bar → headline → big colored image → before/after strip → pill
// Usage: node scripts/make-social-pins.js
//        node scripts/make-social-pins.js dinosaur  (single topic)

'use strict';
const sharp = require('../node_modules/sharp');
const path  = require('path');
const fs    = require('fs');

const ROOT = path.join(__dirname, '..');
const LIB  = path.join(ROOT, 'docs', 'coloring-page-library');
const OUT  = path.join(ROOT, 'docs', 'social-content', 'pins');

// ─── Topic configs ────────────────────────────────────────────────────────────
const PINS = [
  {
    id: 'dinosaur',
    src: 'dinosaur-easy-1704707776.png', // 1024×1024 PNG
    headline1: 'Dinosaur',
    headline2: 'Coloring Pages',
    accentHex: '#2E7D32',   // deep green
    accentLight: '#C8E6C9', // light green
    keyword: 'dinosaur coloring pages for kids free printable',
  },
  {
    id: 'cat',
    src: 'cat-easy-1005447403.png', // 1024×1024 PNG
    headline1: 'Cat',
    headline2: 'Coloring Pages',
    accentHex: '#E65100',   // deep orange
    accentLight: '#FFE0B2', // light orange
    keyword: 'cat coloring pages for kids free printable',
  },
  {
    id: 'unicorn',
    src: 'unicorn-easy-282889560.jpg', // 768×768 JPG
    headline1: 'Unicorn',
    headline2: 'Coloring Pages',
    accentHex: '#6A1B9A',   // deep purple
    accentLight: '#E1BEE7', // light purple
    keyword: 'unicorn coloring pages for kids free printable',
  },
  {
    id: 'rocket',
    src: 'rocket-easy-1224668489.png', // 1024×1024 PNG
    headline1: 'Rocket',
    headline2: 'Coloring Pages',
    accentHex: '#1565C0',   // deep blue
    accentLight: '#BBDEFB', // light blue
    keyword: 'rocket coloring pages for kids free printable',
  },
  // schultuete RETIRED (2026-08-09): a Schultüte pin already posted 8/5; flood-fill
  // consistently leaked through outline gaps. Manifest row removed; file deleted.

  {
    id: 'einschulung',
    src: 'einschulung-easy-1520158737.png',
    headline1: 'Einschulung',
    headline2: 'Ausmalbilder',
    accentHex: '#00695C',   // deep teal
    accentLight: '#B2DFDB', // light teal
    keyword: 'Einschulung Ausmalbilder kostenlos ausdrucken',
    // noFill: blank line-art hero — the account's #1 pin format for printable-seekers.
    // Eliminates the entire flood-fill face-color defect class.
    noFill: true,
  },
];

// ─── Color palette for flood-fill ─────────────────────────────────────────────
const PALETTE = [
  [255, 213,  79], // amber
  [ 77, 182, 172], // teal
  [240, 120, 130], // coral pink
  [129, 199, 132], // light green
  [100, 181, 246], // sky blue
  [206, 147, 216], // lavender
  [255, 171,  64], // orange
  [161, 216, 132], // lime green
  [240, 162,  95], // peach
  [100, 200, 230], // cyan
  [245, 183, 220], // rose
  [179, 229, 252], // powder blue
];

// ─── BFS flood-fill colorizer ─────────────────────────────────────────────────
// Options:
//   skipExterior {bool}  — flood from image border first; border-connected white
//                          pixels stay white so the card background shows through
//   faceZones   {Array} — [{x1,y1,x2,y2}] in display-px space; any region whose
//                          bounding-box centre falls inside a zone is left white
//   seeds       {Array} — [{fx,fy,color:[r,g,b],bounds:{x1,y1,x2,y2}}] fractional
//                          seed fills run after main BFS; bounds are 0-1 fractions
function autoColorize(rawBuf, width, height, { skipExterior = false, faceZones = [], seeds = [], forcedColors = [] } = {}) {
  const n   = width * height;
  const pix = new Uint8ClampedArray(rawBuf.buffer, rawBuf.byteOffset, rawBuf.length);
  const out = Buffer.from(rawBuf);
  const vis = new Uint8Array(n);
  const q   = new Int32Array(n);

  function isWhite(idx) {
    const o = idx << 2;
    return 0.299 * pix[o] + 0.587 * pix[o + 1] + 0.114 * pix[o + 2] >= 190;
  }
  function isLine(idx) {
    const o = idx << 2;
    return 0.299 * pix[o] + 0.587 * pix[o + 1] + 0.114 * pix[o + 2] < 130;
  }

  // Phase 0: mark exterior (border-connected white pixels) as visited so main BFS skips them
  if (skipExterior) {
    let eh = 0, et = 0;
    const seedExt = idx => { if (!vis[idx] && isWhite(idx)) { vis[idx] = 1; q[et++] = idx; } };
    for (let x = 0; x < width; x++) { seedExt(x); seedExt((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { seedExt(y * width); seedExt(y * width + width - 1); }
    while (eh < et) {
      const idx = q[eh++];
      const x = idx % width, y = (idx - x) / width;
      for (const nb of [x > 0 ? idx - 1 : -1, x < width - 1 ? idx + 1 : -1,
                        y > 0 ? idx - width : -1, y < height - 1 ? idx + width : -1]) {
        if (nb >= 0 && !vis[nb] && isWhite(nb)) { vis[nb] = 1; q[et++] = nb; }
      }
    }
  }

  let colorIdx = 0;

  // Pre-compute forced-color seed pixel indices (fractional → absolute)
  const forcedSeeds = forcedColors.map(fc => ({
    idx: Math.round(fc.fy * (height - 1)) * width + Math.round(fc.fx * (width - 1)),
    color: fc.color,
  }));

  // Phase 1: BFS-colour all enclosed (non-exterior) white regions
  for (let i = 0; i < n; i++) {
    if (vis[i]) continue;
    vis[i] = 1;
    if (!isWhite(i)) continue;

    let head = 0, tail = 0;
    q[tail++] = i;
    const region = [];
    let minX = width, minY = height, maxX = 0, maxY = 0;

    // Track pixel indices when forced-color seeds exist (for O(1) membership test)
    const regionSet = forcedSeeds.length > 0 ? new Set() : null;

    while (head < tail) {
      const idx = q[head++];
      region.push(idx);
      if (regionSet) regionSet.add(idx);
      const x = idx % width, y = (idx - x) / width;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (const nb of [x > 0 ? idx - 1 : -1, x < width - 1 ? idx + 1 : -1,
                        y > 0 ? idx - width : -1, y < height - 1 ? idx + width : -1]) {
        if (nb >= 0 && !vis[nb]) { vis[nb] = 1; if (isWhite(nb)) q[tail++] = nb; }
      }
    }

    if (region.length < 400) continue;

    // Skip regions whose bounding box OVERLAPS any face/skin exclusion zone
    // (overlap test is reliable even for large regions that span zone boundaries)
    if (faceZones.length > 0) {
      if (faceZones.some(z => minX <= z.x2 && maxX >= z.x1 && minY <= z.y2 && maxY >= z.y1)) continue;
    }

    // Use forced color if this region contains a seed pixel; otherwise next palette entry
    let assignedColor = null;
    if (regionSet) {
      for (const fs of forcedSeeds) {
        if (regionSet.has(fs.idx)) { assignedColor = fs.color; break; }
      }
    }
    const [cr, cg, cb] = assignedColor !== null ? assignedColor : PALETTE[colorIdx++ % PALETTE.length];
    for (const idx of region) {
      const o = idx << 2;
      out[o] = cr; out[o + 1] = cg; out[o + 2] = cb; out[o + 3] = 255;
    }
  }

  // Phase 2: bounded seed fills (for regions that need a specific colour override)
  for (const { fx, fy, color, bounds } of seeds) {
    const sx = Math.round(fx * (width  - 1));
    const sy = Math.round(fy * (height - 1));
    const bx1 = bounds ? Math.round(bounds.x1 * width)  : 0;
    const by1 = bounds ? Math.round(bounds.y1 * height) : 0;
    const bx2 = bounds ? Math.round(bounds.x2 * width)  : width  - 1;
    const by2 = bounds ? Math.round(bounds.y2 * height) : height - 1;
    const isWhiteOut = idx => { const o = idx << 2; return out[o] >= 200 && out[o+1] >= 200 && out[o+2] >= 200; };
    const startIdx = sy * width + sx;
    if (!isWhiteOut(startIdx)) continue;
    const sv = new Uint8Array(n);
    let sh = 0, st = 0;
    sv[startIdx] = 1; q[st++] = startIdx;
    const region = [];
    while (sh < st) {
      const idx = q[sh++];
      region.push(idx);
      const x = idx % width, y = (idx - x) / width;
      for (const nb of [x > 0 ? idx - 1 : -1, x < width - 1 ? idx + 1 : -1,
                        y > 0 ? idx - width : -1, y < height - 1 ? idx + width : -1]) {
        if (nb < 0 || sv[nb]) continue;
        const nx = nb % width, ny = (nb - nx) / width;
        if (nx < bx1 || nx > bx2 || ny < by1 || ny > by2) continue;
        if (!isWhiteOut(nb)) continue;
        sv[nb] = 1; q[st++] = nb;
      }
    }
    const [cr, cg, cb] = color;
    for (const idx of region) { const o = idx << 2; out[o] = cr; out[o+1] = cg; out[o+2] = cb; out[o+3] = 255; }
  }

  // Phase 3: restore original dark-line pixels (always last)
  for (let i = 0; i < n; i++) {
    if (isLine(i)) {
      const o = i << 2;
      out[o] = pix[o]; out[o + 1] = pix[o + 1]; out[o + 2] = pix[o + 2]; out[o + 3] = 255;
    }
  }

  return out;
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const W = 1000, H = 1500;

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgAccentBar(accentHex) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="80">
    <rect width="${W}" height="80" fill="${escapeXml(accentHex)}"/>
    <text x="500" y="52" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="600"
      fill="white" text-anchor="middle" letter-spacing="2">🖍 lalabuba.com</text>
  </svg>`;
}

function svgHeadline(line1, line2, accentHex) {
  // l1 big, l2 slightly smaller, both centered
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="220">
    <text x="500" y="90" font-family="Segoe UI, Arial, sans-serif" font-size="82"
      font-weight="800" fill="${escapeXml(accentHex)}" text-anchor="middle">${escapeXml(line1)}</text>
    <text x="500" y="170" font-family="Segoe UI, Arial, sans-serif" font-size="56"
      font-weight="600" fill="#333333" text-anchor="middle">${escapeXml(line2)}</text>
  </svg>`;
}

function svgPrintLabel() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="20">
    <text x="0" y="15" font-family="Segoe UI, Arial, sans-serif" font-size="13"
      font-weight="700" fill="#222222">Ausdrucken &amp; Ausmalen</text>
  </svg>`;
}

function svgBeforeLabel(x, y) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
    <text x="60" y="15" font-family="Segoe UI, Arial, sans-serif" font-size="14"
      font-weight="600" fill="#555555" text-anchor="middle">BEFORE</text>
  </svg>`;
}

function svgAfterLabel(x, y) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
    <text x="60" y="15" font-family="Segoe UI, Arial, sans-serif" font-size="14"
      font-weight="700" fill="#222222" text-anchor="middle">AFTER</text>
  </svg>`;
}

function svgArrow() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="130">
    <text x="25" y="75" font-family="Segoe UI, Arial, sans-serif" font-size="36"
      fill="#888888" text-anchor="middle">→</text>
  </svg>`;
}

function svgCtaText() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="130">
    <text x="0" y="38" font-family="Segoe UI, Arial, sans-serif" font-size="32"
      font-weight="700" fill="#222222">Type · Color · Play!</text>
    <text x="0" y="78" font-family="Segoe UI, Arial, sans-serif" font-size="22"
      font-weight="400" fill="#555555">100% Free · No account · No ads</text>
    <text x="0" y="115" font-family="Segoe UI, Arial, sans-serif" font-size="22"
      font-weight="400" fill="#555555">AI-generated coloring for kids</text>
  </svg>`;
}

function svgPill(accentHex) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="70">
    <rect x="0" y="5" width="360" height="60" rx="30" ry="30" fill="${escapeXml(accentHex)}"/>
    <text x="180" y="43" font-family="Segoe UI, Arial, sans-serif" font-size="28"
      font-weight="700" fill="white" text-anchor="middle" letter-spacing="1">🖍 lalabuba.com</text>
  </svg>`;
}

// ─── Main compositor ───────────────────────────────────────────────────────────
async function makePin(cfg) {
  const srcPath = path.join(LIB, cfg.id, cfg.src);
  if (!fs.existsSync(srcPath)) {
    console.warn(`  [skip] source not found: ${srcPath}`);
    return;
  }

  console.log(`  Loading ${cfg.src}...`);
  const meta = await sharp(srcPath).metadata();
  const srcW = meta.width, srcH = meta.height;

  // Fit image into display slot (max 940×940) — uniform scale (up or down), no crop
  const SLOT = 940;
  const scale = Math.min(SLOT / srcW, SLOT / srcH);
  const dispW = Math.round(srcW * scale);
  const dispH = Math.round(srcH * scale);

  // Resize source to display size (for both before and after)
  const lineArtBuf = await sharp(srcPath)
    .resize(dispW, dispH, { fit: 'fill' })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .ensureAlpha()
    .raw()
    .toBuffer();

  let coloredBuf;
  if (cfg.noFill) {
    // Blank line-art format: no flood fill at all
    coloredBuf = null;
  } else {
    console.log(`  Flood-filling ${dispW}×${dispH}...`);
    const coloredRaw = autoColorize(lineArtBuf, dispW, dispH, {
      skipExterior:  cfg.skipExterior  || false,
      faceZones:     cfg.faceZones     || [],
      seeds:         cfg.seeds         || [],
      forcedColors:  cfg.forcedColors  || [],
    });
    coloredBuf = await sharp(coloredRaw, { raw: { width: dispW, height: dispH, channels: 4 } })
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  // Also build line-art PNG buffer (for display)
  const lineArtPngBuf = await sharp(lineArtBuf, { raw: { width: dispW, height: dispH, channels: 4 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png({ compressionLevel: 6 })
    .toBuffer();

  // Thumbnails for comparison strip (120×120)
  const THUMB = 120;
  const thumbScale = Math.min(1, THUMB / dispW, THUMB / dispH);
  const thumbW = Math.round(dispW * thumbScale);
  const thumbH = Math.round(dispH * thumbScale);

  const lineThumbBuf = await sharp(lineArtBuf, { raw: { width: dispW, height: dispH, channels: 4 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(thumbW, thumbH, { fit: 'fill' })
    .png()
    .toBuffer();

  const colorThumbBuf = cfg.noFill ? null : await sharp(
    autoColorize(lineArtBuf, dispW, dispH, {
      skipExterior: cfg.skipExterior || false,
      faceZones:    cfg.faceZones    || [],
      seeds:        cfg.seeds        || [],
      forcedColors: cfg.forcedColors || [],
    }),
    { raw: { width: dispW, height: dispH, channels: 4 } }
  ).resize(thumbW, thumbH, { fit: 'fill' }).png().toBuffer();

  // ─── Composite the pin ────────────────────────────────────────────────────
  // y positions:
  // 0-80:    accent bar
  // 80-120:  spacer
  // 120-340: headline (SVG 220px)
  // 340-360: spacer
  // 360-1300: main colored image (940×940 max) — centered horizontally
  // 1300-1310: spacer
  // 1310-1440: comparison strip (before thumbnail + arrow + after thumbnail + cta text)
  // 1440-1500: pill

  const imgX = Math.round((W - dispW) / 2); // center horizontally
  const imgY = 360;

  // Comparison strip y positions
  const stripY    = 1310;
  const thumbY    = stripY + 15;
  const labelY    = thumbY + thumbH + 4;
  const arrowX    = 35 + thumbW + 8;
  const arrowY    = stripY + 15;
  const colorThX  = arrowX + 50 + 8;
  const colorThY  = thumbY;
  const ctaX      = colorThX + thumbW + 20;
  const ctaY      = stripY;

  const layers = [
    // accent bar
    { input: Buffer.from(svgAccentBar(cfg.accentHex)), top: 0,    left: 0 },
    // headline
    { input: Buffer.from(svgHeadline(cfg.headline1, cfg.headline2, cfg.accentHex)), top: 100, left: 0 },
    // hero image: blank line art (noFill) or flood-filled art (default)
    { input: cfg.noFill ? lineArtPngBuf : coloredBuf, top: imgY, left: imgX },
    // pill (centered)
    { input: Buffer.from(svgPill(cfg.accentHex)), top: 1425, left: Math.round((W - 360) / 2) },
  ];

  if (cfg.noFill) {
    // Blank format strip: single thumbnail + "Ausdrucken & Ausmalen" + CTA
    const printCtaX = 35 + thumbW + 20;
    layers.push(
      { input: lineThumbBuf, top: thumbY, left: 35 },
      { input: Buffer.from(svgPrintLabel()), top: labelY, left: 35 },
      { input: Buffer.from(svgCtaText()), top: ctaY, left: printCtaX },
    );
  } else {
    // Standard before→after strip
    layers.push(
      { input: lineThumbBuf, top: thumbY, left: 35 },
      { input: Buffer.from(svgBeforeLabel()), top: labelY, left: 35 },
      { input: Buffer.from(svgArrow()), top: arrowY, left: arrowX },
      { input: colorThumbBuf, top: colorThY, left: colorThX },
      { input: Buffer.from(svgAfterLabel()), top: labelY, left: colorThX },
      { input: Buffer.from(svgCtaText()), top: ctaY, left: ctaX },
    );
  }

  const outPath = path.join(OUT, `pin_${cfg.id}.png`);
  await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 255, g: 249, b: 245 } }
  })
    .composite(layers)
    .png({ compressionLevel: 6 })
    .toFile(outPath);

  const stat = fs.statSync(outPath);
  console.log(`  ✓ ${path.basename(outPath)} (${Math.round(stat.size / 1024)} KB)`);
}

// ─── Entry ────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const filter = process.argv[2];
  const targets = filter ? PINS.filter(p => p.id === filter) : PINS;

  if (targets.length === 0) {
    console.error(`Unknown topic: ${filter}`);
    process.exit(1);
  }

  for (const cfg of targets) {
    console.log(`\n── ${cfg.id} ────────────────`);
    await makePin(cfg);
  }
  console.log('\nDone. Pins saved to docs/social-content/pins/');
}

main().catch(e => { console.error(e); process.exit(1); });
