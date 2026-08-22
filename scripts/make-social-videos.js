#!/usr/bin/env node
// make-social-videos.js — 3 social media videos (1080×1920, H.264, yuv420p, 30fps)
//
// Video 1: 01_type_to_page.mp4   (~15s) — type prompt → AI generates → page appears
// Video 2: 02_satisfying_coloring.mp4 (~22s) — progressive flood-fill coloring at 2× speed
// Video 3: 03_rewards_journey.mp4 (~20s) — gamification: completion → journal → treehouse
//
// Usage: node scripts/make-social-videos.js [1|2|3]

'use strict';
const sharp       = require('../node_modules/sharp');
const { execSync, spawnSync } = require('child_process');
const path        = require('path');
const fs          = require('fs');

const FFMPEG = 'C:\\Users\\Alexa\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe';
const ROOT   = path.join(__dirname, '..');
const RAW    = path.join(ROOT, 'store_assets', 'raw');
const FINAL  = path.join(ROOT, 'store_assets', 'final');
const LIB    = path.join(ROOT, 'docs', 'coloring-page-library');
const OUT    = path.join(ROOT, 'docs', 'social-content', 'videos');
const POSTERS= path.join(ROOT, 'docs', 'social-content', 'videos', 'posters');
const TMP    = path.join(ROOT, 'docs', 'social-content', '_tmp_vid');

const VW = 1080, VH = 1920; // 9:16 portrait

fs.mkdirSync(OUT,     { recursive: true });
fs.mkdirSync(POSTERS, { recursive: true });
fs.mkdirSync(TMP,     { recursive: true });

// ─── Color palette for flood-fill ────────────────────────────────────────────
const PALETTE = [
  [255, 213,  79], [77, 182, 172], [240, 120, 130],
  [129, 199, 132], [100, 181, 246], [206, 147, 216],
  [255, 171,  64], [161, 216, 132], [240, 162,  95],
  [100, 200, 230], [245, 183, 220], [179, 229, 252],
];

// ─── ffmpeg runner ────────────────────────────────────────────────────────────
function ff(args, label) {
  console.log(`  [ffmpeg] ${label}`);
  const res = spawnSync(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || Buffer.from('')).toString().slice(-2000);
    throw new Error(`ffmpeg failed (${label}): ${err}`);
  }
}

// ─── Image prep: scale phone screenshot to 1080×1920, padded ────────────────
async function prepPhoneShot(srcPath, outPath, bgRgb = [245, 245, 255]) {
  const meta  = await sharp(srcPath).metadata();
  // Scale to fit 1080 wide, preserve ratio
  const scale = VW / meta.width;
  const dW    = VW;
  const dH    = Math.round(meta.height * scale);

  // If taller than VH: crop to top (show most relevant content)
  const useDH = Math.min(dH, VH);

  const resized = await sharp(srcPath)
    .resize(dW, dH, { fit: 'fill' })
    .extract({ left: 0, top: 0, width: dW, height: useDH })
    .toBuffer();

  // Pad to VH with branded background color
  await sharp({
    create: { width: VW, height: VH, channels: 3, background: { r: bgRgb[0], g: bgRgb[1], b: bgRgb[2] } }
  })
    .composite([{ input: resized, top: Math.round((VH - useDH) / 2), left: 0 }])
    .png({ compressionLevel: 4 })
    .toFile(outPath);
}

// ─── SVG overlay helpers ──────────────────────────────────────────────────────
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function svgBrandBar(text, accentHex, yPos = 20) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}">
    <rect x="0" y="${yPos}" width="${VW}" height="80" fill="${esc(accentHex)}" opacity="0.92"/>
    <text x="${VW/2}" y="${yPos+52}" font-family="Segoe UI, Arial, sans-serif" font-size="32"
      font-weight="700" fill="white" text-anchor="middle">${esc(text)}</text>
  </svg>`;
}

function svgBottomCta(accentHex) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${VH-240}" width="${VW}" height="240" fill="url(#g)"/>
    <text x="${VW/2}" y="${VH-160}" font-family="Segoe UI, Arial, sans-serif" font-size="44"
      font-weight="800" fill="white" text-anchor="middle">100% Free · No Account</text>
    <text x="${VW/2}" y="${VH-100}" font-family="Segoe UI, Arial, sans-serif" font-size="30"
      font-weight="400" fill="rgba(255,255,255,0.9)" text-anchor="middle">No ads · No sign-up · Instant</text>
    <rect x="${(VW-340)/2}" y="${VH-68}" width="340" height="56" rx="28" fill="${esc(accentHex)}"/>
    <text x="${VW/2}" y="${VH-32}" font-family="Segoe UI, Arial, sans-serif" font-size="26"
      font-weight="700" fill="white" text-anchor="middle">🖍 lalabuba.com</text>
  </svg>`;
}

// ─── Apply text overlay via sharp, save PNG ───────────────────────────────────
async function overlayText(srcPath, outPath, svgStr) {
  const tmp = outPath + '.tmp.png';
  await sharp(srcPath)
    .composite([{ input: Buffer.from(svgStr), top: 0, left: 0 }])
    .png({ compressionLevel: 4 })
    .toFile(tmp);
  fs.renameSync(tmp, outPath);
}

// ─── Build zoompan segment: still image → slow zoom MP4 ──────────────────────
// zoom: start zoom level, zspeed: zoom rate per frame
// pan: 'none'|'down'|'up' — vertical pan direction
function makeZoompanSegment(inputPng, outputMp4, durationS, { zoom = 1.0, zspeed = 0.0008, pan = 'none' } = {}) {
  const frames = Math.round(durationS * 30);
  // zoompan filter: z = current zoom expression, x/y = pan position
  let xExpr = 'iw/2-(iw/zoom/2)'; // center x always
  let yExpr;
  if (pan === 'down') {
    // pan from top to bottom smoothly
    yExpr = `(ih-oh)/2+((ih-oh)/2)*(on/${frames})`;
  } else if (pan === 'up') {
    // pan from bottom to top
    yExpr = `(ih-oh)/2-((ih-oh)/2)*(on/${frames})`;
  } else {
    yExpr = 'ih/2-(ih/zoom/2)'; // center y always
  }

  const zExpr = `min(${zoom}+${zspeed}*on, ${zoom + zspeed * frames * 1.1})`;

  ff([
    '-loop', '1', '-t', String(durationS), '-i', inputPng,
    '-vf', `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${VW}x${VH},fps=30`,
    '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-t', String(durationS),
    '-y', outputMp4,
  ], `zoompan ${path.basename(outputMp4)} ${durationS}s`);
}

// ─── Crossfade concat multiple segments ──────────────────────────────────────
function concatWithXfade(segments, outputMp4, xfadeDuration = 0.5) {
  if (segments.length === 1) {
    fs.copyFileSync(segments[0].file, outputMp4);
    return;
  }
  // Build filter_complex for chained xfade
  const inputs  = segments.map(s => ['-i', s.file]).flat();
  const offsets = [];
  let t = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    t += segments[i].duration - xfadeDuration;
    offsets.push(t);
  }
  // filter_complex: xfade chains
  const parts = [];
  let prev = '[0:v]';
  for (let i = 0; i < segments.length - 1; i++) {
    const label = i < segments.length - 2 ? `[xf${i}]` : '[out]';
    parts.push(`${prev}[${i+1}:v]xfade=transition=fade:duration=${xfadeDuration}:offset=${offsets[i].toFixed(2)}${label}`);
    prev = `[xf${i}]`;
  }
  ff([
    ...inputs,
    '-filter_complex', parts.join(';'),
    '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-y', outputMp4,
  ], `concat ${path.basename(outputMp4)}`);
}

// ─── VIDEO 1: Type to Page ────────────────────────────────────────────────────
async function makeVideo1() {
  console.log('\n── Video 1: Type to Page ──');
  const accent = '#2E7D32';

  // Prepare images
  const homeOut  = path.join(TMP, 'v1_home.png');
  const loadOut  = path.join(TMP, 'v1_load.png');
  const canvOut  = path.join(TMP, 'v1_canvas.png');
  const ctaOut   = path.join(TMP, 'v1_cta.png');

  console.log('  Preparing frames...');
  await prepPhoneShot(path.join(RAW, 'phone_gen_loading.png'),      homeOut, [235, 240, 255]);
  await prepPhoneShot(path.join(RAW, 'phone_coloring_canvas.png'),  loadOut, [240, 240, 255]);
  await prepPhoneShot(path.join(RAW, 'phone_coloring_progress.png'), canvOut, [245, 250, 235]);

  // Overlay brand bar + CTA on home shot
  await overlayText(homeOut, homeOut,
    svgBrandBar('🖍 lalabuba.com — AI Coloring for Kids', accent));
  await overlayText(canvOut, canvOut, svgBottomCta(accent));

  // CTA frame: colored background + large text
  await sharp({
    create: { width: VW, height: VH, channels: 3, background: { r: 235, g: 240, b: 255 } }
  }).composite([{
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}">
      <text x="${VW/2}" y="${VH/2-120}" font-family="Segoe UI, Arial, sans-serif" font-size="72"
        font-weight="800" fill="#2E7D32" text-anchor="middle">Type It.</text>
      <text x="${VW/2}" y="${VH/2-20}" font-family="Segoe UI, Arial, sans-serif" font-size="72"
        font-weight="800" fill="#1565C0" text-anchor="middle">AI Draws It.</text>
      <text x="${VW/2}" y="${VH/2+80}" font-family="Segoe UI, Arial, sans-serif" font-size="72"
        font-weight="800" fill="#E65100" text-anchor="middle">You Color It!</text>
      <rect x="${(VW-380)/2}" y="${VH/2+200}" width="380" height="70" rx="35" fill="${accent}"/>
      <text x="${VW/2}" y="${VH/2+248}" font-family="Segoe UI, Arial, sans-serif" font-size="30"
        font-weight="700" fill="white" text-anchor="middle">Try Free at lalabuba.com 🖍</text>
    </svg>`), top: 0, left: 0
  }]).png({ compressionLevel: 4 }).toFile(ctaOut);

  // Build segments with zoompan
  const segs = [
    { file: path.join(TMP, 'v1_seg0.mp4'), duration: 4  },
    { file: path.join(TMP, 'v1_seg1.mp4'), duration: 4  },
    { file: path.join(TMP, 'v1_seg2.mp4'), duration: 5  },
    { file: path.join(TMP, 'v1_seg3.mp4'), duration: 3  },
  ];
  console.log('  Encoding segments...');
  makeZoompanSegment(homeOut, segs[0].file, segs[0].duration, { zoom: 1.0, zspeed: 0.0012, pan: 'down' });
  makeZoompanSegment(loadOut, segs[1].file, segs[1].duration, { zoom: 1.1, zspeed: 0.0008 });
  makeZoompanSegment(canvOut, segs[2].file, segs[2].duration, { zoom: 1.0, zspeed: 0.0020, pan: 'none' });
  makeZoompanSegment(ctaOut,  segs[3].file, segs[3].duration, { zoom: 1.0, zspeed: 0.0000 });

  console.log('  Joining segments...');
  const finalPath = path.join(OUT, '01_type_to_page.mp4');
  concatWithXfade(segs, finalPath);

  // Poster frame: save canvOut as 1080×1350 crop
  await sharp(canvOut)
    .extract({ left: 0, top: Math.round((VH - 1350) / 2), width: VW, height: 1350 })
    .png({ compressionLevel: 6 })
    .toFile(path.join(POSTERS, 'poster_01_type_to_page.png'));

  const sz = Math.round(fs.statSync(finalPath).size / 1024);
  console.log(`  ✓ 01_type_to_page.mp4 (${sz} KB)`);
}

// ─── VIDEO 2: Satisfying Coloring (progressive flood-fill) ───────────────────
async function makeVideo2() {
  console.log('\n── Video 2: Satisfying Coloring ──');

  const srcPath = path.join(LIB, 'dinosaur', 'dinosaur-easy-1704707776.png');
  const CANVAS  = 960; // coloring area within 1080 wide frame

  // Load and resize source
  const meta = await sharp(srcPath).metadata();
  const scale = CANVAS / Math.max(meta.width, meta.height);
  const cW    = Math.round(meta.width  * scale);
  const cH    = Math.round(meta.height * scale);

  const rawBuf = await sharp(srcPath)
    .resize(cW, cH, { fit: 'fill' })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Find all regions via BFS
  console.log('  Segmenting regions...');
  const n      = cW * cH;
  const pix    = new Uint8ClampedArray(rawBuf.buffer, rawBuf.byteOffset, rawBuf.length);
  const vis    = new Uint8Array(n);
  const q      = new Int32Array(n);
  const regions = [];

  function isWhite(i) {
    const o = i << 2;
    return 0.299 * pix[o] + 0.587 * pix[o+1] + 0.114 * pix[o+2] >= 190;
  }

  for (let i = 0; i < n; i++) {
    if (vis[i] || !isWhite(i)) { vis[i] = 1; continue; }
    let head = 0, tail = 0, sumX = 0, sumY = 0;
    q[tail++] = i;
    vis[i] = 1;
    const px = [];
    while (head < tail) {
      const idx = q[head++];
      px.push(idx);
      sumX += idx % cW;
      sumY += (idx - idx % cW) / cW;
      const x = idx % cW, y = (idx - x) / cW;
      for (const nb of [x>0?idx-1:-1, x<cW-1?idx+1:-1, y>0?idx-cW:-1, y<cH-1?idx+cW:-1]) {
        if (nb >= 0 && !vis[nb]) { vis[nb] = 1; if (isWhite(nb)) q[tail++] = nb; }
      }
    }
    if (px.length >= 400) {
      regions.push({ pixels: px, cy: sumY / px.length });
    }
  }

  // Sort top-to-bottom (by centroid Y)
  regions.sort((a, b) => a.cy - b.cy);
  console.log(`  Found ${regions.length} regions to color`);

  // Frame generation parameters
  const FPS     = 30;
  const TOTAL_S = 22;
  const TOTAL_F = TOTAL_S * FPS;         // 660 frames
  const HOLD_F  = Math.floor(TOTAL_F / Math.max(regions.length, 1));
  const FRAMES_DIR = path.join(TMP, 'v2_frames');
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  // Canvas X/Y position in the 1080×1920 frame
  const cX = Math.round((VW - cW) / 2);
  const cY = Math.round((VH - cH) / 2);

  // Brand header SVG
  const headerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}">
    <rect x="0" y="0" width="${VW}" height="80" fill="#2E7D32"/>
    <text x="${VW/2}" y="52" font-family="Segoe UI, Arial, sans-serif" font-size="28"
      font-weight="700" fill="white" text-anchor="middle">🖍 Color by Number — lalabuba.com</text>
    <rect x="0" y="${VH-80}" width="${VW}" height="80" fill="#1565C0" opacity="0.9"/>
    <text x="${VW/2}" y="${VH-32}" font-family="Segoe UI, Arial, sans-serif" font-size="26"
      font-weight="700" fill="white" text-anchor="middle">Tap to fill · Free · No account</text>
  </svg>`;

  // Generate frames
  console.log(`  Generating ${TOTAL_F} frames...`);
  const paintBuf = Buffer.from(rawBuf); // mutable copy

  // Frame 0: blank (all white line art)
  let frameIdx = 0;
  async function saveFrame(buf) {
    const imgBuf = await sharp(buf, { raw: { width: cW, height: cH, channels: 4 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png({ compressionLevel: 1 })
      .toBuffer();
    const composite = await sharp({
      create: { width: VW, height: VH, channels: 3, background: { r: 248, g: 249, b: 255 } }
    }).composite([
      { input: imgBuf, top: cY, left: cX },
      { input: Buffer.from(headerSvg), top: 0, left: 0 },
    ]).png({ compressionLevel: 1 }).toBuffer();
    fs.writeFileSync(path.join(FRAMES_DIR, `f${String(frameIdx).padStart(5,'0')}.png`), composite);
    frameIdx++;
  }

  // Blank intro: 30 frames (1s)
  for (let f = 0; f < 30; f++) await saveFrame(Buffer.from(rawBuf));

  // Progressive fills
  for (let ri = 0; ri < regions.length; ri++) {
    const { pixels } = regions[ri];
    const [cr, cg, cb] = PALETTE[ri % PALETTE.length];
    // Fill this region in paintBuf
    for (const idx of pixels) {
      const o = idx << 2;
      paintBuf[o] = cr; paintBuf[o+1] = cg; paintBuf[o+2] = cb; paintBuf[o+3] = 255;
    }
    // Save HOLD_F frames showing this new state
    for (let f = 0; f < Math.max(HOLD_F, 1); f++) await saveFrame(Buffer.from(paintBuf));
  }

  // Final hold: fill remaining frames
  while (frameIdx < TOTAL_F) await saveFrame(Buffer.from(paintBuf));

  console.log(`  Encoded ${frameIdx} frames. Running ffmpeg...`);

  const finalPath = path.join(OUT, '02_satisfying_coloring.mp4');
  ff([
    '-framerate', '30',
    '-i', path.join(FRAMES_DIR, 'f%05d.png'),
    '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-y', finalPath,
  ], '02_satisfying_coloring encode');

  // Poster frame: take last frame colored, crop to 1080×1350
  const lastFramePath = path.join(FRAMES_DIR, `f${String(frameIdx-1).padStart(5,'0')}.png`);
  await sharp(lastFramePath)
    .extract({ left: 0, top: Math.round((VH - 1350) / 2), width: VW, height: 1350 })
    .png({ compressionLevel: 6 })
    .toFile(path.join(POSTERS, 'poster_02_satisfying_coloring.png'));

  // Clean up frames
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });

  const sz = Math.round(fs.statSync(finalPath).size / 1024);
  console.log(`  ✓ 02_satisfying_coloring.mp4 (${sz} KB)`);
}

// ─── VIDEO 3: Rewards Journey ─────────────────────────────────────────────────
async function makeVideo3() {
  console.log('\n── Video 3: Rewards Journey ──');
  const accent = '#6A1B9A';

  const coloredOut  = path.join(TMP, 'v3_colored.png');
  const journalOut  = path.join(TMP, 'v3_journal.png');
  const treehouseOut= path.join(TMP, 'v3_treehouse.png');
  const ctaOut      = path.join(TMP, 'v3_cta.png');

  console.log('  Preparing frames...');

  // Colored canvas (monkey baking cookies) — shows completed coloring page
  await prepPhoneShot(path.join(RAW, 'phone_coloring_progress.png'), coloredOut, [235, 250, 235]);
  await overlayText(coloredOut, coloredOut,
    svgBrandBar('✅ Great job! Your masterpiece is done!', '#2E7D32'));

  // Journal screen
  await prepPhoneShot(path.join(RAW, 'phone_new_03_journal.png'), journalOut, [240, 238, 255]);
  await overlayText(journalOut, journalOut,
    svgBrandBar('📓 Journal — Track Your Artwork & Streaks', accent));

  // Treehouse / Rewards screen
  await prepPhoneShot(path.join(RAW, 'phone_new_06_treehouse.png'), treehouseOut, [248, 243, 255]);
  await overlayText(treehouseOut, treehouseOut,
    svgBrandBar('🏆 Rewards — Unlock Crayon Packs & More', '#E65100'));
  await overlayText(treehouseOut, treehouseOut, svgBottomCta(accent));

  // CTA frame
  await sharp({
    create: { width: VW, height: VH, channels: 3, background: { r: 248, g: 243, b: 255 } }
  }).composite([{
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}">
      <text x="${VW/2}" y="${VH/2-200}" font-family="Segoe UI, Arial, sans-serif" font-size="64"
        font-weight="800" fill="#6A1B9A" text-anchor="middle">Color. Learn.</text>
      <text x="${VW/2}" y="${VH/2-100}" font-family="Segoe UI, Arial, sans-serif" font-size="64"
        font-weight="800" fill="#E65100" text-anchor="middle">Grow. Explore.</text>
      <text x="${VW/2}" y="${VH/2+20}" font-family="Segoe UI, Arial, sans-serif" font-size="42"
        font-weight="600" fill="#333333" text-anchor="middle">AI Coloring for Kids — Free Forever</text>
      <rect x="${(VW-380)/2}" y="${VH/2+120}" width="380" height="70" rx="35" fill="#2E7D32"/>
      <text x="${VW/2}" y="${VH/2+165}" font-family="Segoe UI, Arial, sans-serif" font-size="30"
        font-weight="700" fill="white" text-anchor="middle">🖍 lalabuba.com</text>
    </svg>`), top: 0, left: 0
  }]).png({ compressionLevel: 4 }).toFile(ctaOut);

  const segs = [
    { file: path.join(TMP, 'v3_seg0.mp4'), duration: 5  },
    { file: path.join(TMP, 'v3_seg1.mp4'), duration: 7  },
    { file: path.join(TMP, 'v3_seg2.mp4'), duration: 6  },
    { file: path.join(TMP, 'v3_seg3.mp4'), duration: 3  },
  ];

  console.log('  Encoding segments...');
  makeZoompanSegment(coloredOut,   segs[0].file, segs[0].duration, { zoom: 1.05, zspeed: 0.0006 });
  makeZoompanSegment(journalOut,   segs[1].file, segs[1].duration, { zoom: 1.0,  zspeed: 0.0008, pan: 'down' });
  makeZoompanSegment(treehouseOut, segs[2].file, segs[2].duration, { zoom: 1.0,  zspeed: 0.0010, pan: 'down' });
  makeZoompanSegment(ctaOut,       segs[3].file, segs[3].duration, { zoom: 1.0,  zspeed: 0.0000 });

  console.log('  Joining segments...');
  const finalPath = path.join(OUT, '03_rewards_journey.mp4');
  concatWithXfade(segs, finalPath);

  // Poster
  await sharp(treehouseOut)
    .extract({ left: 0, top: Math.round((VH - 1350) / 2), width: VW, height: 1350 })
    .png({ compressionLevel: 6 })
    .toFile(path.join(POSTERS, 'poster_03_rewards_journey.png'));

  const sz = Math.round(fs.statSync(finalPath).size / 1024);
  console.log(`  ✓ 03_rewards_journey.mp4 (${sz} KB)`);
}

// ─── Entry ────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2];
  const all = !arg;

  try {
    if (all || arg === '1') await makeVideo1();
    if (all || arg === '2') await makeVideo2();
    if (all || arg === '3') await makeVideo3();
  } finally {
    // Clean up tmp (but not frames if they failed)
    try {
      for (const f of fs.readdirSync(TMP)) {
        const fp = path.join(TMP, f);
        if (f.endsWith('.png') || f.endsWith('.mp4')) fs.unlinkSync(fp);
      }
      fs.rmdirSync(TMP, { recursive: true });
    } catch {}
  }

  console.log('\nDone. Videos saved to docs/social-content/videos/');
  console.log('Poster frames saved to docs/social-content/videos/posters/');
}

main().catch(e => { console.error('\n' + e.message); process.exit(1); });
