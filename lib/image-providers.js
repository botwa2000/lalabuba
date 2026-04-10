"use strict";

const { URL } = require("url");

function buildPrompt(subject, difficulty = "medium", size = "medium") {
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

// ─── Quota / busy sentinel ────────────────────────────────────────────────────
// Generators throw new Error('__QUOTA__') when their free tier is exhausted or
// the service is temporarily rate-limited. generateImage() catches this and
// silently moves to the next tier.

function isQuotaOrBusy(err) {
  if (err.message === "__QUOTA__") return true;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("429") || msg.includes("busy") || msg.includes("quota") ||
         msg.includes("limit") || msg.includes("exceeded") || msg.includes("credit") ||
         msg.includes("payment") || msg.includes("billing") || msg.includes("depleted");
}

// ─── Tier 1: Pollinations (free, no key) ─────────────────────────────────────

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
  let upstream;
  try {
    upstream = await fetch(buildPollinationsUrl(prompt, width, height, seed), {
      headers: {
        Accept: "image/*",
        "User-Agent": "lalabuba/1.0",
      },
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    // Network error, timeout, or bot-challenge redirect — fall through to next provider
    console.warn("Pollinations network error:", err.message);
    throw new Error("__QUOTA__");
  }

  if (!upstream.ok) {
    // Any non-2xx (including Cloudflare bot blocks 403, rate limits 429, server errors 5xx)
    // → treat as temporarily unavailable and fall through to next provider
    console.warn(`Pollinations HTTP ${upstream.status} — falling through`);
    throw new Error("__QUOTA__");
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    // Returned JSON/text (NSFW flag, challenge page, etc.) — fall through to next provider
    throw new Error("__QUOTA__");
  }

  return {
    contentType,
    buffer: Buffer.from(await upstream.arrayBuffer()),
  };
}

// ─── Tier 2: Together AI (free tier ~10 000 imgs/month) ───────────────────────

async function generateWithTogetherAI(prompt, width, height, seed, apiKey) {
  const res = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX.1-schnell-Free",
      prompt, width, height, steps: 4, seed, n: 1,
      response_format: "b64_json",
    }),
  });
  if (!res.ok) {
    if (res.status === 429 || res.status === 402 || res.status >= 500) throw new Error("__QUOTA__");
    throw new Error(`Together AI failed (${res.status})`);
  }
  const json = await res.json();
  const buf = Buffer.from(json.data[0].b64_json, "base64");
  return { contentType: "image/png", buffer: buf };
}

// ─── Tier 3: Cloudflare Workers AI (~35–40 free imgs/day, cheap overage) ──────

async function generateWithCloudflare(prompt, width, height, seed, accountId, apiToken) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, num_steps: 8, width, height, seed }),
  });
  if (!res.ok) {
    if (res.status === 429 || res.status === 402 || res.status >= 500) throw new Error("__QUOTA__");
    throw new Error(`Cloudflare AI failed (${res.status})`);
  }
  return {
    contentType: res.headers.get("content-type") || "image/png",
    buffer: Buffer.from(await res.arrayBuffer()),
  };
}

// ─── Tier 4: Novita.ai (paid, ~$0.001–$0.003 per image) ──────────────────────

async function generateWithNovita(prompt, width, height, seed, apiKey) {
  // Step 1: request generation — returns a signed image URL
  const res = await fetch("https://api.novita.ai/v3beta/flux-1-schnell", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, width, height, steps: 4, seed, image_num: 1 }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Novita.ai failed (${res.status}): ${detail.slice(0, 120)}`);
  }
  const json = await res.json();
  const imageUrl = json.images?.[0]?.image_url;
  if (!imageUrl) throw new Error("Novita.ai returned no image URL");

  // Step 2: fetch the actual image bytes
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Novita.ai image fetch failed (${imgRes.status})`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  // Novita CDN returns octet-stream; detect type from magic bytes
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50; // PNG magic
  return { contentType: isPng ? "image/png" : "image/jpeg", buffer };
}

// ─── Legacy: HuggingFace ──────────────────────────────────────────────────────

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

// ─── Main entry point — waterfall across all tiers ───────────────────────────

/**
 * Generate an image, trying providers in order until one succeeds.
 * Tier 1 → Pollinations (free, no key)
 * Tier 2 → Together AI  (free ~10k/month, needs TOGETHER_API_KEY)
 * Tier 3 → Cloudflare   (free ~35/day, needs CF_ACCOUNT_ID + CF_API_TOKEN)
 * Tier 4 → Novita.ai    (paid ~$0.001–$0.003/img, needs NOVITA_API_KEY)
 * Fallback → HuggingFace (legacy, needs HF_TOKEN)
 */
async function generateImage(prompt, width = 1024, height = 1024, seed, opts = {}) {
  const { hfToken, hfModel = "black-forest-labs/FLUX.1-schnell" } = opts;

  const togetherKey = process.env.TOGETHER_API_KEY;
  const cfAccountId = process.env.CF_ACCOUNT_ID;
  const cfToken     = process.env.CF_API_TOKEN;
  const novitaKey   = process.env.NOVITA_API_KEY;

  // Tier 1: Pollinations
  try {
    return await generateWithPollinations(prompt, width, height, seed);
  } catch (err) {
    if (!isQuotaOrBusy(err)) throw err;
    console.warn("Pollinations busy — trying Together AI");
  }

  // Tier 2: Together AI
  if (togetherKey) {
    try {
      return await generateWithTogetherAI(prompt, width, height, seed, togetherKey);
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn("Together AI quota — trying Cloudflare");
    }
  }

  // Tier 3: Cloudflare Workers AI
  if (cfAccountId && cfToken) {
    try {
      return await generateWithCloudflare(prompt, width, height, seed, cfAccountId, cfToken);
    } catch (err) {
      if (!isQuotaOrBusy(err)) throw err;
      console.warn("Cloudflare quota — trying Novita.ai");
    }
  }

  // Tier 4: Novita.ai (paid)
  if (novitaKey) {
    return await generateWithNovita(prompt, width, height, seed, novitaKey);
  }

  // Legacy fallback: HuggingFace
  if (hfToken) {
    return await generateWithHuggingFace(prompt, width, height, seed, hfToken, hfModel);
  }

  throw new Error("The drawing service is busy right now — please try again in a moment! 🎨");
}

module.exports = { buildPrompt, generateImage };
