#!/usr/bin/env node
/**
 * Lalabuba store screenshots — v2 (new rewards-era design).
 *
 * Pipeline:
 *  1. Render 6 "inner app screens" as portrait PNGs (the actual app mock, new design).
 *  2. A framing compositor drops each inner screen into a polished marketing poster
 *     (device bezel + headline) at EVERY required store size, portrait AND landscape,
 *     with NO aspect-ratio distortion (letterbox-free; content is laid out per-frame).
 *
 * Screens:
 *  1 create   — turn an idea into a coloring page
 *  2 color    — color-by-number canvas (clean fills, no white slivers)
 *  3 rewards  — grouped sticker album
 *  4 mission  — daily mission + unlockable crayon packs
 *  5 mascot   — decorate your penguin
 *  6 challenge— challenge a friend (QR + link)
 *
 * Output (replaces legacy assets):
 *   app-store-assets/<lang>/{iphone_6_9,iphone_6_5,ipad_13}{,_landscape}/<n>-<name>.png
 *   store-assets/play-store-listing/screenshots/<lang>/{phone,tablet_7,tablet_10}{,_landscape}/<n>-<name>.png
 */
'use strict';
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const ROOT = path.join(__dirname, '..');

// ─── Palette / tokens ─────────────────────────────────────────────────────────
const C = {
  bg:'#eef6ff', card:'#ffffff', ink:'#1e1b2e', muted:'#7a7a9a', border:'#e3eaf6',
  purple:'#7c4dff', pink:'#f06292', orange:'#ff7043', green:'#26c281', yellow:'#ffca28',
  blue:'#1e90ff', red:'#ff4757', coral:'#ff6b6b', teal:'#00bcd4', brown:'#795548',
  gray:'#9e9e9e', dkblue:'#3f51b5', lock:'#c7cfde',
};
const PALETTE = [
  {n:1,c:'#ff4757'},{n:2,c:'#ff7043'},{n:3,c:'#ffca28'},{n:4,c:'#26c281'},
  {n:5,c:'#1e90ff'},{n:6,c:'#7c4dff'},{n:7,c:'#f06292'},{n:8,c:'#ff6b6b'},
  {n:9,c:'#00bcd4'},{n:10,c:'#795548'},{n:11,c:'#9e9e9e'},{n:12,c:'#3f51b5'},
];

// Inner app-screen canvas (portrait). 0.462 ≈ modern phone aspect.
const SW = 1120, SH = 2424;

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ─── Artwork ──────────────────────────────────────────────────────────────────
function penguinArt(cx, cy, scale, colored = {}, hideNumbers = false) {
  const s = scale, fill = n => colored[n] || 'white', sw = 4*s;
  // numbered regions that actually have a drawn shape:
  // 1 body, 2 belly, 3 head, 4 beak, 5 left foot, 6 right foot, 7 left wing, 8 right wing, 9 eye-patch
  const pos = {1:[0,80],2:[0,200],3:[150,-300],4:[0,-205],5:[-90,478],6:[90,478],
               7:[-250,150],8:[250,150],9:[-130,-380]};
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    <!-- body -->
    <path d="M0,-360 C220,-360 250,-120 250,120 C250,400 140,470 0,470 C-140,470 -250,400 -250,120 C-250,-120 -220,-360 0,-360 Z" fill="${fill(1)}" stroke="#222" stroke-width="${sw}"/>
    <!-- belly -->
    <ellipse cx="0" cy="120" rx="150" ry="260" fill="${fill(2)}" stroke="#222" stroke-width="${sw}"/>
    <!-- wings -->
    <path d="M-235,-40 C-330,40 -330,260 -250,320 C-235,180 -230,40 -210,-40 Z" fill="${fill(7)}" stroke="#222" stroke-width="${sw}"/>
    <path d="M235,-40 C330,40 330,260 250,320 C235,180 230,40 210,-40 Z" fill="${fill(8)}" stroke="#222" stroke-width="${sw}"/>
    <!-- head -->
    <circle cx="0" cy="-330" r="170" fill="${fill(3)}" stroke="#222" stroke-width="${sw}"/>
    <!-- eye patches -->
    <ellipse cx="-62" cy="-360" rx="58" ry="70" fill="${fill(9)}" stroke="#222" stroke-width="${sw*0.7}"/>
    <ellipse cx="62" cy="-360" rx="58" ry="70" fill="${fill(9)}" stroke="#222" stroke-width="${sw*0.7}"/>
    <circle cx="-58" cy="-352" r="20" fill="#222"/><circle cx="58" cy="-352" r="20" fill="#222"/>
    <!-- beak -->
    <path d="M-58,-250 L58,-250 L0,-150 Z" fill="${fill(4)}" stroke="#222" stroke-width="${sw}"/>
    <!-- feet -->
    <ellipse cx="-90" cy="475" rx="80" ry="36" fill="${fill(5)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="90" cy="475" rx="80" ry="36" fill="${fill(6)}" stroke="#222" stroke-width="${sw}"/>
    ${hideNumbers ? '' : Object.entries(pos).map(([n,[nx,ny]])=>{
      const on = colored[n]; const bg = on?'rgba(0,0,0,0.22)':'rgba(255,255,255,0.9)'; const fc=on?'#fff':C.ink;
      return `<circle cx="${nx}" cy="${ny}" r="26" fill="${bg}"/><text x="${nx}" y="${ny+9}" text-anchor="middle" font-family="Arial" font-size="26" font-weight="700" fill="${fc}">${n}</text>`;
    }).join('')}
  </g>`;
}

function miniPenguin(cx,cy,s=0.12){return penguinArt(cx,cy,s,{1:'#1e1b2e',2:'#fff',3:'#1e1b2e',4:'#ffca28',5:'#ff7043',6:'#ff7043',7:'#3f51b5',8:'#3f51b5',9:'#fff',10:'#ff4757'});}
function miniButterfly(cx,cy,s=0.13){
  const col={1:'#ff4757',2:'#7c4dff',3:'#ffca28',4:'#1e90ff',5:'#ff7043',6:'#f06292',7:'#26c281',8:'#ff6b6b'};
  const f=n=>col[n]||'#fff';const sw=22;
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    <ellipse cx="-200" cy="-140" rx="185" ry="200" fill="${f(1)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="200" cy="-140" rx="185" ry="200" fill="${f(2)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="-175" cy="120" rx="145" ry="160" fill="${f(3)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="175" cy="120" rx="145" ry="160" fill="${f(4)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="-170" cy="130" r="50" fill="${f(7)}" stroke="#222" stroke-width="${sw}"/>
    <circle cx="170" cy="130" r="50" fill="${f(8)}" stroke="#222" stroke-width="${sw}"/>
    <ellipse cx="0" cy="0" rx="32" ry="220" fill="#795548" stroke="#222" stroke-width="${sw}"/>
    <circle cx="0" cy="-240" r="45" fill="#795548" stroke="#222" stroke-width="${sw}"/></g>`;
}
function miniRocket(cx,cy,s=0.12){return `<g transform="translate(${cx},${cy}) scale(${s})">
  <path d="M0,-350 C120,-200 160,-50 140,200 L-140,200 C-160,-50 -120,-200 0,-350Z" fill="#1e90ff" stroke="#222" stroke-width="25"/>
  <path d="M-140,200 L-280,380 L-140,340 L-100,480 L0,340" fill="#ff4757" stroke="#222" stroke-width="25"/>
  <path d="M140,200 L280,380 L140,340 L100,480 L0,340" fill="#ff4757" stroke="#222" stroke-width="25"/>
  <circle cx="0" cy="-100" r="90" fill="#ffca28" stroke="#222" stroke-width="25"/>
  <path d="M-140,200 L140,200 L140,340 L-140,340Z" fill="#ff7043" stroke="#222" stroke-width="25"/></g>`;}
function miniUnicorn(cx,cy,s=0.12){return `<g transform="translate(${cx},${cy}) scale(${s})">
  <ellipse cx="80" cy="100" rx="200" ry="130" fill="#f06292" stroke="#222" stroke-width="25"/>
  <circle cx="-60" cy="-80" r="120" fill="#f06292" stroke="#222" stroke-width="25"/>
  <path d="M-60,-200 L-30,-420 L0,-200Z" fill="#ffca28" stroke="#222" stroke-width="20"/>
  <ellipse cx="280" cy="160" rx="35" ry="90" fill="#f06292" stroke="#222" stroke-width="25"/>
  <ellipse cx="100" cy="220" rx="35" ry="90" fill="#f06292" stroke="#222" stroke-width="25"/>
  <circle cx="-95" cy="-110" r="20" fill="#222"/>
  <path d="M60,-120 Q120,-280 0,-340 Q-80,-200 20,-80Z" fill="#7c4dff" stroke="#222" stroke-width="20"/></g>`;}
function miniFish(cx,cy,s=0.12){return `<g transform="translate(${cx},${cy}) scale(${s})">
  <ellipse cx="0" cy="0" rx="240" ry="150" fill="#00bcd4" stroke="#222" stroke-width="25"/>
  <path d="M200,0 L360,-120 L360,120 Z" fill="#ff7043" stroke="#222" stroke-width="25"/>
  <circle cx="-110" cy="-30" r="34" fill="#fff" stroke="#222" stroke-width="18"/><circle cx="-110" cy="-30" r="14" fill="#222"/>
  <path d="M-40,-150 Q40,-240 120,-150" fill="none" stroke="#222" stroke-width="22"/></g>`;}

function qrCode(x,y,size){
  const cell=size/21;
  const p=[[1,1,1,1,1,1,1,0,1,0,0,1,0,1,1,1,1,1,1,1,1],[1,0,0,0,0,0,1,0,0,1,1,0,1,0,1,0,0,0,0,0,1],[1,0,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,1,1,0,1],[1,0,1,1,1,0,1,0,0,1,1,0,1,0,1,0,1,1,1,0,1],[1,0,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,1,1,0,1],[1,0,0,0,0,0,1,0,0,1,1,0,1,0,1,0,0,0,0,0,1],[1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0],[1,0,1,1,0,1,1,1,0,1,1,0,1,1,0,1,1,0,1,0,1],[0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,0,1,0,1,0],[1,0,1,1,0,1,1,1,0,1,0,0,1,1,0,1,1,0,1,0,1],[0,1,0,0,1,0,0,1,1,0,1,0,0,1,1,0,0,1,0,1,0],[1,0,1,1,0,1,1,0,0,1,0,1,1,0,0,1,1,0,1,0,1],[0,0,0,0,0,0,0,0,1,1,0,0,1,0,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,0,0,1,1,0,1,0,1,1,1,1,1,1,1],[1,0,0,0,0,0,1,0,1,0,0,1,0,0,1,0,0,0,0,0,1],[1,0,1,1,1,0,1,0,1,1,0,0,1,1,1,0,1,1,1,0,1],[1,0,1,1,1,0,1,1,0,0,1,0,0,0,1,0,1,1,1,0,1],[1,0,1,1,1,0,1,0,1,0,0,1,1,0,1,0,1,1,1,0,1],[1,0,0,0,0,0,1,0,0,1,0,0,0,1,1,0,0,0,0,0,1],[1,1,1,1,1,1,1,0,1,0,1,1,0,0,1,1,1,1,1,1,1]];
  let o=`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="white" rx="14"/>`;
  p.forEach((r,ri)=>r.forEach((c,ci)=>{ if(c) o+=`<rect x="${x+ci*cell}" y="${y+ri*cell}" width="${cell}" height="${cell}" fill="${C.ink}" rx="1"/>`; }));
  return o;
}

// ─── Shared chrome ──────────────────────────────────────────────────────────
function appHeader(t){
  return `<rect x="0" y="0" width="${SW}" height="150" fill="${C.bg}"/>
  <rect x="34" y="40" width="118" height="70" rx="35" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="93" y="86" text-anchor="middle" font-family="Arial" font-size="34">🖼️</text>
  <text x="${SW/2}" y="98" text-anchor="middle" font-family="Arial Black,Arial" font-size="62" font-weight="900" fill="${C.purple}" letter-spacing="-1">Lalabuba</text>
  <rect x="${SW-218}" y="40" width="80" height="70" rx="35" fill="${C.yellow}"/>
  <text x="${SW-178}" y="88" text-anchor="middle" font-family="Arial" font-size="36">🏆</text>
  <rect x="${SW-122}" y="40" width="88" height="70" rx="35" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  <text x="${SW-78}" y="86" text-anchor="middle" font-family="Arial" font-size="28" fill="${C.ink}">🌐</text>`;
}
function paletteStrip(y, activeNum){
  const sw=78, gap=(SW-34*2-sw*12)/11;
  let o=`<rect x="0" y="${y}" width="${SW}" height="150" fill="${C.card}"/>`;
  PALETTE.forEach(({n,c},i)=>{ const x=34+i*(sw+gap); const a=n===activeNum;
    o+=`<circle cx="${x+sw/2}" cy="${y+18+sw/2}" r="${sw/2}" fill="${c}" ${a?`stroke="${C.ink}" stroke-width="6"`:''}/>
    <text x="${x+sw/2}" y="${y+18+sw/2+9}" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="#fff">${n}</text>`;});
  return o;
}
function toolbar(y){
  const b=[['↩ Undo',34],['✏️ Draw',300],['🖨️ Print',566],['💾 Save',832]];
  let o=`<rect x="0" y="${y}" width="${SW}" height="120" fill="${C.card}"/>`;
  b.forEach(([l,x])=>{o+=`<rect x="${x}" y="${y+22}" width="254" height="76" rx="38" fill="${C.bg}" stroke="${C.border}" stroke-width="2"/><text x="${x+127}" y="${y+70}" text-anchor="middle" font-family="Arial" font-size="30" fill="${C.ink}">${l}</text>`;});
  return o;
}
function svgDoc(body, defs=''){ return `<svg width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs><rect width="${SW}" height="${SH}" fill="${C.bg}"/>${body}</svg>`; }

// ─── INNER SCREENS ────────────────────────────────────────────────────────────
function screenCreate(L){
  const chips=[['🐧','penguin'],['🦋','butterfly'],['🚀','rocket'],['🦄','unicorn']];
  const defs=`<linearGradient id="g1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7043"/><stop offset="1" stop-color="#ff4757"/></linearGradient>`;
  let b=appHeader();
  b+=`<text x="${SW/2}" y="222" text-anchor="middle" font-family="Arial" font-size="40" fill="${C.muted}">${esc(L.tagline)}</text>`;
  b+=`<rect x="${SW/2-250}" y="258" width="500" height="78" rx="39" fill="${C.yellow}"/><text x="${SW/2}" y="309" text-anchor="middle" font-family="Arial" font-size="32" font-weight="700" fill="#5a3e00">🌟 ${esc(L.today)}: dragon</text>`;
  chips.forEach(([e,w],i)=>{const x=40+i*262; b+=`<rect x="${x}" y="372" width="244" height="118" rx="24" fill="${C.card}" stroke="${C.border}" stroke-width="2"/><text x="${x+122}" y="440" text-anchor="middle" font-family="Arial" font-size="58">${e}</text><text x="${x+122}" y="478" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.ink}">${esc(w)}</text>`;});
  b+=`<rect x="34" y="520" width="${SW-68}" height="116" rx="58" fill="${C.card}" stroke="${C.purple}" stroke-width="4"/><text x="92" y="592" font-family="Arial" font-size="42" fill="${C.ink}">shark playing guitar</text><circle cx="${SW-92}" cy="578" r="40" fill="${C.purple}"/><text x="${SW-92}" y="590" text-anchor="middle" font-family="Arial" font-size="30">💡</text>`;
  b+=`<rect x="34" y="660" width="${SW-330}" height="120" rx="60" fill="url(#g1)"/><text x="${(SW-296)/2+34}" y="734" text-anchor="middle" font-family="Arial Black,Arial" font-size="52" font-weight="900" fill="#fff">${esc(L.draw)}</text>`;
  b+=`<rect x="${SW-280}" y="660" width="246" height="120" rx="60" fill="${C.card}" stroke="${C.border}" stroke-width="3"/><text x="${SW-157}" y="734" text-anchor="middle" font-family="Arial" font-size="36" fill="${C.ink}">🎲 ${esc(L.again)}</text>`;
  // options card
  b+=`<rect x="34" y="812" width="${SW-68}" height="360" rx="26" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>`;
  b+=`<text x="74" y="876" font-family="Arial" font-size="30" font-weight="700" fill="${C.muted}">${esc(L.difficulty)}</text>`;
  const diff=[[L.easy,false],[L.medium,true],[L.hard,false],[L.extreme,false]];
  let dx=70; diff.forEach(([t,a])=>{const w=t.length*16+70; b+=`<rect x="${dx}" y="896" width="${w}" height="60" rx="30" fill="${a?C.purple:C.bg}" stroke="${a?'none':C.border}" stroke-width="2"/><text x="${dx+w/2}" y="935" text-anchor="middle" font-family="Arial" font-size="26" font-weight="${a?'700':'400'}" fill="${a?'#fff':C.ink}">${esc(t)}</text>`; dx+=w+18;});
  b+=`<text x="74" y="1018" font-family="Arial" font-size="30" font-weight="700" fill="${C.muted}">${esc(L.colors)}</text>`;
  [6,12,18,24].forEach((n,i)=>{const x=70+i*150; const a=n===12; b+=`<rect x="${x}" y="1038" width="130" height="60" rx="30" fill="${a?C.purple:C.bg}" stroke="${a?'none':C.border}" stroke-width="2"/><text x="${x+65}" y="1077" text-anchor="middle" font-family="Arial" font-size="26" font-weight="${a?'700':'400'}" fill="${a?'#fff':C.ink}">${n}</text>`;});
  b+=`<rect x="690" y="1038" width="364" height="60" rx="30" fill="${C.green}" opacity="0.16"/><rect x="690" y="1038" width="364" height="60" rx="30" fill="none" stroke="${C.green}" stroke-width="2"/><text x="872" y="1077" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.green}">🔢 ${esc(L.byNumber)}</text>`;
  // empty canvas
  b+=`<rect x="34" y="1200" width="${SW-68}" height="${SH-1240}" rx="26" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>`;
  b+=`<g transform="translate(${SW/2},${(1200+SH-40)/2-90}) rotate(-30)"><rect x="-26" y="-240" width="52" height="360" rx="26" fill="${C.blue}"/><path d="M-26,120 Q-26,200 0,230 Q26,200 26,120Z" fill="${C.orange}"/></g>`;
  b+=`<text x="${SW/2}" y="${(1200+SH-40)/2+150}" text-anchor="middle" font-family="Arial" font-size="42" fill="${C.muted}">${esc(L.canvasHint)}</text>`;
  return svgDoc(b,defs);
}

function screenColor(L){
  const colored={1:'#1e1b2e',2:'#fff',3:'#1e1b2e',4:'#ffca28',7:'#3f51b5',9:'#fff'};
  let b=appHeader();
  b+=`<rect x="34" y="180" width="${SW-200}" height="92" rx="46" fill="${C.card}" stroke="${C.border}" stroke-width="2"/><text x="80" y="238" font-family="Arial" font-size="36" fill="${C.ink}">penguin</text><rect x="${SW-150}" y="180" width="116" height="92" rx="46" fill="${C.bg}" stroke="${C.border}" stroke-width="2"/><text x="${SW-92}" y="238" text-anchor="middle" font-family="Arial" font-size="34">🎲</text>`;
  b+=`<rect x="0" y="300" width="${SW}" height="1340" fill="${C.card}"/>`;
  b+=`<rect x="34" y="316" width="${SW-68}" height="70" rx="35" fill="${C.purple}" opacity="0.1"/><text x="${SW/2}" y="362" text-anchor="middle" font-family="Arial" font-size="30" fill="${C.purple}">🔢 ${esc(L.colorHint)}</text>`;
  b+=penguinArt(SW/2, 1060, 1.2, colored);
  b+=`<rect x="34" y="1486" width="${SW-68}" height="74" rx="37" fill="${C.green}" opacity="0.16"/><text x="${SW/2}" y="1534" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="${C.green}">✨ ${esc(L.cleanFills)}</text>`;
  b+=paletteStrip(1660, 4);
  b+=toolbar(1830);
  return svgDoc(b);
}

const ALBUM = [
  ['groupMilestones', C.purple, [['🥇',1],['🖐️',1],['🔟',1],['🎨',1],['⭐',0],['💯',0]]],
  ['groupStreaks',    C.orange, [['🔥',1],['⚡',1],['📅',0],['🏆',0]]],
  ['groupExplorer',   C.green,  [['🐾',1],['🚗',1],['🍎',0],['🌳',1],['🧑',0],['✨',0]]],
  ['groupCreativity', C.pink,   [['💡',1],['🖍️',0],['🌈',1],['🎆',0]]],
  ['groupSharing',    C.blue,   [['📤',1],['🚀',0],['🏁',0],['🌟',1]]],
];
function screenRewards(L){
  let b=appHeader();
  b+=`<text x="${SW/2}" y="232" text-anchor="middle" font-family="Arial Black,Arial" font-size="56" font-weight="900" fill="${C.ink}">${esc(L.rewardsTitle)}</text>`;
  b+=`<rect x="${SW/2-220}" y="262" width="440" height="64" rx="32" fill="${C.yellow}"/><text x="${SW/2}" y="306" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="#5a3e00">14 / 31 ${esc(L.collected)}</text>`;
  let y=370;
  ALBUM.forEach(([gk,col,tiles])=>{
    b+=`<text x="40" y="${y+34}" font-family="Arial Black,Arial" font-size="34" font-weight="800" fill="${col}">${esc(L[gk])}</text>`;
    y+=60;
    const ts=152, gap=(SW-68-ts*6)/5;
    tiles.forEach(([e,earned],i)=>{ const x=34+i*(ts+gap);
      b+=`<rect x="${x}" y="${y}" width="${ts}" height="${ts}" rx="28" fill="${earned?'#fff':'#f1f4fa'}" stroke="${earned?col:C.border}" stroke-width="${earned?4:2}"/>`;
      if(earned){ b+=`<circle cx="${x+ts/2}" cy="${y+ts/2-8}" r="48" fill="${col}" opacity="0.14"/><text x="${x+ts/2}" y="${y+ts/2+18}" text-anchor="middle" font-family="Arial" font-size="64">${e}</text>`; }
      else { b+=`<text x="${x+ts/2}" y="${y+ts/2+22}" text-anchor="middle" font-family="Arial" font-size="58" opacity="0.85">🔒</text>`; }
    });
    y+=ts+44;
  });
  return svgDoc(b);
}

function screenMission(L){
  let b=appHeader();
  b+=`<text x="${SW/2}" y="232" text-anchor="middle" font-family="Arial Black,Arial" font-size="54" font-weight="900" fill="${C.ink}">${esc(L.rewardsTitle)}</text>`;
  // mission card
  b+=`<rect x="34" y="276" width="${SW-68}" height="300" rx="30" fill="${C.purple}" opacity="0.10"/><rect x="34" y="276" width="${SW-68}" height="300" rx="30" fill="none" stroke="${C.purple}" stroke-width="3"/>`;
  b+=`<text x="74" y="356" font-family="Arial Black,Arial" font-size="42" font-weight="800" fill="${C.purple}">${esc(L.missionTitle)}</text>`;
  b+=`<text x="74" y="424" font-family="Arial" font-size="38" fill="${C.ink}">${esc(L.missionText)}</text>`;
  b+=`<rect x="74" y="478" width="692" height="44" rx="22" fill="#e0e0ef"/><rect x="74" y="478" width="${692*0.6}" height="44" rx="22" fill="${C.green}"/>`;
  b+=`<text x="820" y="512" text-anchor="middle" font-family="Arial" font-size="34" font-weight="700" fill="${C.muted}">3 / 5</text>`;
  b+=`<rect x="${SW-74-170}" y="470" width="170" height="60" rx="30" fill="${C.green}"/><text x="${SW-74-85}" y="510" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="#fff">⭐ +1</text>`;
  // crayon packs
  b+=`<text x="40" y="660" font-family="Arial Black,Arial" font-size="40" font-weight="800" fill="${C.ink}">🖍️ ${esc(L.packsTitle)}</text>`;
  const packs=[[L.packClassic,'#ff4757',true,0],[L.packPastel,'#f8bbd0',true,0],[L.packNature,'#26c281',true,0],[L.packNeon,'#00e5ff',false,5],[L.packCandy,'#ff80ab',false,15],[L.packGalaxy,'#7c4dff',false,30]];
  const pw=(SW-68-40)/3, ph=320;
  packs.forEach((p,i)=>{ const [name,col,unlocked,at]=p; const x=34+(i%3)*(pw+20), y=700+Math.floor(i/3)*(ph+24);
    b+=`<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="26" fill="${unlocked?'#fff':'#f1f4fa'}" stroke="${unlocked?col:C.border}" stroke-width="${unlocked?4:2}"/>`;
    // crayon swatches
    const cols= col==='#ff4757'?['#ff4757','#ff7043','#ffca28','#26c281','#1e90ff','#7c4dff']
      : col==='#f8bbd0'?['#f8bbd0','#e1bee7','#b3e5fc','#c8e6c9','#fff9c4','#ffccbc']
      : col==='#26c281'?['#2e7d32','#7cb342','#a1887f','#4db6ac','#8d6e63','#9ccc65']
      : col==='#00e5ff'?['#00e5ff','#1de9b6','#76ff03','#ffea00','#ff1744','#d500f9']
      : col==='#ff80ab'?['#ff80ab','#ff4081','#ea80fc','#b388ff','#82b1ff','#ffd180']
      : ['#7c4dff','#536dfe','#448aff','#e040fb','#311b92','#9fa8da'];
    cols.forEach((cc,ci)=>{ const sx=x+30+(ci%3)*((pw-60)/3)+((pw-60)/6), sy=y+70+Math.floor(ci/3)*86;
      b+=`<g opacity="${unlocked?1:0.4}"><rect x="${sx-22}" y="${sy-44}" width="44" height="78" rx="10" fill="${cc}" stroke="#222" stroke-width="3"/><path d="M${sx-22},${sy-44} L${sx},${sy-72} L${sx+22},${sy-44} Z" fill="${cc}" stroke="#222" stroke-width="3"/></g>`;});
    b+=`<text x="${x+pw/2}" y="${y+ph-58}" text-anchor="middle" font-family="Arial" font-size="32" font-weight="700" fill="${unlocked?C.ink:C.muted}">${esc(name)}</text>`;
    if(unlocked) b+=`<text x="${x+pw/2}" y="${y+ph-18}" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.green}">✓ ${esc(L.unlocked)}</text>`;
    else b+=`<text x="${x+pw/2}" y="${y+ph-18}" text-anchor="middle" font-family="Arial" font-size="26" fill="${C.muted}">🔒 ${esc(L.unlockAt)} ${at}</text>`;
  });
  return svgDoc(b);
}

function screenMascot(L){
  let b=appHeader();
  b+=`<text x="${SW/2}" y="232" text-anchor="middle" font-family="Arial Black,Arial" font-size="52" font-weight="900" fill="${C.ink}">${esc(L.mascotCardTitle)}</text>`;
  b+=`<text x="${SW/2}" y="284" text-anchor="middle" font-family="Arial" font-size="32" fill="${C.muted}">${esc(L.mascotCardSubtitle)}</text>`;
  // stage
  b+=`<rect x="34" y="320" width="${SW-68}" height="1320" rx="34" fill="#fff" stroke="${C.border}" stroke-width="2"/>`;
  b+=`<ellipse cx="${SW/2}" cy="1610" rx="360" ry="56" fill="${C.purple}" opacity="0.08"/>`;
  b+=penguinArt(SW/2, 980, 1.3, {1:'#1e1b2e',2:'#fff',3:'#1e1b2e',4:'#ffca28',5:'#ff7043',6:'#ff7043',7:'#3f51b5',8:'#3f51b5',9:'#fff'}, true);
  // placed stickers on penguin
  const placed=[['🎩',SW/2,380,90],['🧣',SW/2,800,78],['⭐',SW/2-300,1060,70],['🌈',SW/2+300,1100,70],['❤️',SW/2+150,1300,64]];
  placed.forEach(([e,x,y,s])=>{ b+=`<circle cx="${x}" cy="${y}" r="${s*0.8}" fill="#fff" stroke="${C.purple}" stroke-width="3" opacity="0.95"/><text x="${x}" y="${y+s/3}" text-anchor="middle" font-family="Arial" font-size="${s}">${e}</text>`;});
  // tray
  b+=`<rect x="34" y="1672" width="${SW-68}" height="${SH-1700}" rx="30" fill="${C.bg}"/>`;
  b+=`<text x="${SW/2}" y="1726" text-anchor="middle" font-family="Arial" font-size="30" fill="${C.muted}">${esc(L.mascotHint)}</text>`;
  const tray=['🎩','🧣','⭐','🌈','❤️','🔥','🚀','🦋'];
  const tw=128, gap=(SW-68-tw*8)/7;
  tray.forEach((e,i)=>{const x=34+i*(tw+gap); b+=`<rect x="${x}" y="1756" width="${tw}" height="${tw}" rx="24" fill="#fff" stroke="${C.border}" stroke-width="2"/><text x="${x+tw/2}" y="${1756+tw/2+22}" text-anchor="middle" font-family="Arial" font-size="60">${e}</text>`;});
  return svgDoc(b);
}

function screenChallenge(L){
  const full={1:'#1e1b2e',2:'#fff',3:'#1e1b2e',4:'#ffca28',5:'#ff7043',6:'#ff7043',7:'#3f51b5',8:'#3f51b5',9:'#fff'};
  const defs=`<linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c4dff"/><stop offset="1" stop-color="#9c4dff"/></linearGradient>`;
  let b=appHeader();
  b+=`<rect x="34" y="180" width="${SW-68}" height="${SH-220}" rx="34" fill="#fff" stroke="${C.border}" stroke-width="2"/>`;
  b+=`<path d="M34,214 a34,34 0 0 1 34,-34 h${SW-136} a34,34 0 0 1 34,34 v120 h-${SW-68} Z" fill="url(#hg)"/>`;
  b+=`<text x="${SW/2}" y="266" text-anchor="middle" font-family="Arial Black,Arial" font-size="50" font-weight="900" fill="#fff">${esc(L.challengeTitle)}</text>`;
  b+=`<text x="${SW/2}" y="312" text-anchor="middle" font-family="Arial" font-size="30" fill="rgba(255,255,255,0.9)">${esc(L.challengeSub)}</text>`;
  b+=`<rect x="${SW/2-220}" y="380" width="440" height="400" rx="26" fill="#f6f0ff" stroke="${C.border}" stroke-width="2"/>`;
  b+=penguinArt(SW/2, 580, 0.62, full);
  b+=`<text x="${SW/2}" y="850" text-anchor="middle" font-family="Arial Black,Arial" font-size="38" font-weight="800" fill="${C.ink}">${esc(L.scanToJoin)}</text>`;
  b+=qrCode(SW/2-220, 890, 440);
  b+=`<rect x="74" y="1390" width="${SW-148}" height="92" rx="46" fill="${C.bg}" stroke="${C.border}" stroke-width="2"/><text x="120" y="1448" font-family="Arial" font-size="32" fill="${C.muted}">lalabuba.com/c/</text><text x="430" y="1448" font-family="Arial" font-size="32" font-weight="700" fill="${C.purple}">a7f9k2</text>`;
  b+=`<rect x="74" y="1510" width="${SW-148}" height="104" rx="52" fill="${C.purple}"/><text x="${SW/2}" y="1576" text-anchor="middle" font-family="Arial Black,Arial" font-size="40" font-weight="800" fill="#fff">📋 ${esc(L.copyLink)}</text>`;
  b+=`<rect x="74" y="1638" width="${(SW-148-24)/2}" height="100" rx="50" fill="${C.bg}" stroke="${C.border}" stroke-width="3"/><text x="${74+(SW-148-24)/4}" y="1700" text-anchor="middle" font-family="Arial" font-size="34" fill="${C.ink}">📤 ${esc(L.share)}</text>`;
  b+=`<rect x="${74+(SW-148-24)/2+24}" y="1638" width="${(SW-148-24)/2}" height="100" rx="50" fill="${C.bg}" stroke="${C.border}" stroke-width="3"/><text x="${74+(SW-148-24)/2+24+(SW-148-24)/4}" y="1700" text-anchor="middle" font-family="Arial" font-size="34" fill="${C.ink}">✉️ WhatsApp</text>`;
  return svgDoc(b,defs);
}

const SCREENS = [
  {key:'1-create',    fn:screenCreate},
  {key:'2-color',     fn:screenColor},
  {key:'3-rewards',   fn:screenRewards},
  {key:'4-mission',   fn:screenMission},
  {key:'5-mascot',    fn:screenMascot},
  {key:'6-challenge', fn:screenChallenge},
];

// ─── Framing compositor ─────────────────────────────────────────────────────
function roundedMask(w,h,r){ return Buffer.from(`<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`); }

function wrap(text, max){ const words=String(text).split(' '); const lines=[]; let cur='';
  for(const w of words){ if((cur+' '+w).trim().length>max){ if(cur)lines.push(cur); cur=w; } else cur=(cur+' '+w).trim(); }
  if(cur)lines.push(cur); return lines; }

async function compose(innerBuf, {W,H,accent,headline,bullets}){
  const landscape = W > H;
  const r = Math.round(Math.min(W,H)*0.045);
  let frameX, frameY, frameW, frameH, headBlock;
  if(!landscape){
    const headH = Math.round(H*0.155);
    headBlock = {x:Math.round(W*0.07), y:Math.round(H*0.05), w:Math.round(W*0.86), align:'middle', size:Math.round(W*0.062)};
    frameH = Math.round(H - headH - H*0.06);
    frameW = Math.round(frameH * (SW/SH));
    if(frameW > W*0.84){ frameW=Math.round(W*0.84); frameH=Math.round(frameW*(SH/SW)); }
    frameX = Math.round((W-frameW)/2);
    frameY = Math.round(headH + (H - headH - frameH)/2 + H*0.01);
  } else {
    frameH = Math.round(H*0.86);
    frameW = Math.round(frameH * (SW/SH));
    if(frameW > W*0.42){ frameW=Math.round(W*0.42); frameH=Math.round(frameW*(SH/SW)); }
    frameX = Math.round(W*0.06);
    frameY = Math.round((H-frameH)/2);
    headBlock = {x:Math.round(frameX+frameW+W*0.06), y:Math.round(H*0.18), w:Math.round(W - (frameX+frameW) - W*0.12), align:'start', size:Math.round(W*0.045)};
  }
  // background
  const aLight = accent+'22';
  let bg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="bgg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.20"/><stop offset="1" stop-color="${accent}" stop-opacity="0.05"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="${C.bg}"/><rect width="${W}" height="${H}" fill="url(#bgg)"/>
    <circle cx="${W*0.12}" cy="${H*0.9}" r="${Math.min(W,H)*0.08}" fill="${accent}" opacity="0.10"/>
    <circle cx="${W*0.92}" cy="${H*0.08}" r="${Math.min(W,H)*0.06}" fill="${accent}" opacity="0.10"/>`;
  // headline
  const hlines = wrap(headline, landscape?18:22);
  const lh = headBlock.size*1.18;
  hlines.forEach((ln,i)=>{ const tx = headBlock.align==='middle'?W/2:headBlock.x; const ty = headBlock.y + headBlock.size + i*lh;
    bg+=`<text x="${tx}" y="${ty}" text-anchor="${headBlock.align==='middle'?'middle':'start'}" font-family="Arial Black,Arial" font-size="${headBlock.size}" font-weight="900" fill="${C.ink}">${esc(ln)}</text>`;});
  if(landscape && bullets){ let by = headBlock.y + headBlock.size + hlines.length*lh + H*0.05;
    bullets.forEach(bl=>{ bg+=`<text x="${headBlock.x}" y="${by}" font-family="Arial" font-size="${Math.round(headBlock.size*0.62)}" fill="${C.muted}">✓ ${esc(bl)}</text>`; by+=headBlock.size*0.95; }); }
  // bezel
  const bez = Math.round(frameW*0.035);
  bg+=`<rect x="${frameX-bez}" y="${frameY-bez}" width="${frameW+bez*2}" height="${frameH+bez*2}" rx="${r+bez}" fill="#1e1b2e"/></svg>`;

  const base = await sharp(Buffer.from(bg)).png().toBuffer();
  const screen = await sharp(innerBuf).resize(frameW, frameH, {fit:'fill'})
    .composite([{input:roundedMask(frameW,frameH,r), blend:'dest-in'}]).png().toBuffer();
  return sharp(base).composite([{input:screen, left:frameX, top:frameY}]).png().toBuffer();
}

// ─── Targets ────────────────────────────────────────────────────────────────
const TARGETS = [
  // iOS  → app-store-assets/<lang>/<dir>/
  {store:'ios', dir:'iphone_6_9',           W:1320,H:2868},
  {store:'ios', dir:'iphone_6_9_landscape', W:2868,H:1320},
  {store:'ios', dir:'iphone_6_5',           W:1284,H:2778},
  {store:'ios', dir:'iphone_6_5_landscape', W:2778,H:1284},
  {store:'ios', dir:'ipad_13',              W:2048,H:2732},
  {store:'ios', dir:'ipad_13_landscape',    W:2732,H:2048},
  // Android → store-assets/play-store-listing/screenshots/<lang>/<dir>/
  {store:'play', dir:'phone',               W:1080,H:1920},
  {store:'play', dir:'phone_landscape',     W:1920,H:1080},
  {store:'play', dir:'tablet_7',            W:1200,H:1920},
  {store:'play', dir:'tablet_7_landscape',  W:1920,H:1200},
  {store:'play', dir:'tablet_10',           W:1600,H:2560},
  {store:'play', dir:'tablet_10_landscape', W:2560,H:1600},
];

function outDir(store,lang,dir){
  return store==='ios'
    ? path.join(ROOT,'app-store-assets',lang,dir)
    : path.join(ROOT,'store-assets','play-store-listing','screenshots',lang,dir);
}

// Per-locale strings: in-app labels pulled from the app's own i18n (reviewed
// translations), marketing copy from store-i18n.json. Falls back to English.
const STORE_I18N = JSON.parse(fs.readFileSync(path.join(__dirname,'store-i18n.json'),'utf8'));
const I18N_CACHE = {};
function appI18n(lang){
  if(I18N_CACHE[lang]) return I18N_CACHE[lang];
  let en={}, loc={};
  try{ en = JSON.parse(fs.readFileSync(path.join(ROOT,'flutter_app','assets','i18n','en.json'),'utf8')); }catch(e){}
  try{ loc = JSON.parse(fs.readFileSync(path.join(ROOT,'flutter_app','assets','i18n',lang+'.json'),'utf8')); }catch(e){ loc=en; }
  return I18N_CACHE[lang] = {...en, ...loc};
}
function strings(lang){
  const a = appI18n(lang);                              // reviewed app translations
  const m = STORE_I18N[lang] || STORE_I18N.en;          // marketing copy
  const g = (k,fb) => (a[k]!=null && a[k]!=='') ? a[k] : fb;
  return {
    tagline:g('tagline','Draw it · Color it · Love it 🌈'),
    today:g('todayWord','Today'), draw:g('drawBtn','Draw! ✨'), again:g('regenBtn','🎲 Again!').replace(/^🎲\s*/,'')+'',
    difficulty:g('diffLabel','Difficulty'),
    easy:g('diffEasy','Easy 🌟'), medium:g('diffMedium','Medium 🌟🌟'), hard:g('diffHard','Hard 🌟🌟🌟'), extreme:g('diffExtreme','Extreme 🔥'),
    colors:g('colorsLabel','Colors'), byNumber:g('numbersLabel','Numbers'),
    canvasHint:m.canvasHint, colorHint:g('coloringHint','👆 Tap a number, then a color to fill!').replace(/^👆\s*/,''),
    cleanFills:m.cleanFills,
    rewardsTitle:g('rewardsTitle','🏆 Rewards'), collected:m.collected,
    groupMilestones:g('groupMilestonesTitle','Milestones'), groupStreaks:g('groupStreaksTitle','Day Streaks'),
    groupExplorer:g('groupExplorerTitle','Explorer'), groupCreativity:g('groupCreativityTitle','Creativity'),
    groupSharing:g('groupSharingTitle','Sharing & Saving'),
    missionTitle:g('missionTitle',"🎯 Today's Mission"), missionText:g('missionColorTwoText','Color 2 pictures today'),
    packsTitle:m.packsTitle,
    packClassic:g('packClassicName','Classic'), packPastel:g('packPastelName','Pastel'), packNature:g('packNatureName','Nature'),
    packNeon:g('packNeonName','Neon'), packCandy:g('packCandyName','Candy'), packGalaxy:g('packGalaxyName','Galaxy'),
    unlocked:m.unlocked, unlockAt:m.unlockAt,
    mascotCardTitle:g('mascotCardTitle','Decorate your penguin!'), mascotCardSubtitle:g('mascotCardSubtitle','Dress up Lalabuba with your stickers'),
    mascotHint:g('mascotHint','Tap a sticker to add it · drag to move'),
    challengeTitle:'🏆 '+m.challengeTitle, challengeSub:m.challengeSub,
    scanToJoin:m.scanToJoin, copyLink:m.copyLink, share:m.share,
    H:{
      '1-create':[m.h_create,'#7c4dff',[m.b_create_1,m.b_create_2,m.b_create_3]],
      '2-color':[m.h_color,'#1e90ff',[m.b_color_1,m.b_color_2,m.b_color_3]],
      '3-rewards':[m.h_rewards,'#f06292',[m.b_rewards_1,m.b_rewards_2,m.b_rewards_3]],
      '4-mission':[m.h_mission,'#26c281',[m.b_mission_1,m.b_mission_2,m.b_mission_3]],
      '5-mascot':[m.h_mascot,'#ff7043',[m.b_mascot_1,m.b_mascot_2,m.b_mascot_3]],
      '6-challenge':[m.h_challenge,'#7c4dff',[m.b_challenge_1,m.b_challenge_2,m.b_challenge_3]],
    },
  };
}

// ─── Run ─────────────────────────────────────────────────────────────────────
(async () => {
  const langs = (process.argv[2] ? process.argv[2].split(',') : ['en']);
  for(const lang of langs){
    const L = strings(lang);
    // 1) render inner screens once
    console.log(`\n[${lang}] rendering inner screens…`);
    const inner = {};
    for(const s of SCREENS){ inner[s.key] = await sharp(Buffer.from(s.fn(L))).png().toBuffer(); }
    // 2) compose every target × screen
    let count=0;
    for(const t of TARGETS){
      const dir = outDir(t.store, lang, t.dir);
      fs.mkdirSync(dir,{recursive:true});
      for(const s of SCREENS){
        const [headline,accent,bullets] = L.H[s.key];
        const out = await compose(inner[s.key], {W:t.W,H:t.H,accent,headline,bullets});
        await sharp(out).png().toFile(path.join(dir, s.key+'.png'));
        count++;
      }
      console.log(`  ✓ ${t.store}/${t.dir} (${t.W}×${t.H}) — 6 screens`);
    }
    console.log(`[${lang}] done — ${count} images`);
  }
})().catch(e=>{ console.error(e); process.exit(1); });
