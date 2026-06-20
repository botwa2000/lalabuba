// fill-core.js — pure, DOM-free flood-fill + seam-bleed + enclosed-gap reclaim
// for the colour-by-number canvas. Extracted from canvas.js so the pixel logic
// can be unit-tested in Node against synthetic images (scripts/test-fill-core.mjs).
//
// The "sliver" family of bugs: the morphological closing in precomputeRegions
// swallows thin bright features into the outline band (label -1), so after a
// fill a region can leave (a) a white anti-aliased FRINGE against the black line
// and (b) enclosed white POCKETS (a beak tip, the gap between toes) that have no
// divider drawn around them. We close BOTH — but never paint a colour across an
// OPEN gap between two different regions (that would draw a fake border in open
// white). Safety rule, mirroring the Flutter engine: an enclosed bright pocket is
// filled only when the single real region bordering it is the one being filled.
//
// Label semantics (from precomputeRegions): final labels are -1 (outline / tiny
// specks / sealed frame) or >= 1 (real CCA regions, incl. a positive background
// id). There is no label 0 in the finished map.

// Mutates `paint` in place; returns { undoEntries } as a flat
// [idx, prevR, prevG, prevB, prevA, ...] array for the caller to pack for undo.
export function fillRegionCore(opts) {
  const {
    paint, base, regionMap, regionPixels, regionColorMap,
    width, height, regionId, fillColor, minBr = 50,
  } = opts;

  const undoEntries = [];
  const pixels = regionPixels.get(regionId);
  if (!pixels) return { undoEntries };

  const { r, g, b } = fillColor;
  const n = width * height;
  const painted = new Uint8Array(n);

  const paintPixel = (idx) => {
    if (painted[idx]) return;
    const o = idx * 4;
    undoEntries.push(idx, paint[o], paint[o + 1], paint[o + 2], paint[o + 3]);
    paint[o] = r; paint[o + 1] = g; paint[o + 2] = b; paint[o + 3] = 255;
    painted[idx] = 1;
  };

  // 1. Fill the region's own pixels.
  for (const idx of pixels) paintPixel(idx);

  // 2. Two-pass outward bleed into adjacent non-black (anti-aliased) pixels so no
  //    white fringe is left between the fill colour and the black outline.
  let frontier = pixels;
  for (let pass = 0; pass < 2; pass++) {
    const next = [];
    for (const idx of frontier) {
      const x = idx % width, y = (idx / width) | 0;
      const tryBleed = (ni) => {
        if (painted[ni]) return;
        const o = ni * 4;
        if ((base[o] + base[o + 1] + base[o + 2]) / 3 > minBr) {
          paintPixel(ni);
          next.push(ni);
        }
      };
      if (x > 0)          tryBleed(idx - 1);
      if (x < width - 1)  tryBleed(idx + 1);
      if (y > 0)          tryBleed(idx - width);
      if (y < height - 1) tryBleed(idx + width);
    }
    frontier = next;
  }

  // 3. Enclosed-gap reclaim with a single-border-colour safety gate.
  if (regionMap) {
    reclaimEnclosedGaps({
      paint, base, regionMap, regionPixels, regionColorMap,
      width, height, regionId, fillColor, minBr,
      painted, paintPixel, seedLists: [pixels, frontier],
    });
  }

  return { undoEntries };
}

function reclaimEnclosedGaps(ctx) {
  const {
    paint, base, regionMap, regionPixels, regionColorMap,
    width, height, regionId, fillColor, minBr,
    painted, paintPixel, seedLists,
  } = ctx;
  const n = width * height;

  // A pixel belongs to a "gap blob" if it is bright (a swallowed light feature),
  // unpainted, and either outline-band (-1) or a SMALL UNCOLOURED region (a speck
  // the closing merged in). Large or already-coloured regions are real walls, not
  // gap members.
  const isGapMember = (ni) => {
    if (painted[ni]) return false;
    const o = ni * 4;
    if ((base[o] + base[o + 1] + base[o + 2]) / 3 <= minBr) return false; // dark = wall
    const lbl = regionMap[ni];
    if (lbl < 1) return true;            // outline / speck band
    if (lbl === regionId) return false;  // home region pixel = same-colour wall
    const rpx = regionPixels.get(lbl);
    return !!rpx && rpx.length < 500 && !(regionColorMap && regionColorMap.has(lbl));
  };

  // Classify a NON-member neighbour as a bordering colour source:
  //   'home'  → the region being filled (or a pixel already painted its colour)
  //   'x'     → any OTHER region or already-painted colour (a genuine divider)
  //   null    → a dark outline pixel: a wall, but not a colour source
  const borderClass = (ni) => {
    const o = ni * 4;
    if (painted[ni]) {
      return (paint[o] === fillColor.r &&
              paint[o + 1] === fillColor.g &&
              paint[o + 2] === fillColor.b)
          ? 'home'
          : 'x';
    }
    const lbl = regionMap[ni];
    if (lbl === regionId) return 'home';
    if (lbl >= 1) return 'x';            // a real other region → divider zone
    return null;                         // unpainted -1 / handled as member or dark wall
  };

  const pushNeighbours = (idx, fn) => {
    const x = idx % width, y = (idx / width) | 0;
    if (x > 0)          fn(idx - 1);
    if (x < width - 1)  fn(idx + 1);
    if (y > 0)          fn(idx - width);
    if (y < height - 1) fn(idx + width);
  };

  const seen = new Uint8Array(n);
  const seeds = [];
  for (const list of seedLists) {
    for (const idx of list) {
      pushNeighbours(idx, (ni) => {
        if (!seen[ni] && isGapMember(ni)) { seen[ni] = 1; seeds.push(ni); }
      });
    }
  }

  for (const seed of seeds) {
    // BFS the connected gap blob; collect members + whether it borders the home
    // colour and/or any foreign colour.
    const blob = [seed];
    let qi = 0;
    let homeBordered = false;
    let foreignBordered = false;
    while (qi < blob.length) {
      const idx = blob[qi++];
      pushNeighbours(idx, (ni) => {
        if (isGapMember(ni)) {
          if (!seen[ni]) { seen[ni] = 1; blob.push(ni); }
          return;
        }
        const c = borderClass(ni);
        if (c === 'home') homeBordered = true;
        else if (c === 'x') foreignBordered = true;
      });
    }
    // Fill an enclosed pocket ONLY when its border is unambiguous — the home
    // region and nothing else. Any foreign border means a real divider zone, so
    // leave it white and never draw a fake boundary across an open gap.
    if (homeBordered && !foreignBordered) {
      for (const idx of blob) paintPixel(idx);
    }
  }
}
