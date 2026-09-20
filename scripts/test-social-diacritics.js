#!/usr/bin/env node
// test-social-diacritics.js — regression fixture for the social-asset text
// renderer (scripts/social-lib.js). A sibling pipeline (Bonifatus), built the
// same way as this one, shipped ten misspelled German words to a live account
// (Willkuer/Faecher/fuer/Praemien instead of Willkür/Fächer/für/Prämien) and
// had to be deleted. This test renders the same class of characters through
// social-lib.js's actual renderText() path and FAILS LOUDLY if anything is
// wrong — so this can never regress silently again.
//
// This is a real render + pixel check, not a "did it throw" check: a
// transliteration bug (ü→ue) produces a WIDER correctly-rendered image with
// extra glyphs, not an error — so we assert the rendered width is close to a
// known-good reference width, which a silent ASCII substitution would violate.
//
// Run: node scripts/test-social-diacritics.js
'use strict';
const path = require('path');
const fs = require('fs');
const { renderText, FONTS, DIACRITICS_FIXTURE } = require('./social-lib');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'social-content');

async function main() {
  let failures = 0;
  const check = (name, cond, detail) => {
    if (cond) console.log(`  ok   ${name}`);
    else { console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); failures++; }
  };

  console.log('test: diacritics render correctly through social-lib.js renderText()');
  const { buffer, width, height } = await renderText(
    DIACRITICS_FIXTURE, FONTS.bodyExtraBold, 40, '#000000'
  );

  // Must have rendered SOMETHING (non-trivial size) — catches a total failure.
  check('produced a non-trivial image', width > 200 && height > 20,
    `got ${width}x${height}`);

  // A transliterated version of the fixture is 6 characters LONGER than the
  // original (ü→ue, ä→ae, ü→ue, ü→ue, ß→ss = +1 each x5, für→fuer = +1) — at
  // 40pt Nunito ExtraBold that is unmistakably wider. Assert the rendered
  // width falls in the expected band for the CORRECT string, not a
  // transliterated one — this is what actually would have caught the
  // Bonifatus bug, not just "did the font file load".
  // (Band measured empirically from the correct string at this size/font;
  // generous ±15% tolerance for font hinting/rounding, not for a wrong string.)
  const EXPECTED_WIDTH = 889; // measured 2026-09-20 from this exact known-good render (viewed and confirmed correct)
  const tolerance = 0.15;
  const withinBand = Math.abs(width - EXPECTED_WIDTH) / EXPECTED_WIDTH <= tolerance;
  check('rendered width matches the CORRECT (non-transliterated) string',
    withinBand, `got ${width}px, expected ${EXPECTED_WIDTH}px ±${tolerance * 100}%`);

  // Save the actual PNG so a human can also just look at it (mandatory per
  // project convention: never report text-rendering success without viewing
  // the pixels at least once when the fixture changes).
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fixturePath = path.join(OUT_DIR, 'diacritics-regression-fixture.png');
  fs.writeFileSync(fixturePath, buffer);
  console.log(`  → saved ${path.relative(process.cwd(), fixturePath)} for visual confirmation`);

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
