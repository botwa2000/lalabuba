// store-listings/capture-and-generate.js
// Automated store screenshot pipeline: capture from emulator → composite with text → write outputs.
//
// Usage (from repo root):
//   node store-listings/capture-and-generate.js                 # full pipeline
//   node store-listings/capture-and-generate.js --generate-only # composite existing raw PNGs
//   node store-listings/capture-and-generate.js --capture-only  # capture only, no compositing
//   node store-listings/capture-and-generate.js --phone-only    # skip tablet capture
//   node store-listings/capture-and-generate.js --tablet-only   # skip phone capture
//   node store-listings/capture-and-generate.js --screen 01_home,02_coloring  # specific screens
//
// Emulators (configured below in DEVICES):
//   Phone:  emulator-5558  (1080×2400, Android 15/API 35)
//   Tablet: emulator-5556  (2560×1600, Android 15)
//
// App package: com.lalabuba.lalabuba
// Activity:    com.lalabuba.lalabuba.MainActivity

'use strict';
const sharp        = require('sharp');
const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RAW  = path.join(ROOT, 'store_assets', 'raw');
const OUT  = path.join(ROOT, 'store-listings');

// ─── CLI flags ────────────────────────────────────────────────────────────────
const args          = process.argv.slice(2);
const GENERATE_ONLY = args.includes('--generate-only');
const CAPTURE_ONLY  = args.includes('--capture-only');
const PHONE_ONLY    = args.includes('--phone-only');
const TABLET_ONLY   = args.includes('--tablet-only');
const screenFilter  = (() => {
  const f = args.find(a => a.startsWith('--screen='));
  return f ? new Set(f.replace('--screen=', '').split(',')) : null;
})();

// ─── Emulator configs ─────────────────────────────────────────────────────────
const DEVICES = {
  phone: {
    serial: 'emulator-5558',
    type:   'phone',
    w:      1080,
    h:      2400,
    // Nav bar bounds from uiautomator dump: [0,2127][1080,2337] → center y=2232
    navY:   2232,
    tabX:   [135, 405, 675, 945],  // tab centers at w/8, 3w/8, 5w/8, 7w/8
  },
  tablet: {
    serial: 'emulator-5556',
    type:   'tablet',
    w:      2560,
    h:      1600,
    // Nav bar bounds from uiautomator dump: [0,1376][2560,1536] → center y=1456
    navY:   1456,
    tabX:   [320, 960, 1600, 2240],  // tab centers at w/8, 3w/8, 5w/8, 7w/8
  },
};

// ─── Screen configs ───────────────────────────────────────────────────────────
// Each entry:
//   id          unique slug (used as filename base and --screen filter key)
//   phone/tablet  raw output filename in store_assets/raw/
//   title/subtitle  store listing overlay text
//   actions[]   sequence executed BEFORE screenshot (phone device)
//   tabletActions[] (optional) different sequence for tablet device
//
// Action types:
//   { t: 'launch' }            force-stop + start fresh
//   { t: 'wait', ms }          sleep
//   { t: 'tab', n }            tap bottom-nav tab n (0=Draw,1=Journal,2=Gallery,3=Treehouse)
//   { t: 'tap', x, y }         tap absolute px (scaled to device)
//   { t: 'tapF', xf, yf }      tap at fraction of screen
//   { t: 'text', v }            type text via adb
//   { t: 'key', c }             send keycode (4=back, 3=home, 82=menu)
//   { t: 'swipeUp' }           scroll up to top of current screen
//   { t: 'waitIdle', ms }      wait for UI thread to idle (adb shell uiautomator events)
//
// The coloring screenshot is the most complex — it requires AI generation.
// The script taps the first suggestion card, then Draw!, and waits 25s.

const SCREENS = [
  // ── 01: Draw tab home screen ────────────────────────────────────────────────
  {
    id:       '01_home',
    phone:    'phone_port_01_home.png',
    tablet:   'tablet_land_home_fresh.png',
    title:    'Any picture, unique for your child.',
    subtitle: 'Type any idea — AI makes a one-of-a-kind drawing in seconds',
    actions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tab', n: 0 },
      { t: 'wait', ms: 2000 },
      // Dismiss any tutorial/onboarding callout by tapping neutral area (top half of screen)
      { t: 'tap', x: 540, y: 300 },
      { t: 'wait', ms: 1000 },
    ],
    tabletActions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'wait', ms: 2000 },
      { t: 'tap', x: 760, y: 300 },
      { t: 'wait', ms: 1000 },
    ],
  },

  // ── 02: Active coloring ──────────────────────────────────────────────────────
  // Types text into EditText, dismisses keyboard, taps Draw!, waits for AI generation.
  // Phone exact coords from uiautomator dump:
  //   EditText: center (540,1409) → tap to focus, then adb input text
  //   Draw! button: center (761,1560) — below keyboard, so dismiss keyboard first
  // Tablet:
  //   EditText: center (1752,240) → tap to focus
  //   Draw!: center (1972,676)
  {
    id:       '02_coloring',
    phone:    'phone_port_02_coloring.png',
    tablet:   'tablet_land_canvas_inprogress.png',
    title:    'Tap a number. Pick a color. Done.',
    subtitle: 'No instructions needed — kids figure it out right away',
    actions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tap', x: 540, y: 1409 },   // focus EditText
      { t: 'wait', ms: 400 },
      { t: 'text', v: 'unicorn' },       // type subject
      { t: 'key', c: 111 },              // KEYCODE_ESCAPE → dismiss keyboard
      { t: 'wait', ms: 1000 },
      { t: 'tap', x: 761, y: 1560 },    // tap Draw! (now enabled, keyboard gone)
      { t: 'wait', ms: 90000 },
      // Dismiss hint + add color fills to show the coloring mechanic in action
      { t: 'tap', x: 51, y: 1305 },    // tap red swatch → selects color + dismisses hint
      { t: 'wait', ms: 600 },
      { t: 'tap', x: 500, y: 750 },    // fill unicorn body region
      { t: 'wait', ms: 800 },
      { t: 'tap', x: 311, y: 1305 },   // tap yellow swatch
      { t: 'wait', ms: 500 },
      { t: 'tap', x: 230, y: 560 },    // fill mane area
      { t: 'wait', ms: 800 },
      { t: 'tap', x: 701, y: 1305 },   // tap cyan/teal swatch
      { t: 'wait', ms: 500 },
      { t: 'tap', x: 180, y: 430 },    // fill horn area
      { t: 'wait', ms: 800 },
      { t: 'tap', x: 571, y: 1305 },   // tap green swatch
      { t: 'wait', ms: 500 },
      { t: 'tap', x: 650, y: 900 },    // fill leg/lower area
      { t: 'wait', ms: 1000 },
    ],
    tabletActions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tap', x: 1752, y: 240 },   // focus EditText
      { t: 'wait', ms: 400 },
      { t: 'text', v: 'unicorn' },
      { t: 'key', c: 111 },
      { t: 'wait', ms: 1000 },
      { t: 'tap', x: 1972, y: 676 },   // tap Draw!
      { t: 'wait', ms: 90000 },
    ],
  },

  // ── 03: Explore screen ───────────────────────────────────────────────────────
  // Phone Explore button from uiautomator dump: center (886,206) → tapF(0.820, 0.086)
  // Tablet Explore button: center (2412,104) → tapF(0.942, 0.065)
  {
    id:       '03_explore',
    phone:    'phone_port_04_explore.png',
    tablet:   'tablet_land_explore_hub.png',
    title:    'Thousands of topics. All free.',
    subtitle: 'Dragons, unicorns, space — pick anything and start coloring',
    actions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tapF', xf: 0.820, yf: 0.086 },  // Explore button in AppBar
      { t: 'wait', ms: 2500 },
    ],
    tabletActions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tapF', xf: 0.942, yf: 0.065 },  // Explore button in AppBar
      { t: 'wait', ms: 2500 },
    ],
  },

  // ── 04: Treehouse (rewards, mascot, achievements) ────────────────────────────
  {
    id:       '04_treehouse',
    phone:    'phone_port_04_treehouse.png',  // phone portrait captured separately
    tablet:   'tablet_land_rewards.png',
    title:    'Color more, unlock more.',
    subtitle: 'Earn badges, crayon packs, and a pet companion as you go',
    actions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tab', n: 3 },
      { t: 'wait', ms: 2500 },
    ],
  },

  // ── 05: Mascot studio ────────────────────────────────────────────────────────
  // Phone: "Choose your companion!" bounds [42,311][1038,647] → center (540,479)
  // Tablet: tablet landscape (2560×1600) from emulator-5556
  {
    id:       '05_mascot',
    phone:    'phone_port_05_mascot.png',  // phone portrait captured separately
    tablet:   'tablet_land_mascot.png',
    title:    'Pick a pet. Dress it up.',
    subtitle: 'Unlock hats, accessories, and expressions for your companion',
    actions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tab', n: 3 },               // Treehouse tab
      { t: 'wait', ms: 2500 },
      { t: 'tap', x: 540, y: 479 },     // "Choose your companion!" card → Mascot Studio
      { t: 'wait', ms: 2000 },
      { t: 'tap', x: 97, y: 460 },      // Tap Pixel companion → customization screen
      { t: 'wait', ms: 2000 },
    ],
  },

  // ── 06: Completed coloring canvas ────────────────────────────────────────────
  // Wait 90s for AI generation to complete — shows finished numbered coloring page.
  // Tablet composite reuses the phone portrait with 'entropy' smart crop to find
  // the dinosaur image (avoids the tablet emulator's persistent stylus input dialog).
  {
    id:       '06_scenes',
    phone:    'phone_port_06_canvas.png',
    tablet:   'phone_port_06_canvas.png',
    positions: { tablet: 'entropy' },
    title:    'Every idea becomes a coloring page.',
    subtitle: 'Tap any numbered region to fill it — no mess, no cleanup',
    actions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tap', x: 540, y: 1409 },   // focus EditText
      { t: 'wait', ms: 400 },
      { t: 'text', v: 'dragon' },
      { t: 'key', c: 111 },             // dismiss keyboard
      { t: 'wait', ms: 1000 },
      { t: 'tap', x: 761, y: 1560 },   // Draw! (suggestion cards collapsed after typing)
      { t: 'wait', ms: 240000 },
      { t: 'tap', x: 137, y: 1305 },   // orange swatch → dismisses hint
      { t: 'wait', ms: 600 },
      { t: 'tap', x: 400, y: 550 },    // fill body
      { t: 'wait', ms: 800 },
      { t: 'tap', x: 51, y: 1305 },    // red swatch
      { t: 'wait', ms: 500 },
      { t: 'tap', x: 250, y: 500 },    // fill wing/head
      { t: 'wait', ms: 800 },
      { t: 'tap', x: 701, y: 1305 },   // cyan swatch
      { t: 'wait', ms: 500 },
      { t: 'tap', x: 600, y: 700 },    // fill another region
      { t: 'wait', ms: 800 },
    ],
  },

  // ── 07: Journal tab (personal art collection) ────────────────────────────────
  {
    id:       '07_journal',
    phone:    'phone_port_07_journal.png',
    tablet:   'tablet_land_07_journal.png',
    title:    'Every masterpiece saved.',
    subtitle: 'Flip back through your art and watch your collection grow',
    actions: [
      // Generate a butterfly, color it, finish it, then navigate to journal
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tap', x: 540, y: 1409 },   // focus search bar
      { t: 'wait', ms: 400 },
      { t: 'text', v: 'unicorn' },
      { t: 'key', c: 111 },             // dismiss keyboard
      { t: 'wait', ms: 1000 },
      { t: 'tap', x: 761, y: 1560 },   // Draw!
      { t: 'wait', ms: 120000 },        // unicorn generates fast (~90s)
      { t: 'tap', x: 137, y: 1305 },   // orange swatch → dismiss hint
      { t: 'wait', ms: 600 },
      { t: 'tap', x: 400, y: 550 },    // fill body
      { t: 'wait', ms: 800 },
      { t: 'tap', x: 51, y: 1305 },    // red swatch
      { t: 'wait', ms: 500 },
      { t: 'tap', x: 250, y: 500 },    // fill wing
      { t: 'wait', ms: 800 },
      { t: 'tap', x: 174, y: 1780 },   // "I'm finished!" button
      { t: 'wait', ms: 5000 },          // wait for celebration + auto-navigation
      { t: 'tap', x: 126, y: 162 },    // Home button (canvas header) → goes to Draw tab
      { t: 'wait', ms: 1500 },
      { t: 'tab', n: 1 },               // Journal tab
      { t: 'wait', ms: 2500 },
    ],
    tabletActions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tap', x: 1752, y: 240 },   // EditText on tablet
      { t: 'wait', ms: 400 },
      { t: 'text', v: 'butterfly' },
      { t: 'key', c: 111 },
      { t: 'wait', ms: 1000 },
      { t: 'tap', x: 1972, y: 676 },   // Draw! on tablet
      { t: 'wait', ms: 240000 },
      { t: 'tapF', xf: 0.07, yf: 0.87 }, // "I'm finished!" estimated position on tablet
      { t: 'wait', ms: 3000 },
      { t: 'tap', x: 1280, y: 800 },   // dismiss celebration
      { t: 'wait', ms: 1000 },
      { t: 'tab', n: 1 },
      { t: 'wait', ms: 2500 },
    ],
  },

  // ── 08: Gallery (community art) ──────────────────────────────────────────────
  {
    id:       '08_gallery',
    phone:    'phone_port_05_community.png',
    tablet:   'tablet_land_community.png',
    title:    'Share art with kids everywhere.',
    subtitle: 'See what others made, share your own, get inspired',
    actions: [
      { t: 'launch' },
      { t: 'wait', ms: 6000 },
      { t: 'tab', n: 2 },
      { t: 'wait', ms: 3500 }, // wait for community art grid to load
    ],
  },
];

// ─── Output targets ───────────────────────────────────────────────────────────
const TARGETS = [
  { dir: 'google-play/phone',  w: 1080, h: 1920, src: 'phone',  ovFrac: 0.27, tPx: 52, sPx: 28, tCh: 30, sCh: 43 },
  { dir: 'google-play/tablet', w: 2560, h: 1600, src: 'tablet', ovFrac: 0.27, tPx: 78, sPx: 43, tCh: 36, sCh: 52 },
  { dir: 'app-store/iphone',   w: 1290, h: 2796, src: 'phone',  ovFrac: 0.23, tPx: 64, sPx: 36, tCh: 30, sCh: 42 },
  { dir: 'app-store/ipad',     w: 2732, h: 2048, src: 'tablet', ovFrac: 0.27, tPx: 78, sPx: 43, tCh: 36, sCh: 52 },
];

// ─── ADB helpers ─────────────────────────────────────────────────────────────
const APP_PACKAGE  = 'com.lalabuba.lalabuba';
const APP_ACTIVITY = `${APP_PACKAGE}/.MainActivity`;
const ADB_TIMEOUT  = 10_000;

function adb(serial, cmd) {
  return execSync(`adb -s ${serial} ${cmd}`, { timeout: ADB_TIMEOUT, encoding: 'utf8' });
}

function adbShell(serial, cmd) {
  return adb(serial, `shell ${cmd}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runActions(device, actions) {
  for (const a of actions) {
    switch (a.t) {
      case 'launch':
        try { adbShell(device.serial, `am force-stop ${APP_PACKAGE}`); } catch {}
        await sleep(500);
        adbShell(device.serial, `wm dismiss-keyguard`);
        // Force light mode so canvas renders with white background, not dark grey
        try { adbShell(device.serial, `cmd uimode night no`); } catch {}
        // Disable stylus handwriting dialog that blocks input text on tablet emulators
        try { adbShell(device.serial, `settings put global stylus_handwriting_enabled 0`); } catch {}
        await sleep(300);
        adbShell(device.serial, `am start -n ${APP_ACTIVITY}`);
        break;

      case 'wait':
        await sleep(a.ms);
        break;

      case 'tab':
        // Tap bottom navigation tab n (0=Draw, 1=Journal, 2=Gallery, 3=Treehouse)
        adbShell(device.serial, `input tap ${device.tabX[a.n]} ${device.navY}`);
        break;

      case 'tap':
        adbShell(device.serial, `input tap ${a.x} ${a.y}`);
        break;

      case 'tapF':
        adbShell(device.serial, `input tap ${Math.round(a.xf * device.w)} ${Math.round(a.yf * device.h)}`);
        break;

      case 'text':
        adbShell(device.serial, `input text "${a.v.replace(/ /g, '%s')}"`);
        break;

      case 'key':
        adbShell(device.serial, `input keyevent ${a.c}`);
        break;

      case 'swipeUp':
        adbShell(device.serial, `input swipe ${Math.round(device.w * 0.5)} ${Math.round(device.h * 0.7)} ${Math.round(device.w * 0.5)} ${Math.round(device.h * 0.2)} 500`);
        break;

      case 'swipe':
        // General swipe: x1,y1 → x2,y2 over ms duration
        adbShell(device.serial, `input swipe ${a.x1} ${a.y1} ${a.x2} ${a.y2} ${a.ms || 500}`);
        break;

      default:
        console.warn(`  ⚠ Unknown action type: ${a.t}`);
    }
  }
}

async function captureScreen(serial, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // Use exec-out to pipe screencap directly without the temp file pull dance.
  // PowerShell-safe: run via bash -c to get the pipe working.
  execSync(
    `adb -s ${serial} exec-out screencap -p > "${outPath}"`,
    { shell: 'bash', timeout: 15_000 }
  );
}

// ─── Capture phase ────────────────────────────────────────────────────────────
async function capture() {
  const devicesToCapture = [];
  if (!TABLET_ONLY) devicesToCapture.push(DEVICES.phone);
  if (!PHONE_ONLY)  devicesToCapture.push(DEVICES.tablet);

  for (const device of devicesToCapture) {
    // Verify device is reachable
    try {
      adb(device.serial, 'get-state');
    } catch {
      console.warn(`⚠ ${device.serial} not available — skipping ${device.type} capture`);
      continue;
    }

    console.log(`\n📱 Capturing ${device.type} screenshots on ${device.serial} (${device.w}×${device.h})`);

    for (const screen of SCREENS) {
      if (screenFilter && !screenFilter.has(screen.id)) continue;

      const rawFile = screen[device.type];
      if (!rawFile) {
        console.log(`  ⤼ ${screen.id}: no ${device.type} source defined`);
        continue;
      }

      const actions = (device.type === 'tablet' && screen.tabletActions)
        ? screen.tabletActions
        : screen.actions;

      const outPath = path.join(RAW, rawFile);
      console.log(`  ▸ ${screen.id}: "${screen.title.substring(0, 45)}…"`);

      try {
        await runActions(device, actions);
        await captureScreen(device.serial, outPath);
        console.log(`    ✓ → ${path.relative(ROOT, outPath)}`);
      } catch (err) {
        console.error(`    ✗ FAILED: ${err.message}`);
      }
    }
  }
}

// ─── Text overlay helpers ─────────────────────────────────────────────────────
function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrap(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length <= maxChars) { cur = test; }
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function makeOverlay(w, h, titleLines, subLines, tPx, sPx, textFrac = 0.5) {
  const lhT  = tPx * 1.22;
  const lhS  = sPx * 1.38;
  const gap  = tPx * 0.45;
  const totH = titleLines.length * lhT + gap + subLines.length * lhS;
  let y = (h * textFrac - totH / 2) + tPx * 0.82;

  const elems = [];
  for (const line of titleLines) {
    elems.push(`  <text x="${w/2}" y="${Math.round(y)}" text-anchor="middle"
      font-family="Arial,Helvetica,sans-serif" font-size="${tPx}" font-weight="700"
      fill="#ffffff" stroke="#00000044" stroke-width="${Math.max(1, Math.round(tPx * 0.06))}"
      paint-order="stroke">${escXml(line)}</text>`);
    y += lhT;
  }
  y += gap;
  for (const line of subLines) {
    elems.push(`  <text x="${w/2}" y="${Math.round(y)}" text-anchor="middle"
      font-family="Arial,Helvetica,sans-serif" font-size="${sPx}"
      fill="rgba(255,255,255,0.88)">${escXml(line)}</text>`);
    y += lhS;
  }

  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000000" stop-opacity="0"/>
      <stop offset="32%"  stop-color="#2d0e99" stop-opacity="0.36"/>
      <stop offset="100%" stop-color="#2d0e99" stop-opacity="0.76"/>
    </linearGradient>
    <filter id="ts" x="-5%" y="-25%" width="110%" height="150%">
      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#000000" flood-opacity="0.70"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <g filter="url(#ts)">
${elems.join('\n')}
  </g>
</svg>`);
}

// ─── Composite phase ─────────────────────────────────────────────────────────
async function composite(srcPath, target, screen) {
  const { w, h, dir, ovFrac, tPx, sPx, tCh, sCh, src } = target;

  const srcMeta       = await sharp(srcPath).metadata();
  const srcIsLandscape = srcMeta.width > srcMeta.height;
  const targetIsPortrait = h > w;

  let baseBuffer;
  let ovH;

  if (srcIsLandscape && targetIsPortrait) {
    const minWidthFrac = 0.55;
    const maxByWidth   = Math.round((w * srcMeta.height) / (minWidthFrac * srcMeta.width));
    const screenH      = Math.min(maxByWidth, Math.round(h * 0.60));
    ovH = Math.round(h * ovFrac);
    const fillH = h - screenH;

    const scaledBuf = await sharp(srcPath)
      .resize(w, screenH, { fit: 'cover', position: 'left' })
      .png().toBuffer();

    const fillBuf = await sharp(srcPath)
      .resize(w, fillH, { fit: 'cover', position: 'bottom' })
      .blur(22).modulate({ brightness: 0.70 })
      .png().toBuffer();

    baseBuffer = await sharp({
      create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
    })
      .composite([
        { input: scaledBuf, top: 0,       left: 0 },
        { input: fillBuf,   top: screenH, left: 0 },
      ])
      .png().toBuffer();
  } else {
    const position = screen.positions?.[src] ?? 'top';
    baseBuffer = await sharp(srcPath)
      .resize(w, h, { fit: 'cover', position })
      .png().toBuffer();
    ovH = Math.round(h * ovFrac);
  }

  const overlay  = makeOverlay(w, ovH, wrap(screen.title, tCh), wrap(screen.subtitle, sCh), tPx, sPx);
  const outFile  = path.join(OUT, dir, `${screen.id}.png`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  await sharp(baseBuffer)
    .composite([{ input: overlay, top: h - ovH, left: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(outFile);

  return outFile;
}

async function generate() {
  console.log('\n🎨 Compositing store screenshots...\n');

  for (const screen of SCREENS) {
    if (screenFilter && !screenFilter.has(screen.id)) continue;
    console.log(`▸ ${screen.id}  "${screen.title}"`);

    for (const target of TARGETS) {
      const rawFile = screen[target.src];
      if (!rawFile) {
        console.log(`    ⤼ ${target.dir} — no ${target.src} source`);
        continue;
      }
      const srcPath = path.join(RAW, rawFile);
      if (!fs.existsSync(srcPath)) {
        console.log(`    ⚠ SKIP ${target.dir} — missing: ${rawFile}`);
        continue;
      }
      try {
        const out = await composite(srcPath, target, screen);
        console.log(`    ✓ ${path.relative(ROOT, out)}`);
      } catch (err) {
        console.error(`    ✗ ${target.dir}: ${err.message}`);
      }
    }
  }

  console.log('\n✓ All done. Outputs in store-listings/');
}

// ─── Entry point ─────────────────────────────────────────────────────────────
(async () => {
  if (!GENERATE_ONLY) await capture();
  if (!CAPTURE_ONLY)  await generate();
})().catch(e => { console.error(e); process.exit(1); });
