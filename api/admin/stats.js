"use strict";
// /api/admin/stats — data for the confidential /admin/stats dashboard.
// Auth: admin session cookie (email OTP, lib/admin-auth.js) or X-Admin-Key.
//
// GET  ?range=today|7d|30d|90d|12m|day|week|month|ytd|custom[&at=YYYY-MM-DD][&from=…&to=…]
//      &platform=all|web|ios|android&traffic=human|all[&bucket=day|week|month]
//      → aggregates (lib/stats.js). traffic=human (default) counts people only,
//      traffic=all counts every row; health.traffic lists every class either way.
//      Without bucket the period picks one: day ≤ 31 days, week ≤ 120, else month.
// POST {"action":"import","only":["play_reviews",...]?} → start the store import
//      in the background (the iOS ratings sweep takes ~10 min); poll GET for
//      health.imports to see the result.

const adminAuth = require("../../lib/admin-auth");
const { getStats } = require("../../lib/stats");
const storeImport = require("../../lib/store-import");

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4096) throw new Error("body too large");
  }
  return JSON.parse(raw || "{}");
}

module.exports = async function adminStatsHandler(req, res, url) {
  if (!adminAuth.isAdminRequest(req)) return send(res, 401, { error: "Unauthorized" });
  try {
    if (req.method === "GET") {
      const q = (k) => url.searchParams.get(k) || undefined;
      const stats = await getStats({ range: q("range"), platform: q("platform"), at: q("at"), from: q("from"), to: q("to"), traffic: q("traffic"), bucket: q("bucket") });
      return send(res, 200, stats);
    }
    if (req.method === "POST") {
      // Cookie-authenticated POSTs must come from our own page (SameSite=Strict
      // already blocks cross-site cookies; this also rejects odd same-site origins).
      const origin = req.headers.origin;
      if (!adminAuth.hasAdminKey(req) && origin && !/^https:\/\/(www\.|dev\.)?lalabuba\.com$|^http:\/\/localhost(:\d+)?$/.test(origin)) {
        return send(res, 403, { error: "Bad origin" });
      }
      let body;
      try { body = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
      if (body.action !== "import") return send(res, 400, { error: "Unknown action" });
      const only = Array.isArray(body.only) ? body.only.filter((s) => storeImport.SOURCES.some((x) => x.id === s)) : undefined;
      storeImport.runAll({ only }).catch((e) => console.error("[admin/stats] import:", e.message));
      return send(res, 202, { ok: true, started: only || storeImport.SOURCES.map((s) => s.id) });
    }
    return send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error("[admin/stats]", e.message);
    return send(res, 500, { error: "Internal error" });
  }
};
