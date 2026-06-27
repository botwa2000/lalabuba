export const DEBUG = ['localhost','127.0.0.1'].includes(window.location.hostname);

export const state = {
  currentImage: null,
  baseImageData: null,
  paintedImageData: null,
  regionMap: null,
  regionPixels: null,
  backgroundRegionId: 0,
  regionColorMap: null,
  eraseMode: false,
  completedRegions: new Set(),
  celebrationShown: false,
  colorCount: 12,
  lastSeed: null,
  lastImageUrl: null,
  coloringStartTime: null,
  selectedPaletteIndex: 0,
  selectedSize: 'xxl',
  pencilDrawing: false,
  customColor: '#e91e63',
  turnstileToken: null,
  turnstileWidgetId: null,
  undoStack: [],        // [{regionId, record: Uint8Array, completedBefore: boolean}]
  colorMode: 'tap',     // 'tap' | 'pencil' | 'brush'
  artStyle: 'structured', // 'structured' (Classic) | 'artistic' (Sketch)
  canvasBgColor: '#ffffff', // user-selected canvas background colour
  paletteOverride: null, // when set, activePalette() uses this instead of PALETTES[selected]
  isFreeMode: false,    // one-way unlock: no enforcement, any color any area
  hasFreehand: false,   // any pencil/paint stroke drawn this image — gates costly draw-layer reads
  numberTargets: null,  // cached meaningful-area ids for free-mode completion (per image)
  isSegmenting: false,  // true while the region-worker is computing; taps show "preparing" status
};
