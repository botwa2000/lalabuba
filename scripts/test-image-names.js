// Descriptive picture URLs (lib/image-names.js) and the image sitemap (growth plan L3).
// Stubs the library so it runs without the server's gallery.json.
const assert = require("assert");
const gallery = require("../lib/gallery");

const LIB = {
  car: { easy: [{ slug: "tow-easy", url: "/img/g/car-easy-1.png" }], medium: [], hard: [{ slug: "sporty-hard", url: "/img/g/car-hard-2.png" }] },
  dragon: { easy: [{ slug: "dragon-easy-9", url: "/img/g/dragon-easy-9.jpg" }], medium: [], hard: [] },
  firetruck: { easy: [{ slug: "firetruck-easy-1", url: "/img/g/firetruck-easy-9.jpg" }], medium: [], hard: [] },
};
gallery.getAllForTopic = (t) => LIB[t] || {};
gallery.hasImages = (t) => !!LIB[t];

const names = require("../lib/image-names");
const sitemap = require("../lib/sitemap");

// Each language uses its own topic slug in folder and file name.
assert.strictEqual(names.pictureUrl("tr", "car", LIB.car.hard[0]), "/img/p/araba/araba-sporty-hard.png");
assert.strictEqual(names.pictureUrl("pl", "car", LIB.car.easy[0]), "/img/p/samochod/samochod-tow-easy.png");
assert.strictEqual(names.pictureUrl("de", "car", LIB.car.easy[0]), "/img/p/auto/auto-tow-easy.png");
assert.strictEqual(names.pictureUrl("en", "car", LIB.car.easy[0]), "/img/p/car/car-tow-easy.png");
assert.strictEqual(names.pictureUrl("fr", "firetruck", LIB.firetruck.easy[0]), "/img/p/camion-de-pompiers/camion-de-pompiers-firetruck-easy-1.jpg");
assert.strictEqual(names.pictureUrl("tr", "car", { slug: "x" }), null, "entry without a stored file");
assert.strictEqual(names.pictureUrl("en", "dragon", LIB.dragon.easy[0]), "/img/p/dragon/dragon-easy-9.jpg", "no doubled prefix");
assert.strictEqual(names.pictureUrl("tr", "dragon", LIB.dragon.easy[0]), "/img/p/ejderha/ejderha-dragon-easy-9.jpg");
assert.strictEqual(names.resolve("dragon", "dragon-easy-9.jpg").url, "/img/g/dragon-easy-9.jpg");
assert.strictEqual(names.resolve("ejderha", "ejderha-dragon-easy-9.jpg").url, "/img/g/dragon-easy-9.jpg");

// …and resolve back to the stored file, also where one slug starts with another ("camion" vs "camion-de-pompiers").
assert.strictEqual(names.resolve("araba", "araba-sporty-hard.png").url, "/img/g/car-hard-2.png");
assert.strictEqual(names.resolve("auto", "auto-tow-easy.png").url, "/img/g/car-easy-1.png");
assert.strictEqual(names.resolve("camion-de-pompiers", "camion-de-pompiers-firetruck-easy-1.jpg").url, "/img/g/firetruck-easy-9.jpg");
assert.strictEqual(names.resolve("araba", "araba-sporty-hard.jpg"), null, "wrong extension");
assert.strictEqual(names.resolve("araba", "kedi-sporty-hard.png"), null, "file must start with the folder's slug");
assert.strictEqual(names.resolve("araba", "araba-nope.png"), null, "unknown picture");
assert.strictEqual(names.resolve("nope", "nope-tow-easy.png"), null, "unknown topic slug");

// Image sitemap: one <url> per picture page per language, each with its descriptive image.
const xml = sitemap._buildImages();
assert.ok(xml.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'));
assert.ok(xml.includes("<loc>https://lalabuba.com/boyama-sayfalari/araba/sporty-hard/</loc><image:image><image:loc>https://lalabuba.com/img/p/araba/araba-sporty-hard.png</image:loc>"));
assert.ok(xml.includes("<loc>https://lalabuba.com/de/ausmalbilder/auto/tow-easy/</loc>"));
const n = (xml.match(/<url>/g) || []).length;
assert.strictEqual(n, 4 * 12, `4 pictures × 12 languages, got ${n}`);
console.log("image-names: all checks passed");
