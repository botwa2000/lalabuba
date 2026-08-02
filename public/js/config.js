// Client-side drawing config.
// At boot, main.js fetches /api/drawing-config and stores the result in
// window.DRAWING_CONFIG. All consumers call getDrawingConfig() which returns
// the server config or these fallback defaults when the fetch hasn't completed.
//
// Fallback values MUST match lib/drawing-config.js DEFAULTS so the first frame
// (before the fetch completes) behaves identically to subsequent frames.

const FALLBACK = {
  difficulties: {
    easy:    { minArea: 2000, maxRegions: 10, colorCount:  6, resolution: 1024, skipFreeTiers: false },
    medium:  { minArea:  800, maxRegions: 18, colorCount:  8, resolution: 1024, skipFreeTiers: false },
    hard:    { minArea:  300, maxRegions: 30, colorCount: 12, resolution: 1024, skipFreeTiers: true  },
    extreme: { minArea:   80, maxRegions: 48, colorCount: 99, resolution: 1024, skipFreeTiers: true  },
  },
  detection: {
    absoluteFloor:    30,
    promoteFloor:     50,
    rescueFloor:       5,
    bfsDarkThreshold: 80,
    bfsFloodCapRatio: 0.65,
    workerTimeoutMs:  90000,
    snapRadius:       { web: 16, flutter: 12 },
    regionFilter: { absoluteFloor: 30, promoteFloor: 50, rescueFloor: 5 },
  },
  completion: {
    freeCoverageRatio:      0.90,
    freehandCoverThreshold: 0.45,
    tinyRegionAutoRatio:    0.0005,
  },
  generation: {
    clientTimeoutMs: 80000,
  },
  providers: {
    rateLimitMax:      15,
    rateLimitWindowMs: 3_600_000,
  },
};

export function getDrawingConfig() {
  return window.DRAWING_CONFIG || FALLBACK;
}

// Convenience: returns the detection sub-object (most-used in canvas.js / worker).
export function getDetectionConfig() {
  return getDrawingConfig().detection || FALLBACK.detection;
}
