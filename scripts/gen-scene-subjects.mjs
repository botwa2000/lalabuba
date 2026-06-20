// Builds flutter_app/assets/data/scene_subjects.json: a complete en->{locale}
// translation table for every Sticker-Scenes subject, so the scene-of-week pill
// (and anything else) shows the child's language instead of raw English.
// Pulls existing translations from daily_words.json where present, and supplies
// the rest from the hand map below. Run: node scripts/gen-scene-subjects.mjs
import fs from 'fs';
import path from 'path';

const repo = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(repo, 'flutter_app/assets/data');
const LOCALES = ['de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'tr', 'zh', 'hi'];

// The full scene subject pool (must match kSceneSubjects in scenes.dart / SCENE_SUBJECTS).
const SUBJECTS = [
  'butterfly', 'flower', 'rabbit', 'fox', 'tree', 'bee', 'ladybug',
  'penguin', 'polar bear', 'seal', 'snowman', 'whale', 'snowflake',
  'fish', 'octopus', 'dolphin', 'turtle', 'crab', 'shark', 'seahorse',
  'car', 'bus', 'house', 'dog', 'bicycle', 'fire truck', 'train',
  'rocket', 'planet', 'astronaut', 'alien', 'star', 'moon', 'comet',
];

// Hand translations for subjects NOT covered by daily_words.json. Order: de,es,fr,it,nl,pl,pt,ru,tr,zh,hi.
const HAND = {
  flower:       ['Blume', 'flor', 'fleur', 'fiore', 'bloem', 'kwiat', 'flor', 'цветок', 'çiçek', '花', 'फूल'],
  rabbit:       ['Kaninchen', 'conejo', 'lapin', 'coniglio', 'konijn', 'królik', 'coelho', 'кролик', 'tavşan', '兔子', 'खरगोश'],
  tree:         ['Baum', 'árbol', 'arbre', 'albero', 'boom', 'drzewo', 'árvore', 'дерево', 'ağaç', '树', 'पेड़'],
  'polar bear': ['Eisbär', 'oso polar', 'ours polaire', 'orso polare', 'ijsbeer', 'niedźwiedź polarny', 'urso polar', 'белый медведь', 'kutup ayısı', '北极熊', 'ध्रुवीय भालू'],
  seal:         ['Robbe', 'foca', 'phoque', 'foca', 'zeehond', 'foka', 'foca', 'тюлень', 'fok', '海豹', 'सील'],
  snowman:      ['Schneemann', 'muñeco de nieve', 'bonhomme de neige', 'pupazzo di neve', 'sneeuwpop', 'bałwan', 'boneco de neve', 'снеговик', 'kardan adam', '雪人', 'हिममानव'],
  whale:        ['Wal', 'ballena', 'baleine', 'balena', 'walvis', 'wieloryb', 'baleia', 'кит', 'balina', '鲸鱼', 'व्हेल'],
  fish:         ['Fisch', 'pez', 'poisson', 'pesce', 'vis', 'ryba', 'peixe', 'рыба', 'balık', '鱼', 'मछली'],
  crab:         ['Krabbe', 'cangrejo', 'crabe', 'granchio', 'krab', 'krab', 'caranguejo', 'краб', 'yengeç', '螃蟹', 'केकड़ा'],
  car:          ['Auto', 'coche', 'voiture', 'automobile', 'auto', 'samochód', 'carro', 'машина', 'araba', '汽车', 'कार'],
  bus:          ['Bus', 'autobús', 'bus', 'autobus', 'bus', 'autobus', 'ônibus', 'автобус', 'otobüs', '公共汽车', 'बस'],
  house:        ['Haus', 'casa', 'maison', 'casa', 'huis', 'dom', 'casa', 'дом', 'ev', '房子', 'घर'],
  rocket:       ['Rakete', 'cohete', 'fusée', 'razzo', 'raket', 'rakieta', 'foguete', 'ракета', 'roket', '火箭', 'रॉकेट'],
  planet:       ['Planet', 'planeta', 'planète', 'pianeta', 'planeet', 'planeta', 'planeta', 'планета', 'gezegen', '行星', 'ग्रह'],
  alien:        ['Außerirdischer', 'extraterrestre', 'extraterrestre', 'alieno', 'buitenaards wezen', 'kosmita', 'alienígena', 'инопланетянин', 'uzaylı', '外星人', 'एलियन'],
  star:         ['Stern', 'estrella', 'étoile', 'stella', 'ster', 'gwiazda', 'estrela', 'звезда', 'yıldız', '星星', 'तारा'],
  moon:         ['Mond', 'luna', 'lune', 'luna', 'maan', 'księżyc', 'lua', 'луна', 'ay', '月亮', 'चंद्रमा'],
  comet:        ['Komet', 'cometa', 'comète', 'cometa', 'komeet', 'kometa', 'cometa', 'комета', 'kuyruklu yıldız', '彗星', 'धूमकेतु'],
  shark:        ['Hai', 'tiburón', 'requin', 'squalo', 'haai', 'rekin', 'tubarão', 'акула', 'köpekbalığı', '鲨鱼', 'शार्क'],
  dog:          ['Hund', 'perro', 'chien', 'cane', 'hond', 'pies', 'cachorro', 'собака', 'köpek', '狗', 'कुत्ता'],
};

const dw = JSON.parse(fs.readFileSync(path.join(dataDir, 'daily_words.json'), 'utf8'));
const dwTrans = dw.translations || {};

const out = {};
const missing = [];
for (const en of SUBJECTS) {
  const row = {};
  for (const loc of LOCALES) {
    let v = (dwTrans[loc] || {})[en];           // 1) reuse daily-word translation
    if (!v && HAND[en]) v = HAND[en][LOCALES.indexOf(loc)]; // 2) hand map
    if (v) row[loc] = v;
    else missing.push(`${en}/${loc}`);
  }
  out[en] = row;
}

if (missing.length) {
  console.error('MISSING translations:', missing.join(', '));
  process.exit(1);
}

const file = path.join(dataDir, 'scene_subjects.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`wrote ${file}: ${SUBJECTS.length} subjects × ${LOCALES.length} locales`);
