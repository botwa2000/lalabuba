// line-bridge.js — Stage-2 of the line-art precision stack: bridge genuine line
// BREAKS. Pure, DOM-free; the web twin of Flutter's line_bridge.dart.
// Unit-tested via scripts/test-line-bridge.mjs.
//
// Hysteresis (outline-mask.js) seals faint anti-aliased pin-gaps, but a real
// break in a boundary line — a tip stopping short of the line it should meet —
// still leaks a fill across it. We find the line TIPS (via a 1-px skeleton) and
// join only tips that FACE each other across a short gap. The facing test is the
// safety guard: parallel groove tips have parallel tangents (not facing) and are
// NOT joined, so this never re-creates the "can't colour" over-seal. Bridges go
// to the segmentation mask only (not the visible line), so regions separate
// cleanly with no fake ink across the gap.
//
// [mask] is the wall mask (Uint8Array, 1 = wall, 0 = free); modified in place.
export function bridgeLineGaps(mask, w, h, opts = {}) {
  const short = w < h ? w : h;
  const maxGap = opts.maxGap ?? Math.max(4, Math.min(16, (short / 100) | 0));
  const faceCos = opts.faceCos ?? 0.5;      // cos 60°
  const tangentSteps = opts.tangentSteps ?? 4;
  if (maxGap < 2) return;

  const skel = zhangSuenThin(mask, w, h);

  const tips = [];
  for (let i = 0; i < w * h; i++) {
    if (skel[i] === 0) continue;
    if (skelNeighbourCount(skel, i, w, h) === 1) tips.push(i);
  }
  if (tips.length < 2) return;

  const dirX = new Float64Array(tips.length);
  const dirY = new Float64Array(tips.length);
  for (let t = 0; t < tips.length; t++) {
    const back = walkBack(skel, tips[t], w, h, tangentSteps);
    const ex = tips[t] % w, ey = (tips[t] / w) | 0;
    const bx = back % w, by = (back / w) | 0;
    let vx = ex - bx, vy = ey - by;
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0) { vx /= len; vy /= len; }
    dirX[t] = vx; dirY[t] = vy;
  }

  const used = new Array(tips.length).fill(false);
  const gap2 = maxGap * maxGap;
  for (let a = 0; a < tips.length; a++) {
    if (used[a]) continue;
    const ax = tips[a] % w, ay = (tips[a] / w) | 0;
    let best = -1, bestD2 = gap2 + 1;
    for (let b = 0; b < tips.length; b++) {
      if (b === a || used[b]) continue;
      const bx = tips[b] % w, by = (tips[b] / w) | 0;
      const dx = bx - ax, dy = by - ay;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1 || d2 > gap2 || d2 >= bestD2) continue;
      const glen = Math.sqrt(d2);
      const gx = dx / glen, gy = dy / glen;
      if (dirX[a] * gx + dirY[a] * gy < faceCos) continue;
      if (dirX[b] * -gx + dirY[b] * -gy < faceCos) continue;
      best = b; bestD2 = d2;
    }
    if (best >= 0) {
      draw4ConnectedLine(mask, ax, ay, tips[best] % w, (tips[best] / w) | 0, w, h);
      used[a] = true; used[best] = true;
    }
  }
}

function skelNeighbourCount(skel, i, w, h) {
  const x = i % w, y = (i / w) | 0;
  let c = 0;
  for (let dy = -1; dy <= 1; dy++) {
    const ny = y + dy;
    if (ny < 0 || ny >= h) continue;
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      if (nx < 0 || nx >= w) continue;
      if (skel[ny * w + nx] === 1) c++;
    }
  }
  return c;
}

function walkBack(skel, endpoint, w, h, steps) {
  let prev = -1, cur = endpoint;
  for (let s = 0; s < steps; s++) {
    const x = cur % w, y = (cur / w) | 0;
    let next = -1, count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= w) continue;
        const ni = ny * w + nx;
        if (skel[ni] === 1 && ni !== prev) { next = ni; count++; }
      }
    }
    if (next < 0 || count > 1) break;
    prev = cur; cur = next;
  }
  return cur;
}

function draw4ConnectedLine(mask, x0, y0, x1, y1, w, h) {
  let x = x0, y = y0;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    if (x >= 0 && x < w && y >= 0 && y < h) mask[y * w + x] = 1;
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 - dy > dx - e2) { err -= dy; x += sx; }
    else { err += dx; y += sy; }
  }
}

// Zhang-Suen thinning → 1-px skeleton. Returns a new array; src unmodified.
export function zhangSuenThin(src, w, h) {
  const img = Uint8Array.from(src);
  let changed = true;
  const toClear = [];
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      toClear.length = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (img[i] === 0) continue;
          const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1],
                p5 = img[i + w + 1], p6 = img[i + w], p7 = img[i + w - 1],
                p8 = img[i - 1], p9 = img[i - w - 1];
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          let a = 0;
          if (p2 === 0 && p3 === 1) a++;
          if (p3 === 0 && p4 === 1) a++;
          if (p4 === 0 && p5 === 1) a++;
          if (p5 === 0 && p6 === 1) a++;
          if (p6 === 0 && p7 === 1) a++;
          if (p7 === 0 && p8 === 1) a++;
          if (p8 === 0 && p9 === 1) a++;
          if (p9 === 0 && p2 === 1) a++;
          if (a !== 1) continue;
          if (step === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }
          toClear.push(i);
        }
      }
      if (toClear.length) {
        changed = true;
        for (const i of toClear) img[i] = 0;
      }
    }
  }
  return img;
}
