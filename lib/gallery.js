"use strict";
// Gallery manager — permanent pre-generated coloring page library.
// Images stored in data/images/g/ on server filesystem (Docker volume-mounted).
// Manifest stored in data/gallery.json on the server filesystem.

const fs   = require("fs");
const path = require("path");
const { buildPrompt, generateImage } = require("./image-providers");

const DATA_DIR    = path.join(__dirname, "../data");
const GALLERY_FILE = path.join(DATA_DIR, "gallery.json");
const IMAGES_DIR  = path.join(DATA_DIR, "images", "g");
const MAX_PER_SLOT = 9; // images per topic+difficulty in the gallery
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "novita";

// Mirror of data.js DAILY_WORDS — used server-side for today's page.
const DAILY_WORDS = [
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

// English DAILY_WORDS → lowercase ASCII German slugs (used in /ausmalbilder/taeglich/ URLs).
const DE_DAILY_WORDS = {
  "butterfly":"schmetterling","dragon":"drache","castle":"burg","rocket ship":"rakete",
  "cat":"katze","unicorn":"einhorn","dinosaur":"dinosaurier","elephant":"elefant",
  "robot":"roboter","mermaid":"meerjungfrau","pirate":"pirat","wizard":"zauberer",
  "fairy":"fee","knight":"ritter","princess":"prinzessin","phoenix":"phoenix",
  "tiger":"tiger","panda":"panda","koala":"koala","giraffe":"giraffe",
  "penguin":"pinguin","dolphin":"delfin","turtle":"schildkroete","fox":"fuchs",
  "bear":"baer","lion":"loewe","owl":"eule","parrot":"papagei",
  "octopus":"oktopus","seahorse":"seepferdchen","treehouse":"baumhaus",
  "submarine":"uboot","spaceship":"raumschiff","lighthouse":"leuchtturm",
  "hot air balloon":"heissluftballon","train":"zug","fire truck":"feuerwehrauto",
  "pirate ship":"piratenschiff","igloo":"iglu","windmill":"windmuehle",
  "rainbow":"regenbogen","waterfall":"wasserfall","volcano":"vulkan","iceberg":"eisberg",
  "cave":"hoehle","garden":"garten","jungle":"dschungel","desert":"wueste",
  "snowflake":"schneeflocke","tornado":"tornado","birthday cake":"geburtstagskuchen",
  "ice cream sundae":"eisbecher","pizza":"pizza","cookie":"keks","cupcake":"muffin",
  "lollipop":"lutscher","donut":"donut","sandwich":"sandwich","popcorn":"popcorn",
  "sushi":"sushi","teddy bear":"teddybaer","kite":"lenkdrachen","bicycle":"fahrrad",
  "skateboard":"skateboard","guitar":"gitarre","drum kit":"schlagzeug",
  "telescope":"teleskop","microscope":"mikroskop","camera":"kamera","crown":"krone",
  "bunny":"hase","hamster":"hamster","puppy":"welpe","kitten":"kaetzchen",
  "goldfish":"goldfisch","frog":"frosch","snail":"schnecke","ladybug":"marienkaefer",
  "bee":"biene","firefly":"gluehwuermchen","superhero":"superheld","astronaut":"astronaut",
  "chef":"koch","firefighter":"feuerwehrmann","explorer":"entdecker","inventor":"erfinder",
  "time traveler":"zeitreisender","ninja":"ninja","cowboy":"cowboy","detective":"detektiv",
  "magic wand":"zauberstab","treasure chest":"schatztruhe","map":"karte",
  "compass":"kompass","lantern":"laterne","hourglass":"sanduhr",
  "crystal ball":"kristallkugel","flying carpet":"fliegenderteppich",
  "magic lamp":"wunderlampe","portal":"portal",
};

// Per-topic metadata: emoji, display name, and subject variants used for generation.
// Each variant is a slightly different take on the topic so the gallery has variety.
const TOPIC_META = {
  dragon: {
    emoji: "🐉", name: "Dragon",
    subjects: ["cute baby dragon","dragon flying over mountains","fire-breathing dragon","dragon curled up sleeping","dragon with spread wings","dragon guarding treasure","small friendly dragon"],
  },
  unicorn: {
    emoji: "🦄", name: "Unicorn",
    subjects: ["magical unicorn in meadow","unicorn with rainbow mane","baby unicorn playing","unicorn jumping over rainbow","unicorn in enchanted forest","unicorn with flowers","running unicorn"],
  },
  butterfly: {
    emoji: "🦋", name: "Butterfly",
    subjects: ["butterfly on a flower","colorful butterfly with big wings","butterfly in a garden","two butterflies flying","butterfly emerging from cocoon","monarch butterfly","butterfly with geometric wings"],
  },
  dinosaur: {
    emoji: "🦕", name: "Dinosaur",
    subjects: ["friendly triceratops","baby t-rex","long-neck brachiosaurus","stegosaurus with spiky back","pterodactyl flying","velociraptor running","cute dinosaur hatching from egg"],
  },
  cat: {
    emoji: "🐱", name: "Cat",
    subjects: ["fluffy cat sitting","kitten playing with yarn","cat curled up sleeping","cat jumping","playful kitten","cat on a windowsill","cat chasing a butterfly"],
  },
  princess: {
    emoji: "👸", name: "Princess",
    subjects: ["princess in a castle tower","princess with a crown","princess and a dragon","princess in a magical forest","princess dancing at a ball","princess with a magic wand","princess riding a horse"],
  },
  mermaid: {
    emoji: "🧜", name: "Mermaid",
    subjects: ["mermaid swimming underwater","mermaid sitting on a rock","mermaid with long flowing hair","mermaid with sea creatures","baby mermaid exploring coral reef","mermaid holding a pearl","mermaid with a dolphin"],
  },
  rocket: {
    emoji: "🚀", name: "Rocket",
    subjects: ["rocket launching into space","rocket flying past planets","cute rocket ship","rocket landing on the moon","rocket with astronaut window","rocket and shooting stars","small rocket with booster flames"],
  },
  schultuete: {
    emoji: "🎒", name: "Schultüte", seasonal: true,
    subjects: ["school cone bag with gifts and ribbons","colorful Schultüte with school supplies","large paper cone filled with sweets","decorated school starting cone bag","traditional German school cone with bow"],
  },
  einschulung: {
    emoji: "✏️", name: "Einschulung", seasonal: true,
    subjects: ["excited child on first day of school with backpack","child holding a Schultüte at school entrance","happy students with teacher in classroom","first grader with pencils and school supplies","children at school gate with parents"],
  },
};

const TOPICS = Object.keys(TOPIC_META);
const DIFFICULTIES = ["easy", "medium", "hard"];

// ── Manifest read/write ──────────────────────────────────────────────────────

function getGallery() {
  try {
    return JSON.parse(fs.readFileSync(GALLERY_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveGallery(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(GALLERY_FILE, JSON.stringify(data, null, 2), "utf8");
}

function getImages(topic, difficulty) {
  const gallery = getGallery();
  return (gallery[topic]?.[difficulty] || []).slice(0, MAX_PER_SLOT);
}

function getAllForTopic(topic) {
  const gallery = getGallery();
  const topicData = gallery[topic] || {};
  return {
    easy:   (topicData.easy   || []).slice(0, MAX_PER_SLOT),
    medium: (topicData.medium || []).slice(0, MAX_PER_SLOT),
    hard:   (topicData.hard   || []).slice(0, MAX_PER_SLOT),
  };
}

function getTodayEntry() {
  const gallery = getGallery();
  const dateKey = todayKey();
  return (gallery._daily || {})[dateKey] || null;
}

function getDailyEntry(dateKey) {
  const gallery = getGallery();
  return (gallery._daily || {})[dateKey] || null;
}

function getDailyWord() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return {
    word: DAILY_WORDS[dayIndex % DAILY_WORDS.length],
    seed: (dayIndex * 1000003) % 2147483647,
    date: todayKey(),
  };
}

function getDailyWordForDate(dateKey) {
  // Compute the daily word for an arbitrary YYYY-MM-DD date.
  // Uses T12:00:00Z to avoid UTC-boundary off-by-one across timezones.
  const dayIndex = Math.floor(new Date(dateKey + "T12:00:00Z").getTime() / 86400000);
  return DAILY_WORDS[dayIndex % DAILY_WORDS.length];
}

function getDailyWordDE() {
  const { word, date } = getDailyWord();
  return { word: DE_DAILY_WORDS[word] || word, date };
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

// ── Image generation ─────────────────────────────────────────────────────────

async function generateAndUpload(subject, difficulty, slugPrefix) {
  const prompt    = buildPrompt(subject, difficulty, "medium", "structured");
  const seed      = Math.floor(Math.random() * 2_000_000_000);
  const generated = await generateImage(prompt, 1024, 1024, seed, {
    provider: IMAGE_PROVIDER,
    hfToken:  process.env.HF_TOKEN,
    hfModel:  process.env.HF_MODEL,
  });
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const ext      = generated.contentType === "image/jpeg" ? "jpg" : "png";
  const filename = `${slugPrefix}-${seed}.${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, filename), generated.buffer);
  return { url: `/img/g/${filename}`, seed };
}

async function addToGallery(topic, difficulty, subject, url) {
  const gallery = getGallery();
  if (!gallery[topic])             gallery[topic] = {};
  if (!gallery[topic][difficulty]) gallery[topic][difficulty] = [];
  const entry = { id: `${topic}-${difficulty}-${Date.now()}`, subject, url, date: todayKey() };
  gallery[topic][difficulty].unshift(entry); // newest first
  gallery[topic][difficulty] = gallery[topic][difficulty].slice(0, MAX_PER_SLOT);
  saveGallery(gallery);
  return entry;
}

async function addDailyImage(word, difficulty, url) {
  const gallery = getGallery();
  if (!gallery._daily) gallery._daily = {};
  const key = todayKey();
  if (!gallery._daily[key]) gallery._daily[key] = { word, images: [] };
  gallery._daily[key].images.push({ difficulty, url, date: key });
  // Prune old daily entries (keep last 30 days)
  const keys = Object.keys(gallery._daily).sort().slice(-30);
  gallery._daily = Object.fromEntries(keys.map(k => [k, gallery._daily[k]]));
  saveGallery(gallery);
}

module.exports = {
  TOPIC_META, TOPICS, DIFFICULTIES, DAILY_WORDS, DE_DAILY_WORDS, MAX_PER_SLOT,
  getGallery, saveGallery, getImages, getAllForTopic,
  getDailyWord, getDailyWordForDate, getDailyWordDE, getTodayEntry, getDailyEntry,
  generateAndUpload, addToGallery, addDailyImage,
};
