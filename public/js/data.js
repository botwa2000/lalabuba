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

// ─── Combinatorial card system: SUBJECTS × ACTIONS = 400 unique prompts ──────
// Adding a new subject or action row instantly creates 20 new combinations.
// `subject` sent to the AI is always the English combo: "{subj.en} {act.en}".

const CARD_SUBJECTS = [
  { en:"shark",      emoji:"🦈", de:"Hai",          fr:"requin",      es:"tiburón",      pt:"tubarão",     it:"squalo",      nl:"haai",         pl:"rekin",       ru:"акула",       tr:"köpekbalığı",  zh:"鲨鱼",   hi:"शार्क"       },
  { en:"giraffe",    emoji:"🦒", de:"Giraffe",      fr:"girafe",      es:"jirafa",       pt:"girafa",      it:"giraffa",     nl:"giraf",        pl:"żyrafa",      ru:"жираф",       tr:"zürafa",       zh:"长颈鹿", hi:"जिराफ़"      },
  { en:"elephant",   emoji:"🐘", de:"Elefant",      fr:"éléphant",    es:"elefante",     pt:"elefante",    it:"elefante",    nl:"olifant",      pl:"słoń",        ru:"слон",        tr:"fil",          zh:"大象",   hi:"हाथी"        },
  { en:"penguin",    emoji:"🐧", de:"Pinguin",      fr:"pingouin",    es:"pingüino",     pt:"pinguim",     it:"pinguino",    nl:"pinguïn",      pl:"pingwin",     ru:"пингвин",     tr:"penguen",      zh:"企鹅",   hi:"पेंगुइन"     },
  { en:"fox",        emoji:"🦊", de:"Fuchs",        fr:"renard",      es:"zorro",        pt:"raposa",      it:"volpe",       nl:"vos",          pl:"lis",         ru:"лиса",        tr:"tilki",        zh:"狐狸",   hi:"लोमड़ी"      },
  { en:"bear",       emoji:"🐻", de:"Bär",          fr:"ours",        es:"oso",          pt:"urso",        it:"orso",        nl:"beer",         pl:"niedźwiedź",  ru:"медведь",     tr:"ayı",          zh:"熊",     hi:"भालू"        },
  { en:"panda",      emoji:"🐼", de:"Panda",        fr:"panda",       es:"panda",        pt:"panda",       it:"panda",       nl:"panda",        pl:"panda",       ru:"панда",       tr:"panda",        zh:"熊猫",   hi:"पांडा"       },
  { en:"owl",        emoji:"🦉", de:"Eule",         fr:"hibou",       es:"búho",         pt:"coruja",      it:"gufo",        nl:"uil",          pl:"sowa",        ru:"сова",        tr:"baykuş",       zh:"猫头鹰", hi:"उल्लू"       },
  { en:"lion",       emoji:"🦁", de:"Löwe",         fr:"lion",        es:"león",         pt:"leão",        it:"leone",       nl:"leeuw",        pl:"lew",         ru:"лев",         tr:"aslan",        zh:"狮子",   hi:"शेर"         },
  { en:"frog",       emoji:"🐸", de:"Frosch",       fr:"grenouille",  es:"rana",         pt:"sapo",        it:"rana",        nl:"kikker",       pl:"żaba",        ru:"лягушка",     tr:"kurbağa",      zh:"青蛙",   hi:"मेंढक"       },
  { en:"octopus",    emoji:"🐙", de:"Tintenfisch",  fr:"pieuvre",     es:"pulpo",        pt:"polvo",       it:"polpo",       nl:"octopus",      pl:"ośmiornica",  ru:"осьминог",    tr:"ahtapot",      zh:"章鱼",   hi:"ऑक्टोपस"    },
  { en:"dinosaur",   emoji:"🦖", de:"Dinosaurier",  fr:"dinosaure",   es:"dinosaurio",   pt:"dinossauro",  it:"dinosauro",   nl:"dinosaurus",   pl:"dinozaur",    ru:"динозавр",    tr:"dinozor",      zh:"恐龙",   hi:"डायनासोर"    },
  { en:"dragon",     emoji:"🐉", de:"Drache",       fr:"dragon",      es:"dragón",       pt:"dragão",      it:"drago",       nl:"draak",        pl:"smok",        ru:"дракон",      tr:"ejderha",      zh:"龙",     hi:"ड्रैगन"      },
  { en:"unicorn",    emoji:"🦄", de:"Einhorn",      fr:"licorne",     es:"unicornio",    pt:"unicórnio",   it:"unicorno",    nl:"eenhoorn",     pl:"jednorożec",  ru:"единорог",    tr:"unicorn",      zh:"独角兽", hi:"यूनिकॉर्न"   },
  { en:"cat",        emoji:"🐱", de:"Katze",        fr:"chat",        es:"gato",         pt:"gato",        it:"gatto",       nl:"kat",          pl:"kot",         ru:"кот",         tr:"kedi",         zh:"猫",     hi:"बिल्ली"      },
  { en:"dog",        emoji:"🐶", de:"Hund",         fr:"chien",       es:"perro",        pt:"cachorro",    it:"cane",        nl:"hond",         pl:"pies",        ru:"пёс",         tr:"köpek",        zh:"狗",     hi:"कुत्ता"      },
  { en:"bunny",      emoji:"🐰", de:"Hase",         fr:"lapin",       es:"conejito",     pt:"coelho",      it:"coniglio",    nl:"konijn",       pl:"królik",      ru:"кролик",      tr:"tavşan",       zh:"兔子",   hi:"खरगोश"      },
  { en:"turtle",     emoji:"🐢", de:"Schildkröte",  fr:"tortue",      es:"tortuga",      pt:"tartaruga",   it:"tartaruga",   nl:"schildpad",    pl:"żółw",        ru:"черепаха",    tr:"kaplumbağa",   zh:"乌龟",   hi:"कछुआ"        },
  { en:"monkey",     emoji:"🐒", de:"Affe",         fr:"singe",       es:"mono",         pt:"macaco",      it:"scimmia",     nl:"aap",          pl:"małpa",       ru:"обезьяна",    tr:"maymun",       zh:"猴子",   hi:"बंदर"        },
  { en:"crocodile",  emoji:"🐊", de:"Krokodil",     fr:"crocodile",   es:"cocodrilo",    pt:"crocodilo",   it:"coccodrillo", nl:"krokodil",     pl:"krokodyl",    ru:"крокодил",    tr:"timsah",       zh:"鳄鱼",   hi:"मगरमच्छ"     },
];

const CARD_ACTIONS = [
  { en:"playing guitar",       de:"spielt Gitarre",          fr:"et sa guitare",              es:"con guitarra",            pt:"com guitarra",          it:"e chitarra",             nl:"speelt gitaar",          pl:"z gitarą",              ru:"с гитарой",           tr:"gitarla",            zh:"弹吉他",     hi:"गिटार बजाते"         },
  { en:"baking cookies",       de:"backt Kekse",             fr:"fait des gâteaux",           es:"horneando galletas",      pt:"fazendo biscoitos",     it:"fa biscotti",            nl:"bakt koekjes",           pl:"piecze ciastka",        ru:"печёт печенье",       tr:"kurabiye pişirir",   zh:"烤饼干",     hi:"कुकीज़ बनाते"        },
  { en:"riding a bicycle",     de:"fährt Fahrrad",           fr:"à vélo",                     es:"en bicicleta",            pt:"de bicicleta",          it:"in bicicletta",          nl:"op de fiets",            pl:"jedzie rowerem",        ru:"на велосипеде",       tr:"bisiklet sürer",     zh:"骑自行车",   hi:"साइकिल चलाते"       },
  { en:"reading a book",       de:"liest ein Buch",          fr:"lit un livre",               es:"leyendo un libro",        pt:"lendo um livro",        it:"legge un libro",         nl:"leest een boek",         pl:"czyta książkę",         ru:"читает книгу",        tr:"kitap okur",         zh:"看书",       hi:"किताब पढ़ते"         },
  { en:"driving a bus",        de:"fährt Bus",               fr:"conduit un bus",             es:"manejando un autobús",    pt:"dirigindo um ônibus",   it:"guida un autobus",       nl:"rijdt een bus",          pl:"prowadzi autobus",      ru:"за рулём автобуса",   tr:"otobüs sürer",       zh:"开公共汽车", hi:"बस चलाते"            },
  { en:"painting a rainbow",   de:"malt Regenbogen",         fr:"peint un arc-en-ciel",       es:"pintando un arcoíris",    pt:"pintando arco-íris",    it:"dipinge arcobaleno",     nl:"schildert regenboog",    pl:"maluje tęczę",          ru:"рисует радугу",       tr:"gökkuşağı boyar",    zh:"画彩虹",     hi:"इंद्रधनुष बनाते"     },
  { en:"playing piano",        de:"spielt Klavier",          fr:"joue du piano",              es:"tocando el piano",        pt:"tocando piano",         it:"suona il pianoforte",    nl:"speelt piano",           pl:"gra na pianinie",       ru:"играет на пианино",   tr:"piyano çalar",       zh:"弹钢琴",     hi:"पियानो बजाते"        },
  { en:"flying a kite",        de:"lässt Drachen steigen",   fr:"fait voler un cerf-volant",  es:"volando una cometa",      pt:"soltando pipa",         it:"fa volare un aquilone",  nl:"vliegert",               pl:"puszcza latawca",       ru:"запускает змея",      tr:"uçurtma uçurur",     zh:"放风筝",     hi:"पतंग उड़ाते"         },
  { en:"having a tea party",   de:"bei der Teeparty",        fr:"prend le thé",               es:"en una merienda",         pt:"no chá da tarde",       it:"al tè",                  nl:"op theekransje",         pl:"na herbatce",           ru:"на чаепитии",         tr:"çay partisinde",     zh:"喝下午茶",   hi:"चाय पार्टी में"      },
  { en:"surfing",              de:"surft die Wellen",        fr:"surfe les vagues",           es:"surfeando las olas",      pt:"surfando as ondas",     it:"fa surf",                nl:"surft de golven",        pl:"surfuje",               ru:"катается на волнах",  tr:"sörf yapar",         zh:"冲浪",       hi:"सर्फिंग करते"        },
  { en:"eating ice cream",     de:"isst Eis",                fr:"mange une glace",            es:"comiendo helado",         pt:"comendo sorvete",       it:"mangia gelato",          nl:"eet een ijsje",          pl:"je lody",               ru:"ест мороженое",       tr:"dondurma yer",       zh:"吃冰淇淋",   hi:"आइसक्रीम खाते"       },
  { en:"dancing",              de:"tanzt",                   fr:"danse",                      es:"bailando",                pt:"dançando",              it:"balla",                  nl:"danst",                  pl:"tańczy",                ru:"танцует",             tr:"dans eder",          zh:"跳舞",       hi:"नाचते"               },
  { en:"cooking spaghetti",    de:"kocht Spaghetti",         fr:"cuisine des spaghettis",     es:"cocinando espagueti",     pt:"fazendo espaguete",     it:"cucina spaghetti",       nl:"kookt spaghetti",        pl:"gotuje spaghetti",      ru:"готовит спагетти",    tr:"spagetti pişirir",   zh:"煮意面",     hi:"स्पेगेटी बनाते"      },
  { en:"playing chess",        de:"spielt Schach",           fr:"joue aux échecs",            es:"jugando ajedrez",         pt:"jogando xadrez",        it:"gioca a scacchi",        nl:"speelt schaken",         pl:"gra w szachy",          ru:"играет в шахматы",    tr:"satranç oynar",      zh:"下棋",       hi:"शतरंज खेलते"         },
  { en:"building a sandcastle",de:"baut Sandburg",           fr:"fait un château de sable",   es:"haciendo castillo arena",  pt:"fazendo castelo areia", it:"fa castello di sabbia",  nl:"bouwt zandkasteel",      pl:"buduje zamek z piasku", ru:"строит замок из песка",tr:"kum kalesi yapar",   zh:"建沙堡",     hi:"रेत का महल बनाते"    },
  { en:"doing yoga",           de:"macht Yoga",              fr:"fait du yoga",               es:"haciendo yoga",           pt:"fazendo yoga",          it:"fa yoga",                nl:"doet yoga",              pl:"robi jogę",             ru:"занимается йогой",    tr:"yoga yapar",         zh:"练瑜伽",     hi:"योगा करते"           },
  { en:"playing drums",        de:"spielt Schlagzeug",       fr:"joue de la batterie",        es:"tocando la batería",      pt:"tocando bateria",       it:"suona la batteria",      nl:"speelt drums",           pl:"gra na perkusji",       ru:"играет на барабанах", tr:"davul çalar",        zh:"打鼓",       hi:"ड्रम बजाते"          },
  { en:"in a spaceship",       de:"im Raumschiff",           fr:"dans un vaisseau spatial",   es:"en una nave espacial",    pt:"numa nave espacial",    it:"su un'astronave",        nl:"in een ruimteschip",     pl:"w statku kosmicznym",   ru:"в космическом корабле",tr:"uzay gemisinde",     zh:"在宇宙飞船里",hi:"अंतरिक्ष यान में"   },
  { en:"at school",            de:"in der Schule",           fr:"à l'école",                  es:"en la escuela",           pt:"na escola",             it:"a scuola",               nl:"op school",              pl:"w szkole",              ru:"в школе",             tr:"okulda",             zh:"在学校",     hi:"स्कूल में"           },
  { en:"skateboarding",        de:"fährt Skateboard",        fr:"fait du skateboard",         es:"en monopatín",            pt:"andando de skate",      it:"fa skateboard",          nl:"skateboardt",            pl:"jedzie na deskorolce",  ru:"катается на скейте",  tr:"kaykay yapar",       zh:"玩滑板",     hi:"स्केटबोर्ड करते"     },
];

const LANGS = ['de','fr','es','pt','it','nl','pl','ru','tr','zh','hi'];

export function buildCardPool() {
  const pool = [];
  for (const subj of CARD_SUBJECTS) {
    for (const act of CARD_ACTIONS) {
      const labels = {};
      for (const lang of LANGS) {
        labels[lang] = `${subj[lang] ?? subj.en} ${act[lang] ?? act.en}`;
      }
      pool.push({ subject: `${subj.en} ${act.en}`, emoji: subj.emoji, labels });
    }
  }
  return pool;
}

export function randomCardSubject() {
  const subj = CARD_SUBJECTS[Math.floor(Math.random() * CARD_SUBJECTS.length)];
  const act  = CARD_ACTIONS[Math.floor(Math.random() * CARD_ACTIONS.length)];
  return `${subj.en} ${act.en}`;
}

// Keep for backward compatibility — buildCardPool() is preferred for the card grid.
export const EXAMPLE_SUGGESTIONS = buildCardPool();

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

// ─── Daily Word Challenge ──────────────────────────────────────────────────────
export const DAILY_WORDS = [
  "butterfly","dragon","castle","rocket ship","cat","unicorn","dinosaur","elephant","robot","mermaid",
  "pirate","wizard","fairy","knight","princess","phoenix","tiger","panda","koala","giraffe",
  "penguin","dolphin","turtle","fox","bear","lion","owl","parrot","octopus","seahorse",
  "treehouse","submarine","spaceship","lighthouse","hot air balloon","train","fire truck","pirate ship","igloo","windmill",
  "rainbow","waterfall","volcano","iceberg","cave","garden","jungle","desert","snowflake","tornado",
  "birthday cake","ice cream sundae","pizza","cookie","cupcake","lollipop","donut","sandwich","popcorn","sushi",
  "teddy bear","kite","bicycle","skateboard","guitar","drum kit","telescope","microscope","camera","crown",
  "bunny","hamster","puppy","kitten","goldfish","frog","snail","ladybug","bee","firefly",
  "superhero","astronaut","chef","firefighter","explorer","inventor","time traveler","ninja","cowboy","detective",
  "magic wand","treasure chest","map","compass","lantern","hourglass","crystal ball","flying carpet","magic lamp","portal",
];

export function getDailyChallenge() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  const word = DAILY_WORDS[dayIndex % DAILY_WORDS.length];
  const seed = (dayIndex * 1000003) % 2147483647;
  return { word, seed };
}

// ─── Daily Word Translations (all 12 supported languages) ────────────────────
export const DAILY_WORDS_I18N = {
  de: {
    "butterfly":"Schmetterling","dragon":"Drache","castle":"Schloss","rocket ship":"Raumschiff","cat":"Katze",
    "unicorn":"Einhorn","dinosaur":"Dinosaurier","elephant":"Elefant","robot":"Roboter","mermaid":"Meerjungfrau",
    "pirate":"Pirat","wizard":"Zauberer","fairy":"Fee","knight":"Ritter","princess":"Prinzessin",
    "phoenix":"Phönix","tiger":"Tiger","panda":"Panda","koala":"Koala","giraffe":"Giraffe",
    "penguin":"Pinguin","dolphin":"Delfin","turtle":"Schildkröte","fox":"Fuchs","bear":"Bär",
    "lion":"Löwe","owl":"Eule","parrot":"Papagei","octopus":"Tintenfisch","seahorse":"Seepferdchen",
    "treehouse":"Baumhaus","submarine":"U-Boot","spaceship":"Raumschiff","lighthouse":"Leuchtturm",
    "hot air balloon":"Heißluftballon","train":"Zug","fire truck":"Feuerwehrauto","pirate ship":"Piratenschiff",
    "igloo":"Iglu","windmill":"Windmühle","rainbow":"Regenbogen","waterfall":"Wasserfall","volcano":"Vulkan",
    "iceberg":"Eisberg","cave":"Höhle","garden":"Garten","jungle":"Dschungel","desert":"Wüste",
    "snowflake":"Schneeflocke","tornado":"Tornado","birthday cake":"Geburtstagskuchen",
    "ice cream sundae":"Eisbecher","pizza":"Pizza","cookie":"Keks","cupcake":"Cupcake",
    "lollipop":"Lutscher","donut":"Donut","sandwich":"Sandwich","popcorn":"Popcorn","sushi":"Sushi",
    "teddy bear":"Teddybär","kite":"Drachen","bicycle":"Fahrrad","skateboard":"Skateboard",
    "guitar":"Gitarre","drum kit":"Schlagzeug","telescope":"Teleskop","microscope":"Mikroskop",
    "camera":"Kamera","crown":"Krone","bunny":"Häschen","hamster":"Hamster","puppy":"Welpe",
    "kitten":"Kätzchen","goldfish":"Goldfisch","frog":"Frosch","snail":"Schnecke",
    "ladybug":"Marienkäfer","bee":"Biene","firefly":"Glühwürmchen","superhero":"Superheld",
    "astronaut":"Astronaut","chef":"Koch","firefighter":"Feuerwehrmann","explorer":"Entdecker",
    "inventor":"Erfinder","time traveler":"Zeitreisender","ninja":"Ninja","cowboy":"Cowboy",
    "detective":"Detektiv","magic wand":"Zauberstab","treasure chest":"Schatztruhe","map":"Landkarte",
    "compass":"Kompass","lantern":"Laterne","hourglass":"Sanduhr","crystal ball":"Kristallkugel",
    "flying carpet":"Fliegender Teppich","magic lamp":"Wunderlampe","portal":"Portal",
  },
  ru: {
    "butterfly":"бабочка","dragon":"дракон","castle":"замок","rocket ship":"ракета","cat":"кошка",
    "unicorn":"единорог","dinosaur":"динозавр","elephant":"слон","robot":"робот","mermaid":"русалка",
    "pirate":"пират","wizard":"волшебник","fairy":"фея","knight":"рыцарь","princess":"принцесса",
    "phoenix":"феникс","tiger":"тигр","panda":"панда","koala":"коала","giraffe":"жираф",
    "penguin":"пингвин","dolphin":"дельфин","turtle":"черепаха","fox":"лиса","bear":"медведь",
    "lion":"лев","owl":"сова","parrot":"попугай","octopus":"осьминог","seahorse":"морской конёк",
    "treehouse":"домик на дереве","submarine":"подводная лодка","spaceship":"космический корабль",
    "lighthouse":"маяк","hot air balloon":"воздушный шар","train":"поезд","fire truck":"пожарная машина",
    "pirate ship":"пиратский корабль","igloo":"иглу","windmill":"ветряная мельница",
    "rainbow":"радуга","waterfall":"водопад","volcano":"вулкан","iceberg":"айсберг","cave":"пещера",
    "garden":"сад","jungle":"джунгли","desert":"пустыня","snowflake":"снежинка","tornado":"торнадо",
    "birthday cake":"торт на день рождения","ice cream sundae":"мороженое","pizza":"пицца",
    "cookie":"печенье","cupcake":"кекс","lollipop":"леденец","donut":"пончик","sandwich":"бутерброд",
    "popcorn":"попкорн","sushi":"суши","teddy bear":"плюшевый мишка","kite":"воздушный змей",
    "bicycle":"велосипед","skateboard":"скейтборд","guitar":"гитара","drum kit":"барабаны",
    "telescope":"телескоп","microscope":"микроскоп","camera":"фотоаппарат","crown":"корона",
    "bunny":"зайчик","hamster":"хомяк","puppy":"щенок","kitten":"котёнок","goldfish":"золотая рыбка",
    "frog":"лягушка","snail":"улитка","ladybug":"божья коровка","bee":"пчела","firefly":"светлячок",
    "superhero":"супергерой","astronaut":"космонавт","chef":"повар","firefighter":"пожарный",
    "explorer":"исследователь","inventor":"изобретатель","time traveler":"путешественник во времени",
    "ninja":"ниндзя","cowboy":"ковбой","detective":"детектив","magic wand":"волшебная палочка",
    "treasure chest":"сундук с сокровищами","map":"карта","compass":"компас","lantern":"фонарь",
    "hourglass":"песочные часы","crystal ball":"хрустальный шар","flying carpet":"ковёр-самолёт",
    "magic lamp":"волшебная лампа","portal":"портал",
  },
  fr: {
    "butterfly":"papillon","dragon":"dragon","castle":"château","rocket ship":"fusée","cat":"chat",
    "unicorn":"licorne","dinosaur":"dinosaure","elephant":"éléphant","robot":"robot","mermaid":"sirène",
    "pirate":"pirate","wizard":"sorcier","fairy":"fée","knight":"chevalier","princess":"princesse",
    "phoenix":"phénix","tiger":"tigre","panda":"panda","koala":"koala","giraffe":"girafe",
    "penguin":"pingouin","dolphin":"dauphin","turtle":"tortue","fox":"renard","bear":"ours",
    "lion":"lion","owl":"hibou","parrot":"perroquet","octopus":"pieuvre","seahorse":"hippocampe",
    "treehouse":"cabane dans les arbres","submarine":"sous-marin","spaceship":"vaisseau spatial",
    "lighthouse":"phare","hot air balloon":"montgolfière","train":"train","fire truck":"camion de pompiers",
    "pirate ship":"bateau pirate","igloo":"igloo","windmill":"moulin à vent","rainbow":"arc-en-ciel",
    "waterfall":"cascade","volcano":"volcan","iceberg":"iceberg","cave":"grotte","garden":"jardin",
    "jungle":"jungle","desert":"désert","snowflake":"flocon de neige","tornado":"tornado",
    "birthday cake":"gâteau d'anniversaire","ice cream sundae":"coupe de glace","pizza":"pizza",
    "cookie":"biscuit","cupcake":"cupcake","lollipop":"sucette","donut":"beignet","sandwich":"sandwich",
    "popcorn":"popcorn","sushi":"sushi","teddy bear":"nounours","kite":"cerf-volant","bicycle":"vélo",
    "skateboard":"skateboard","guitar":"guitare","drum kit":"batterie","telescope":"télescope",
    "microscope":"microscope","camera":"appareil photo","crown":"couronne","bunny":"lapin",
    "hamster":"hamster","puppy":"chiot","kitten":"chaton","goldfish":"poisson rouge","frog":"grenouille",
    "snail":"escargot","ladybug":"coccinelle","bee":"abeille","firefly":"luciole",
    "superhero":"super-héros","astronaut":"astronaute","chef":"chef cuisinier","firefighter":"pompier",
    "explorer":"explorateur","inventor":"inventeur","time traveler":"voyageur du temps","ninja":"ninja",
    "cowboy":"cowboy","detective":"détective","magic wand":"baguette magique",
    "treasure chest":"coffre au trésor","map":"carte","compass":"boussole","lantern":"lanterne",
    "hourglass":"sablier","crystal ball":"boule de cristal","flying carpet":"tapis volant",
    "magic lamp":"lampe magique","portal":"portail",
  },
  es: {
    "butterfly":"mariposa","dragon":"dragón","castle":"castillo","rocket ship":"cohete","cat":"gato",
    "unicorn":"unicornio","dinosaur":"dinosaurio","elephant":"elefante","robot":"robot","mermaid":"sirena",
    "pirate":"pirata","wizard":"mago","fairy":"hada","knight":"caballero","princess":"princesa",
    "phoenix":"fénix","tiger":"tigre","panda":"panda","koala":"koala","giraffe":"jirafa",
    "penguin":"pingüino","dolphin":"delfín","turtle":"tortuga","fox":"zorro","bear":"oso",
    "lion":"león","owl":"búho","parrot":"loro","octopus":"pulpo","seahorse":"caballito de mar",
    "treehouse":"casa en el árbol","submarine":"submarino","spaceship":"nave espacial",
    "lighthouse":"faro","hot air balloon":"globo aerostático","train":"tren","fire truck":"camión de bomberos",
    "pirate ship":"barco pirata","igloo":"iglú","windmill":"molino de viento","rainbow":"arco iris",
    "waterfall":"cascada","volcano":"volcán","iceberg":"iceberg","cave":"cueva","garden":"jardín",
    "jungle":"selva","desert":"desierto","snowflake":"copo de nieve","tornado":"tornado",
    "birthday cake":"pastel de cumpleaños","ice cream sundae":"helado","pizza":"pizza",
    "cookie":"galleta","cupcake":"cupcake","lollipop":"piruleta","donut":"dona","sandwich":"sándwich",
    "popcorn":"palomitas","sushi":"sushi","teddy bear":"osito de peluche","kite":"cometa",
    "bicycle":"bicicleta","skateboard":"monopatín","guitar":"guitarra","drum kit":"batería",
    "telescope":"telescopio","microscope":"microscopio","camera":"cámara","crown":"corona",
    "bunny":"conejito","hamster":"hámster","puppy":"cachorro","kitten":"gatito","goldfish":"pez dorado",
    "frog":"rana","snail":"caracol","ladybug":"mariquita","bee":"abeja","firefly":"luciérnaga",
    "superhero":"superhéroe","astronaut":"astronauta","chef":"chef","firefighter":"bombero",
    "explorer":"explorador","inventor":"inventor","time traveler":"viajero del tiempo","ninja":"ninja",
    "cowboy":"vaquero","detective":"detective","magic wand":"varita mágica","treasure chest":"cofre del tesoro",
    "map":"mapa","compass":"brújula","lantern":"linterna","hourglass":"reloj de arena",
    "crystal ball":"bola de cristal","flying carpet":"alfombra voladora","magic lamp":"lámpara mágica",
    "portal":"portal",
  },
  pt: {
    "butterfly":"borboleta","dragon":"dragão","castle":"castelo","rocket ship":"foguete","cat":"gato",
    "unicorn":"unicórnio","dinosaur":"dinossauro","elephant":"elefante","robot":"robô","mermaid":"sereia",
    "pirate":"pirata","wizard":"mago","fairy":"fada","knight":"cavaleiro","princess":"princesa",
    "phoenix":"fênix","tiger":"tigre","panda":"panda","koala":"coala","giraffe":"girafa",
    "penguin":"pinguim","dolphin":"golfinho","turtle":"tartaruga","fox":"raposa","bear":"urso",
    "lion":"leão","owl":"coruja","parrot":"papagaio","octopus":"polvo","seahorse":"cavalo-marinho",
    "treehouse":"casa na árvore","submarine":"submarino","spaceship":"nave espacial","lighthouse":"farol",
    "hot air balloon":"balão de ar quente","train":"trem","fire truck":"caminhão de bombeiros",
    "pirate ship":"navio pirata","igloo":"iglu","windmill":"moinho de vento","rainbow":"arco-íris",
    "waterfall":"cachoeira","volcano":"vulcão","iceberg":"iceberg","cave":"caverna","garden":"jardim",
    "jungle":"selva","desert":"deserto","snowflake":"floco de neve","tornado":"tornado",
    "birthday cake":"bolo de aniversário","ice cream sundae":"sorvete","pizza":"pizza",
    "cookie":"biscoito","cupcake":"cupcake","lollipop":"pirulito","donut":"rosquinha","sandwich":"sanduíche",
    "popcorn":"pipoca","sushi":"sushi","teddy bear":"ursinho de pelúcia","kite":"pipa",
    "bicycle":"bicicleta","skateboard":"skate","guitar":"violão","drum kit":"bateria",
    "telescope":"telescópio","microscope":"microscópio","camera":"câmera","crown":"coroa",
    "bunny":"coelhinho","hamster":"hamster","puppy":"filhote de cachorro","kitten":"gatinho",
    "goldfish":"peixinho dourado","frog":"sapo","snail":"caracol","ladybug":"joaninha",
    "bee":"abelha","firefly":"vaga-lume","superhero":"super-herói","astronaut":"astronauta",
    "chef":"chef","firefighter":"bombeiro","explorer":"explorador","inventor":"inventor",
    "time traveler":"viajante do tempo","ninja":"ninja","cowboy":"cowboy","detective":"detetive",
    "magic wand":"varinha mágica","treasure chest":"baú do tesouro","map":"mapa","compass":"bússola",
    "lantern":"lanterna","hourglass":"ampulheta","crystal ball":"bola de cristal",
    "flying carpet":"tapete voador","magic lamp":"lâmpada mágica","portal":"portal",
  },
  it: {
    "butterfly":"farfalla","dragon":"drago","castle":"castello","rocket ship":"razzo","cat":"gatto",
    "unicorn":"unicorno","dinosaur":"dinosauro","elephant":"elefante","robot":"robot","mermaid":"sirena",
    "pirate":"pirata","wizard":"mago","fairy":"fata","knight":"cavaliere","princess":"principessa",
    "phoenix":"fenice","tiger":"tigre","panda":"panda","koala":"koala","giraffe":"giraffa",
    "penguin":"pinguino","dolphin":"delfino","turtle":"tartaruga","fox":"volpe","bear":"orso",
    "lion":"leone","owl":"gufo","parrot":"pappagallo","octopus":"polpo","seahorse":"cavalluccio marino",
    "treehouse":"casa sull'albero","submarine":"sottomarino","spaceship":"astronave","lighthouse":"faro",
    "hot air balloon":"mongolfiera","train":"treno","fire truck":"camion dei pompieri",
    "pirate ship":"nave pirata","igloo":"igloo","windmill":"mulino a vento","rainbow":"arcobaleno",
    "waterfall":"cascata","volcano":"vulcano","iceberg":"iceberg","cave":"grotta","garden":"giardino",
    "jungle":"giungla","desert":"deserto","snowflake":"fiocco di neve","tornado":"tornado",
    "birthday cake":"torta di compleanno","ice cream sundae":"gelato","pizza":"pizza",
    "cookie":"biscotto","cupcake":"cupcake","lollipop":"lecca-lecca","donut":"ciambella",
    "sandwich":"panino","popcorn":"popcorn","sushi":"sushi","teddy bear":"orsacchiotto",
    "kite":"aquilone","bicycle":"bicicletta","skateboard":"skateboard","guitar":"chitarra",
    "drum kit":"batteria","telescope":"telescopio","microscope":"microscopio",
    "camera":"macchina fotografica","crown":"corona","bunny":"coniglietto","hamster":"criceto",
    "puppy":"cucciolo","kitten":"gattino","goldfish":"pesciolino rosso","frog":"rana",
    "snail":"chiocciola","ladybug":"coccinella","bee":"ape","firefly":"lucciola",
    "superhero":"supereroe","astronaut":"astronauta","chef":"cuoco","firefighter":"pompiere",
    "explorer":"esploratore","inventor":"inventore","time traveler":"viaggiatore del tempo",
    "ninja":"ninja","cowboy":"cowboy","detective":"detective","magic wand":"bacchetta magica",
    "treasure chest":"forziere","map":"mappa","compass":"bussola","lantern":"lanterna",
    "hourglass":"clessidra","crystal ball":"sfera di cristallo","flying carpet":"tappeto volante",
    "magic lamp":"lampada magica","portal":"portale",
  },
  nl: {
    "butterfly":"vlinder","dragon":"draak","castle":"kasteel","rocket ship":"raket","cat":"kat",
    "unicorn":"eenhoorn","dinosaur":"dinosaurus","elephant":"olifant","robot":"robot","mermaid":"zeemeermin",
    "pirate":"piraat","wizard":"tovenaar","fairy":"fee","knight":"ridder","princess":"prinses",
    "phoenix":"feniks","tiger":"tijger","panda":"panda","koala":"koala","giraffe":"giraf",
    "penguin":"pinguïn","dolphin":"dolfijn","turtle":"schildpad","fox":"vos","bear":"beer",
    "lion":"leeuw","owl":"uil","parrot":"papegaai","octopus":"octopus","seahorse":"zeepaardje",
    "treehouse":"boomhut","submarine":"onderzeeër","spaceship":"ruimteschip","lighthouse":"vuurtoren",
    "hot air balloon":"luchtballon","train":"trein","fire truck":"brandweerauto",
    "pirate ship":"piratenschip","igloo":"iglo","windmill":"windmolen","rainbow":"regenboog",
    "waterfall":"waterval","volcano":"vulkaan","iceberg":"ijsberg","cave":"grot","garden":"tuin",
    "jungle":"jungle","desert":"woestijn","snowflake":"sneeuwvlok","tornado":"tornado",
    "birthday cake":"verjaardagstaart","ice cream sundae":"ijscoupe","pizza":"pizza",
    "cookie":"koekje","cupcake":"cupcake","lollipop":"lolly","donut":"donut","sandwich":"boterham",
    "popcorn":"popcorn","sushi":"sushi","teddy bear":"teddybeer","kite":"vlieger","bicycle":"fiets",
    "skateboard":"skateboard","guitar":"gitaar","drum kit":"drumstel","telescope":"telescoop",
    "microscope":"microscoop","camera":"camera","crown":"kroon","bunny":"konijntje","hamster":"hamster",
    "puppy":"puppy","kitten":"katje","goldfish":"goudvis","frog":"kikker","snail":"slak",
    "ladybug":"lieveheersbeestje","bee":"bij","firefly":"vuurvliegje","superhero":"superheld",
    "astronaut":"astronaut","chef":"kok","firefighter":"brandweerman","explorer":"ontdekkingsreiziger",
    "inventor":"uitvinder","time traveler":"tijdreiziger","ninja":"ninja","cowboy":"cowboy",
    "detective":"detective","magic wand":"toverstaf","treasure chest":"schatkist","map":"kaart",
    "compass":"kompas","lantern":"lantaarn","hourglass":"zandloper","crystal ball":"kristallen bol",
    "flying carpet":"vliegend tapijt","magic lamp":"magische lamp","portal":"portaal",
  },
  pl: {
    "butterfly":"motyl","dragon":"smok","castle":"zamek","rocket ship":"rakieta","cat":"kot",
    "unicorn":"jednorożec","dinosaur":"dinozaur","elephant":"słoń","robot":"robot","mermaid":"syrenka",
    "pirate":"pirat","wizard":"czarodziej","fairy":"wróżka","knight":"rycerz","princess":"księżniczka",
    "phoenix":"feniks","tiger":"tygrys","panda":"panda","koala":"koala","giraffe":"żyrafa",
    "penguin":"pingwin","dolphin":"delfin","turtle":"żółw","fox":"lis","bear":"niedźwiedź",
    "lion":"lew","owl":"sowa","parrot":"papuga","octopus":"ośmiornica","seahorse":"konik morski",
    "treehouse":"domek na drzewie","submarine":"łódź podwodna","spaceship":"statek kosmiczny",
    "lighthouse":"latarnia morska","hot air balloon":"balon","train":"pociąg","fire truck":"wóz strażacki",
    "pirate ship":"statek piracki","igloo":"igloo","windmill":"wiatrak","rainbow":"tęcza",
    "waterfall":"wodospad","volcano":"wulkan","iceberg":"góra lodowa","cave":"jaskinia","garden":"ogród",
    "jungle":"dżungla","desert":"pustynia","snowflake":"płatek śniegu","tornado":"tornado",
    "birthday cake":"tort urodzinowy","ice cream sundae":"lody","pizza":"pizza","cookie":"ciastko",
    "cupcake":"babeczka","lollipop":"lizak","donut":"pączek","sandwich":"kanapka","popcorn":"popcorn",
    "sushi":"sushi","teddy bear":"miś","kite":"latawiec","bicycle":"rower","skateboard":"deskorolka",
    "guitar":"gitara","drum kit":"perkusja","telescope":"teleskop","microscope":"mikroskop",
    "camera":"aparat","crown":"korona","bunny":"zajączek","hamster":"chomik","puppy":"szczeniak",
    "kitten":"kotek","goldfish":"złota rybka","frog":"żaba","snail":"ślimak","ladybug":"biedronka",
    "bee":"pszczoła","firefly":"świetlik","superhero":"superbohater","astronaut":"astronauta",
    "chef":"kucharz","firefighter":"strażak","explorer":"odkrywca","inventor":"wynalazca",
    "time traveler":"podróżnik w czasie","ninja":"ninja","cowboy":"kowboj","detective":"detektyw",
    "magic wand":"różdżka","treasure chest":"skrzynia skarbów","map":"mapa","compass":"kompas",
    "lantern":"latarnia","hourglass":"klepsydra","crystal ball":"kryształowa kula",
    "flying carpet":"latający dywan","magic lamp":"magiczna lampa","portal":"portal",
  },
  tr: {
    "butterfly":"kelebek","dragon":"ejderha","castle":"kale","rocket ship":"roket","cat":"kedi",
    "unicorn":"tek boynuzlu at","dinosaur":"dinozor","elephant":"fil","robot":"robot","mermaid":"deniz kızı",
    "pirate":"korsan","wizard":"büyücü","fairy":"peri","knight":"şövalye","princess":"prenses",
    "phoenix":"anka kuşu","tiger":"kaplan","panda":"panda","koala":"koala","giraffe":"zürafa",
    "penguin":"penguen","dolphin":"yunus","turtle":"kaplumbağa","fox":"tilki","bear":"ayı",
    "lion":"aslan","owl":"baykuş","parrot":"papağan","octopus":"ahtapot","seahorse":"denizatı",
    "treehouse":"ağaç ev","submarine":"denizaltı","spaceship":"uzay gemisi","lighthouse":"deniz feneri",
    "hot air balloon":"sıcak hava balonu","train":"tren","fire truck":"itfaiye aracı",
    "pirate ship":"korsan gemisi","igloo":"iglo","windmill":"yel değirmeni","rainbow":"gökkuşağı",
    "waterfall":"şelale","volcano":"yanardağ","iceberg":"buzdağı","cave":"mağara","garden":"bahçe",
    "jungle":"orman","desert":"çöl","snowflake":"kar tanesi","tornado":"kasırga",
    "birthday cake":"doğum günü pastası","ice cream sundae":"dondurma","pizza":"pizza",
    "cookie":"kurabiye","cupcake":"cupcake","lollipop":"lolipop","donut":"çörek","sandwich":"sandviç",
    "popcorn":"patlamış mısır","sushi":"sushi","teddy bear":"oyuncak ayı","kite":"uçurtma",
    "bicycle":"bisiklet","skateboard":"kaykay","guitar":"gitar","drum kit":"davul takımı",
    "telescope":"teleskop","microscope":"mikroskop","camera":"kamera","crown":"taç",
    "bunny":"tavşancık","hamster":"hamster","puppy":"yavru köpek","kitten":"yavru kedi",
    "goldfish":"japon balığı","frog":"kurbağa","snail":"salyangoz","ladybug":"uğur böceği",
    "bee":"arı","firefly":"ateşböceği","superhero":"süper kahraman","astronaut":"astronot",
    "chef":"şef","firefighter":"itfaiyeci","explorer":"kaşif","inventor":"mucit",
    "time traveler":"zaman yolcusu","ninja":"ninja","cowboy":"kovboy","detective":"dedektif",
    "magic wand":"sihirli değnek","treasure chest":"hazine sandığı","map":"harita","compass":"pusula",
    "lantern":"fener","hourglass":"kum saati","crystal ball":"kristal küre","flying carpet":"uçan halı",
    "magic lamp":"sihirli lamba","portal":"portal",
  },
  zh: {
    "butterfly":"蝴蝶","dragon":"龙","castle":"城堡","rocket ship":"火箭","cat":"猫",
    "unicorn":"独角兽","dinosaur":"恐龙","elephant":"大象","robot":"机器人","mermaid":"美人鱼",
    "pirate":"海盗","wizard":"巫师","fairy":"仙女","knight":"骑士","princess":"公主",
    "phoenix":"凤凰","tiger":"老虎","panda":"熊猫","koala":"考拉","giraffe":"长颈鹿",
    "penguin":"企鹅","dolphin":"海豚","turtle":"乌龟","fox":"狐狸","bear":"熊",
    "lion":"狮子","owl":"猫头鹰","parrot":"鹦鹉","octopus":"章鱼","seahorse":"海马",
    "treehouse":"树屋","submarine":"潜水艇","spaceship":"宇宙飞船","lighthouse":"灯塔",
    "hot air balloon":"热气球","train":"火车","fire truck":"消防车","pirate ship":"海盗船",
    "igloo":"冰屋","windmill":"风车","rainbow":"彩虹","waterfall":"瀑布","volcano":"火山",
    "iceberg":"冰山","cave":"山洞","garden":"花园","jungle":"丛林","desert":"沙漠",
    "snowflake":"雪花","tornado":"龙卷风","birthday cake":"生日蛋糕","ice cream sundae":"圣代冰淇淋",
    "pizza":"披萨","cookie":"饼干","cupcake":"纸杯蛋糕","lollipop":"棒棒糖","donut":"甜甜圈",
    "sandwich":"三明治","popcorn":"爆米花","sushi":"寿司","teddy bear":"泰迪熊","kite":"风筝",
    "bicycle":"自行车","skateboard":"滑板","guitar":"吉他","drum kit":"鼓","telescope":"望远镜",
    "microscope":"显微镜","camera":"相机","crown":"皇冠","bunny":"小兔子","hamster":"仓鼠",
    "puppy":"小狗","kitten":"小猫","goldfish":"金鱼","frog":"青蛙","snail":"蜗牛",
    "ladybug":"瓢虫","bee":"蜜蜂","firefly":"萤火虫","superhero":"超级英雄","astronaut":"宇航员",
    "chef":"厨师","firefighter":"消防员","explorer":"探险家","inventor":"发明家",
    "time traveler":"时间旅行者","ninja":"忍者","cowboy":"牛仔","detective":"侦探",
    "magic wand":"魔法棒","treasure chest":"宝箱","map":"地图","compass":"指南针","lantern":"灯笼",
    "hourglass":"沙漏","crystal ball":"水晶球","flying carpet":"飞毯","magic lamp":"神灯","portal":"传送门",
  },
  hi: {
    "butterfly":"तितली","dragon":"अजगर","castle":"महल","rocket ship":"रॉकेट","cat":"बिल्ली",
    "unicorn":"यूनिकॉर्न","dinosaur":"डायनासोर","elephant":"हाथी","robot":"रोबोट","mermaid":"जलपरी",
    "pirate":"समुद्री डाकू","wizard":"जादूगर","fairy":"परी","knight":"सिपाही","princess":"राजकुमारी",
    "phoenix":"फ़ीनिक्स","tiger":"बाघ","panda":"पांडा","koala":"कोआला","giraffe":"जिराफ़",
    "penguin":"पेंगुइन","dolphin":"डॉल्फ़िन","turtle":"कछुआ","fox":"लोमड़ी","bear":"भालू",
    "lion":"शेर","owl":"उल्लू","parrot":"तोता","octopus":"ऑक्टोपस","seahorse":"समुद्री घोड़ा",
    "treehouse":"पेड़ पर घर","submarine":"पनडुब्बी","spaceship":"अंतरिक्ष यान",
    "lighthouse":"प्रकाश स्तंभ","hot air balloon":"गर्म हवा का गुब्बारा","train":"रेलगाड़ी",
    "fire truck":"दमकल","pirate ship":"समुद्री डाकू का जहाज़","igloo":"इग्लू","windmill":"पवन चक्की",
    "rainbow":"इंद्रधनुष","waterfall":"झरना","volcano":"ज्वालामुखी","iceberg":"हिमखंड",
    "cave":"गुफा","garden":"बगीचा","jungle":"जंगल","desert":"रेगिस्तान",
    "snowflake":"बर्फ का टुकड़ा","tornado":"बवंडर","birthday cake":"जन्मदिन का केक",
    "ice cream sundae":"आइसक्रीम","pizza":"पिज़्ज़ा","cookie":"बिस्कुट","cupcake":"कपकेक",
    "lollipop":"लॉलीपॉप","donut":"डोनट","sandwich":"सैंडविच","popcorn":"पॉपकॉर्न","sushi":"सुशी",
    "teddy bear":"टेडी बियर","kite":"पतंग","bicycle":"साइकिल","skateboard":"स्केटबोर्ड",
    "guitar":"गिटार","drum kit":"ड्रम","telescope":"दूरबीन","microscope":"सूक्ष्मदर्शी",
    "camera":"कैमरा","crown":"मुकुट","bunny":"खरगोश","hamster":"हैम्स्टर","puppy":"पिल्ला",
    "kitten":"बिल्ली का बच्चा","goldfish":"सुनहरी मछली","frog":"मेंढक","snail":"घोंघा",
    "ladybug":"लेडीबर्ड","bee":"मधुमक्खी","firefly":"जुगनू","superhero":"सुपरहीरो",
    "astronaut":"अंतरिक्ष यात्री","chef":"रसोइया","firefighter":"अग्निशामक","explorer":"खोजकर्ता",
    "inventor":"आविष्कारक","time traveler":"समय यात्री","ninja":"निंजा","cowboy":"काउबॉय",
    "detective":"जासूस","magic wand":"जादू की छड़ी","treasure chest":"खजाने का संदूक",
    "map":"नक्शा","compass":"दिशा सूचक","lantern":"लालटेन","hourglass":"रेत घड़ी",
    "crystal ball":"क्रिस्टल बॉल","flying carpet":"उड़ने वाला कालीन","magic lamp":"जादुई दीपक",
    "portal":"पोर्टल",
  },
};

export function getTranslatedDailyWord(word, lang) {
  return DAILY_WORDS_I18N[lang]?.[word] ?? word;
}

export function buildPrompt(subject, difficulty = "medium", size = "medium") {
  const base = [
    "every outline is a fully closed loop",
    "no open line ends",
    "flat white interior",
    "pure solid white fills",
    "white background",
    "no color",
    "no gradients",
    "no shading",
    "no shadows",
    "no stippling",
    "no dots",
    "no dashed lines",
    "no crosshatching",
    "no texture",
    "no realism",
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
