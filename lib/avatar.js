"use strict";
// Emoji avatar list for community profiles. Indexed 0–19.
// Stored as avatar_index in DB — rendered as emoji in UI.

const AVATARS = [
  "🐉", "🐧", "🐻", "🦄", "🐯", "🦊", "🐰", "🐬",
  "🦅", "🐺", "🐼", "🐨", "🐆", "🦉", "🦜", "🐹",
  "🦔", "🦦", "🐿️", "🦘",
];

function isValidAvatar(idx) {
  const n = parseInt(idx);
  return Number.isInteger(n) && n >= 0 && n < AVATARS.length;
}

function getAvatar(idx) {
  const n = parseInt(idx);
  return AVATARS[n] || AVATARS[0];
}

module.exports = { AVATARS, isValidAvatar, getAvatar };
