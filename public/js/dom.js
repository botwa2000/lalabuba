export const form = document.getElementById("generator-form");
export const subjectInput = document.getElementById("subject");
export const showNumbersInput = document.getElementById("show-numbers");
export const difficultySelect = document.getElementById("difficulty-select");
export const providerSelect = document.getElementById("provider-select");
export const paletteSelect = document.getElementById("palette-select");
export const statusElement = document.getElementById("status");
export const previewStage = document.getElementById("preview-stage");
export const previewCanvas = document.getElementById("preview-canvas");
export const drawCanvas = document.getElementById("draw-canvas");
export const printButton = document.getElementById("print-button");
export const downloadButton = document.getElementById("download-button");
export const pencilBtn = document.getElementById("pencil-button");
export const clearPencilBtn = document.getElementById("clear-pencil-button");
export const legendList = document.getElementById("legend-list");
export const colorCountSelect = document.getElementById("color-count-select");
export const debugPanel = document.getElementById("debug-panel");
// Guard getContext: on any page that loads this module without the canvases
// present (or before they exist), calling getContext on null would throw at
// import time and break the whole bundle. Degrade to null instead.
export const context = previewCanvas?.getContext("2d", { willReadFrequently: true }) ?? null;
export const drawCtx = drawCanvas?.getContext("2d") ?? null;
