/// Pure decision for masked "stay-in-the-lines" freehand, mirroring the web twin
/// (completion-core.freehandKeepsPaint). Returns true if a freehand point may be
/// painted:
///  - never on a black line ([onLine]) — keeps the line art crisp;
///  - in [assist] mode (Easy/Medium) only inside the shape the stroke began in
///    ([region] == [startRegion]) — "stay inside this area".
/// [startRegion] < 0 (the stroke began on a line) disables the region clamp so a
/// child is never trapped.
bool freehandKeepsPaint({
  required bool onLine,
  required int region,
  required int startRegion,
  required bool assist,
}) {
  if (onLine) return false;
  if (assist && startRegion >= 0 && region != startRegion) return false;
  return true;
}

/// Assist (stay-in-shape) is on for the gentler levels; off for Hard/Extreme,
/// where older kids may want to cross between adjacent areas (lines still block).
bool maskAssistFor(String? difficulty) =>
    difficulty == 'easy' || difficulty == 'medium';
