"use strict";
// Store reviewers (Apple App Review, Google Play) must be able to sign in to the
// family account to check features like account deletion, but they cannot
// receive our emailed one-time code. Exactly one address, the Swarm secret
// REVIEW_LOGIN_EMAIL, gets a fixed code (Swarm secret REVIEW_LOGIN_CODE) instead
// of a random emailed one. Everything else is unchanged: the code is still
// stored with a 10-minute expiry, 5 tries per code and 3 codes per hour per
// address, so guessing is about 15 tries an hour against 10^6 codes.
// With either secret missing, the reviewer path is off.

function reviewCode(normalEmail) {
  const addr = (process.env.REVIEW_LOGIN_EMAIL || "").trim().toLowerCase();
  const code = (process.env.REVIEW_LOGIN_CODE || "").trim();
  if (!addr || !/^\d{6}$/.test(code)) return null;
  return normalEmail === addr ? code : null;
}

module.exports = { reviewCode };
