const { URL } = require("url");

const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "huggingface";

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

async function generateWithPollinations(prompt, width = 1024, height = 1024) {
  const u = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  u.searchParams.set("width",   String(width));
  u.searchParams.set("height",  String(height));
  u.searchParams.set("nologo",  "true");
  u.searchParams.set("model",   "flux");
  u.searchParams.set("enhance", "false");
  u.searchParams.set("safe",    "true");
  u.searchParams.set("seed",    String(Math.floor(Math.random() * 2_000_000_000)));
  u.searchParams.set("referrer","lalabuba");

  const upstream = await fetch(u.toString(), {
    headers: { Accept: "image/*", "User-Agent": "lalabuba/1.0" },
  });

  if (!upstream.ok) {
    const details = await upstream.text();
    throw new Error(`Pollinations failed (${upstream.status}): ${details.slice(0, 200)}`);
  }

  return {
    contentType: upstream.headers.get("content-type") || "image/png",
    buffer: Buffer.from(await upstream.arrayBuffer()),
  };
}

async function generateWithHuggingFace(prompt, width = 1024, height = 1024) {
  if (!HF_TOKEN) {
    throw new Error(
      "No HF_TOKEN set. Add your Hugging Face token in Vercel Environment Variables."
    );
  }

  const upstream = await fetch(
    `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(HF_MODEL)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { width, height, guidance_scale: 3.5, num_inference_steps: 8 },
      }),
    }
  );

  if (!upstream.ok) {
    const details = await upstream.text();
    throw new Error(`Hugging Face failed (${upstream.status}): ${details.slice(0, 300)}`);
  }

  return {
    contentType: upstream.headers.get("content-type") || "image/jpeg",
    buffer: Buffer.from(await upstream.arrayBuffer()),
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const body = req.body || {};
    const subject    = sanitizeSubject(body.subject);
    const difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
    const width      = [512, 768, 1024].includes(body.width)  ? body.width  : 1024;
    const height     = [512, 768, 1024].includes(body.height) ? body.height : 1024;

    if (!subject) {
      res.status(400).json({ error: "Please provide a subject to draw." });
      return;
    }

    const prompt = buildPrompt(subject, difficulty);
    let result;
    if (IMAGE_PROVIDER === "pollinations") {
      result = await generateWithPollinations(prompt, width, height);
    } else {
      result = await generateWithHuggingFace(prompt, width, height);
    }

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(result.buffer);
  } catch (error) {
    res.status(500).json({ error: error.message || "Image generation failed." });
  }
};
