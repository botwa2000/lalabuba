export const PALETTES = {
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

export const DIFFICULTY = {
  easy:    { minArea: 2000 },
  medium:  { minArea:  600 },
  hard:    { minArea:  200 },
  extreme: { minArea:   40 },
};

export const SIZE_DIMS = {
  small:  { w: 512,  h: 512  },
  medium: { w: 768,  h: 768  },
  large:  { w: 1024, h: 1024 },
  xxl:    { w: 1024, h: 1024 },
};

// Mirrors the server-side blocklist for instant client feedback.
export const BLOCKED_TERMS = new Set([
  // English
  "nude","naked","nudity","blood","bloody","gore","gory","kill","killing",
  "murder","murderer","dead","death","dying","corpse","weapon","weapons",
  "gun","guns","rifle","pistol","knife","knives","bomb","bombs","explosive",
  "sex","sexy","sexual","porn","pornography","erotic","erotica",
  "violence","violent","torture","abuse","drug","drugs","cocaine","heroin",
  "meth","terror","terrorist","suicide","rape","racist","racism","nazi",
  // German
  "nackt","nackten","blut","blutig","töten","tötung","mord","mörder",
  "tot","leiche","waffe","waffen","gewehr","messer","bombe","bomben",
  "sexuell","pornografie","gewalt","folter","missbrauch","droge",
  "drogen","terror","terrorist","selbstmord","vergewaltigung",
  // Russian
  "голый","голая","голые","кровь","кровавый","убить","убийство","убийца",
  "мертвый","мёртвый","труп","смерть","оружие","пистолет","нож","бомба",
  "порно","насилие","пытка","наркотик","наркотики","террор",
  "суицид","изнасилование","расизм",
  // French
  "nu","nue","nus","nues","sang","sanglant","tuer","meurtre","meurtrier",
  "mort","cadavre","arme","armes","pistolet","couteau","bombe","bombes",
  "sexuel","pornographie","violence","torture","abus","drogue",
  "drogues","terreur","terroriste","suicide","viol","racisme",
]);

export function sanitizeSubject(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function isSafeSubject(subject) {
  const words = subject.toLowerCase().split(/[\s,!?;:'"()\[\]{}\-_/@#]+/);
  return !words.some(w => w.length > 0 && BLOCKED_TERMS.has(w));
}

export function buildPrompt(subject, difficulty = "medium") {
  const base = [
    "every outline is a fully closed loop",
    "no open line ends",
    "flat white interior",
    "white background",
    "no color",
    "no gradients",
    "no shading",
    "no text",
    "no watermark",
  ];

  if (difficulty === "easy") {
    return [
      `coloring book page of ${subject}`,
      "toddler coloring book style",
      "only 3 to 4 very large simple bold shapes",
      "extremely thick black outlines",
      ...base,
      "absolutely no interior lines or details whatsoever",
      "maximum simplicity",
      "clean toddler coloring page",
    ].join(", ");
  }

  if (difficulty === "hard") {
    return [
      `detailed coloring book page of ${subject}`,
      "children's detailed coloring book style",
      "bold continuous black outlines",
      ...base,
      "15 to 30 clearly enclosed regions",
      "decorative interior lines that form fully closed sub-regions",
      "no hatching or crosshatching",
      "professional detailed coloring book illustration",
    ].join(", ");
  }

  if (difficulty === "extreme") {
    return [
      `ultra-detailed adult coloring book page of ${subject}`,
      "intricate zentangle and mandala illustration style",
      "bold continuous black outlines",
      ...base,
      "every interior line forms a fully closed loop",
      "dozens of tiny fully enclosed ornamental cells covering every surface",
      "dense geometric and floral patterns filling every shape",
      "maximum intricacy throughout the entire image",
      "expert adult coloring book",
    ].join(", ");
  }

  // medium (default)
  return [
    `coloring book page of ${subject}`,
    "simple cartoon illustration style",
    "thick bold continuous black outlines",
    ...base,
    "6 to 10 clearly enclosed regions",
    "absolutely no interior texture or detail lines",
    "clean professional coloring book illustration",
  ].join(", ");
}
