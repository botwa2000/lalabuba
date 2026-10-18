"use strict";
// Localised labels for gallery generation subjects, keyed lang → English subject.
// Shown on topic-page cards, image pages and the app's Explore grid instead of the
// English prompt text. gallery.subjectLabel() falls back to English when missing.
// German lives here for new topics and is merged into gallery.DE_SUBJECT_LABELS.

const CAR = [
  "cute cartoon car with big wheels and a happy face",
  "classic vintage car with round headlights",
  "sporty race car with stripes and a big spoiler",
  "convertible car driving along the seaside",
  "monster truck with giant tires",
  "camper van parked at a campsite by a lake",
  "family car with suitcases on the roof rack",
  "off-road jeep driving through the jungle",
  "tow truck pulling a little broken-down car",
];

// One row per language, in CAR order.
const CAR_LABELS = {
  de: ["Fröhliches Auto mit großen Rädern", "Oldtimer mit runden Scheinwerfern", "Rennwagen mit Streifen und Heckspoiler", "Cabrio an der Küste", "Monstertruck mit Riesenreifen", "Wohnmobil am See", "Familienauto mit Koffern auf dem Dach", "Geländewagen im Dschungel", "Abschleppwagen mit kleinem Auto"],
  fr: ["Voiture rigolote aux grosses roues", "Voiture ancienne aux phares ronds", "Voiture de course à bandes avec aileron", "Cabriolet au bord de la mer", "Monster truck aux pneus géants", "Camping-car au bord d’un lac", "Voiture familiale avec valises sur le toit", "Jeep tout-terrain dans la jungle", "Dépanneuse qui remorque une petite voiture"],
  es: ["Coche alegre con ruedas grandes", "Coche clásico con faros redondos", "Coche de carreras con rayas y alerón", "Descapotable junto al mar", "Monster truck con ruedas gigantes", "Autocaravana junto a un lago", "Coche familiar con maletas en el techo", "Todoterreno en la selva", "Grúa remolcando un cochecito"],
  pt: ["Carrinho alegre com rodas grandes", "Carro antigo com faróis redondos", "Carro de corrida com listras e aerofólio", "Conversível à beira-mar", "Monster truck com pneus gigantes", "Motorhome à beira de um lago", "Carro da família com malas no teto", "Jipe na selva", "Guincho rebocando um carrinho"],
  ru: ["Весёлая машинка с большими колёсами", "Ретро-автомобиль с круглыми фарами", "Гоночная машина с полосками и спойлером", "Кабриолет у моря", "Монстр-трак с огромными колёсами", "Дом на колёсах у озера", "Семейная машина с чемоданами на крыше", "Внедорожник в джунглях", "Эвакуатор везёт маленькую машинку"],
  it: ["Macchinina allegra con ruote grandi", "Auto d’epoca con fari rotondi", "Auto da corsa con strisce e alettone", "Cabriolet in riva al mare", "Monster truck con ruote giganti", "Camper in riva a un lago", "Auto di famiglia con valigie sul tetto", "Fuoristrada nella giungla", "Carro attrezzi che traina una macchinina"],
  nl: ["Vrolijk autootje met grote wielen", "Oldtimer met ronde koplampen", "Raceauto met strepen en spoiler", "Cabrio langs de kust", "Monstertruck met reuzenbanden", "Camper bij een meer", "Gezinsauto met koffers op het dak", "Jeep in de jungle", "Takelwagen met een klein autootje"],
  pl: ["Wesoły samochodzik z dużymi kołami", "Zabytkowy samochód z okrągłymi reflektorami", "Wyścigówka w paski ze spojlerem", "Kabriolet nad morzem", "Monster truck z ogromnymi oponami", "Kamper nad jeziorem", "Rodzinne auto z walizkami na dachu", "Terenówka w dżungli", "Laweta holująca mały samochodzik"],
  tr: ["Kocaman tekerlekli neşeli araba", "Yuvarlak farlı klasik araba", "Çizgili, rüzgârlıklı yarış arabası", "Deniz kenarında üstü açık araba", "Dev tekerlekli canavar kamyon", "Göl kenarında karavan", "Tavanında bavullar olan aile arabası", "Ormanda arazi aracı", "Küçük arabayı çeken çekici"],
  zh: ["大轮子的快乐小汽车", "圆车灯的老爷车", "带条纹和尾翼的赛车", "海边的敞篷车", "大轮胎怪兽卡车", "湖边的房车", "车顶放着行李箱的家庭轿车", "丛林里的越野车", "拖着小汽车的拖车"],
  hi: ["बड़े पहियों वाली खुशमिज़ाज कार", "गोल हेडलाइट वाली पुरानी कार", "धारियों और स्पॉइलर वाली रेस कार", "समुद्र किनारे खुली छत वाली कार", "विशाल टायरों वाला मॉन्स्टर ट्रक", "झील के किनारे कैंपर वैन", "छत पर सूटकेस वाली परिवार की कार", "जंगल में ऑफ-रोड जीप", "छोटी कार को खींचता टो ट्रक"],
};

const SUBJECT_LABELS = {};
for (const [lang, labels] of Object.entries(CAR_LABELS)) {
  if (labels.length !== CAR.length) throw new Error(`subject-labels: ${lang} has ${labels.length} car labels, need ${CAR.length}`);
  SUBJECT_LABELS[lang] = Object.fromEntries(CAR.map((s, i) => [s, labels[i]]));
}

module.exports = { SUBJECT_LABELS };
