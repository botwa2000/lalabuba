// social-lib.js — shared text/callout rendering for the social-asset generators
// (make-social-pins.js, make-social-carousel.js). Extracted 2026-09-20 to fix two
// defects found in both scripts:
//
// 1. DIACRITICS: inline SVG `<text font-family="Segoe UI, Arial, sans-serif">`
//    depends on HOST fonts. On this dev machine "Segoe UI"/"Arial" happen to be
//    installed and render correctly — but the sibling Bonifatus pipeline (built
//    the same way) shipped ten misspelled words (Willkuer/Faecher/fuer/Praemien
//    instead of Willkür/Fächer/für/Prämien) and had to be deleted. Investigation
//    here found that was NOT a missing-glyph problem (missing glyphs render as
//    tofu boxes, not ASCII substitutions) — it was almost certainly a string
//    transliterated upstream before ever reaching the renderer. But the "depends
//    on host fonts" risk is real regardless: this repo's own generic
//    `font-family="sans-serif"` (no specific name) silently falls back to a
//    monospace font on this machine, and in a Docker/Linux CI context even
//    "Segoe UI" (Windows-only) would not exist at all.
//
//    Fix: render ALL text via `sharp({ text: { fontfile: <bundled .ttf> } })`
//    (Pango, via libvips) instead of SVG `<text>`. This loads the exact font
//    file directly — no fontconfig/host-font lookup involved — so output is
//    byte-identical regardless of what's installed on the machine running the
//    script. Verified: @font-face + base64 data-URI embedding in SVG (the
//    "obvious" fix) does NOT work on this sharp/rsvg build (silently falls back
//    to the same monospace default) — `sharp.text({fontfile})` is the only
//    mechanism that reliably worked in testing.
//
// 2. WRAPPING: SVG `<text>` never wraps; long headlines overflow the frame
//    silently. `sharp.text({width, wrap:'word'})` uses Pango's real text-layout
//    engine (real glyph metrics, real line breaking) instead of a guessed
//    character-width heuristic, and auto-crops the output to the actual
//    rendered bounding box, so the caller always knows the true size before
//    compositing.
'use strict';
const sharp = require('sharp');
const path = require('path');

const FONT_DIR = path.join(__dirname, '..', 'flutter_app', 'google_fonts');

// Display font (headlines, big numerals) vs body font (subtext, labels, CTA) —
// mirrors the app's own type pairing (Fredoka for the playful wordmark/headings,
// Nunito for body text), so social assets stay visually on-brand with the app.
const FONTS = {
  displayBold:   { family: 'Fredoka Bold',      file: path.join(FONT_DIR, 'Fredoka-Bold.ttf') },
  displaySemi:   { family: 'Fredoka SemiBold',  file: path.join(FONT_DIR, 'Fredoka-SemiBold.ttf') },
  bodyExtraBold: { family: 'Nunito ExtraBold',  file: path.join(FONT_DIR, 'Nunito-ExtraBold.ttf') },
  bodyBold:      { family: 'Nunito Bold',       file: path.join(FONT_DIR, 'Nunito-Bold.ttf') },
  bodySemi:      { family: 'Nunito SemiBold',   file: path.join(FONT_DIR, 'Nunito-SemiBold.ttf') },
  bodyRegular:   { family: 'Nunito Regular',    file: path.join(FONT_DIR, 'Nunito-Regular.ttf') },
};

// Pango markup escaping (same special characters as XML: & < > among these).
function escMarkup(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Regression fixture proving diacritics render correctly through this exact
// path — used by scripts/test-social-diacritics.js. Keep in sync with that test.
const DIACRITICS_FIXTURE = 'Fächer Willkür Prämien für — ÄÖÜäöüß àéîôû ñ';

/**
 * Render a line (or wrapped block) of text to a tightly-cropped RGBA PNG buffer
 * via Pango/libvips, using an explicitly bundled font file (see FONTS above) —
 * never a host/system font lookup.
 *
 * @param {string} text - plain text (will be markup-escaped internally)
 * @param {{family:string,file:string}} font - one of FONTS.*
 * @param {number} sizePt - Pango point size
 * @param {string} color - glyph color as a Pango-markup color: a named color
 *   or #RGB/#RRGGBB/#RRGGBBAA hex. NOT a CSS `rgba(...)` string — Pango's
 *   `foreground` attribute doesn't parse that syntax and throws "invalid
 *   markup in text" (hit this during the 2026-09-20 rewrite).
 * @param {number} [maxWidth] - wrap width in px; omit for single-line, no wrap
 * @param {'left'|'center'|'right'} [align]
 * @param {number} [letterSpacing] - extra px between letters (Pango `letter_spacing`, in 1024ths of a px... see below)
 * @returns {Promise<{buffer:Buffer,width:number,height:number}>}
 */
async function renderText(text, font, sizePt, color, { maxWidth, align = 'left', letterSpacing } = {}) {
  const spanAttrs = [`size="${Math.round(sizePt * 1000)}"`, `foreground="${color}"`];
  if (letterSpacing) spanAttrs.push(`letter_spacing="${Math.round(letterSpacing * 1024)}"`);
  const markup = `<span ${spanAttrs.join(' ')}>${escMarkup(text)}</span>`;
  const opts = {
    text: {
      text: markup,
      font: font.family,
      fontfile: font.file,
      rgba: true,
      align,
    },
  };
  if (maxWidth) {
    opts.text.width = Math.round(maxWidth);
    opts.text.wrap = 'word';
  }
  const img = sharp(opts);
  const meta = await img.metadata();
  const buffer = await img.png().toBuffer();
  return { buffer, width: meta.width, height: meta.height };
}

/**
 * Assert a rendered text block fits within a safe box; throws with a clear
 * message instead of silently shipping clipped/overflowing text. Call this
 * after every renderText() that has a hard layout budget.
 */
function assertFits({ width, height }, maxWidth, maxHeight, label) {
  const problems = [];
  if (maxWidth != null && width > maxWidth) problems.push(`width ${width} > ${maxWidth}`);
  if (maxHeight != null && height > maxHeight) problems.push(`height ${height} > ${maxHeight}`);
  if (problems.length) {
    throw new Error(`[social-lib] "${label}" overflowed its safe box: ${problems.join(', ')}`);
  }
}

// ─── Shapes (SVG is fine here — no text glyphs involved) ──────────────────────

function escXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

async function roundedRectShadow(w, h, radius, fill, opacity = 1) {
  const pad = 24; // room for the blur to breathe without clipping
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}">
    <defs>
      <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.28"/>
      </filter>
    </defs>
    <rect x="${pad}" y="${pad}" width="${w}" height="${h}" rx="${radius}" ry="${radius}"
      fill="${escXml(fill)}" opacity="${opacity}" filter="url(#s)"/>
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return { buffer, width: w + pad * 2, height: h + pad * 2, pad };
}

// Simple triangular arrow pointing in one of 4 directions, solid fill.
async function arrow(dir, size, fill) {
  const s = size;
  const pts = {
    down:  `0,0 ${s},0 ${s / 2},${s}`,
    up:    `0,${s} ${s},${s} ${s / 2},0`,
    left:  `${s},0 ${s},${s} 0,${s / 2}`,
    right: `0,0 0,${s} ${s},${s / 2}`,
  }[dir];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
    <polygon points="${pts}" fill="${escXml(fill)}"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function circleBadge(diameter, fill, ringColor) {
  const stroke = ringColor ? `stroke="${escXml(ringColor)}" stroke-width="4"` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}">
    <circle cx="${diameter / 2}" cy="${diameter / 2}" r="${diameter / 2 - 3}" fill="${escXml(fill)}" ${stroke}/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Numbered step marker: solid circle + white numeral, rendered as one PNG.
 * Used for ①②③-style sequence markers (numerals via bundled font, not the
 * Unicode circled-digit glyphs — those are missing from most fonts).
 */
async function numberMarker(n, diameter, accentHex) {
  const circleBuf = await circleBadge(diameter, accentHex);
  const sizePt = Math.round(diameter * 0.42);
  const { buffer: numBuf, width: nw, height: nh } = await renderText(
    String(n), FONTS.bodyExtraBold, sizePt, '#ffffff'
  );
  const composed = await sharp(circleBuf)
    .composite([{ input: numBuf, top: Math.round((diameter - nh) / 2) - Math.round(diameter * 0.03), left: Math.round((diameter - nw) / 2) }])
    .png().toBuffer();
  return { buffer: composed, width: diameter, height: diameter };
}

/**
 * A callout box: rounded rect + drop shadow + wrapped label text, with an
 * optional numbered marker OR arrow pointing at the UI element it describes.
 * Returns an array of {input, top, left} composite-layer descriptors, already
 * positioned relative to (x, y) = the box's top-left corner — the caller just
 * offsets everything onto the final canvas.
 *
 * @param {object} opts
 * @param {string} opts.text - callout label (wrapped automatically)
 * @param {number} opts.x - box top-left x on the canvas
 * @param {number} opts.y - box top-left y on the canvas
 * @param {number} opts.maxTextWidth - wrap width for the label, in px
 * @param {string} opts.accentHex - box fill color
 * @param {string} [opts.textColor] - label color (default white)
 * @param {number} [opts.sizePt] - label font size (default 26)
 * @param {number|null} [opts.stepNumber] - if set, draws a number marker to the box's left
 * @param {'down'|'up'|'left'|'right'|null} [opts.arrowDir] - if set, draws a small arrow on that edge, pointing away from the box
 */
async function drawCallout({ text, x, y, maxTextWidth, accentHex, textColor = '#ffffff', sizePt = 26, stepNumber = null, arrowDir = null }) {
  const padX = 28, padY = 20;
  const { buffer: textBuf, width: tw, height: th } = await renderText(
    text, FONTS.bodyBold, sizePt, textColor, { maxWidth: maxTextWidth, align: 'left' }
  );
  const boxW = tw + padX * 2;
  const boxH = th + padY * 2;
  const { buffer: boxBuf, width: boxOuterW, height: boxOuterH, pad } = await roundedRectShadow(boxW, boxH, 18, accentHex);

  const layers = [
    { input: boxBuf, top: y - pad, left: x - pad },
    { input: textBuf, top: y + padY, left: x + padX },
  ];

  if (stepNumber != null) {
    const dia = boxH + 10;
    const { buffer: markerBuf } = await numberMarker(stepNumber, dia, accentHex);
    layers.unshift({ input: markerBuf, top: y - 5, left: x - dia - 14 });
  }

  if (arrowDir) {
    const s = 22;
    const arrowBuf = await arrow(arrowDir, s, accentHex);
    const pos = {
      down:  { top: y + boxH - 2, left: x + boxW / 2 - s / 2 },
      up:    { top: y - s + 2,    left: x + boxW / 2 - s / 2 },
      left:  { top: y + boxH / 2 - s / 2, left: x - s + 2 },
      right: { top: y + boxH / 2 - s / 2, left: x + boxW - 2 },
    }[arrowDir];
    layers.push({ input: arrowBuf, top: Math.round(pos.top), left: Math.round(pos.left) });
  }

  return { layers, width: boxW, height: boxH };
}

module.exports = {
  FONTS, FONT_DIR, DIACRITICS_FIXTURE,
  renderText, assertFits, escMarkup,
  roundedRectShadow, arrow, circleBadge, numberMarker, drawCallout,
};
