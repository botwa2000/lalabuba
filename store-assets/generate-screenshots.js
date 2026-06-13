#!/usr/bin/env node
/**
 * Generates 5 Android Play Store phone screenshots at 1080×1920 px.
 * All artwork is programmatic SVG — no existing image files are used.
 *
 * Screens:
 *  1. Home / generate prompt
 *  2. AI-generated coloring page (butterfly, half-colored)
 *  3. Gallery of saved artworks
 *  4. Daily Challenge
 *  5. Challenge a Friend
 *
 * Output: android/play-store-listing/screenshots/en/
 */

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const W = 1080;
const H = 1920;
const OUT = path.join(__dirname, 'play-store-listing', 'screenshots', 'en');
fs.mkdirSync(OUT, { recursive: true });

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg:      '#eef6ff',
  card:    '#ffffff',
  ink:     '#1e1b2e',
  muted:   '#7a7a9a',
  border:  '#e0e8f4',
  purple:  '#7c4dff',
  pink:    '#f06292',
  orange:  '#ff7043',
  green:   '#26c281',
  yellow:  '#ffca28',
  blue:    '#1e90ff',
  red:     '#ff4757',
  coral:   '#ff6b6b',
  teal:    '#00bcd4',
  brown:   '#795548',
  gray:    '#9e9e9e',
  dkblue:  '#3f51b5',
  cream:   '#fef9ef',
};

// Classic 12-color palette (matches app)
const PALETTE = [
  { n:1,  c:'#ff4757' },  // red
  { n:2,  c:'#ff7043' },  // orange
  { n:3,  c:'#ffca28' },  // yellow
  { n:4,  c:'#26c281' },  // green
  { n:5,  c:'#1e90ff' },  // blue
  { n:6,  c:'#7c4dff' },  // purple
  { n:7,  c:'#f06292' },  // pink
  { n:8,  c:'#ff6b6b' },  // coral
  { n:9,  c:'#00bcd4' },  // teal
  { n:10, c:'#795548' },  // brown
  { n:11, c:'#9e9e9e' },  // gray
  { n:12, c:'#3f51b5' },  // dark blue
];

// ─── Shared components ────────────────────────────────────────────────────────

function statusBar(time = '17:49') {
  return `
  <rect x="0" y="0" width="${W}" height="80" fill="${C.bg}"/>
  <text x="60" y="52" font-family="Arial" font-size="34" font-weight="700" fill="${C.ink}">${time}</text>
  <!-- signal bars -->
  <rect x="${W-200}" y="24" width="10" height="32" rx="3" fill="${C.ink}" opacity="0.3"/>
  <rect x="${W-185}" y="18" width="10" height="38" rx="3" fill="${C.ink}" opacity="0.5"/>
  <rect x="${W-170}" y="12" width="10" height="44" rx="3" fill="${C.ink}" opacity="0.7"/>
  <rect x="${W-155}" y="6"  width="10" height="50" rx="3" fill="${C.ink}"/>
  <!-- 5G badge -->
  <text x="${W-138}" y="48" font-family="Arial" font-size="26" font-weight="700" fill="${C.ink}">5G</text>
  <!-- battery -->
  <rect x="${W-96}" y="16" width="72" height="36" rx="8" fill="none" stroke="${C.ink}" stroke-width="3"/>
  <rect x="${W-24}" y="26" width="8" height="16" rx="3" fill="${C.ink}" opacity="0.5"/>
  <rect x="${W-92}" y="20" width="52" height="28" rx="5" fill="${C.green}"/>
  <text x="${W-78}" y="40" font-family="Arial" font-size="20" font-weight="700" fill="white">83</text>`;
}

function appHeader(galleryLabel = '🖼️ Gallery') {
  return `
  <!-- header bg -->
  <rect x="0" y="80" width="${W}" height="110" fill="${C.bg}"/>
  <!-- Gallery button -->
  <rect x="32" y="96" width="200" height="62" rx="31" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="132" y="136" text-anchor="middle" font-family="Arial" font-size="28" fill="${C.ink}">${galleryLabel}</text>
  <!-- Logo text -->
  <text x="${W/2}" y="148" text-anchor="middle"
        font-family="Arial Black, Arial" font-size="58" font-weight="900"
        fill="${C.purple}" letter-spacing="-1">Lalabuba</text>
  <!-- Lang button -->
  <rect x="${W-232}" y="96" width="120" height="62" rx="31" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="${W-172}" y="136" text-anchor="middle" font-family="Arial" font-size="28" fill="${C.ink}">🇬🇧 EN</text>`;
}

function colorPaletteStrip(y, activeColor = null, activeNum = null) {
  const sw = 76;
  const gap = (W - 32*2 - sw * 12) / 11;
  let out = `<rect x="0" y="${y}" width="${W}" height="140" fill="${C.card}" rx="0"/>`;
  PALETTE.forEach(({ n, c }, i) => {
    const x = 32 + i * (sw + gap);
    const isActive = n === activeNum;
    out += `
    <rect x="${x}" y="${y+14}" width="${sw}" height="${sw}" rx="${sw/2}"
          fill="${c}" ${isActive ? `stroke="${C.ink}" stroke-width="5"` : ''}/>
    <text x="${x+sw/2}" y="${y+14+sw/2+10}" text-anchor="middle"
          font-family="Arial" font-size="20" font-weight="700"
          fill="${n <= 3 || n === 7 || n === 8 || n === 9 ? 'white' : 'white'}">${n}</text>`;
  });
  return out;
}

function bottomToolbar(y) {
  const btns = [
    { label:'↩ Undo', x:32 },
    { label:'✏️ Draw', x:32+252 },
    { label:'🗑️ Clear', x:32+504 },
    { label:'🖨️ Print', x:32+756 },
  ];
  let out = `<rect x="0" y="${y}" width="${W}" height="90" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>`;
  btns.forEach(({ label, x }) => {
    out += `
    <rect x="${x}" y="${y+14}" width="220" height="62" rx="31"
          fill="${C.bg}" stroke="${C.border}" stroke-width="2"/>
    <text x="${x+110}" y="${y+51}" text-anchor="middle"
          font-family="Arial" font-size="24" fill="${C.ink}">${label}</text>`;
  });
  return out;
}

function actionBar(y) {
  return `
  <rect x="0" y="${y}" width="${W}" height="100" fill="${C.card}"/>
  <!-- Save -->
  <rect x="32" y="${y+14}" width="220" height="68" rx="34"
        fill="${C.bg}" stroke="${C.border}" stroke-width="2"/>
  <text x="142" y="${y+55}" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.ink}">💾 Save</text>
  <!-- Share art -->
  <rect x="264" y="${y+14}" width="250" height="68" rx="34"
        fill="${C.bg}" stroke="${C.border}" stroke-width="2"/>
  <text x="389" y="${y+55}" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.ink}">🖼️ Share art</text>
  <!-- Challenge -->
  <rect x="526" y="${y+14}" width="522" height="68" rx="34"
        fill="${C.orange}" />
  <text x="787" y="${y+57}" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="white">🏆 Challenge!</text>`;
}

// ─── Butterfly coloring artwork ───────────────────────────────────────────────
// Draws a schematic butterfly with numbered regions (some colored, some blank)
function butterflyArt(cx, cy, scale = 1.0, coloredRegions = {}) {
  // coloredRegions: { 1: '#ff4757', 3: '#ffca28', ... }
  const s = scale;
  const fill = (n) => coloredRegions[n] || 'white';
  const sw = 3.5 * s; // stroke width

  return `
  <g transform="translate(${cx}, ${cy}) scale(${s})">
    <!-- Upper left wing -->
    <ellipse cx="-200" cy="-140" rx="185" ry="200" fill="${fill(1)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Upper right wing -->
    <ellipse cx="200" cy="-140" rx="185" ry="200" fill="${fill(2)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Lower left wing -->
    <ellipse cx="-175" cy="120" rx="145" ry="160" fill="${fill(3)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Lower right wing -->
    <ellipse cx="175" cy="120" rx="145" ry="160" fill="${fill(4)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Wing spots upper left -->
    <ellipse cx="-195" cy="-150" rx="55" ry="65" fill="${fill(5)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Wing spots upper right -->
    <ellipse cx="195" cy="-150" rx="55" ry="65" fill="${fill(6)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Wing spots lower left -->
    <circle cx="-170" cy="130" r="50" fill="${fill(7)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Wing spots lower right -->
    <circle cx="170" cy="130" r="50" fill="${fill(8)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Body -->
    <ellipse cx="0" cy="0" rx="32" ry="220" fill="${fill(9)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Head -->
    <circle cx="0" cy="-240" r="45" fill="${fill(10)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Antennae -->
    <line x1="-20" y1="-278" x2="-70" y2="-360" stroke="#222" stroke-width="${sw}" stroke-linecap="round"/>
    <line x1="20" y1="-278" x2="70" y2="-360" stroke="#222" stroke-width="${sw}" stroke-linecap="round"/>
    <circle cx="-70" cy="-360" r="14" fill="${fill(11)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="70" cy="-360" r="14" fill="${fill(12)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Number labels -->
    ${Object.keys({1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,11:11,12:12}).map(n => {
      const positions = {
        1: [-200,-140], 2: [200,-140], 3: [-175,120], 4: [175,120],
        5: [-195,-150], 6: [195,-150], 7: [-170,130], 8: [170,130],
        9: [0,0], 10: [0,-240], 11: [-70,-360], 12: [70,-360]
      };
      const [nx, ny] = positions[n];
      const bg = coloredRegions[n] ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.85)';
      const fc = coloredRegions[n] ? 'white' : C.ink;
      return `
      <circle cx="${nx}" cy="${ny}" r="22" fill="${bg}"/>
      <text x="${nx}" y="${ny+8}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="${fc}">${n}</text>`;
    }).join('')}
  </g>`;
}

// ─── Dragon coloring artwork ──────────────────────────────────────────────────
function dragonArt(cx, cy, scale = 1.0, coloredRegions = {}) {
  const s = scale;
  const fill = (n) => coloredRegions[n] || 'white';
  const sw = 3.5 * s;
  return `
  <g transform="translate(${cx}, ${cy}) scale(${s})">
    <!-- Body -->
    <ellipse cx="0" cy="80" rx="200" ry="260" fill="${fill(1)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Head -->
    <ellipse cx="0" cy="-220" rx="150" ry="130" fill="${fill(2)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Neck -->
    <rect x="-60" y="-100" width="120" height="160" rx="40" fill="${fill(2)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Left wing -->
    <path d="M -200 -60 Q -420 -280 -340 -420 Q -160 -300 -160 -60 Z" fill="${fill(3)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Right wing -->
    <path d="M 200 -60 Q 420 -280 340 -420 Q 160 -300 160 -60 Z" fill="${fill(4)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Tail -->
    <path d="M 160 280 Q 320 380 280 500 Q 160 420 80 320 Z" fill="${fill(5)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Belly scales -->
    <ellipse cx="0" cy="120" rx="120" ry="180" fill="${fill(6)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Left eye -->
    <circle cx="-50" cy="-250" r="30" fill="${fill(7)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="-50" cy="-250" r="14" fill="#222"/>
    <!-- Right eye -->
    <circle cx="50" cy="-250" r="30" fill="${fill(7)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="50" cy="-250" r="14" fill="#222"/>
    <!-- Horn -->
    <path d="M -20 -330 L 0 -430 L 20 -330 Z" fill="${fill(8)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Left leg -->
    <ellipse cx="-160" cy="320" rx="55" ry="100" fill="${fill(9)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Right leg -->
    <ellipse cx="160" cy="320" rx="55" ry="100" fill="${fill(9)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Spines on back -->
    <path d="M -60 -80 L -80 -180 L -20 -100 Z" fill="${fill(10)}" stroke="#222" stroke-width="${sw}"/>
    <path d="M 0 -90 L 0 -200 L 40 -110 Z" fill="${fill(10)}" stroke="#222" stroke-width="${sw}"/>
    <path d="M 60 -80 L 80 -180 L 20 -100 Z" fill="${fill(10)}" stroke="#222" stroke-width="${sw}"/>
    <!-- Numbers -->
    ${[1,2,3,4,5,6,7,8,9,10].map(n => {
      const positions = {
        1:[0,80], 2:[0,-210], 3:[-280,-220], 4:[280,-220],
        5:[220,390], 6:[0,120], 7:[0,-250], 8:[0,-380],
        9:[0,360], 10:[0,-130]
      };
      if (!positions[n]) return '';
      const [nx, ny] = positions[n];
      const bg = coloredRegions[n] ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.85)';
      const fc = coloredRegions[n] ? 'white' : C.ink;
      return `
      <circle cx="${nx}" cy="${ny}" r="24" fill="${bg}"/>
      <text x="${nx}" y="${ny+9}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="${fc}">${n}</text>`;
    }).join('')}
  </g>`;
}

// ─── Mini artwork thumbnails for gallery ─────────────────────────────────────
function miniButterfly(cx, cy, s = 0.15) {
  return butterflyArt(cx, cy, s, {1:'#ff4757',2:'#7c4dff',3:'#ffca28',4:'#1e90ff',
    5:'#ff7043',6:'#f06292',7:'#26c281',8:'#ff6b6b',9:'#795548',10:'#00bcd4',11:'#ff4757',12:'#ffca28'});
}
function miniDragon(cx, cy, s = 0.12) {
  return dragonArt(cx, cy, s, {1:'#26c281',2:'#ff7043',3:'#7c4dff',4:'#7c4dff',
    5:'#ff4757',6:'#ffca28',7:'#ff4757',8:'#ffca28',9:'#795548',10:'#ff6b6b'});
}

// Simple mini rocket for gallery
function miniRocket(cx, cy, s = 0.13) {
  const sc = `scale(${s})`;
  return `<g transform="translate(${cx},${cy}) ${sc}">
    <path d="M0,-350 C120,-200 160,-50 140,200 L-140,200 C-160,-50 -120,-200 0,-350Z" fill="#1e90ff" stroke="#222" stroke-width="25"/>
    <path d="M-140,200 L-280,380 L-140,340 L-100,480 L0,340" fill="#ff4757" stroke="#222" stroke-width="25"/>
    <path d="M140,200 L280,380 L140,340 L100,480 L0,340" fill="#ff4757" stroke="#222" stroke-width="25"/>
    <circle cx="0" cy="-100" r="90" fill="#ffca28" stroke="#222" stroke-width="25"/>
    <path d="M-140,200 L140,200 L140,340 L-140,340Z" fill="#ff7043" stroke="#222" stroke-width="25"/>
  </g>`;
}

function miniUnicorn(cx, cy, s = 0.13) {
  const sc = `scale(${s})`;
  return `<g transform="translate(${cx},${cy}) ${sc}">
    <ellipse cx="80" cy="100" rx="200" ry="130" fill="#f06292" stroke="#222" stroke-width="25"/>
    <circle cx="-60" cy="-80" r="120" fill="#f06292" stroke="#222" stroke-width="25"/>
    <path d="-60,-200 L-30,-420 L0,-200Z" fill="#ffca28" stroke="#222" stroke-width="20"/>
    <ellipse cx="-60" cy="-200" rx="30" ry="18" fill="#ffca28"/>
    <ellipse cx="280" cy="160" rx="35" ry="90" fill="#f06292" stroke="#222" stroke-width="25"/>
    <ellipse cx="100" cy="220" rx="35" ry="90" fill="#f06292" stroke="#222" stroke-width="25"/>
    <path d="M180,-30 Q320,-120 360,-30 Q280,60 180,-30Z" fill="#f06292" stroke="#222" stroke-width="25"/>
    <circle cx="-95" cy="-110" r="20" fill="#222"/>
    <!-- mane -->
    <path d="M60,-120 Q120,-280 0,-340 Q-80,-200 20,-80Z" fill="#7c4dff" stroke="#222" stroke-width="20"/>
    <path d="M80,-140 Q160,-300 60,-380 Q-40,-240 60,-100Z" fill="#ff7043" stroke="#222" stroke-width="20"/>
  </g>`;
}

function miniCastle(cx, cy, s = 0.14) {
  const sc = `scale(${s})`;
  return `<g transform="translate(${cx},${cy}) ${sc}">
    <rect x="-250" y="-80" width="500" height="380" fill="#9e9e9e" stroke="#222" stroke-width="25"/>
    <rect x="-320" y="-200" width="140" height="240" rx="10" fill="#795548" stroke="#222" stroke-width="25"/>
    <rect x="180" y="-200" width="140" height="240" rx="10" fill="#795548" stroke="#222" stroke-width="25"/>
    <rect x="-120" y="-160" width="240" height="180" rx="10" fill="#9e9e9e" stroke="#222" stroke-width="25"/>
    <path d="M-80,300 L-80,60 Q0,-30 80,60 L80,300Z" fill="#222"/>
    <rect x="-100" y="-80" width="80" height="80" fill="#1e90ff" stroke="#222" stroke-width="20"/>
    <rect x="20" y="-80" width="80" height="80" fill="#1e90ff" stroke="#222" stroke-width="20"/>
    <!-- crenellations -->
    <rect x="-320" y="-260" width="40" height="60" fill="#795548" stroke="#222" stroke-width="20"/>
    <rect x="-240" y="-260" width="40" height="60" fill="#795548" stroke="#222" stroke-width="20"/>
    <rect x="200" y="-260" width="40" height="60" fill="#795548" stroke="#222" stroke-width="20"/>
    <rect x="280" y="-260" width="40" height="60" fill="#795548" stroke="#222" stroke-width="20"/>
  </g>`;
}

// ─── QR code pattern ─────────────────────────────────────────────────────────
function qrCode(x, y, size) {
  const cell = size / 21;
  // Schematic QR code pattern (not real data — visual only)
  const pattern = [
    [1,1,1,1,1,1,1,0,1,0,0,1,0,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,1,0,1,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,1,0,1,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,1,1,0,1,1,0,1,1,0,1,1,0,1,0,1],
    [0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,0,1,0,1,0],
    [1,0,1,1,0,1,1,1,0,1,0,0,1,1,0,1,1,0,1,0,1],
    [0,1,0,0,1,0,0,1,1,0,1,0,0,1,1,0,0,1,0,1,0],
    [1,0,1,1,0,1,1,0,0,1,0,1,1,0,0,1,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,1,1,0,0,1,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,0,0,1,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,0,1,1,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,1,0,0,1,0,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,0,1,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,0,0,1,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,1,0,0,1,1,1,1,1,1,1],
  ];
  let out = `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="white" rx="12"/>`;
  pattern.forEach((row, ri) => {
    row.forEach((col, ci) => {
      if (col) {
        out += `<rect x="${x + ci*cell}" y="${y + ri*cell}" width="${cell}" height="${cell}" fill="#1e1b2e" rx="1"/>`;
      }
    });
  });
  return out;
}

// ─── SCREENSHOT 1: Home / Generate ───────────────────────────────────────────
async function screenshot1() {
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ff7043"/>
      <stop offset="100%" style="stop-color:#ff4757"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${statusBar('17:49')}
  ${appHeader()}

  <!-- Tagline -->
  <text x="${W/2}" y="240" text-anchor="middle" font-family="Arial" font-size="36" fill="${C.muted}">Draw it · Color it · Love it 🌈</text>

  <!-- Daily challenge chip -->
  <rect x="${W/2-220}" y="270" width="440" height="68" rx="34" fill="${C.yellow}" opacity="0.9"/>
  <text x="${W/2}" y="311" text-anchor="middle" font-family="Arial" font-size="28" font-weight="700" fill="#5a3e00">🌟 Today: dragon</text>

  <!-- Example suggestion chips -->
  <rect x="40" y="365" width="200" height="58" rx="29" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="140" y="400" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.ink}">🦋 butterfly</text>
  <rect x="256" y="365" width="200" height="58" rx="29" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="356" y="400" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.ink}">🚀 rocket</text>
  <rect x="472" y="365" width="200" height="58" rx="29" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="572" y="400" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.ink}">🦄 unicorn</text>
  <rect x="688" y="365" width="200" height="58" rx="29" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="788" y="400" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.ink}">🏰 castle</text>
  <rect x="904" y="365" width="136" height="58" rx="29" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="972" y="400" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.ink}">🎲</text>

  <!-- Search bar -->
  <rect x="32" y="448" width="${W-64}" height="100" rx="50" fill="${C.card}" stroke="${C.purple}" stroke-width="3"/>
  <text x="88" y="508" font-family="Arial" font-size="36" fill="${C.ink}">shark playing guitar</text>
  <circle cx="${W-80}" cy="498" r="36" fill="${C.purple}"/>
  <text x="${W-80}" y="508" text-anchor="middle" font-family="Arial" font-size="26" fill="white">💡</text>

  <!-- Draw button + Again -->
  <rect x="32" y="568" width="720" height="100" rx="50" fill="url(#btnGrad)"/>
  <text x="392" y="628" text-anchor="middle" font-family="Arial Black, Arial" font-size="46" font-weight="900" fill="white">Draw! ✨</text>
  <rect x="768" y="568" width="280" height="100" rx="50" fill="${C.card}" stroke="${C.border}" stroke-width="3"/>
  <text x="908" y="628" text-anchor="middle" font-family="Arial" font-size="34" fill="${C.ink}">🎲 Again!</text>

  <!-- Options pill -->
  <rect x="32" y="686" width="260" height="72" rx="36" fill="${C.card}" stroke="${C.border}" stroke-width="2" stroke-dasharray="8,4"/>
  <text x="162" y="729" text-anchor="middle" font-family="Arial" font-size="30" fill="${C.muted}">⚙️ Options ▾</text>

  <!-- Options panel (open) -->
  <rect x="32" y="774" width="${W-64}" height="340" rx="22" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>

  <!-- Difficulty row -->
  <text x="72" y="830" font-family="Arial" font-size="28" font-weight="700" fill="${C.muted}">Difficulty</text>
  <rect x="68" y="848" width="155" height="54" rx="27" fill="${C.bg}" stroke="${C.border}" stroke-width="2"/>
  <text x="145" y="882" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.ink}">Easy 🌟</text>
  <rect x="235" y="848" width="195" height="54" rx="27" fill="${C.purple}"/>
  <text x="332" y="882" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="white">Medium 🌟🌟</text>
  <rect x="442" y="848" width="175" height="54" rx="27" fill="${C.bg}" stroke="${C.border}" stroke-width="2"/>
  <text x="529" y="882" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.ink}">Hard 🌟🌟🌟</text>
  <rect x="629" y="848" width="195" height="54" rx="27" fill="${C.bg}" stroke="${C.border}" stroke-width="2"/>
  <text x="726" y="882" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.ink}">Extreme 🔥</text>

  <!-- Colors row -->
  <text x="72" y="950" font-family="Arial" font-size="28" font-weight="700" fill="${C.muted}">Colors</text>
  ${[6,12,18,24].map((n,i) => {
    const bx = 68 + i*190;
    const active = n === 12;
    return `<rect x="${bx}" y="966" width="165" height="54" rx="27" fill="${active ? C.purple : C.bg}" stroke="${active ? 'none' : C.border}" stroke-width="2"/>
    <text x="${bx+82}" y="1000" text-anchor="middle" font-family="Arial" font-size="${active?'28':'24'}" font-weight="${active?'700':'400'}" fill="${active?'white':C.ink}">${n}</text>`;
  }).join('')}
  <!-- Color by number toggle -->
  <rect x="832" y="966" width="200" height="54" rx="27" fill="${C.green}" opacity="0.15" stroke="${C.green}" stroke-width="2"/>
  <text x="932" y="1000" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.green}">🔢 by number</text>

  <!-- Palette row -->
  <text x="72" y="1070" font-family="Arial" font-size="28" font-weight="700" fill="${C.muted}">Palette</text>
  <rect x="68" y="1086" width="290" height="54" rx="27" fill="${C.purple}"/>
  <text x="213" y="1120" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="white">🖍️ Classic crayons</text>
  <rect x="370" y="1086" width="245" height="54" rx="27" fill="${C.bg}" stroke="${C.border}" stroke-width="2"/>
  <text x="492" y="1120" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.ink}">🌸 Soft pastels</text>
  <rect x="627" y="1086" width="175" height="54" rx="27" fill="${C.bg}" stroke="${C.border}" stroke-width="2"/>
  <text x="714" y="1120" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.ink}">🌿 Nature</text>

  <!-- Canvas area empty state -->
  <rect x="32" y="1134" width="${W-64}" height="630" rx="22" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <!-- Paintbrush illustration -->
  <g transform="translate(${W/2}, 1450) rotate(-45)">
    <rect x="-20" y="-200" width="40" height="320" rx="20" fill="${C.blue}"/>
    <path d="M-20,120 Q-20,180 0,200 Q20,180 20,120Z" fill="${C.orange}"/>
    <ellipse cx="0" cy="200" rx="18" ry="8" fill="${C.pink}" opacity="0.8"/>
  </g>
  <text x="${W/2}" y="1640" text-anchor="middle" font-family="Arial" font-size="38" fill="${C.muted}">Your picture will</text>
  <text x="${W/2}" y="1686" text-anchor="middle" font-family="Arial" font-size="38" fill="${C.muted}">appear here!</text>

  <!-- Bottom toolbars -->
  ${bottomToolbar(1778)}
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, '1-create.png'));
  console.log('✓ 1-create.png');
}

// ─── SCREENSHOT 2: Coloring butterfly (half-filled) ──────────────────────────
async function screenshot2() {
  // Some regions colored, some blank
  const colored = {1:'#ff4757',2:'#7c4dff',5:'#ff7043',6:'#f06292',9:'#795548',10:'#00bcd4'};

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${statusBar('17:51')}
  ${appHeader()}

  <!-- Search bar (compact) -->
  <rect x="32" y="204" width="${W-180}" height="80" rx="40" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="76" y="252" font-family="Arial" font-size="32" fill="${C.ink}">butterfly</text>
  <rect x="${W-134}" y="204" width="102" height="80" rx="40" fill="${C.bg}" stroke="${C.border}" stroke-width="2"/>
  <text x="${W-83}" y="252" text-anchor="middle" font-family="Arial" font-size="28" fill="${C.ink}">🎲</text>

  <!-- Canvas -->
  <rect x="0" y="300" width="${W}" height="1140" fill="${C.card}"/>

  <!-- Butterfly artwork centered in canvas -->
  ${butterflyArt(W/2, 870, 1.38, colored)}

  <!-- Coloring hint banner -->
  <rect x="32" y="310" width="${W-64}" height="60" rx="30" fill="${C.purple}" opacity="0.1"/>
  <text x="${W/2}" y="348" text-anchor="middle" font-family="Arial" font-size="27" fill="${C.purple}">🔢 Tap a number, then tap a color to fill!</text>

  <!-- Active region highlight hint -->
  <rect x="32" y="1380" width="${W-64}" height="60" rx="30" fill="${C.yellow}" opacity="0.8"/>
  <text x="${W/2}" y="1418" text-anchor="middle" font-family="Arial" font-size="27" font-weight="700" fill="#5a3e00">6 of 12 regions colored — keep going!</text>

  <!-- Color palette strip -->
  ${colorPaletteStrip(1450, C.pink, 7)}

  <!-- Toolbars -->
  ${bottomToolbar(1598)}
  ${actionBar(1690)}

  <!-- Status -->
  <rect x="0" y="1796" width="${W}" height="124" fill="${C.bg}"/>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, '2-color-by-number.png'));
  console.log('✓ 2-color-by-number.png');
}

// ─── SCREENSHOT 3: Gallery ────────────────────────────────────────────────────
async function screenshot3() {
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${statusBar('17:53')}
  ${appHeader()}

  <!-- Gallery heading -->
  <text x="${W/2}" y="254" text-anchor="middle" font-family="Arial Black, Arial" font-size="52" font-weight="900" fill="${C.ink}">🖼️ My Gallery</text>
  <text x="${W/2}" y="296" text-anchor="middle" font-family="Arial" font-size="30" fill="${C.muted}">6 saved artworks</text>

  <!-- Gallery grid: 2 columns × 3 rows -->
  ${[
    { label:'butterfly', fn: (cx,cy)=>miniButterfly(cx,cy,0.14), col:0, row:0, bg:'#fff0f3' },
    { label:'dragon',    fn: (cx,cy)=>miniDragon(cx,cy,0.12),    col:1, row:0, bg:'#f0fff4' },
    { label:'rocket',    fn: (cx,cy)=>miniRocket(cx,cy,0.12),    col:0, row:1, bg:'#f0f4ff' },
    { label:'unicorn',   fn: (cx,cy)=>miniUnicorn(cx,cy,0.12),   col:1, row:1, bg:'#fff8f0' },
    { label:'castle',    fn: (cx,cy)=>miniCastle(cx,cy,0.12),    col:0, row:2, bg:'#f5f0ff' },
    { label:'shark',     fn: (cx,cy)=>miniRocket(cx,cy,0.12),    col:1, row:2, bg:'#f0f8ff' },
  ].map(({ label, fn, col, row, bg }) => {
    const cw = (W - 64 - 24) / 2;
    const ch = 360;
    const x  = 32 + col * (cw + 24);
    const y  = 330 + row * (ch + 20);
    const cx = x + cw/2;
    const cy = y + (ch - 60) / 2;
    return `
    <rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="22" fill="${bg}" stroke="${C.border}" stroke-width="2"/>
    ${fn(cx, cy)}
    <!-- Label bar -->
    <rect x="${x}" y="${y+ch-64}" width="${cw}" height="64" rx="0 0 22 22" fill="rgba(255,255,255,0.9)"/>
    <rect x="${x}" y="${y+ch-64}" width="${cw}" height="64" rx="0 0 22 22" fill="none" stroke="${C.border}" stroke-width="2"/>
    <text x="${cx}" y="${y+ch-26}" text-anchor="middle" font-family="Arial" font-size="28" font-weight="700" fill="${C.ink}">${label}</text>`;
  }).join('')}
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, '3-gallery.png'));
  console.log('✓ 3-gallery.png');
}

// ─── SCREENSHOT 4: Daily Challenge ───────────────────────────────────────────
async function screenshot4() {
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="challengeBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#7c4dff;stop-opacity:0.12"/>
      <stop offset="100%" style="stop-color:#ff7043;stop-opacity:0.06"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${statusBar('09:00')}
  ${appHeader()}

  <!-- Full-width challenge card -->
  <rect x="32" y="210" width="${W-64}" height="820" rx="32" fill="url(#challengeBg)" stroke="${C.purple}" stroke-width="3"/>

  <!-- Star icon -->
  <text x="${W/2}" y="340" text-anchor="middle" font-family="Arial" font-size="120">⭐</text>

  <!-- "Daily Challenge" heading -->
  <text x="${W/2}" y="440" text-anchor="middle" font-family="Arial Black, Arial" font-size="54" font-weight="900" fill="${C.purple}">Daily Challenge!</text>
  <text x="${W/2}" y="498" text-anchor="middle" font-family="Arial" font-size="32" fill="${C.muted}">Everyone colors the same word today</text>

  <!-- Word box -->
  <rect x="200" y="532" width="${W-400}" height="160" rx="32" fill="${C.purple}"/>
  <text x="${W/2}" y="592" text-anchor="middle" font-family="Arial" font-size="36" fill="rgba(255,255,255,0.7)">Today's word</text>
  <text x="${W/2}" y="666" text-anchor="middle" font-family="Arial Black, Arial" font-size="72" font-weight="900" fill="white">dragon</text>

  <!-- Stats row -->
  <rect x="72" y="730" width="280" height="120" rx="22" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="212" y="784" text-anchor="middle" font-family="Arial" font-size="50" font-weight="700" fill="${C.orange}">🔥 847</text>
  <text x="212" y="826" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.muted}">colorists today</text>

  <rect x="400" y="730" width="280" height="120" rx="22" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="540" y="784" text-anchor="middle" font-family="Arial" font-size="50" font-weight="700" fill="${C.purple}">🎨 #3</text>
  <text x="540" y="826" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.muted}">your best rank</text>

  <rect x="728" y="730" width="280" height="120" rx="22" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="868" y="784" text-anchor="middle" font-family="Arial" font-size="50" font-weight="700" fill="${C.green}">⏱️ 14h</text>
  <text x="868" y="826" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.muted}">left today</text>

  <!-- Try it button -->
  <rect x="160" y="888" width="${W-320}" height="110" rx="55" fill="${C.orange}"/>
  <text x="${W/2}" y="954" text-anchor="middle" font-family="Arial Black, Arial" font-size="48" font-weight="900" fill="white">Draw today's dragon! ✨</text>

  <!-- Previous challenges -->
  <text x="72" y="1090" font-family="Arial Black, Arial" font-size="36" font-weight="700" fill="${C.ink}">Previous challenges</text>
  ${[
    {word:'butterfly', emoji:'🦋', c:C.pink},
    {word:'rocket',    emoji:'🚀', c:C.blue},
    {word:'unicorn',   emoji:'🦄', c:C.purple},
    {word:'castle',    emoji:'🏰', c:C.gray},
    {word:'cat',       emoji:'🐱', c:C.orange},
  ].map(({word,emoji,c},i) => {
    const x = 72 + i * 192;
    return `
    <rect x="${x}" y="1110" width="170" height="170" rx="22" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
    <text x="${x+85}" y="1180" text-anchor="middle" font-family="Arial" font-size="60">${emoji}</text>
    <text x="${x+85}" y="1260" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.muted}">${word}</text>`;
  }).join('')}

  <!-- Dragon coloring preview (mini) -->
  ${dragonArt(W/2, 1560, 0.5, {1:'#26c281',2:'#ff7043',3:'#7c4dff',4:'#7c4dff',5:'#ff4757',6:'#ffca28'})}

  <!-- Tagline -->
  <text x="${W/2}" y="1840" text-anchor="middle" font-family="Arial" font-size="32" fill="${C.muted}">Race your friends! New word every day.</text>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, '4-daily-challenge.png'));
  console.log('✓ 4-daily-challenge.png');
}

// ─── SCREENSHOT 5: Challenge a Friend ────────────────────────────────────────
async function screenshot5() {
  const fullyColored = {1:'#ff4757',2:'#7c4dff',3:'#ffca28',4:'#1e90ff',
    5:'#ff7043',6:'#f06292',7:'#26c281',8:'#ff6b6b',9:'#795548',10:'#00bcd4',11:'#ff4757',12:'#ffca28'};

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#7c4dff"/>
      <stop offset="100%" style="stop-color:#9c4dff"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${statusBar('17:55')}
  ${appHeader()}

  <!-- Challenge modal card -->
  <rect x="32" y="210" width="${W-64}" height="1650" rx="32" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>

  <!-- Modal header -->
  <rect x="32" y="210" width="${W-64}" height="130" rx="32 32 0 0" fill="url(#headerGrad)"/>
  <rect x="32" y="274" width="${W-64}" height="66" fill="url(#headerGrad)"/>
  <text x="${W/2}" y="294" text-anchor="middle" font-family="Arial Black, Arial" font-size="48" font-weight="900" fill="white">🏆 Challenge a Friend!</text>
  <text x="${W/2}" y="332" text-anchor="middle" font-family="Arial" font-size="28" fill="rgba(255,255,255,0.85)">Share the same picture — race to finish first!</text>

  <!-- Your artwork preview -->
  <text x="${W/2}" y="410" text-anchor="middle" font-family="Arial" font-size="32" font-weight="700" fill="${C.muted}">Your artwork: butterfly</text>

  <!-- Small butterfly preview (fully colored) -->
  <rect x="340" y="424" width="400" height="360" rx="22" fill="#fff0f8" stroke="${C.border}" stroke-width="2"/>
  ${butterflyArt(W/2, 604, 0.52, fullyColored)}

  <!-- Divider -->
  <line x1="72" y1="808" x2="${W-72}" y2="808" stroke="${C.border}" stroke-width="2"/>

  <!-- Share via QR -->
  <text x="${W/2}" y="860" text-anchor="middle" font-family="Arial Black, Arial" font-size="36" font-weight="700" fill="${C.ink}">Share via QR code</text>
  ${qrCode(W/2 - 200, 880, 400)}
  <text x="${W/2}" y="1310" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.muted}">Friends scan this to join your challenge</text>

  <!-- Divider -->
  <line x1="72" y1="1340" x2="${W-72}" y2="1340" stroke="${C.border}" stroke-width="2"/>

  <!-- Or share link -->
  <text x="${W/2}" y="1390" text-anchor="middle" font-family="Arial Black, Arial" font-size="36" font-weight="700" fill="${C.ink}">Or share a link</text>

  <!-- Link box -->
  <rect x="72" y="1410" width="${W-144}" height="80" rx="40" fill="${C.bg}" stroke="${C.border}" stroke-width="2"/>
  <text x="130" y="1460" font-family="Arial" font-size="28" fill="${C.muted}">lalabuba.com/c/</text>
  <text x="130" y="1460" dx="286" font-family="Arial" font-size="28" fill="${C.purple}">a7f9k2</text>

  <!-- CTA buttons -->
  <rect x="72" y="1512" width="${W-144}" height="96" rx="48" fill="${C.purple}"/>
  <text x="${W/2}" y="1570" text-anchor="middle" font-family="Arial Black, Arial" font-size="38" font-weight="700" fill="white">📋 Copy link</text>

  <rect x="72" y="1624" width="450" height="96" rx="48" fill="${C.bg}" stroke="${C.border}" stroke-width="3"/>
  <text x="297" y="1682" text-anchor="middle" font-family="Arial" font-size="34" fill="${C.ink}">📤 Share…</text>

  <rect x="558" y="1624" width="450" height="96" rx="48" fill="${C.bg}" stroke="${C.border}" stroke-width="3"/>
  <text x="783" y="1682" text-anchor="middle" font-family="Arial" font-size="34" fill="${C.ink}">✉️ WhatsApp</text>

  <!-- Close button -->
  <text x="${W/2}" y="1800" text-anchor="middle" font-family="Arial" font-size="30" fill="${C.muted}">Tap outside to close</text>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, '5-challenge.png'));
  console.log('✓ 5-challenge.png');
}

// ─── Run ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Generating 5 screenshots → ${OUT}\n`);
  try {
    await screenshot1();
    await screenshot2();
    await screenshot3();
    await screenshot4();
    await screenshot5();
    console.log(`\nDone. Files are in:\n  android/play-store-listing/screenshots/en/`);
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
