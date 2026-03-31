const form = document.getElementById("generator-form");
const subjectInput = document.getElementById("subject");
const showNumbersInput = document.getElementById("show-numbers");
const difficultySelect = document.getElementById("difficulty-select");
const providerSelect = document.getElementById("provider-select");
const paletteSelect = document.getElementById("palette-select");
const statusElement = document.getElementById("status");
const previewStage = document.getElementById("preview-stage");
const previewCanvas = document.getElementById("preview-canvas");
const printButton = document.getElementById("print-button");
const downloadButton = document.getElementById("download-button");
const legendList = document.getElementById("legend-list");
const colorCountSelect = document.getElementById("color-count-select");
const debugPanel = document.getElementById("debug-panel");

const context = previewCanvas.getContext("2d", { willReadFrequently: true });

const PALETTES = {
  classic: [
    { label: "Red",       color: "#e63946" },
    { label: "Orange",    color: "#f77f00" },
    { label: "Yellow",    color: "#f4d35e" },
    { label: "Green",     color: "#6a994e" },
    { label: "Blue",      color: "#3f88c5" },
    { label: "Purple",    color: "#7b2cbf" },
    { label: "Pink",      color: "#e07ab0" },
    { label: "Brown",     color: "#8c5e3c" },
    { label: "Teal",      color: "#2a9d8f" },
    { label: "Lime",      color: "#90be6d" },
    { label: "Gold",      color: "#f9c74f" },
    { label: "Cyan",      color: "#48cae4" },
    { label: "Coral",     color: "#ff6b6b" },
    { label: "Olive",     color: "#606c38" },
    { label: "Navy",      color: "#023e8a" },
    { label: "Maroon",    color: "#800000" },
    { label: "Turquoise", color: "#06d6a0" },
    { label: "Salmon",    color: "#ff9b85" },
    { label: "Lavender",  color: "#9b72cf" },
    { label: "Tan",       color: "#d4a373" },
    { label: "Slate",     color: "#577590" },
    { label: "Forest",    color: "#386641" },
    { label: "Crimson",   color: "#c1121f" },
    { label: "Sky",       color: "#56cfe1" },
  ],
  pastel: [
    { label: "Peach",       color: "#f7b7a3" },
    { label: "Butter",      color: "#f3e9a6" },
    { label: "Mint",        color: "#b7e4c7" },
    { label: "Sky",         color: "#a9def9" },
    { label: "Lilac",       color: "#d0bdf4" },
    { label: "Rose",        color: "#f4acb7" },
    { label: "Apricot",     color: "#ffd6a5" },
    { label: "Sage",        color: "#c9d5b5" },
    { label: "Mauve",       color: "#c9b1bd" },
    { label: "Baby Pink",   color: "#ffb3c6" },
    { label: "Powder Blue", color: "#bde0fe" },
    { label: "Honeydew",    color: "#d8f3dc" },
    { label: "Lemon",       color: "#fff3b0" },
    { label: "Blush",       color: "#ffccd5" },
    { label: "Seafoam",     color: "#b5ead7" },
    { label: "Lavender",    color: "#e0c3fc" },
    { label: "Cotton",      color: "#ffc8dd" },
    { label: "Pistachio",   color: "#c1e1c1" },
    { label: "Champagne",   color: "#f2e2ba" },
    { label: "Periwinkle",  color: "#c5cae9" },
    { label: "Orchid",      color: "#e8c6f0" },
    { label: "Wheat",       color: "#f5deb3" },
    { label: "Mist",        color: "#dde5ed" },
    { label: "Cream",       color: "#fff8e7" },
  ],
  nature: [
    { label: "Leaf",    color: "#588157" },
    { label: "Sun",     color: "#ffb703" },
    { label: "Clay",    color: "#bc6c25" },
    { label: "Berry",   color: "#9d4edd" },
    { label: "Lake",    color: "#219ebc" },
    { label: "Cloud",   color: "#adb5bd" },
    { label: "Bark",    color: "#6b4226" },
    { label: "Sand",    color: "#e9c46a" },
    { label: "Moss",    color: "#3d6b4f" },
    { label: "Amber",   color: "#fb8500" },
    { label: "Stone",   color: "#8d99ae" },
    { label: "Meadow",  color: "#4caf50" },
    { label: "Dusk",    color: "#4a4e69" },
    { label: "River",   color: "#48cae4" },
    { label: "Earth",   color: "#7b4b2a" },
    { label: "Fern",    color: "#52b788" },
    { label: "Petal",   color: "#e63946" },
    { label: "Sky",     color: "#56cfe1" },
    { label: "Rust",    color: "#ae2012" },
    { label: "Forest",  color: "#2d6a4f" },
    { label: "Mud",     color: "#6b4423" },
    { label: "Ember",   color: "#f3722c" },
    { label: "Dew",     color: "#74c69d" },
    { label: "Twig",    color: "#a07850" },
  ],
};

const DIFFICULTY = {
  easy:   { minArea: 3000, maxRegions: 6  },
  medium: { minArea:  900, maxRegions: 12 },
  hard:   { minArea:  400, maxRegions: 18 },
};

function activePalette() {
  const count = parseInt(colorCountSelect.value, 10) || 6;
  return PALETTES[paletteSelect.value].slice(0, count);
}

let currentImage = null;
let selectedPaletteIndex = 0;
let baseImageData = null;
let paintedImageData = null;
let regionMap = null;         // Int32Array — per-pixel: -1=dark  >0=region id (background is also a region)
let regionPixels = null;      // Map<id, number[]> — flat pixel indices for each region
let backgroundRegionId = 0;   // region id for the image background
let regionColorMap = null;    // Map<regionId, paletteIndex> — set by overlayNumbers
let eraseMode = false;        // when true, clicks restore region to original pixels
let completedRegions = new Set(); // region IDs that have been filled
let celebrationShown = false;

const SIZE_DIMS = {
  small:  { w: 512,  h: 512  },
  medium: { w: 768,  h: 768  },
  large:  { w: 1024, h: 1024 },
  xxl:    { w: 1024, h: 1024 },
};
let selectedSize = "medium";

function sanitizeSubject(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function buildPrompt(subject, difficulty = "medium") {
  const diffHint = {
    easy:   "only 3-4 very large simple shapes, no small details, toddler coloring book",
    medium: "simple cartoon with 6-10 clearly enclosed regions",
    hard:   "detailed cartoon with many small fully enclosed decorative regions",
  }[difficulty] || "simple cartoon with 6-10 clearly enclosed regions";

  return [
    `coloring book page of ${subject}`,
    "simple cartoon illustration style",
    "thick bold continuous black outlines",
    "every single outline is a fully closed loop",
    "every shape sealed at the bottom by a ground line or base edge",
    "flat white interior inside every closed shape",
    "white background",
    "absolutely no interior texture lines",
    "absolutely no hatching or crosshatching inside shapes",
    "absolutely no shading or shadow lines inside shapes",
    "no open lines",
    "no loose line ends",
    "no gradients",
    "no color",
    "no detail strokes inside shapes",
    diffHint,
    "clean professional coloring book illustration",
    "no text",
    "no watermark",
  ].join(", ");
}

function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function svgShell(body) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">`,
    `<rect width="1024" height="1024" fill="white"/>`,
    `<g fill="none" stroke="#111" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">`,
    body,
    `</g>`,
    `</svg>`,
  ].join("");
}

function buildDemoImage(subject) {
  const normalized = subject.toLowerCase();

  if (normalized.includes("butterfly")) {
    return svgDataUrl(svgShell(`
      <ellipse cx="360" cy="390" rx="170" ry="210"/>
      <ellipse cx="664" cy="390" rx="170" ry="210"/>
      <ellipse cx="390" cy="670" rx="150" ry="180"/>
      <ellipse cx="634" cy="670" rx="150" ry="180"/>
      <line x1="512" y1="240" x2="512" y2="790"/>
      <circle cx="512" cy="215" r="48"/>
      <line x1="490" y1="170" x2="450" y2="120"/>
      <line x1="534" y1="170" x2="574" y2="120"/>
      <circle cx="322" cy="382" r="48"/>
      <circle cx="700" cy="382" r="48"/>
      <circle cx="402" cy="676" r="42"/>
      <circle cx="622" cy="676" r="42"/>
    `));
  }

  if (normalized.includes("rocket")) {
    return svgDataUrl(svgShell(`
      <path d="M512 140 C610 220 646 370 632 560 L392 560 C378 370 414 220 512 140 Z"/>
      <path d="M432 560 L330 710 L430 690 L470 820 L512 730"/>
      <path d="M592 560 L694 710 L594 690 L554 820 L512 730"/>
      <path d="M452 560 L452 860 L572 860 L572 560"/>
      <circle cx="512" cy="350" r="72"/>
      <path d="M452 860 Q512 960 572 860"/>
    `));
  }

  if (normalized.includes("cat")) {
    return svgDataUrl(svgShell(`
      <circle cx="512" cy="390" r="210"/>
      <path d="M350 250 L414 120 L470 250"/>
      <path d="M554 250 L610 120 L674 250"/>
      <circle cx="438" cy="380" r="22"/>
      <circle cx="586" cy="380" r="22"/>
      <path d="M470 470 Q512 510 554 470"/>
      <path d="M512 420 L480 462 L544 462 Z"/>
      <line x1="450" y1="455" x2="336" y2="430"/>
      <line x1="450" y1="485" x2="330" y2="490"/>
      <line x1="574" y1="455" x2="688" y2="430"/>
      <line x1="574" y1="485" x2="694" y2="490"/>
      <path d="M404 600 Q512 720 620 600"/>
    `));
  }

  if (normalized.includes("castle")) {
    return svgDataUrl(svgShell(`
      <rect x="250" y="330" width="524" height="470"/>
      <rect x="210" y="260" width="120" height="180"/>
      <rect x="694" y="260" width="120" height="180"/>
      <rect x="320" y="250" width="90" height="120"/>
      <rect x="614" y="250" width="90" height="120"/>
      <path d="M450 800 L450 610 Q512 530 574 610 L574 800"/>
      <rect x="342" y="430" width="90" height="90"/>
      <rect x="592" y="430" width="90" height="90"/>
      <line x1="250" y1="330" x2="774" y2="330"/>
    `));
  }

  return svgDataUrl(svgShell(`
    <circle cx="512" cy="360" r="180"/>
    <ellipse cx="512" cy="690" rx="250" ry="170"/>
    <circle cx="430" cy="330" r="34"/>
    <circle cx="594" cy="330" r="34"/>
    <path d="M420 430 Q512 510 604 430"/>
    <circle cx="512" cy="690" r="56"/>
    <circle cx="398" cy="690" r="44"/>
    <circle cx="626" cy="690" r="44"/>
  `));
}
function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
  statusElement.style.color = "";
}

function renderLegend() {
  const palette = activePalette();
  legendList.innerHTML = "";

  // Erase swatch (always first).
  const eraseItem = document.createElement("li");
  eraseItem.innerHTML = `<button class="color-swatch erase-swatch${eraseMode ? " active" : ""}" title="Erase"><span class="swatch-num">✕</span></button>`;
  eraseItem.querySelector("button").addEventListener("click", () => {
    eraseMode = true;
    renderLegend();
    setStatus("Erase mode — click a colored area to clear it.");
  });
  legendList.appendChild(eraseItem);

  palette.forEach((entry, index) => {
    const item = document.createElement("li");
    const active = !eraseMode && index === selectedPaletteIndex;
    item.innerHTML = `<button class="color-swatch${active ? " active" : ""}" style="--c:${entry.color}" title="${index + 1} — ${entry.label}"><span class="swatch-num">${index + 1}</span><span class="swatch-name">${entry.label}</span></button>`;
    item.querySelector("button").addEventListener("click", () => {
      eraseMode = false;
      selectedPaletteIndex = index;
      renderLegend();
      setStatus(`Selected: ${entry.label}. Click the picture to fill! 🎨`);
    });
    legendList.appendChild(item);
  });
}

function imageFromBase64(imageBase64) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode generated image."));
    image.src = `data:image/png;base64,${imageBase64}`;
  });
}

async function imageFromUrl(url) {
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Image request failed (${response.status}).`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to decode generated image."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Fetches a cross-origin image and returns it as a data URL so it can be
// stored in currentImage and reused on re-renders without re-fetching.
async function fetchToDataUrl(url) {
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Pollinations returned ${response.status}. ` +
      `Check your connection or switch to "Backend server".`
    );
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image data."));
    reader.readAsDataURL(blob);
  });
}

// One pass of 4-neighbour dilation to lightly sharpen anti-aliased outlines on
// the displayed image. Heavy gap-sealing for segmentation happens separately inside
// precomputeRegions() on a private copy that never touches the canvas.
function closeOutlineGaps(imageData) {
  const { data, width, height } = imageData;
  const dark = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    dark[i] = (data[o] + data[o + 1] + data[o + 2]) / 3 < 40 ? 1 : 0;
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (dark[i]) continue;
      if (dark[(y - 1) * width + x] || dark[(y + 1) * width + x] ||
          dark[y * width + (x - 1)] || dark[y * width + (x + 1)]) {
        const o = i * 4;
        data[o] = 0; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 255;
      }
    }
  }
}

function drawBaseImage(image) {
  previewCanvas.width  = image.naturalWidth  || image.width  || 1024;
  previewCanvas.height = image.naturalHeight || image.height || 1024;
  previewCanvas.hidden = false;
  previewStage.classList.remove("empty");
  context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  context.drawImage(image, 0, 0, previewCanvas.width, previewCanvas.height);
  const raw = context.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
  closeOutlineGaps(raw);
  context.putImageData(raw, 0, 0);
  baseImageData = context.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
  paintedImageData = context.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
  regionMap = null;
  regionPixels = null;
  regionColorMap = null;
  backgroundRegionId = 0;
  eraseMode = false;
  completedRegions = new Set();
  celebrationShown = false;
  precomputeRegions();
}

function buildWalkableMask(data, width, height) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const brightness = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
    mask[i] = brightness > 235 ? 1 : 0;
  }
  return mask;
}

function findRegions(mask, width, height, minRegionSize = 900, maxRegions = 12) {
  const visited = new Uint8Array(mask.length);
  const regions = [];
  const queueX = new Int32Array(mask.length);
  const queueY = new Int32Array(mask.length);

  for (let startY = 1; startY < height - 1; startY += 1) {
    for (let startX = 1; startX < width - 1; startX += 1) {
      const startIndex = startY * width + startX;
      if (visited[startIndex] || !mask[startIndex]) {
        continue;
      }

      let head = 0;
      let tail = 0;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let touchesEdge = false;

      visited[startIndex] = 1;
      queueX[tail] = startX;
      queueY[tail] = startY;
      tail += 1;

      while (head < tail) {
        const x = queueX[head];
        const y = queueY[head];
        head += 1;

        area += 1;
        sumX += x;
        sumY += y;

        if (x < 10 || y < 10 || x > width - 11 || y > height - 11) {
          touchesEdge = true;
        }

        const neighbors = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];

        for (const [nextX, nextY] of neighbors) {
          const nextIndex = nextY * width + nextX;
          if (visited[nextIndex] || !mask[nextIndex]) {
            continue;
          }

          visited[nextIndex] = 1;
          queueX[tail] = nextX;
          queueY[tail] = nextY;
          tail += 1;
        }
      }

      if (!touchesEdge && area >= minRegionSize) {
        regions.push({
          area,
          x: Math.round(sumX / area),
          y: Math.round(sumY / area),
        });
      }
    }
  }

  return regions
    .sort((left, right) => right.area - left.area)
    .slice(0, maxRegions);
}

// Returns the index in palette of the color nearest to (r, g, b).
function nearestPaletteIndex(r, g, b, palette) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const c = hexToRgb(palette[i].color);
    const d = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function overlayNumbers() {
  if (!baseImageData) return;
  // Always use base image data so numbers are stable regardless of user fills.
  const mask = buildWalkableMask(baseImageData.data, previewCanvas.width, previewCanvas.height);
  const diff = DIFFICULTY[difficultySelect.value] || DIFFICULTY.medium;
  const regions = findRegions(mask, previewCanvas.width, previewCanvas.height, diff.minArea, diff.maxRegions);
  const palette = activePalette();
  const src = baseImageData.data;
  const w = previewCanvas.width;

  // Build regionColorMap once per image load; reuse on subsequent redraws.
  if (!regionColorMap) {
    regionColorMap = new Map();
    const used = new Set();

    regions.forEach((region, index) => {
      // Sample average color of this region's pixels to find the nearest palette match.
      const pixels = regionMap ? regionPixels?.get(regionMap[region.y * w + region.x]) : null;
      let paletteIndex = index % palette.length;

      if (pixels && pixels.length > 0) {
        let sumR = 0, sumG = 0, sumB = 0;
        const step = Math.max(1, Math.floor(pixels.length / 200)); // sample up to 200 pixels
        let count = 0;
        for (let pi = 0; pi < pixels.length; pi += step) {
          const o = pixels[pi] * 4;
          sumR += src[o]; sumG += src[o + 1]; sumB += src[o + 2];
          count++;
        }
        const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
        const avgBr = (avgR + avgG + avgB) / 3;
        // Only use color-matching if the region has a non-white average color hint.
        if (avgBr < 240) {
          const candidate = nearestPaletteIndex(avgR, avgG, avgB, palette);
          if (!used.has(candidate)) paletteIndex = candidate;
        }
        // Fallback: find first unused palette index if color match is already taken.
        if (used.has(paletteIndex)) {
          for (let k = 0; k < palette.length; k++) {
            if (!used.has(k)) { paletteIndex = k; break; }
          }
        }
      }

      used.add(paletteIndex);
      const mapId = regionMap?.[region.y * w + region.x];
      if (mapId > 0) regionColorMap.set(mapId, paletteIndex);
    });
  }

  context.textAlign = "center";
  context.textBaseline = "middle";

  regions.forEach((region) => {
    const mapId = regionMap?.[region.y * w + region.x];
    // Hide badge once the region has been filled.
    if (mapId > 0 && completedRegions.has(mapId)) return;
    const paletteIndex = (mapId > 0 ? regionColorMap.get(mapId) : null) ?? 0;
    const badgeColor = palette[paletteIndex]?.color ?? "#222";
    const radius = Math.max(14, Math.min(26, Math.sqrt(region.area) * 0.08));

    context.fillStyle = "rgba(255,255,255,0.92)";
    context.beginPath();
    context.arc(region.x, region.y, radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = badgeColor;
    context.lineWidth = 2.5;
    context.stroke();

    context.fillStyle = "#111";
    context.font = `bold ${Math.round(radius)}px Georgia`;
    context.fillText(String(paletteIndex + 1), region.x, region.y + 1);
  });
}

function redrawCanvas() {
  if (!paintedImageData) {
    return;
  }

  context.putImageData(paintedImageData, 0, 0);

  if (showNumbersInput.checked) {
    overlayNumbers();
  }
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

// ─── Pre-segmentation ────────────────────────────────────────────────────────
// Runs once per image load. Builds a per-pixel region map so a click looks up
// and paints pre-identified pixels — fill can never leak across regions.
//
// Dual threshold strategy:
//   sealMask (200)    — includes anti-aliased edges; used only for background BFS
//   outlineMask (128) — true outline pixels; used for pixel assignment
// Anti-aliased pixels (brightness 128–200) are NOT outline, so they join their
// adjacent region → no unpainted white fringe between fill and lines.

function precomputeRegions() {
  const { width, height } = previewCanvas;
  const n = width * height;
  const src = baseImageData.data;

  // Build both masks in one pass.
  let sealMask     = new Uint8Array(n); // threshold 200
  const outlineMask = new Uint8Array(n); // threshold 128
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const br = (src[o] + src[o + 1] + src[o + 2]) / 3;
    sealMask[i]    = br < 200 ? 1 : 0;
    outlineMask[i] = br < 40 ? 1 : 0;
  }

  // Dilate sealMask 4× to close gaps up to 4 px (segmentation copy only).
  for (let pass = 0; pass < 4; pass++) {
    const next = new Uint8Array(sealMask);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (!sealMask[i] && (sealMask[i-1]||sealMask[i+1]||sealMask[i-width]||sealMask[i+width]))
          next[i] = 1;
      }
    }
    sealMask = next;
  }

  // Flood-fill from every border pixel through the sealed mask → background.
  const inBg  = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;

  const seedBg = (i) => { if (!sealMask[i] && !inBg[i]) { inBg[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < width; x++) { seedBg(x); seedBg((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { seedBg(y * width); seedBg(y * width + width - 1); }
  while (head < tail) {
    const i = queue[head++];
    const x = i % width, y = (i / width) | 0;
    if (x > 0         && !sealMask[i-1]     && !inBg[i-1])     { inBg[i-1]=1;     queue[tail++]=i-1; }
    if (x < width - 1 && !sealMask[i+1]     && !inBg[i+1])     { inBg[i+1]=1;     queue[tail++]=i+1; }
    if (y > 0         && !sealMask[i-width] && !inBg[i-width]) { inBg[i-width]=1; queue[tail++]=i-width; }
    if (y < height - 1&& !sealMask[i+width] && !inBg[i+width]) { inBg[i+width]=1; queue[tail++]=i+width; }
  }

  // Build label map using outlineMask (128) so anti-aliased pixels join regions.
  const label    = new Int32Array(n);
  const bgPixels = [];
  for (let i = 0; i < n; i++) {
    if (outlineMask[i])  { label[i] = -1; }           // true outline
    else if (inBg[i])    { label[i] = -2; bgPixels.push(i); } // background (temp)
    // else 0 = unvisited enclosed pixel
  }

  // Connected-component labelling for enclosed pixels.
  regionPixels = new Map();
  let nextId = 1;

  for (let start = 0; start < n; start++) {
    if (label[start] !== 0) continue;

    label[start] = nextId;
    head = 0; tail = 0;
    queue[tail++] = start;
    const buf = [];

    while (head < tail) {
      const i = queue[head++];
      buf.push(i);
      const x = i % width, y = (i / width) | 0;
      if (x > 0         && label[i-1]     === 0) { label[i-1]=nextId;     queue[tail++]=i-1; }
      if (x < width - 1 && label[i+1]     === 0) { label[i+1]=nextId;     queue[tail++]=i+1; }
      if (y > 0         && label[i-width] === 0) { label[i-width]=nextId; queue[tail++]=i-width; }
      if (y < height - 1&& label[i+width] === 0) { label[i+width]=nextId; queue[tail++]=i+width; }
    }

    if (buf.length >= 30) {
      regionPixels.set(nextId, buf);
      nextId++;
    } else {
      for (const p of buf) { label[p] = -2; bgPixels.push(p); } // fold tiny specks into background
    }
  }

  // Register the background as its own fillable region.
  backgroundRegionId = nextId;
  for (const p of bgPixels) label[p] = nextId;
  regionPixels.set(nextId, bgPixels);

  regionMap = label;
}

// Paint every pixel in regionId with fillColor, then redraw.
function fillRegion(regionId, fillColor) {
  const pixels = regionPixels.get(regionId);
  if (!pixels) return false;
  const data = paintedImageData.data;
  const { r, g, b } = fillColor;
  for (const idx of pixels) {
    const o = idx * 4;
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
  }
  redrawCanvas();
  return true;
}

// Return the region id at (canvasX, canvasY), snapping up to 8 px if on a line.
function findRegionAt(canvasX, canvasY) {
  const { width, height } = previewCanvas;
  if (!regionMap) return 0;
  const direct = regionMap[canvasY * width + canvasX];
  if (direct > 0) return direct;
  for (let r = 1; r <= 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) < r && Math.abs(dy) < r) continue;
        const x = canvasX + dx, y = canvasY + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const id = regionMap[y * width + x];
        if (id > 0) return id;
      }
    }
  }
  return 0;
}

async function renderGeneratedImage(imageBase64) {
  const image = imageBase64.startsWith("data:")
    ? await new Promise((resolve, reject) => {
        const dataImage = new Image();
        dataImage.onload = () => resolve(dataImage);
        dataImage.onerror = () => reject(new Error("Failed to decode generated image."));
        dataImage.src = imageBase64;
      })
    : imageBase64.startsWith("http") || imageBase64.startsWith("blob:")
      ? await imageFromUrl(imageBase64)
      : await imageFromBase64(imageBase64);
  currentImage = imageBase64;
  drawBaseImage(image);
  redrawCanvas();

  printButton.disabled = false;
  downloadButton.disabled = false;
}

async function generatePage(subject) {
  const difficulty = difficultySelect.value;
  setStatus(`Drawing "${subject}" (${difficulty})… may take a few seconds.`);
  const imageUrl = await requestGeneratedImage(subject, difficulty);
  await renderGeneratedImage(imageUrl);
  setStatus(`Done! Click a numbered area then pick a color in the legend to fill it.`);
}

async function requestGeneratedImage(subject, difficulty = "medium") {
  const provider = providerSelect.value;

  if (provider === "demo") {
    return buildDemoImage(subject);
  }

  if (provider === "direct") {
    const prompt = buildPrompt(subject, difficulty);
    const seed = Math.floor(Math.random() * 2_000_000_000);
    const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
    const dims = SIZE_DIMS[selectedSize] || SIZE_DIMS.medium;
    url.searchParams.set("width",  String(dims.w));
    url.searchParams.set("height", String(dims.h));
    url.searchParams.set("nologo", "true");
    url.searchParams.set("model", "flux");
    url.searchParams.set("enhance", "false");
    url.searchParams.set("safe", "true");
    url.searchParams.set("seed", String(seed));
    return fetchToDataUrl(url.toString());
  }

  if (provider === "backend") {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject,
        difficulty,
        width:  (SIZE_DIMS[selectedSize] || SIZE_DIMS.medium).w,
        height: (SIZE_DIMS[selectedSize] || SIZE_DIMS.medium).h,
      }),
    });

    if (!response.ok) {
      let message = `Image request failed (${response.status}).`;
      try {
        const payload = await response.json();
        if (payload?.error) {
          message = payload.error;
        }
      } catch {
        // Ignore JSON parse errors and keep the generic message.
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const subject = sanitizeSubject(subjectInput.value);
  if (!subject) {
    setStatus("Type something to draw first.", true);
    return;
  }

  const submitButton = document.getElementById("generate-button");
  submitButton.disabled = true;

  try {
    await generatePage(subject);
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  } finally {
    submitButton.disabled = false;
  }
});

showNumbersInput.addEventListener("change", async () => {
  if (!currentImage) {
    return;
  }

  try {
    await renderGeneratedImage(currentImage);
  } catch (error) {
    setStatus(error.message || "Failed to redraw preview.", true);
  }
});

paletteSelect.addEventListener("change", async () => {
  renderLegend();

  if (!currentImage) {
    return;
  }

  if (showNumbersInput.checked) {
    await renderGeneratedImage(currentImage);
  }
});

providerSelect.addEventListener("change", () => {
  const hints = {
    direct:  "Ready — type any word in any language.",
    backend: "Ready — make sure the server is running (npm start).",
    demo:    "Offline demo: try butterfly, cat, rocket, or castle.",
  };
  setStatus(hints[providerSelect.value] || "Ready.");
});

colorCountSelect.addEventListener("change", () => {
  const palette = activePalette();
  if (selectedPaletteIndex >= palette.length) selectedPaletteIndex = 0;
  renderLegend();
  if (currentImage && showNumbersInput.checked) {
    renderGeneratedImage(currentImage).catch((error) => {
      setStatus(error.message || "Failed to redraw preview.", true);
    });
  }
});

difficultySelect.addEventListener("change", () => {
  // Clamp selectedPaletteIndex to new palette size.
  const palette = activePalette();
  if (selectedPaletteIndex >= palette.length) {
    selectedPaletteIndex = 0;
  }
  renderLegend();

  if (currentImage && showNumbersInput.checked) {
    renderGeneratedImage(currentImage).catch((error) => {
      setStatus(error.message || "Failed to redraw preview.", true);
    });
  }
});

function checkCompletion() {
  if (celebrationShown || !showNumbersInput.checked || !regionColorMap || regionColorMap.size === 0) return;
  if ([...regionColorMap.keys()].every((id) => completedRegions.has(id))) {
    celebrationShown = true;
    document.getElementById("celebration").classList.remove("hidden");
    document.getElementById("celebration").setAttribute("aria-hidden", "false");
  }
}

previewCanvas.addEventListener("click", (event) => {
  if (!regionMap) return;

  const rect = previewCanvas.getBoundingClientRect();
  const canvasX = Math.floor((event.clientX - rect.left) * (previewCanvas.width / rect.width));
  const canvasY = Math.floor((event.clientY - rect.top) * (previewCanvas.height / rect.height));

  const regionId = findRegionAt(canvasX, canvasY);

  if (debugPanel) {
    debugPanel.textContent = [
      `Clicked     : (${canvasX}, ${canvasY})`,
      `Region id   : ${regionId > 0 ? regionId : "none"}${regionId === backgroundRegionId ? " (bg)" : ""} (${regionPixels.get(regionId)?.length ?? 0} px)`,
      `Mode        : ${eraseMode ? "erase" : "fill " + activePalette()[selectedPaletteIndex]?.label}`,
    ].join("\n");
    document.getElementById("debug-details").open = true;
  }

  if (!regionId) {
    setStatus("That area isn't enclosed — try another spot or generate again.", true);
    return;
  }

  // Erase mode: restore region pixels to the original base image.
  if (eraseMode) {
    const pixels = regionPixels.get(regionId);
    if (pixels) {
      const paint = paintedImageData.data;
      const base  = baseImageData.data;
      for (const idx of pixels) {
        const o = idx * 4;
        paint[o] = base[o]; paint[o+1] = base[o+1]; paint[o+2] = base[o+2]; paint[o+3] = base[o+3];
      }
      completedRegions.delete(regionId);
      celebrationShown = false;
      redrawCanvas();
      setStatus("Area cleared.");
    }
    return;
  }

  // Color-constraint: when numbers are shown, enforce the assigned palette color.
  if (showNumbersInput.checked && regionColorMap && regionColorMap.has(regionId)) {
    const required = regionColorMap.get(regionId);
    if (selectedPaletteIndex !== required) {
      const c = activePalette()[required];
      setStatus(`This area needs color ${required + 1}: ${c.label}. Select it in the legend first.`, true);
      return;
    }
  }

  const palette = activePalette();
  const fillColor = hexToRgb(palette[selectedPaletteIndex].color);
  completedRegions.add(regionId);
  fillRegion(regionId, fillColor);
  setStatus(`Filled with ${palette[selectedPaletteIndex].label}.`);
  checkCompletion();
});

printButton.addEventListener("click", () => {
  window.print();
});

downloadButton.addEventListener("click", () => {
  if (!currentImage) {
    return;
  }

  const link = document.createElement("a");
  link.href = previewCanvas.toDataURL("image/png");
  link.download = `${subjectInput.value.trim().replace(/\s+/g, "-").toLowerCase() || "coloring-page"}.png`;
  link.click();
});

document.getElementById("celebration-keep").addEventListener("click", () => {
  document.getElementById("celebration").classList.add("hidden");
  document.getElementById("celebration").setAttribute("aria-hidden", "true");
});

document.getElementById("celebration-new").addEventListener("click", () => {
  document.getElementById("celebration").classList.add("hidden");
  document.getElementById("celebration").setAttribute("aria-hidden", "true");
  subjectInput.value = "";
  subjectInput.focus();
});

document.querySelectorAll(".size-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".size-pill").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedSize = btn.dataset.size;
  });
});

renderLegend();
