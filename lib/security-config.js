"use strict";
// Request-security settings. DEFAULTS below, deep-merged with the DB key
// "security_config" (migration 008). Edited at runtime — no redeploy — via the
// admin-key-protected POST /api/admin/security. Deliberately NOT part of
// drawing_config, which is served publicly by /api/drawing-config.

const { deepMerge } = require("./drawing-config");

const DEFAULTS = {
  appCheck: {
    // Firebase App Check for native (no-Origin) callers.
    //   false → monitor: unattested native requests are allowed and counted
    //   true  → enforce: native requests without a valid App Check token get 403
    // A PRESENT-but-invalid token is always rejected, in both modes.
    // Flip once GET /api/admin/security shows unattested native traffic is low
    // enough (old app versions age out).
    enforce: false,
    projectNumber: "909101543003",                      // Firebase project lalabuba-app
    appIds: [
      "1:909101543003:android:ba790ba5e3f72132cb197e",   // com.lalabuba.lalabuba (Android)
      "1:909101543003:ios:0f3db60ea4e38f40cb197e",       // com.lalabuba.lalabuba (iOS)
    ],
  },
  generate: {
    perIpLimit:    15,          // image generations per client IP per window
    perIpWindowMs: 3_600_000,   // sliding 1h
    dailyBudget:   1000,        // hard cap on generations per UTC day, all callers
  },
};

const CACHE_TTL_MS = 30_000;
let _cache = null, _cacheAt = 0;

async function getSecurityConfig() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;
  try {
    const db = require("./db");
    const raw = await db.getConfig("security_config", "{}");
    _cache = deepMerge(DEFAULTS, JSON.parse(raw || "{}"));
  } catch (err) {
    // Keep the last good config; fall back to defaults only if we never had one.
    console.error("[security-config] load failed, using", _cache ? "last good config" : "DEFAULTS", "—", err.message);
    _cache = _cache || DEFAULTS;
  }
  _cacheAt = Date.now();
  return _cache;
}

function invalidateSecurityConfigCache() { _cacheAt = 0; }

// Validate an override object: only known keys, correct types, sane ranges.
// Returns an error string, or null when valid.
function validateOverrides(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return "body must be a JSON object";
  const allowed = { appCheck: ["enforce", "projectNumber", "appIds"], generate: ["perIpLimit", "perIpWindowMs", "dailyBudget"] };
  for (const [section, val] of Object.entries(o)) {
    if (!allowed[section]) return `unknown section "${section}"`;
    if (!val || typeof val !== "object" || Array.isArray(val)) return `${section} must be an object`;
    for (const [k, v] of Object.entries(val)) {
      if (!allowed[section].includes(k)) return `unknown key "${section}.${k}"`;
      if (k === "enforce" && typeof v !== "boolean") return "appCheck.enforce must be boolean";
      if (k === "projectNumber" && !/^\d{6,20}$/.test(String(v))) return "appCheck.projectNumber must be digits";
      if (k === "appIds" && !(Array.isArray(v) && v.length && v.every((s) => /^1:\d+:(android|ios|web):[0-9a-f]+$/.test(s)))) return "appCheck.appIds must be Firebase app IDs";
      if (["perIpLimit", "dailyBudget"].includes(k) && !(Number.isInteger(v) && v >= 1 && v <= 1_000_000)) return `${section}.${k} must be an integer 1..1000000`;
      if (k === "perIpWindowMs" && !(Number.isInteger(v) && v >= 60_000 && v <= 86_400_000)) return "generate.perIpWindowMs must be 60000..86400000";
    }
  }
  return null;
}

module.exports = { DEFAULTS, getSecurityConfig, invalidateSecurityConfigCache, validateOverrides };
