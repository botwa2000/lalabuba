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
  selectedSize: 'medium',
  pencilMode: false,
  pencilDrawing: false,
  customColor: '#e91e63',
};
