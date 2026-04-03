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

// Structured pool for hero suggestion cards and the surprise button.
// `subject` is always English (sent to the AI). `labels` provides the
// display name per language; English is derived from `subject` at render time.
export const EXAMPLE_SUGGESTIONS = [
  { subject: "butterfly", emoji: "🦋", labels: { de:"Schmetterling", ru:"Бабочка", fr:"Papillon", es:"Mariposa", pt:"Borboleta", it:"Farfalla", nl:"Vlinder", pl:"Motyl" } },
  { subject: "dragon", emoji: "🐉", labels: { de:"Drache", ru:"Дракон", fr:"Dragon", es:"Dragón", pt:"Dragão", it:"Drago", nl:"Draak", pl:"Smok" } },
  { subject: "castle", emoji: "🏰", labels: { de:"Schloss", ru:"Замок", fr:"Château", es:"Castillo", pt:"Castelo", it:"Castello", nl:"Kasteel", pl:"Zamek" } },
  { subject: "rocket ship", emoji: "🚀", labels: { de:"Rakete", ru:"Ракета", fr:"Fusée", es:"Cohete", pt:"Foguete", it:"Razzo", nl:"Raket", pl:"Rakieta" } },
  { subject: "cat", emoji: "🐱", labels: { de:"Katze", ru:"Кот", fr:"Chat", es:"Gato", pt:"Gato", it:"Gatto", nl:"Kat", pl:"Kot" } },
  { subject: "unicorn", emoji: "🦄", labels: { de:"Einhorn", ru:"Единорог", fr:"Licorne", es:"Unicornio", pt:"Unicórnio", it:"Unicorno", nl:"Eenhoorn", pl:"Jednorożec" } },
  { subject: "dinosaur eating pizza", emoji: "🦖", labels: { de:"Dino isst Pizza", ru:"Динозавр ест пиццу", fr:"Dinosaure et pizza", es:"Dino comiendo pizza", pt:"Dino comendo pizza", it:"Dinosauro e pizza", nl:"Dino eet pizza", pl:"Dinozaur je pizzę" } },
  { subject: "dragon baking cookies", emoji: "🍪", labels: { de:"Drache backt Kekse", ru:"Дракон печёт печенье", fr:"Dragon pâtissier", es:"Dragón y galletas", pt:"Dragão e biscoitos", it:"Drago e biscotti", nl:"Draak bakt koekjes", pl:"Smok piecze ciastka" } },
  { subject: "cat riding a bicycle", emoji: "🚲", labels: { de:"Katze fährt Fahrrad", ru:"Кот на велосипеде", fr:"Chat à vélo", es:"Gato en bicicleta", pt:"Gato de bicicleta", it:"Gatto in bicicletta", nl:"Kat op de fiets", pl:"Kot na rowerze" } },
  { subject: "castle on a cloud", emoji: "☁️", labels: { de:"Schloss auf Wolke", ru:"Замок на облаке", fr:"Château sur un nuage", es:"Castillo en la nube", pt:"Castelo na nuvem", it:"Castello su nuvola", nl:"Kasteel op een wolk", pl:"Zamek na chmurze" } },
  { subject: "robot puppy", emoji: "🤖", labels: { de:"Roboter-Welpe", ru:"Робот-щенок", fr:"Chiot robot", es:"Cachorro robot", pt:"Cachorro robô", it:"Cucciolo robot", nl:"Robothondje", pl:"Szczeniak-robot" } },
  { subject: "mermaid at school", emoji: "🧜", labels: { de:"Meerjungfrau in Schule", ru:"Русалка в школе", fr:"Sirène à l'école", es:"Sirena en la escuela", pt:"Sereia na escola", it:"Sirena a scuola", nl:"Zeemeermin op school", pl:"Syrenka w szkole" } },
  { subject: "pirate octopus", emoji: "🐙", labels: { de:"Piraten-Krake", ru:"Осьминог-пират", fr:"Pieuvre pirate", es:"Pulpo pirata", pt:"Polvo pirata", it:"Polpo pirata", nl:"Piraat-octopus", pl:"Ośmiornica pirat" } },
  { subject: "superhero penguin", emoji: "🐧", labels: { de:"Superhelden-Pinguin", ru:"Пингвин-супергерой", fr:"Pingouin super-héros", es:"Pingüino superhéroe", pt:"Pinguim super-herói", it:"Pinguino supereroe", nl:"Superheld pinguïn", pl:"Pingwin superbohater" } },
  { subject: "wizard casting spells", emoji: "🧙", labels: { de:"Zauberer zaubert", ru:"Волшебник колдует", fr:"Magicien et sorts", es:"Mago lanzando hechizos", pt:"Mago lançando feitiços", it:"Mago e incantesimi", nl:"Tovenaar tovert", pl:"Czarodziej i czary" } },
  { subject: "flying whale", emoji: "🐋", labels: { de:"Fliegender Wal", ru:"Летающий кит", fr:"Baleine volante", es:"Ballena voladora", pt:"Baleia voadora", it:"Balena volante", nl:"Vliegende walvis", pl:"Latający wieloryb" } },
  { subject: "princess on a dragon", emoji: "👸", labels: { de:"Prinzessin auf Drache", ru:"Принцесса на драконе", fr:"Princesse sur un dragon", es:"Princesa en dragón", pt:"Princesa no dragão", it:"Principessa su drago", nl:"Prinses op draak", pl:"Księżniczka na smoku" } },
  { subject: "bunny astronaut", emoji: "🐰", labels: { de:"Hasen-Astronaut", ru:"Кролик-космонавт", fr:"Lapin astronaute", es:"Conejo astronauta", pt:"Coelho astronauta", it:"Coniglio astronauta", nl:"Konijn astronaut", pl:"Królik astronauta" } },
  { subject: "shark playing guitar", emoji: "🦈", labels: { de:"Hai spielt Gitarre", ru:"Акула с гитарой", fr:"Requin guitariste", es:"Tiburón con guitarra", pt:"Tubarão com guitarra", it:"Squalo e chitarra", nl:"Haai speelt gitaar", pl:"Rekin z gitarą" } },
  { subject: "bear having a tea party", emoji: "🐻", labels: { de:"Bär bei Teeparty", ru:"Медведь на чаепитии", fr:"Ours au goûter", es:"Oso tomando té", pt:"Urso tomando chá", it:"Orso al tè", nl:"Beer op theekransje", pl:"Miś na herbatce" } },
  { subject: "giraffe driving a bus", emoji: "🦒", labels: { de:"Giraffe fährt Bus", ru:"Жираф за рулём", fr:"Girafe chauffeur de bus", es:"Jirafa en autobús", pt:"Girafa no ônibus", it:"Giraffa alla guida", nl:"Giraffe rijdt bus", pl:"Żyrafa prowadzi autobus" } },
  { subject: "fox in a spaceship", emoji: "🦊", labels: { de:"Fuchs im Raumschiff", ru:"Лиса в космолёте", fr:"Renard dans un vaisseau", es:"Zorro en nave espacial", pt:"Raposa na nave", it:"Volpe nell'astronave", nl:"Vos in ruimteschip", pl:"Lis w statku kosmicznym" } },
  { subject: "lion reading a book", emoji: "🦁", labels: { de:"Löwe liest ein Buch", ru:"Лев читает книгу", fr:"Lion qui lit un livre", es:"León leyendo un libro", pt:"Leão lendo um livro", it:"Leone con un libro", nl:"Leeuw leest een boek", pl:"Lew czyta książkę" } },
  { subject: "elephant playing piano", emoji: "🐘", labels: { de:"Elefant spielt Klavier", ru:"Слон играет на пианино", fr:"Éléphant au piano", es:"Elefante al piano", pt:"Elefante no piano", it:"Elefante al pianoforte", nl:"Olifant speelt piano", pl:"Słoń gra na pianinie" } },
  { subject: "turtle racing a rocket", emoji: "🐢", labels: { de:"Schildkröte gegen Rakete", ru:"Черепаха и ракета", fr:"Tortue contre fusée", es:"Tortuga contra cohete", pt:"Tartaruga e foguete", it:"Tartaruga e razzo", nl:"Schildpad vs raket", pl:"Żółw kontra rakieta" } },
  { subject: "owl baking a cake", emoji: "🦉", labels: { de:"Eule backt Kuchen", ru:"Сова печёт торт", fr:"Hibou pâtissier", es:"Búho horneando pastel", pt:"Coruja e bolo", it:"Gufo e torta", nl:"Uil bakt taart", pl:"Sowa piecze tort" } },
  { subject: "panda painting a rainbow", emoji: "🐼", labels: { de:"Panda malt Regenbogen", ru:"Панда рисует радугу", fr:"Panda et arc-en-ciel", es:"Panda y arcoíris", pt:"Panda e arco-íris", it:"Panda e arcobaleno", nl:"Panda schildert regenboog", pl:"Panda maluje tęczę" } },
];

export const SURPRISE_SUBJECTS = [
  "dinosaur eating pizza",
  "unicorn in space",
  "dragon baking cookies",
  "cat riding a bicycle",
  "castle on a cloud",
  "robot puppy",
  "mermaid at school",
  "pirate octopus",
  "superhero penguin",
  "wizard casting spells",
  "flying whale",
  "princess on a dragon",
  "submarine adventure",
  "alien playground",
  "magic treehouse",
  "bunny astronaut",
  "shark playing guitar",
  "bear having a tea party",
  "giraffe driving a bus",
  "fox in a spaceship",
  "lion reading a book",
  "elephant playing piano",
  "turtle racing a rocket",
  "owl baking a cake",
  "panda painting a rainbow",
];

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

// ─── Max-mode color grid (16 × 16 = 256 programmatically generated) ──────────
function hsl2hex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

export function buildMaxPalette() {
  const N = 16;
  const hues = Array.from({ length: N }, (_, i) => i * (360 / N));
  // 12 rows: vivid → light → rich → dark
  const rows = [
    [100, 50], [100, 62], [88, 72], [75, 80],
    [60,  87], [45,  92],
    [100, 42], [90,  34],
    [80,  26], [65,  19],
    [50,  13], [35,   8],
  ];
  const colors = [];
  for (const [s, l] of rows) hues.forEach(h => colors.push(hsl2hex(h, s, l)));
  // Warm skin / earth tones row
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    colors.push(hsl2hex(15 + t * 20, 70 - t * 30, 92 - t * 68));
  }
  // Brown / neutral row
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    colors.push(hsl2hex(28 - t * 8, 50 - t * 20, 80 - t * 55));
  }
  // Grays: white → black
  for (let i = 0; i < N; i++) {
    const v = Math.round(255 * (1 - i / (N - 1)));
    const h = v.toString(16).padStart(2, '0');
    colors.push(`#${h}${h}${h}`);
  }
  // Specials / metallics row
  colors.push(
    '#FFD700','#FFA500','#FF4500','#FF1493','#FF69B4','#DA70D6','#9400D3','#4169E1',
    '#00BFFF','#00CED1','#00FF7F','#7FFF00','#C0C0C0','#A0A0A0','#696969','#1C1C1C'
  );
  return colors; // 16 × 16 = 256
}

export function buildPrompt(subject, difficulty = "medium", size = "medium") {
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

  // Size controls compositional scope: small = zoomed-in single subject,
  // large/xxl = wide scene with background elements filling the canvas.
  const sizeHints = {
    small: ["single centered subject", "sparse simple layout"],
    large: ["wide scene filling the full canvas", "include background elements"],
    xxl:   ["panoramic wide scene filling the entire canvas", "rich background detail throughout"],
  };
  const extra = sizeHints[size] || [];

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
      ...extra,
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
      ...extra,
    ].join(", ");
  }

  if (difficulty === "extreme") {
    return [
      `ultra-detailed adult coloring book page of ${subject}`,
      "intricate mandala-inspired style with complex ornamental cell borders",
      "bold continuous black outline-only lines",
      ...base,
      "every interior line forms a fully closed loop",
      "no filled black areas anywhere in the image",
      "all interiors remain white with only black boundary lines",
      "dozens of tiny white-filled enclosed cells covering every region",
      "dense geometric and floral border patterns creating many fillable white areas",
      "maximum intricacy throughout the entire image",
      "expert adult coloring book for skilled colorers",
      ...extra,
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
    ...extra,
  ].join(", ");
}
