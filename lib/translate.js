"use strict";
// Translates a custom user subject to English before building the AI image prompt.
// Two free tiers — no Anthropic API needed:
//
//   Tier 1: DeepL Free  (set DEEPL_API_KEY)  — 500,000 chars/month free
//           Register free at https://www.deepl.com/pro-api
//           Free-tier keys end with ":fx"
//
//   Tier 2: MyMemory    (no key needed)       — 5,000 chars/day unregistered
//           Optional: set MYMEMORY_EMAIL for 50,000 chars/day
//
// Falls back to original text if both services fail (generation still runs,
// just with the untranslated subject).

async function translateWithDeepL(text, apiKey) {
  const isFree = apiKey.endsWith(":fx");
  const base   = isFree
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
  const res = await fetch(`${base}/v2/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ auth_key: apiKey, text, target_lang: "EN" }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`DeepL HTTP ${res.status}`);
  const data = await res.json();
  const translated = data.translations?.[0]?.text;
  if (!translated) throw new Error("DeepL returned no translation");
  return translated;
}

async function translateWithMyMemory(text) {
  const email = process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : "";
  const url   = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|en${email}`;
  const res   = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const data  = await res.json();
  if (data.responseStatus !== 200) throw new Error(`MyMemory: ${data.responseDetails}`);
  const translated = data.responseData?.translatedText;
  if (!translated) throw new Error("MyMemory returned empty translation");
  return translated;
}

async function translateToEnglish(text) {
  if (!text?.trim()) return text;
  try {
    const deeplKey = process.env.DEEPL_API_KEY;
    const result   = deeplKey
      ? await translateWithDeepL(text, deeplKey).catch(() => translateWithMyMemory(text))
      : await translateWithMyMemory(text);
    console.log(`[translate] "${text}" → "${result}"`);
    return result;
  } catch (err) {
    console.warn("[translate] Both services failed, using original:", err.message);
    return text;
  }
}

module.exports = { translateToEnglish };
