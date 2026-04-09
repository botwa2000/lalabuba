#!/usr/bin/env node
/**
 * Generates Android Play Store tablet screenshots.
 *   7-inch  : 1280×800  px (landscape)
 *  10-inch  : 1920×1200 px (landscape)
 *
 * Screens per size:
 *  1. Home / Generate
 *  2. Coloring in progress (palette sidebar + large canvas)
 *  3. Gallery (3-col / 4-col grid)
 *  4. Daily Challenge (two-panel)
 *
 * Output:
 *   android/play-store-listing/screenshots/en/tablet-7/
 *   android/play-store-listing/screenshots/en/tablet-10/
 */
'use strict';
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const OUT7  = path.join(__dirname, 'play-store-listing', 'screenshots', 'en', 'tablet-7');
const OUT10 = path.join(__dirname, 'play-store-listing', 'screenshots', 'en', 'tablet-10');
fs.mkdirSync(OUT7,  { recursive: true });
fs.mkdirSync(OUT10, { recursive: true });

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:     '#eef6ff', card:   '#ffffff', ink:    '#1e1b2e', muted:  '#7a7a9a',
  border: '#e0e8f4', purple: '#7c4dff', pink:   '#f06292', orange: '#ff7043',
  green:  '#26c281', yellow: '#ffca28', blue:   '#1e90ff', red:    '#ff4757',
  coral:  '#ff6b6b', teal:   '#00bcd4', brown:  '#795548', gray:   '#9e9e9e',
  dkblue: '#3f51b5',
};

const PALETTE = [
  {n:1,c:'#ff4757'},{n:2,c:'#ff7043'},{n:3,c:'#ffca28'},{n:4,c:'#26c281'},
  {n:5,c:'#1e90ff'},{n:6,c:'#7c4dff'},{n:7,c:'#f06292'},{n:8,c:'#ff6b6b'},
  {n:9,c:'#00bcd4'},{n:10,c:'#795548'},{n:11,c:'#9e9e9e'},{n:12,c:'#3f51b5'},
];

// ─── Artwork (same SVG logic as phone generator) ──────────────────────────────
function butterflyArt(cx, cy, scale, coloredRegions = {}) {
  const s = scale; const fill = n => coloredRegions[n] || 'white'; const sw = 3.5*s;
  const pos = {1:[-200,-140],2:[200,-140],3:[-175,120],4:[175,120],
               5:[-195,-150],6:[195,-150],7:[-170,130],8:[170,130],
               9:[0,0],10:[0,-240],11:[-70,-360],12:[70,-360]};
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    <ellipse cx="-200" cy="-140" rx="185" ry="200" fill="${fill(1)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="200" cy="-140" rx="185" ry="200" fill="${fill(2)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="-175" cy="120" rx="145" ry="160" fill="${fill(3)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="175" cy="120" rx="145" ry="160" fill="${fill(4)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="-195" cy="-150" rx="55" ry="65" fill="${fill(5)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="195" cy="-150" rx="55" ry="65" fill="${fill(6)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="-170" cy="130" r="50" fill="${fill(7)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="170" cy="130" r="50" fill="${fill(8)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="0" cy="0" rx="32" ry="220" fill="${fill(9)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="0" cy="-240" r="45" fill="${fill(10)}" stroke="#222" stroke-width="${sw}"/>
    <line x1="-20" y1="-278" x2="-70" y2="-360" stroke="#222" stroke-width="${sw}" stroke-linecap="round"/>
    <line x1="20" y1="-278" x2="70" y2="-360" stroke="#222" stroke-width="${sw}" stroke-linecap="round"/>
    <circle cx="-70" cy="-360" r="14" fill="${fill(11)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="70" cy="-360" r="14" fill="${fill(12)}" stroke="#222" stroke-width="${sw}"/>
    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>{
      const[nx,ny]=pos[n]; const bg=coloredRegions[n]?'rgba(0,0,0,0.25)':'rgba(255,255,255,0.85)';
      const fc=coloredRegions[n]?'white':C.ink;
      return `<circle cx="${nx}" cy="${ny}" r="22" fill="${bg}"/>
      <text x="${nx}" y="${ny+8}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="${fc}">${n}</text>`;
    }).join('')}
  </g>`;
}

function dragonArt(cx, cy, scale, coloredRegions = {}) {
  const s = scale; const fill = n => coloredRegions[n] || 'white'; const sw = 3.5*s;
  const pos = {1:[0,80],2:[0,-210],3:[-280,-220],4:[280,-220],5:[220,390],
               6:[0,120],7:[0,-250],8:[0,-380],9:[0,360],10:[0,-130]};
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    <ellipse cx="0" cy="80" rx="200" ry="260" fill="${fill(1)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="0" cy="-220" rx="150" ry="130" fill="${fill(2)}" stroke="#222" stroke-width="${sw}"/>
    <rect x="-60" y="-100" width="120" height="160" rx="40" fill="${fill(2)}" stroke="#222" stroke-width="${sw}"/>
    <path d="M -200 -60 Q -420 -280 -340 -420 Q -160 -300 -160 -60 Z" fill="${fill(3)}" stroke="#222" stroke-width="${sw}"/>
    <path d="M 200 -60 Q 420 -280 340 -420 Q 160 -300 160 -60 Z" fill="${fill(4)}" stroke="#222" stroke-width="${sw}"/>
    <path d="M 160 280 Q 320 380 280 500 Q 160 420 80 320 Z" fill="${fill(5)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="0" cy="120" rx="120" ry="180" fill="${fill(6)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="-50" cy="-250" r="30" fill="${fill(7)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="-50" cy="-250" r="14" fill="#222"/>
    <circle cx="50" cy="-250" r="30" fill="${fill(7)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="50" cy="-250" r="14" fill="#222"/>
    <path d="M -20 -330 L 0 -430 L 20 -330 Z" fill="${fill(8)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="-160" cy="320" rx="55" ry="100" fill="${fill(9)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="160" cy="320" rx="55" ry="100" fill="${fill(9)}" stroke="#222" stroke-width="${sw}"/>
    <path d="M -60 -80 L -80 -180 L -20 -100 Z" fill="${fill(10)}" stroke="#222" stroke-width="${sw}"/>
    <path d="M 0 -90 L 0 -200 L 40 -110 Z" fill="${fill(10)}" stroke="#222" stroke-width="${sw}"/>
    <path d="M 60 -80 L 80 -180 L 20 -100 Z" fill="${fill(10)}" stroke="#222" stroke-width="${sw}"/>
    ${[1,2,3,4,5,6,7,8,9,10].map(n=>{
      if(!pos[n])return''; const[nx,ny]=pos[n];
      const bg=coloredRegions[n]?'rgba(0,0,0,0.25)':'rgba(255,255,255,0.85)';
      const fc=coloredRegions[n]?'white':C.ink;
      return `<circle cx="${nx}" cy="${ny}" r="24" fill="${bg}"/>
      <text x="${nx}" y="${ny+9}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="${fc}">${n}</text>`;
    }).join('')}
  </g>`;
}

// ─── Mini thumbnails ──────────────────────────────────────────────────────────
const FULL_BUTTERFLY = {1:'#ff4757',2:'#7c4dff',3:'#ffca28',4:'#1e90ff',
  5:'#ff7043',6:'#f06292',7:'#26c281',8:'#ff6b6b',9:'#795548',10:'#00bcd4',11:'#ff4757',12:'#ffca28'};
const FULL_DRAGON = {1:'#26c281',2:'#ff7043',3:'#7c4dff',4:'#7c4dff',
  5:'#ff4757',6:'#ffca28',7:'#ff4757',8:'#ffca28',9:'#795548',10:'#ff6b6b'};

const miniButterfly = (cx,cy,s=0.15) => butterflyArt(cx,cy,s,FULL_BUTTERFLY);
const miniDragon    = (cx,cy,s=0.12) => dragonArt(cx,cy,s,FULL_DRAGON);
function miniRocket(cx,cy,s=0.13){
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    <path d="M0,-350 C120,-200 160,-50 140,200 L-140,200 C-160,-50 -120,-200 0,-350Z" fill="#1e90ff" stroke="#222" stroke-width="25"/>
    <path d="M-140,200 L-280,380 L-140,340 L-100,480 L0,340" fill="#ff4757" stroke="#222" stroke-width="25"/>
    <path d="M140,200 L280,380 L140,340 L100,480 L0,340" fill="#ff4757" stroke="#222" stroke-width="25"/>
    <circle cx="0" cy="-100" r="90" fill="#ffca28" stroke="#222" stroke-width="25"/>
    <path d="M-140,200 L140,200 L140,340 L-140,340Z" fill="#ff7043" stroke="#222" stroke-width="25"/>
  </g>`;
}
function miniUnicorn(cx,cy,s=0.13){
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    <ellipse cx="80" cy="100" rx="200" ry="130" fill="#f06292" stroke="#222" stroke-width="25"/>
    <circle cx="-60" cy="-80" r="120" fill="#f06292" stroke="#222" stroke-width="25"/>
    <ellipse cx="-60" cy="-200" rx="30" ry="18" fill="#ffca28"/>
    <ellipse cx="280" cy="160" rx="35" ry="90" fill="#f06292" stroke="#222" stroke-width="25"/>
    <ellipse cx="100" cy="220" rx="35" ry="90" fill="#f06292" stroke="#222" stroke-width="25"/>
    <circle cx="-95" cy="-110" r="20" fill="#222"/>
    <path d="M60,-120 Q120,-280 0,-340 Q-80,-200 20,-80Z" fill="#7c4dff" stroke="#222" stroke-width="20"/>
    <path d="M80,-140 Q160,-300 60,-380 Q-40,-240 60,-100Z" fill="#ff7043" stroke="#222" stroke-width="20"/>
  </g>`;
}
function miniCastle(cx,cy,s=0.14){
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    <rect x="-250" y="-80" width="500" height="380" fill="#9e9e9e" stroke="#222" stroke-width="25"/>
    <rect x="-320" y="-200" width="140" height="240" rx="10" fill="#795548" stroke="#222" stroke-width="25"/>
    <rect x="180" y="-200" width="140" height="240" rx="10" fill="#795548" stroke="#222" stroke-width="25"/>
    <rect x="-120" y="-160" width="240" height="180" rx="10" fill="#9e9e9e" stroke="#222" stroke-width="25"/>
    <path d="M-80,300 L-80,60 Q0,-30 80,60 L80,300Z" fill="#222"/>
    <rect x="-100" y="-80" width="80" height="80" fill="#1e90ff" stroke="#222" stroke-width="20"/>
    <rect x="20" y="-80" width="80" height="80" fill="#1e90ff" stroke="#222" stroke-width="20"/>
    <rect x="-320" y="-260" width="40" height="60" fill="#795548" stroke="#222" stroke-width="20"/>
    <rect x="-240" y="-260" width="40" height="60" fill="#795548" stroke="#222" stroke-width="20"/>
    <rect x="200" y="-260" width="40" height="60" fill="#795548" stroke="#222" stroke-width="20"/>
    <rect x="280" y="-260" width="40" height="60" fill="#795548" stroke="#222" stroke-width="20"/>
  </g>`;
}

// ─── QR code ─────────────────────────────────────────────────────────────────
function qrCode(x, y, size) {
  const cell = size / 21;
  const p = [
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
  let out = `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="white" rx="10"/>`;
  p.forEach((row,ri)=>row.forEach((v,ci)=>{
    if(v) out+=`<rect x="${x+ci*cell}" y="${y+ri*cell}" width="${cell}" height="${cell}" fill="#1e1b2e" rx="1"/>`;
  }));
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7-INCH TABLET  1280 × 800  (landscape)
// ═══════════════════════════════════════════════════════════════════════════════
const W7 = 1280, H7 = 800, SB7 = 46;   // SB = status-bar height
const SIDE7 = 420, MAIN7 = W7 - SIDE7; // MAIN7 = 860

function sb7(time = '17:49') {
  return `<rect x="0" y="0" width="${W7}" height="${SB7}" fill="${C.bg}"/>
  <text x="24" y="32" font-family="Arial" font-size="22" font-weight="700" fill="${C.ink}">${time}</text>
  <rect x="${W7-68}" y="12" width="46" height="24" rx="5" fill="none" stroke="${C.ink}" stroke-width="2"/>
  <rect x="${W7-22}" y="18" width="5" height="12" rx="2" fill="${C.ink}" opacity="0.4"/>
  <rect x="${W7-64}" y="14" width="34" height="20" rx="3" fill="${C.green}"/>
  <text x="${W7-47}" y="29" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="white">83</text>
  <text x="${W7-88}" y="31" font-family="Arial" font-size="15" font-weight="700" fill="${C.ink}">5G</text>`;
}

function leftSidebar7(active = 'create') {
  const nav = [{id:'create',lbl:'🏠 Create'},{id:'gallery',lbl:'🖼️ Gallery'},{id:'daily',lbl:'⭐ Daily'}];
  let o = `<rect x="0" y="${SB7}" width="${SIDE7}" height="${H7-SB7}" fill="${C.card}"/>
  <rect x="${SIDE7-1}" y="${SB7}" width="1" height="${H7-SB7}" fill="${C.border}"/>
  <text x="${SIDE7/2}" y="${SB7+64}" text-anchor="middle" font-family="Arial Black,Arial" font-size="38" font-weight="900" fill="${C.purple}">Lalabuba</text>
  <text x="${SIDE7/2}" y="${SB7+88}" text-anchor="middle" font-family="Arial" font-size="18" fill="${C.muted}">Color by number 🎨</text>`;
  nav.forEach(({id,lbl},i)=>{
    const on = id===active;
    const ty = SB7+112+i*64;
    o += `<rect x="16" y="${ty}" width="${SIDE7-32}" height="50" rx="25" fill="${on?C.purple:C.bg}" stroke="${on?'none':C.border}" stroke-width="1"/>
    <text x="${SIDE7/2}" y="${ty+32}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="${on?'700':'400'}" fill="${on?'white':C.ink}">${lbl}</text>`;
  });
  return o;
}

function palette7(activeN = null) {
  // 2 rows × 6 cols of swatches inside left panel
  const sw=44, gap=8, cols=6;
  const sx = (SIDE7-(cols*(sw+gap)-gap))/2;
  const sy = SB7+316;
  let o=`<text x="${SIDE7/2}" y="${sy-10}" text-anchor="middle" font-family="Arial" font-size="17" font-weight="700" fill="${C.muted}">Color palette</text>`;
  PALETTE.forEach(({n,c},i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const x=sx+col*(sw+gap), y=sy+row*(sw+gap+4);
    const on=n===activeN;
    o+=`<rect x="${x}" y="${y}" width="${sw}" height="${sw}" rx="${sw/2}" fill="${c}" ${on?`stroke="${C.ink}" stroke-width="4"`:''} />
    <text x="${x+sw/2}" y="${y+sw/2+7}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700" fill="white">${n}</text>`;
  });
  return o;
}

// ── 7-inch screen 1: Home ────────────────────────────────────────────────────
async function t7s1() {
  const RX = SIDE7+20, RW = MAIN7-40; // right-content x, width (fits within 1260)
  const svg = `<svg width="${W7}" height="${H7}" viewBox="0 0 ${W7} ${H7}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" style="stop-color:#ff7043"/><stop offset="100%" style="stop-color:#ff4757"/>
  </linearGradient></defs>
  <rect width="${W7}" height="${H7}" fill="${C.bg}"/>
  ${sb7('17:49')}
  ${leftSidebar7('create')}

  <!-- Search bar -->
  <rect x="${RX}" y="58" width="${RW}" height="58" rx="29" fill="${C.card}" stroke="${C.purple}" stroke-width="2"/>
  <text x="${RX+38}" y="93" font-family="Arial" font-size="24" fill="${C.ink}">shark playing guitar</text>
  <circle cx="${W7-40}" cy="87" r="24" fill="${C.purple}"/>
  <text x="${W7-40}" y="95" text-anchor="middle" font-family="Arial" font-size="18" fill="white">💡</text>

  <!-- Draw + Again -->
  <rect x="${RX}" y="128" width="658" height="62" rx="31" fill="url(#bg)"/>
  <text x="${RX+329}" y="167" text-anchor="middle" font-family="Arial Black,Arial" font-size="30" font-weight="900" fill="white">Draw! ✨</text>
  <rect x="${W7-170}" y="128" width="150" height="62" rx="31" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="${W7-95}" y="167" text-anchor="middle" font-family="Arial" font-size="22" fill="${C.ink}">🎲 Again</text>

  <!-- Options panel -->
  <rect x="${RX}" y="204" width="${RW}" height="290" rx="18" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="${RX+20}" y="238" font-family="Arial" font-size="17" font-weight="700" fill="${C.muted}">Difficulty</text>
  ${['Easy','Medium','Hard','Extreme'].map((d,i)=>{
    const on=d==='Medium', bx=RX+20+i*200;
    return `<rect x="${bx}" y="246" width="178" height="44" rx="22" fill="${on?C.purple:C.bg}" stroke="${on?'none':C.border}" stroke-width="1"/>
    <text x="${bx+89}" y="274" text-anchor="middle" font-family="Arial" font-size="17" font-weight="${on?'700':'400'}" fill="${on?'white':C.ink}">${d}</text>`;
  }).join('')}
  <text x="${RX+20}" y="326" font-family="Arial" font-size="17" font-weight="700" fill="${C.muted}">Colors</text>
  ${[6,12,18,24].map((n,i)=>{
    const on=n===12, bx=RX+20+i*160;
    return `<rect x="${bx}" y="334" width="140" height="44" rx="22" fill="${on?C.purple:C.bg}" stroke="${on?'none':C.border}" stroke-width="1"/>
    <text x="${bx+70}" y="362" text-anchor="middle" font-family="Arial" font-size="17" font-weight="${on?'700':'400'}" fill="${on?'white':C.ink}">${n}</text>`;
  }).join('')}
  <text x="${RX+20}" y="412" font-family="Arial" font-size="17" font-weight="700" fill="${C.muted}">Palette</text>
  <rect x="${RX+20}" y="420" width="198" height="44" rx="22" fill="${C.purple}"/>
  <text x="${RX+119}" y="448" text-anchor="middle" font-family="Arial" font-size="16" font-weight="700" fill="white">🖍️ Classic</text>
  <rect x="${RX+230}" y="420" width="182" height="44" rx="22" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>
  <text x="${RX+321}" y="448" text-anchor="middle" font-family="Arial" font-size="16" fill="${C.ink}">🌸 Pastels</text>
  <rect x="${RX+424}" y="420" width="168" height="44" rx="22" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>
  <text x="${RX+508}" y="448" text-anchor="middle" font-family="Arial" font-size="16" fill="${C.ink}">🌿 Nature</text>

  <!-- Example chips -->
  ${['🦋 butterfly','🚀 rocket','🦄 unicorn','🏰 castle'].map((chip,i)=>{
    const bx=RX+20+i*206;
    return `<rect x="${bx}" y="508" width="184" height="40" rx="20" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
    <text x="${bx+92}" y="533" text-anchor="middle" font-family="Arial" font-size="16" fill="${C.ink}">${chip}</text>`;
  }).join('')}

  <!-- Empty canvas -->
  <rect x="${RX}" y="560" width="${RW}" height="218" rx="18" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <g transform="translate(${RX+RW/2},660) rotate(-45)">
    <rect x="-12" y="-100" width="24" height="170" rx="12" fill="${C.blue}"/>
    <path d="M-12,70 Q-12,100 0,112 Q12,100 12,70Z" fill="${C.orange}"/>
  </g>
  <text x="${RX+RW/2}" y="724" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.muted}">Your picture will appear here ✨</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT7,'1-create.png'));
  console.log('✓ tablet-7  1-create.png');
}

// ── 7-inch screen 2: Coloring ────────────────────────────────────────────────
async function t7s2() {
  const colored = {1:'#ff4757',2:'#7c4dff',5:'#ff7043',6:'#f06292',9:'#795548',10:'#00bcd4'};
  const svg = `<svg width="${W7}" height="${H7}" viewBox="0 0 ${W7} ${H7}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W7}" height="${H7}" fill="${C.bg}"/>
  ${sb7('17:51')}
  ${leftSidebar7('create')}
  ${palette7(7)}
  <!-- Progress -->
  <rect x="16" y="${H7-74}" width="${SIDE7-32}" height="44" rx="22" fill="${C.yellow}" opacity="0.9"/>
  <text x="${SIDE7/2}" y="${H7-45}" text-anchor="middle" font-family="Arial" font-size="17" font-weight="700" fill="#5a3e00">6 of 12 regions colored</text>
  <!-- Canvas -->
  <rect x="${SIDE7}" y="${SB7}" width="${MAIN7}" height="${H7-SB7}" fill="${C.card}"/>
  <!-- Hint banner -->
  <rect x="${SIDE7+12}" y="${SB7+10}" width="${MAIN7-24}" height="40" rx="20" fill="${C.purple}" opacity="0.1"/>
  <text x="${SIDE7+MAIN7/2}" y="${SB7+35}" text-anchor="middle" font-family="Arial" font-size="19" fill="${C.purple}">🔢 Tap a number, then tap a color to fill!</text>
  <!-- Butterfly -->
  ${butterflyArt(SIDE7+MAIN7/2, H7/2+32, 0.82, colored)}
  <!-- Active color -->
  <rect x="${W7-182}" y="${SB7+10}" width="162" height="40" rx="20" fill="${C.pink}"/>
  <text x="${W7-101}" y="${SB7+34}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="white">Color: 7 🎨</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT7,'2-coloring.png'));
  console.log('✓ tablet-7  2-coloring.png');
}

// ── 7-inch screen 3: Gallery ─────────────────────────────────────────────────
async function t7s3() {
  const items = [
    {lbl:'butterfly',fn:miniButterfly,bg:'#fff0f3'},{lbl:'dragon',fn:miniDragon,bg:'#f0fff4'},
    {lbl:'rocket',fn:miniRocket,bg:'#f0f4ff'},{lbl:'unicorn',fn:miniUnicorn,bg:'#fff8f0'},
    {lbl:'castle',fn:miniCastle,bg:'#f5f0ff'},{lbl:'shark',fn:miniRocket,bg:'#f0f8ff'},
  ];
  const cols=3, pad=20, gap=14;
  const gx=SIDE7+pad, gw=MAIN7-pad*2;
  const cw=Math.floor((gw-gap*(cols-1))/cols); // 260
  const headerH=80;
  const gy=SB7+headerH;
  const avail=H7-gy-pad;
  const ch=Math.floor((avail-gap)/2); // ≈ 327
  const svg = `<svg width="${W7}" height="${H7}" viewBox="0 0 ${W7} ${H7}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W7}" height="${H7}" fill="${C.bg}"/>
  ${sb7('17:53')}
  ${leftSidebar7('gallery')}
  <text x="${SIDE7+MAIN7/2}" y="${SB7+50}" text-anchor="middle" font-family="Arial Black,Arial" font-size="30" font-weight="900" fill="${C.ink}">🖼️ My Gallery (6)</text>
  ${items.map(({lbl,fn,bg},i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const x=gx+col*(cw+gap), y=gy+row*(ch+gap);
    const cx2=x+cw/2, cy2=y+(ch-40)/2;
    return `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="14" fill="${bg}" stroke="${C.border}" stroke-width="1"/>
    ${fn(cx2,cy2,0.11)}
    <rect x="${x}" y="${y+ch-38}" width="${cw}" height="38" rx="3" fill="rgba(255,255,255,0.92)"/>
    <text x="${cx2}" y="${y+ch-11}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="${C.ink}">${lbl}</text>`;
  }).join('')}
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT7,'3-gallery.png'));
  console.log('✓ tablet-7  3-gallery.png');
}

// ── 7-inch screen 4: Daily Challenge ─────────────────────────────────────────
async function t7s4() {
  // Split right panel into two halves: info (left) | dragon (right)
  const RX=SIDE7+16, RW=MAIN7-32;
  const infoW=Math.floor(RW*0.52); // ~448
  const dragonX=SIDE7+16+infoW+12; // start of dragon panel
  const dragonW=RW-infoW-12;       // ~384
  const svg = `<svg width="${W7}" height="${H7}" viewBox="0 0 ${W7} ${H7}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="dlg" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" style="stop-color:#7c4dff;stop-opacity:0.12"/>
    <stop offset="100%" style="stop-color:#ff7043;stop-opacity:0.06"/>
  </linearGradient></defs>
  <rect width="${W7}" height="${H7}" fill="${C.bg}"/>
  ${sb7('09:00')}
  ${leftSidebar7('daily')}

  <!-- Challenge info card -->
  <rect x="${RX}" y="${SB7+12}" width="${infoW}" height="${H7-SB7-24}" rx="20" fill="url(#dlg)" stroke="${C.purple}" stroke-width="2"/>
  <text x="${RX+infoW/2}" y="${SB7+68}" text-anchor="middle" font-family="Arial" font-size="50">⭐</text>
  <text x="${RX+infoW/2}" y="${SB7+112}" text-anchor="middle" font-family="Arial Black,Arial" font-size="26" font-weight="900" fill="${C.purple}">Daily Challenge!</text>
  <text x="${RX+infoW/2}" y="${SB7+136}" text-anchor="middle" font-family="Arial" font-size="16" fill="${C.muted}">Same word for everyone today</text>
  <!-- Word box -->
  <rect x="${RX+20}" y="${SB7+150}" width="${infoW-40}" height="96" rx="20" fill="${C.purple}"/>
  <text x="${RX+infoW/2}" y="${SB7+196}" text-anchor="middle" font-family="Arial" font-size="20" fill="rgba(255,255,255,0.7)">Today's word</text>
  <text x="${RX+infoW/2}" y="${SB7+240}" text-anchor="middle" font-family="Arial Black,Arial" font-size="44" font-weight="900" fill="white">dragon</text>
  <!-- Stats -->
  <rect x="${RX+20}" y="${SB7+260}" width="116" height="72" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
  <text x="${RX+78}" y="${SB7+302}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="${C.orange}">🔥 847</text>
  <text x="${RX+78}" y="${SB7+322}" text-anchor="middle" font-family="Arial" font-size="14" fill="${C.muted}">colorists</text>
  <rect x="${RX+148}" y="${SB7+260}" width="100" height="72" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
  <text x="${RX+198}" y="${SB7+302}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="${C.purple}">🎨 #3</text>
  <text x="${RX+198}" y="${SB7+322}" text-anchor="middle" font-family="Arial" font-size="14" fill="${C.muted}">rank</text>
  <rect x="${RX+260}" y="${SB7+260}" width="100" height="72" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
  <text x="${RX+310}" y="${SB7+302}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="${C.green}">⏱️ 14h</text>
  <text x="${RX+310}" y="${SB7+322}" text-anchor="middle" font-family="Arial" font-size="14" fill="${C.muted}">left</text>
  <!-- CTA -->
  <rect x="${RX+20}" y="${SB7+348}" width="${infoW-40}" height="56" rx="28" fill="${C.orange}"/>
  <text x="${RX+infoW/2}" y="${SB7+382}" text-anchor="middle" font-family="Arial Black,Arial" font-size="22" font-weight="900" fill="white">Draw today's dragon! ✨</text>
  <!-- Previous row -->
  <text x="${RX+20}" y="${SB7+436}" font-family="Arial" font-size="16" font-weight="700" fill="${C.ink}">Previous:</text>
  ${[{w:'butterfly',e:'🦋'},{w:'rocket',e:'🚀'},{w:'unicorn',e:'🦄'},{w:'castle',e:'🏰'}].map(({w,e},i)=>{
    const bx=RX+20+i*106;
    return `<rect x="${bx}" y="${SB7+446}" width="94" height="94" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
    <text x="${bx+47}" y="${SB7+500}" text-anchor="middle" font-family="Arial" font-size="38">${e}</text>
    <text x="${bx+47}" y="${SB7+532}" text-anchor="middle" font-family="Arial" font-size="14" fill="${C.muted}">${w}</text>`;
  }).join('')}

  <!-- Dragon artwork panel -->
  <rect x="${dragonX}" y="${SB7+12}" width="${dragonW}" height="${H7-SB7-24}" rx="20" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
  ${dragonArt(dragonX+dragonW/2, H7/2+24, 0.42, {1:'#26c281',2:'#ff7043',3:'#7c4dff',4:'#7c4dff',5:'#ff4757',6:'#ffca28'})}
  <text x="${dragonX+dragonW/2}" y="${H7-34}" text-anchor="middle" font-family="Arial" font-size="16" fill="${C.muted}">Everyone's coloring this!</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT7,'4-daily-challenge.png'));
  console.log('✓ tablet-7  4-daily-challenge.png');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10-INCH TABLET  1920 × 1200  (landscape)
// ═══════════════════════════════════════════════════════════════════════════════
const W10=1920, H10=1200, SB10=58;
const SIDE10=560, MAIN10=W10-SIDE10; // MAIN10=1360

function sb10(time='17:49'){
  return `<rect x="0" y="0" width="${W10}" height="${SB10}" fill="${C.bg}"/>
  <text x="30" y="39" font-family="Arial" font-size="28" font-weight="700" fill="${C.ink}">${time}</text>
  <rect x="${W10-80}" y="14" width="52" height="28" rx="6" fill="none" stroke="${C.ink}" stroke-width="2.5"/>
  <rect x="${W10-28}" y="20" width="6" height="16" rx="3" fill="${C.ink}" opacity="0.4"/>
  <rect x="${W10-76}" y="16" width="40" height="24" rx="4" fill="${C.green}"/>
  <text x="${W10-56}" y="33" text-anchor="middle" font-family="Arial" font-size="15" font-weight="700" fill="white">83</text>
  <text x="${W10-106}" y="38" font-family="Arial" font-size="20" font-weight="700" fill="${C.ink}">5G</text>`;
}

function leftSidebar10(active='create'){
  const nav=[{id:'create',lbl:'🏠 Create'},{id:'gallery',lbl:'🖼️ Gallery'},{id:'daily',lbl:'⭐ Daily Challenge'}];
  let o=`<rect x="0" y="${SB10}" width="${SIDE10}" height="${H10-SB10}" fill="${C.card}"/>
  <rect x="${SIDE10-1}" y="${SB10}" width="1" height="${H10-SB10}" fill="${C.border}"/>
  <text x="${SIDE10/2}" y="${SB10+80}" text-anchor="middle" font-family="Arial Black,Arial" font-size="52" font-weight="900" fill="${C.purple}">Lalabuba</text>
  <text x="${SIDE10/2}" y="${SB10+112}" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.muted}">Color by number 🎨</text>`;
  nav.forEach(({id,lbl},i)=>{
    const on=id===active, ty=SB10+140+i*78;
    o+=`<rect x="20" y="${ty}" width="${SIDE10-40}" height="62" rx="31" fill="${on?C.purple:C.bg}" stroke="${on?'none':C.border}" stroke-width="1"/>
    <text x="${SIDE10/2}" y="${ty+40}" text-anchor="middle" font-family="Arial" font-size="26" font-weight="${on?'700':'400'}" fill="${on?'white':C.ink}">${lbl}</text>`;
  });
  return o;
}

function palette10(activeN=null){
  const sw=56, gap=10, cols=6;
  const sx=(SIDE10-(cols*(sw+gap)-gap))/2;
  const sy=SB10+440;
  let o=`<text x="${SIDE10/2}" y="${sy-14}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="${C.muted}">Color palette</text>`;
  PALETTE.forEach(({n,c},i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const x=sx+col*(sw+gap), y=sy+row*(sw+gap+6);
    const on=n===activeN;
    o+=`<rect x="${x}" y="${y}" width="${sw}" height="${sw}" rx="${sw/2}" fill="${c}" ${on?`stroke="${C.ink}" stroke-width="5"`:''} />
    <text x="${x+sw/2}" y="${y+sw/2+8}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="white">${n}</text>`;
  });
  return o;
}

// ── 10-inch screen 1: Home ───────────────────────────────────────────────────
async function t10s1(){
  const RX=SIDE10+24, RW=MAIN10-48; // fits within 1920-24=1896
  const svg=`<svg width="${W10}" height="${H10}" viewBox="0 0 ${W10} ${H10}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" style="stop-color:#ff7043"/><stop offset="100%" style="stop-color:#ff4757"/>
  </linearGradient></defs>
  <rect width="${W10}" height="${H10}" fill="${C.bg}"/>
  ${sb10('17:49')}
  ${leftSidebar10('create')}

  <!-- Daily chip -->
  <rect x="${RX}" y="${SB10+10}" width="500" height="54" rx="27" fill="${C.yellow}" opacity="0.9"/>
  <text x="${RX+250}" y="${SB10+43}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="#5a3e00">🌟 Today's challenge: dragon</text>

  <!-- Search -->
  <rect x="${RX}" y="${SB10+78}" width="${RW}" height="72" rx="36" fill="${C.card}" stroke="${C.purple}" stroke-width="3"/>
  <text x="${RX+46}" y="${SB10+123}" font-family="Arial" font-size="32" fill="${C.ink}">shark playing guitar</text>
  <circle cx="${W10-52}" cy="${SB10+114}" r="30" fill="${C.purple}"/>
  <text x="${W10-52}" y="${SB10+123}" text-anchor="middle" font-family="Arial" font-size="22" fill="white">💡</text>

  <!-- Draw + Again -->
  <rect x="${RX}" y="${SB10+164}" width="${RW-190}" height="76" rx="38" fill="url(#bg)"/>
  <text x="${RX+(RW-190)/2}" y="${SB10+210}" text-anchor="middle" font-family="Arial Black,Arial" font-size="36" font-weight="900" fill="white">Draw! ✨</text>
  <rect x="${W10-180}" y="${SB10+164}" width="156" height="76" rx="38" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="${W10-102}" y="${SB10+210}" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.ink}">🎲 Again</text>

  <!-- Options panel -->
  <rect x="${RX}" y="${SB10+256}" width="${RW}" height="300" rx="22" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="${RX+24}" y="${SB10+296}" font-family="Arial" font-size="22" font-weight="700" fill="${C.muted}">Difficulty</text>
  ${['Easy 🌟','Medium 🌟🌟','Hard 🌟🌟🌟','Extreme 🔥'].map((d,i)=>{
    const on=i===1, bx=RX+24+i*308;
    return `<rect x="${bx}" y="${SB10+306}" width="285" height="56" rx="28" fill="${on?C.purple:C.bg}" stroke="${on?'none':C.border}" stroke-width="1"/>
    <text x="${bx+142}" y="${SB10+340}" text-anchor="middle" font-family="Arial" font-size="20" font-weight="${on?'700':'400'}" fill="${on?'white':C.ink}">${d}</text>`;
  }).join('')}
  <text x="${RX+24}" y="${SB10+396}" font-family="Arial" font-size="22" font-weight="700" fill="${C.muted}">Colors</text>
  ${[6,12,18,24].map((n,i)=>{
    const on=n===12, bx=RX+24+i*210;
    return `<rect x="${bx}" y="${SB10+406}" width="190" height="56" rx="28" fill="${on?C.purple:C.bg}" stroke="${on?'none':C.border}" stroke-width="1"/>
    <text x="${bx+95}" y="${SB10+440}" text-anchor="middle" font-family="Arial" font-size="20" font-weight="${on?'700':'400'}" fill="${on?'white':C.ink}">${n}</text>`;
  }).join('')}
  <text x="${RX+24}" y="${SB10+492}" font-family="Arial" font-size="22" font-weight="700" fill="${C.muted}">Palette</text>
  <rect x="${RX+24}" y="${SB10+502}" width="262" height="56" rx="28" fill="${C.purple}"/>
  <text x="${RX+155}" y="${SB10+536}" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="white">🖍️ Classic crayons</text>
  <rect x="${RX+298}" y="${SB10+502}" width="222" height="56" rx="28" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>
  <text x="${RX+409}" y="${SB10+536}" text-anchor="middle" font-family="Arial" font-size="20" fill="${C.ink}">🌸 Soft pastels</text>
  <rect x="${RX+532}" y="${SB10+502}" width="186" height="56" rx="28" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>
  <text x="${RX+625}" y="${SB10+536}" text-anchor="middle" font-family="Arial" font-size="20" fill="${C.ink}">🌿 Nature</text>

  <!-- Examples -->
  <text x="${RX+24}" y="${SB10+584}" font-family="Arial" font-size="22" font-weight="700" fill="${C.muted}">Try these</text>
  ${['🦋 butterfly','🚀 rocket','🦄 unicorn','🏰 castle','🐉 dragon','🦈 shark'].map((chip,i)=>{
    const bx=RX+24+i*224;
    return `<rect x="${bx}" y="${SB10+594}" width="202" height="52" rx="26" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
    <text x="${bx+101}" y="${SB10+626}" text-anchor="middle" font-family="Arial" font-size="19" fill="${C.ink}">${chip}</text>`;
  }).join('')}

  <!-- Empty canvas area -->
  <rect x="${RX}" y="${SB10+662}" width="${RW}" height="${H10-SB10-680}" rx="22" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <g transform="translate(${RX+RW/2},${SB10+830}) rotate(-45)">
    <rect x="-16" y="-140" width="32" height="230" rx="16" fill="${C.blue}"/>
    <path d="M-16,90 Q-16,126 0,140 Q16,126 16,90Z" fill="${C.orange}"/>
  </g>
  <text x="${RX+RW/2}" y="${SB10+930}" text-anchor="middle" font-family="Arial" font-size="34" fill="${C.muted}">Your coloring page will appear here ✨</text>
  <text x="${RX+RW/2}" y="${SB10+972}" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.muted}">Type anything above and tap Draw!</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT10,'1-create.png'));
  console.log('✓ tablet-10 1-create.png');
}

// ── 10-inch screen 2: Coloring ───────────────────────────────────────────────
async function t10s2(){
  const colored={1:'#ff4757',2:'#7c4dff',5:'#ff7043',6:'#f06292',9:'#795548',10:'#00bcd4'};
  const svg=`<svg width="${W10}" height="${H10}" viewBox="0 0 ${W10} ${H10}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W10}" height="${H10}" fill="${C.bg}"/>
  ${sb10('17:51')}
  ${leftSidebar10('create')}
  ${palette10(7)}
  <!-- Toolbar -->
  ${['↩ Undo','✏️ Draw','🗑️ Clear'].map((lbl,i)=>{
    const bx=20+i*182;
    return `<rect x="${bx}" y="${H10-86}" width="162" height="52" rx="26" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>
    <text x="${bx+81}" y="${H10-53}" text-anchor="middle" font-family="Arial" font-size="20" fill="${C.ink}">${lbl}</text>`;
  }).join('')}
  <!-- Progress -->
  <rect x="20" y="${H10-152}" width="${SIDE10-40}" height="48" rx="24" fill="${C.yellow}" opacity="0.9"/>
  <text x="${SIDE10/2}" y="${H10-120}" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="#5a3e00">6 of 12 regions colored 🎨</text>
  <!-- Canvas -->
  <rect x="${SIDE10}" y="${SB10}" width="${MAIN10}" height="${H10-SB10}" fill="${C.card}"/>
  <!-- Hint -->
  <rect x="${SIDE10+16}" y="${SB10+10}" width="${MAIN10-32}" height="48" rx="24" fill="${C.purple}" opacity="0.1"/>
  <text x="${SIDE10+MAIN10/2}" y="${SB10+39}" text-anchor="middle" font-family="Arial" font-size="22" fill="${C.purple}">🔢 Tap a number to select a region, then tap a color to fill!</text>
  <!-- Large butterfly -->
  ${butterflyArt(SIDE10+MAIN10/2, H10/2+52, 1.18, colored)}
  <!-- Active color badge -->
  <rect x="${W10-218}" y="${SB10+12}" width="196" height="50" rx="25" fill="${C.pink}"/>
  <text x="${W10-120}" y="${SB10+44}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="white">Color: 7 🩷</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT10,'2-coloring.png'));
  console.log('✓ tablet-10 2-coloring.png');
}

// ── 10-inch screen 3: Gallery ────────────────────────────────────────────────
async function t10s3(){
  const items=[
    {lbl:'butterfly',fn:miniButterfly,bg:'#fff0f3'},{lbl:'dragon',fn:miniDragon,bg:'#f0fff4'},
    {lbl:'rocket',fn:miniRocket,bg:'#f0f4ff'},{lbl:'unicorn',fn:miniUnicorn,bg:'#fff8f0'},
    {lbl:'castle',fn:miniCastle,bg:'#f5f0ff'},{lbl:'shark',fn:miniRocket,bg:'#f0f8ff'},
    {lbl:'cat',fn:miniUnicorn,bg:'#fff0f8'},{lbl:'robot',fn:miniRocket,bg:'#f0fbff'},
  ];
  const cols=4, pad=24, gap=16;
  const gx=SIDE10+pad, gw=MAIN10-pad*2;
  const cw=Math.floor((gw-gap*(cols-1))/cols); // ~325
  const headerH=100, gy=SB10+headerH;
  const avail=H10-gy-pad;
  const ch=Math.floor((avail-gap)/2); // ~504
  const svg=`<svg width="${W10}" height="${H10}" viewBox="0 0 ${W10} ${H10}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W10}" height="${H10}" fill="${C.bg}"/>
  ${sb10('17:53')}
  ${leftSidebar10('gallery')}
  <text x="${SIDE10+MAIN10/2}" y="${SB10+58}" text-anchor="middle" font-family="Arial Black,Arial" font-size="40" font-weight="900" fill="${C.ink}">🖼️ My Gallery</text>
  <text x="${SIDE10+MAIN10/2}" y="${SB10+90}" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.muted}">8 saved artworks</text>
  ${items.map(({lbl,fn,bg},i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const x=gx+col*(cw+gap), y=gy+row*(ch+gap);
    const cx2=x+cw/2, cy2=y+(ch-50)/2;
    return `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="18" fill="${bg}" stroke="${C.border}" stroke-width="1"/>
    ${fn(cx2,cy2,0.12)}
    <rect x="${x}" y="${y+ch-48}" width="${cw}" height="48" rx="3" fill="rgba(255,255,255,0.92)"/>
    <text x="${cx2}" y="${y+ch-16}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="${C.ink}">${lbl}</text>`;
  }).join('')}
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT10,'3-gallery.png'));
  console.log('✓ tablet-10 3-gallery.png');
}

// ── 10-inch screen 4: Daily Challenge ───────────────────────────────────────
async function t10s4(){
  const infoW=Math.floor(MAIN10*0.52); // ~707
  const dragonX=SIDE10+infoW+32;
  const dragonW=W10-dragonX-24;        // ~609
  const svg=`<svg width="${W10}" height="${H10}" viewBox="0 0 ${W10} ${H10}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="dlg" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" style="stop-color:#7c4dff;stop-opacity:0.12"/>
    <stop offset="100%" style="stop-color:#ff7043;stop-opacity:0.06"/>
  </linearGradient></defs>
  <rect width="${W10}" height="${H10}" fill="${C.bg}"/>
  ${sb10('09:00')}
  ${leftSidebar10('daily')}

  <!-- Info card -->
  <rect x="${SIDE10+16}" y="${SB10+16}" width="${infoW}" height="${H10-SB10-32}" rx="24" fill="url(#dlg)" stroke="${C.purple}" stroke-width="2"/>
  <text x="${SIDE10+16+infoW/2}" y="${SB10+104}" text-anchor="middle" font-family="Arial" font-size="80">⭐</text>
  <text x="${SIDE10+16+infoW/2}" y="${SB10+174}" text-anchor="middle" font-family="Arial Black,Arial" font-size="44" font-weight="900" fill="${C.purple}">Daily Challenge!</text>
  <text x="${SIDE10+16+infoW/2}" y="${SB10+210}" text-anchor="middle" font-family="Arial" font-size="24" fill="${C.muted}">Everyone colors the same word today</text>
  <!-- Word box -->
  <rect x="${SIDE10+40}" y="${SB10+228}" width="${infoW-48}" height="130" rx="28" fill="${C.purple}"/>
  <text x="${SIDE10+16+infoW/2}" y="${SB10+288}" text-anchor="middle" font-family="Arial" font-size="28" fill="rgba(255,255,255,0.7)">Today's word</text>
  <text x="${SIDE10+16+infoW/2}" y="${SB10+358}" text-anchor="middle" font-family="Arial Black,Arial" font-size="64" font-weight="900" fill="white">dragon</text>
  <!-- Stats -->
  <rect x="${SIDE10+40}" y="${SB10+378}" width="218" height="106" rx="18" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
  <text x="${SIDE10+149}" y="${SB10+436}" text-anchor="middle" font-family="Arial" font-size="40" font-weight="700" fill="${C.orange}">🔥 847</text>
  <text x="${SIDE10+149}" y="${SB10+466}" text-anchor="middle" font-family="Arial" font-size="20" fill="${C.muted}">colorists today</text>
  <rect x="${SIDE10+270}" y="${SB10+378}" width="200" height="106" rx="18" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
  <text x="${SIDE10+370}" y="${SB10+436}" text-anchor="middle" font-family="Arial" font-size="40" font-weight="700" fill="${C.purple}">🎨 #3</text>
  <text x="${SIDE10+370}" y="${SB10+466}" text-anchor="middle" font-family="Arial" font-size="20" fill="${C.muted}">best rank</text>
  <rect x="${SIDE10+482}" y="${SB10+378}" width="200" height="106" rx="18" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
  <text x="${SIDE10+582}" y="${SB10+436}" text-anchor="middle" font-family="Arial" font-size="40" font-weight="700" fill="${C.green}">⏱️ 14h</text>
  <text x="${SIDE10+582}" y="${SB10+466}" text-anchor="middle" font-family="Arial" font-size="20" fill="${C.muted}">left today</text>
  <!-- CTA -->
  <rect x="${SIDE10+40}" y="${SB10+504}" width="${infoW-48}" height="82" rx="41" fill="${C.orange}"/>
  <text x="${SIDE10+16+infoW/2}" y="${SB10+555}" text-anchor="middle" font-family="Arial Black,Arial" font-size="34" font-weight="900" fill="white">Draw today's dragon! ✨</text>
  <!-- Previous challenges -->
  <text x="${SIDE10+40}" y="${SB10+624}" font-family="Arial Black,Arial" font-size="28" font-weight="700" fill="${C.ink}">Previous challenges</text>
  ${[{w:'butterfly',e:'🦋'},{w:'rocket',e:'🚀'},{w:'unicorn',e:'🦄'},{w:'castle',e:'🏰'},{w:'cat',e:'🐱'}].map(({w,e},i)=>{
    const bx=SIDE10+40+i*136;
    return `<rect x="${bx}" y="${SB10+638}" width="120" height="120" rx="16" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
    <text x="${bx+60}" y="${SB10+704}" text-anchor="middle" font-family="Arial" font-size="48">${e}</text>
    <text x="${bx+60}" y="${SB10+746}" text-anchor="middle" font-family="Arial" font-size="18" fill="${C.muted}">${w}</text>`;
  }).join('')}

  <!-- Dragon preview panel -->
  <rect x="${dragonX}" y="${SB10+16}" width="${dragonW}" height="${H10-SB10-32}" rx="24" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
  ${dragonArt(dragonX+dragonW/2, H10/2+30, 0.66, {1:'#26c281',2:'#ff7043',3:'#7c4dff',4:'#7c4dff',5:'#ff4757',6:'#ffca28'})}
  <text x="${dragonX+dragonW/2}" y="${H10-58}" text-anchor="middle" font-family="Arial" font-size="22" fill="${C.muted}">Everyone's coloring this today!</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT10,'4-daily-challenge.png'));
  console.log('✓ tablet-10 4-daily-challenge.png');
}

// ─── Run ─────────────────────────────────────────────────────────────────────
(async()=>{
  console.log('Generating tablet screenshots…\n');
  try {
    await t7s1(); await t7s2(); await t7s3(); await t7s4();
    await t10s1(); await t10s2(); await t10s3(); await t10s4();
    console.log(`\nDone.`);
    console.log(`  7-inch  (1280×800):  android/play-store-listing/screenshots/en/tablet-7/`);
    console.log(`  10-inch (1920×1200): android/play-store-listing/screenshots/en/tablet-10/`);
  } catch(err){
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
