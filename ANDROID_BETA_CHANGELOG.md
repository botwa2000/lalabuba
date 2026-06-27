# Android Beta Changelog — Pre-Release Testing Log

> 12 beta testers · 14-day window (starting ~2026-07-01)
> Every user-reported issue and our fix is documented here.
> This file will be submitted to Google Play as evidence of user feedback resolution.

---

## How to Use This File

1. Each bug gets a numbered entry under the week it was discovered
2. Include: reported symptom → root cause → fix committed → version deployed
3. Mark [RESOLVED] / [IN PROGRESS] / [WON'T FIX] clearly
4. Before Play Store production release, summarise in §Final Summary

---

## Week 1 (Days 1–7)

### BUG-001: Dense/Extreme images not colorable [RESOLVED]
- **Reported**: Areas on complex submarine/detailed images couldn't be filled by tapping
- **Root cause**: All trapped-ball segments < 30px → demoted → `regionMap` all -1 → every tap failed
- **Fix**: Adaptive demotion threshold in `region-worker.js` — rescues largest segments to ≥5px when all would be demoted
- **Also fixed**: `floodFillAt` now searches 16px for non-line start pixel; `findRegionAt` radius 8→16px
- **Committed**: b2806c1 — 2026-06-27
- **Deployed**: Production v227

### BUG-002: Number badges not appearing on dense/artistic images [RESOLVED]
- **Reported**: Clicking "Numbers" button did nothing on complex images
- **Root cause**: `buildWalkableMask` (brightness > 235) found no large white regions on stippled images → `findRegions` returned empty array → no badges drawn
- **Fix**: `overlayNumbers()` now falls back to `state.regionPixels` centroids (worker-derived) when brightness-based search yields < 3 regions
- **Committed**: (commit pending v228) — 2026-06-27
- **Deployed**: Production v228

### BUG-003: Turnstile popup showed "tap the box" with no visible checkbox [RESOLVED]
- **Reported**: Cloudflare challenge appeared as a modal with instructional text but blank widget space
- **Root cause**: Widget was always positioned on-screen; `interaction-only` mode renders invisibly until CF decides to challenge; user saw modal text but empty widget
- **Fix**: Widget lives at `left: -9999px` by default; only moves on-screen via `before-interactive-callback` when CF explicitly requires human click
- **Committed**: d8b048f — 2026-06-27
- **Deployed**: Production (session before v227)

---

## Week 2 (Days 8–14)

*Issues will be logged here as reported*

---

## Fix Totals

| Category | Count |
|---|---|
| Fill / coloring bugs | 2 |
| UI / bot-protection | 1 |
| Performance | 0 |
| Crash | 0 |
| Feature requests | 0 |

---

## Final Summary (to be completed before Play Store submission)

*Complete this section after the 14-day window closes.*

- Total bugs reported: TBD
- Total bugs resolved: TBD
- Critical bugs (P0/P1): TBD
- Average time to fix: TBD
- Tester satisfaction notes: TBD
