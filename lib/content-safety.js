"use strict";

// Subject helpers. The decision whether a subject is safe lives in lib/moderation.js:
// a word list cannot judge meaning. It let "women without shirt" through while
// blocking "butter knife" (5 of 72 unsafe test phrases blocked, 14 innocent ones
// refused). What remains here is the exact-match list an admin grows from reviewed
// reports (config `blocked_subjects`).

function sanitizeSubject(value) {
  return String(value || "")
    // Strip zero-width / invisible characters used to split blocked words.
    .replace(/[​-‍⁠﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// Leetspeak fold — only applied to evasion-prone Latin tokens so common
// substitutions still match an admin-blocked subject.
const LEET_MAP = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

function normalizeToken(tok) {
  let t = tok.toLowerCase();
  // Only Latin tokens get NFKD accent-stripping + leet folding. Decomposing
  // non-Latin scripts is destructive — e.g. Cyrillic "й"/"ё" are distinct
  // letters that NFKD splits into base+combining mark, which would corrupt the
  // word (so "голый" must NOT be decomposed).
  const hasLatin = /[a-zÀ-ɏ]/.test(t);
  const hasNonLatin = /[Ѐ-ӿ԰-֏ऀ-ॿ぀-ヿ一-鿿]/.test(t);
  if (hasLatin && !hasNonLatin) {
    t = t.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    if (/^[a-z0-9@$]+$/.test(t)) {
      t = t.replace(/[013457@$]/g, (c) => LEET_MAP[c] || c);
    }
  }
  return t;
}

// Canonical form of a subject for the admin blocklist (config `blocked_subjects`,
// grown from reviewed in-app content reports): sanitized, lowercased, tokens
// normalized, single-spaced.
function subjectKey(subject) {
  return sanitizeSubject(subject)
    .split(/[\s,.!?;:'"()\[\]{}\-_/\\#]+/)
    .map(normalizeToken)
    .filter((w) => w.length > 0)
    .join(" ");
}

// True when `subject` contains any admin-blocked subject as a whole-word phrase.
function isAdminBlockedSubject(subject, blocked) {
  if (!Array.isArray(blocked) || blocked.length === 0) return false;
  const padded = ` ${subjectKey(subject)} `;
  return blocked.some((b) => {
    const key = subjectKey(b);
    return key.length > 0 && padded.includes(` ${key} `);
  });
}

module.exports = { sanitizeSubject, normalizeToken, subjectKey, isAdminBlockedSubject };
