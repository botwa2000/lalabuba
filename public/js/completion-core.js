// Pure, DOM-free core of free-colour completion, so the decision logic can be
// unit-tested in node (scripts/test-completion-core.mjs) and stay in lock-step
// with the Flutter twin (CanvasState.isComplete / colouredTargetCount).
//
// The model: a picture has a difficulty-scaled set of "meaningful" areas (the
// largest regions — the ones that would carry a number). A free-colour page is
// finished when a forgiving, self-scaling ~90% of those areas are coloured with
// ANY colour — by a tap/paint fill OR by enough freehand (pencil) coverage.

// How many areas count as "meaningful" per difficulty. Mirrors the Flutter
// _maxNumberedFor and the recommended ranges:
// Easy ~6-10 · Medium ~12-20 · Hard ~24-36 · Extreme ~48-64.
export function numberedCapFor(diff) {
  switch (diff) {
    case 'easy':    return 10;
    case 'hard':    return 30;
    case 'extreme': return 48;
    default:        return 18; // medium
  }
}

// Pick the meaningful target areas = the largest `cap` regions, excluding the
// outer background. `entries` is an array of [id, pixelCount]. Returns ids.
export function pickMeaningfulTargets(entries, cap, backgroundId) {
  return entries
    .filter(([id]) => id > 0 && id !== backgroundId)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([id]) => id);
}

// Forgiving, self-scaling completion threshold. With few big areas (Easy) this
// rounds up to "all of them"; on dense pages it tolerates the slivers a child
// inevitably leaves uncoloured.
export function freeComplete(total, coloured) {
  if (total <= 0) return false;
  return coloured >= Math.ceil(total * 0.9);
}

// A freehand area counts as coloured once this fraction of its interior is
// painted. Low + forgiving: children colour unevenly, leaving white gaps.
export const COVER_THRESHOLD = 0.45;

export function isCovered(coveredPixels, totalPixels, threshold = COVER_THRESHOLD) {
  return totalPixels > 0 && coveredPixels / totalPixels >= threshold;
}

// ── Masked "stay-in-the-lines" freehand ──────────────────────────────────────
// Pure decision for whether a freehand (pencil/paint) pixel is KEPT or wiped:
// - never paint over a black line (onLine) — keeps the line art crisp;
// - in assist mode (Easy/Medium) also wipe paint that left the shape the stroke
//   started in (region != startRegion) — "stay inside this area".
// `onLine` true = the pixel is a wall/line. startRegion < 0 (stroke began on a
// line) disables the region clamp so the child is never trapped.
export function freehandKeepsPaint(onLine, region, startRegion, assist) {
  if (onLine) return false;
  if (assist && startRegion >= 0 && region !== startRegion) return false;
  return true;
}

// Assist (stay-in-shape) is on for the gentler levels; off for Hard/Extreme,
// where older kids may want to cross between adjacent areas (lines still block).
export function maskAssistFor(diff) {
  return diff === 'easy' || diff === 'medium';
}
