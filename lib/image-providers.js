"use strict";

const { URL } = require("url");

function buildPrompt(subject, difficulty = "medium") {
  const diffHint = {
    easy:    "only 3-4 very large simple shapes, no small details, toddler coloring book",
    medium:  "simple cartoon with 6-10 clearly enclosed regions",
    hard:    "detailed cartoon with many small fully enclosed decorative regions",
    extreme: "ultra-intricate zentangle-style illustration with dozens of tiny fully enclosed cells and dense ornamental patterns covering every surface, maximum complexity, expert coloring book",
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
    "every panel door and window has a fully closed border",
    "no gradients",
    "no color",
    "no detail strokes inside shapes",
    diffHint,
    "clean professional coloring book illustration",
    "no text",
    "no watermark",
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
