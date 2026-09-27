"use strict";
// /api/admin/security — request-security control plane. Auth: X-Admin-Key must
// equal GALLERY_ADMIN_KEY (Swarm secret), compared in constant time.
//
// GET  → { defaults, current, stats }   stats = per-UTC-day auth outcome counts
//        (native_attested vs native_unattested_* drives the enforcement decision)
// POST → partial override, e.g. {"appCheck":{"enforce":true}} or
//        {"generate":{"dailyBudget":2000}}. Validated, deep-merged over the stored
//        overrides, effective within seconds — no redeploy.

const crypto = require("crypto");
const { getConfig, setConfig } = require("../../lib/db");
const { deepMerge } = require("../../lib/drawing-config");
const { DEFAULTS, getSecurityConfig, invalidateSecurityConfigCache, validateOverrides } = require("../../lib/security-config");
const authStats = require("../../lib/auth-stats");

function isAdmin(req) {
  const expected = process.env.GALLERY_ADMIN_KEY;
  const got = req.headers["x-admin-key"];
  if (!expected || typeof got !== "string") return false;
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error("body too large");
  }
  return JSON.parse(raw || "{}");
}

module.exports = async function adminSecurityHandler(req, res) {
  if (!isAdmin(req)) return send(res, 401, { error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const [current, stats] = await Promise.all([getSecurityConfig(), authStats.recent(14)]);
      return send(res, 200, { defaults: DEFAULTS, current, stats });
    }

    if (req.method === "POST") {
      let patch;
      try { patch = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
      const err = validateOverrides(patch);
      if (err) return send(res, 400, { error: err });
      const stored = JSON.parse((await getConfig("security_config", "{}")) || "{}");
      const next = deepMerge(stored, patch);
      await setConfig("security_config", next);
      invalidateSecurityConfigCache();
      console.warn(`[admin/security] overrides updated: ${JSON.stringify(patch)}`);
      return send(res, 200, { ok: true, overrides: next, current: await getSecurityConfig() });
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error("[admin/security]", e.message);
    return send(res, 500, { error: "Internal error" });
  }
};
