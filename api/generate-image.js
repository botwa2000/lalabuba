const { sanitizeSubject, isSafeSubject } = require("../lib/content-safety");
const { buildPrompt, generateImage } = require("../lib/image-providers");

const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "huggingface";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const body = req.body || {};
    const subject    = sanitizeSubject(body.subject);
    const difficulty = ["easy", "medium", "hard", "extreme"].includes(body.difficulty) ? body.difficulty : "medium";
    const width      = [512, 768, 1024].includes(body.width)  ? body.width  : 1024;
    const height     = [512, 768, 1024].includes(body.height) ? body.height : 1024;
    const seedRaw    = Number(body.seed);
    const seed       = (Number.isFinite(seedRaw) && seedRaw > 0) ? Math.floor(seedRaw) : Math.floor(Math.random() * 2_000_000_000);

    if (!subject) {
      res.status(400).json({ error: "Please provide a subject to draw." });
      return;
    }

    if (!isSafeSubject(subject)) {
      res.status(400).json({ error: "Please choose a fun topic for kids — animals, vehicles, fantasy creatures, food…" });
      return;
    }

    const prompt = buildPrompt(subject, difficulty);
    const result = await generateImage(prompt, width, height, seed, {
      provider: IMAGE_PROVIDER,
      hfToken: HF_TOKEN,
      hfModel: HF_MODEL,
    });

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Image-Seed", String(seed));
    res.setHeader("Access-Control-Expose-Headers", "X-Image-Seed");
    res.status(200).send(result.buffer);
  } catch (error) {
    res.status(500).json({ error: error.message || "Image generation failed." });
  }
};
