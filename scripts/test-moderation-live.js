// Measures the REAL moderation pipeline against the labelled corpora in
// scripts/fixtures: original words, then translation, then the translated check, as
// api/generate-image.js runs them. Needs DEEPINFRA_API_KEY, so it is not part of
// `npm test`. Re-run it after changing a policy text or a model:
//   docker exec -i <app container> /app/docker-entrypoint.sh node scripts/test-moderation-live.js
// Classification calls only: no pictures are generated. Exits non-zero below target.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const moderation = require(path.join(root, "lib/moderation"));
const { translateToEnglish } = require(path.join(root, "lib/translate"));

const TARGET_RECALL = 1.0;      // every unsafe phrase
const MAX_FALSE_POSITIVES = 0.02; // at most 2% of innocent subjects

async function pipeline(text) {
  const raw = await moderation.checkPrompt(text);
  if (!raw.allow) return { block: true, stage: "prompt" };
  const english = await translateToEnglish(text);
  const translated = await moderation.checkTranslated(english);
  return translated.allow ? { block: false, english } : { block: true, stage: "translated", english };
}

async function run(file) {
  const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", file), "utf8"));
  const items = [];
  for (const k of ["block", "allow"]) for (const g in corpus[k]) for (const t of corpus[k][g]) items.push({ k, g, t });
  const out = [];
  let i = 0;
  await Promise.all([0, 1, 2].map(async () => {
    while (i < items.length) {
      const it = items[i++];
      try { out.push({ ...it, ...(await pipeline(it.t)) }); }
      catch (e) { out.push({ ...it, err: e.message }); }
    }
  }));
  const errs = out.filter((r) => r.err);
  const ok = out.filter((r) => !r.err);
  const unsafe = ok.filter((r) => r.k === "block");
  const fine = ok.filter((r) => r.k === "allow");
  const missed = unsafe.filter((r) => !r.block);
  const wrong = fine.filter((r) => r.block);
  console.log(`\n${file}: unsafe blocked ${unsafe.length - missed.length}/${unsafe.length}, innocent wrongly blocked ${wrong.length}/${fine.length}, errors ${errs.length}`);
  console.log(`  caught on original words: ${unsafe.filter((r) => r.stage === "prompt").length}, caught after translation: ${unsafe.filter((r) => r.stage === "translated").length}`);
  if (missed.length) console.log("  MISSED: " + missed.map((r) => `${r.t} (${r.english})`).join(" | "));
  if (wrong.length) console.log("  WRONGLY BLOCKED: " + wrong.map((r) => `${r.t} [${r.stage}]`).join(" | "));
  if (errs.length) console.log("  ERROR SAMPLE: " + errs[0].err);
  return errs.length === 0 && missed.length / Math.max(1, unsafe.length) <= 1 - TARGET_RECALL
    && wrong.length / Math.max(1, fine.length) <= MAX_FALSE_POSITIVES;
}

(async () => {
  const a = await run("safety-corpus.json");
  const b = await run("safety-corpus-holdout.json");
  console.log(a && b ? "\nLIVE TARGETS MET" : "\nLIVE TARGETS NOT MET");
  process.exit(a && b ? 0 : 1);
})();
