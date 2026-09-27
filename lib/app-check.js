"use strict";
// Firebase App Check token verification (offline JWT check against Google's
// public JWKS) — the attestation proof for native app requests. The Flutter app
// obtains the token through Play Integrity (Android) / App Attest (iOS) and sends
// it in the X-Firebase-AppCheck header.
//
// Checks, per https://firebase.google.com/docs/app-check/custom-resource-backend:
//   alg RS256 · signature by a key from the JWKS · iss = https://firebaseappcheck.googleapis.com/<projectNumber>
//   aud contains projects/<projectNumber> · exp in the future · sub is one of our app IDs

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const JWKS_URL = "https://firebaseappcheck.googleapis.com/v1/jwks";
const MAX_TOKEN_LEN = 4096;
const DEFAULT_JWKS_TTL_MS = 6 * 3600_000;
const MIN_REFETCH_MS = 60_000;

let _keys = new Map();          // kid → KeyObject
let _keysExpireAt = 0;
let _lastFetchAt = 0;
let _inflight = null;

async function fetchJwks() {
  if (_inflight) return _inflight;
  _inflight = (async () => {
    _lastFetchAt = Date.now();
    const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`JWKS HTTP ${res.status}`);
    const { keys } = await res.json();
    const next = new Map();
    for (const jwk of keys || []) {
      if (jwk.kty === "RSA" && jwk.kid) next.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
    }
    if (!next.size) throw new Error("JWKS contained no RSA keys");
    const maxAge = /max-age=(\d+)/.exec(res.headers.get("cache-control") || "");
    _keys = next;
    _keysExpireAt = Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : DEFAULT_JWKS_TTL_MS);
  })().finally(() => { _inflight = null; });
  return _inflight;
}

async function keyFor(kid) {
  if (Date.now() >= _keysExpireAt) {
    try {
      await fetchJwks();
    } catch (err) {
      // Stale-if-error: keep verifying with the last good keys (signatures still
      // prove authenticity); retry the fetch on the next minute boundary.
      if (!_keys.size) throw err;
      console.error("[app-check] JWKS refresh failed, using cached keys:", err.message);
      _keysExpireAt = Date.now() + MIN_REFETCH_MS;
    }
  }
  let key = _keys.get(kid);
  // Unknown kid → Google may have rotated keys; refetch, but not more than once a minute.
  if (!key && Date.now() - _lastFetchAt > MIN_REFETCH_MS) {
    await fetchJwks();
    key = _keys.get(kid);
  }
  return key || null;
}

/**
 * @returns {Promise<{ ok: true, appId: string } | { ok: false, reason: string }>}
 * reason "unavailable" means we could not load Google's keys (not the caller's fault).
 */
async function verifyAppCheckToken(token, { projectNumber, appIds }) {
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LEN) return { ok: false, reason: "malformed" };
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header?.alg !== "RS256" || !decoded.header?.kid) return { ok: false, reason: "malformed" };

  let key;
  try {
    key = await keyFor(decoded.header.kid);
  } catch (err) {
    console.error("[app-check] JWKS fetch failed:", err.message);
    return { ok: false, reason: "unavailable" };
  }
  if (!key) return { ok: false, reason: "unknown-key" };

  try {
    const payload = jwt.verify(token, key, {
      algorithms: ["RS256"],
      issuer: `https://firebaseappcheck.googleapis.com/${projectNumber}`,
      audience: `projects/${projectNumber}`,
    });
    if (!appIds.includes(payload.sub)) return { ok: false, reason: "wrong-app" };
    return { ok: true, appId: payload.sub };
  } catch (err) {
    return { ok: false, reason: err.name === "TokenExpiredError" ? "expired" : "invalid" };
  }
}

module.exports = {
  verifyAppCheckToken,
  // Test hook: install keys as if freshly fetched (no network).
  _setKeysForTest: (m, exp) => { _keys = m; _keysExpireAt = exp; _lastFetchAt = Date.now(); },
};
