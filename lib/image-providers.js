"use strict";

const { URL } = require("url");

function buildPrompt(subject, difficulty = "medium") {
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

function buildPollinationsUrl(prompt, width, height, seed) {
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  url.searchParams.set("width",   String(width));
  url.searchParams.set("height",  String(height));
  url.searchParams.set("nologo",  "true");
  url.searchParams.set("model",   "flux");
  url.searchParams.set("enhance", "false");
  url.searchParams.set("safe",    "true");
  url.searchParams.set("seed",    String(seed));
  url.searchParams.set("referrer","lalabuba");
  return url.toString();
}

async function generateWithPollinations(prompt, width, height, seed) {
  const upstream = await fetch(buildPollinationsUrl(prompt, width, height, seed), {
    headers: {
      Accept: "image/*",
      "User-Agent": "lalabuba/1.0",
    },
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

async function generateWithHuggingFace(prompt, width, height, seed, hfToken, hfModel) {
  if (!hfToken) {
    throw new Error(
      "No HF_TOKEN set. Add your free Hugging Face token to the .env file. " +
      "Get one free at https://huggingface.co/settings/tokens"
    );
  }

  const upstream = await fetch(`https://router.huggingface.co/hf-inference/models/${encodeURIComponent(hfModel)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        width,
        height,
        guidance_scale: 3.5,
        num_inference_steps: 8,
        seed,
      },
    }),
  });

  if (!upstream.ok) {
    const details = await upstream.text();
    throw new Error(`Hugging Face failed (${upstream.status}): ${details.slice(0, 300)}`);
  }

  return {
    contentType: upstream.headers.get("content-type") || "image/jpeg",
    buffer: Buffer.from(await upstream.arrayBuffer()),
  };
}

function isQuotaError(err) {
  const msg = (err.message || "").toLowerCase();
  return msg.includes("402") || msg.includes("429") ||
         msg.includes("credit") || msg.includes("quota") ||
         msg.includes("limit") || msg.includes("exceeded") ||
         msg.includes("payment") || msg.includes("billing") ||
         msg.includes("depleted");
}

/**
 * Generate an image.
 * @param {string} prompt
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @param {{ provider: string, hfToken: string|undefined, hfModel: string }} opts
 * @returns {Promise<{ contentType: string, buffer: Buffer }>}
 */
async function generateImage(prompt, width = 1024, height = 1024, seed, opts = {}) {
  const { provider = "huggingface", hfToken, hfModel = "black-forest-labs/FLUX.1-schnell" } = opts;

  if (provider === "pollinations") {
    return generateWithPollinations(prompt, width, height, seed);
  }

  // HuggingFace with automatic Pollinations fallback on quota/limit errors.
  try {
    return await generateWithHuggingFace(prompt, width, height, seed, hfToken, hfModel);
  } catch (err) {
    if (isQuotaError(err)) {
      console.warn(`HuggingFace quota error — falling back to Pollinations. (${err.message.slice(0, 80)})`);
      return generateWithPollinations(prompt, width, height, seed);
    }
    throw err;
  }
}

module.exports = { buildPrompt, generateImage };
