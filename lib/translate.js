"use strict";
// Translates a subject to English when it contains non-Latin characters.
// Uses claude-haiku for cost-effective, low-latency translation.
// Returns the original string unchanged if it's already Latin-only or
// if ANTHROPIC_API_KEY is not configured.

const Anthropic = require("@anthropic-ai/sdk");

// Matches characters outside Basic Latin + Latin Extended (covers Cyrillic,
// Arabic, CJK, Hebrew, Hindi, etc.)
function isNonLatin(text) {
  return /[^\u0000-\u024F]/.test(text);
}

let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

async function translateToEnglish(text) {
  if (!isNonLatin(text)) return text;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[translate] No ANTHROPIC_API_KEY — subject used as-is");
    return text;
  }
  try {
    const msg = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64,
      messages: [{
        role: "user",
        content: `Translate to English. Reply with the translated phrase only, no explanation: ${text}`,
      }],
    });
    const translated = (msg.content[0]?.text || "").trim();
    console.log(`[translate] "${text}" → "${translated}"`);
    return translated || text;
  } catch (err) {
    console.warn("[translate] Failed, using original:", err.message);
    return text;
  }
}

module.exports = { translateToEnglish, isNonLatin };
