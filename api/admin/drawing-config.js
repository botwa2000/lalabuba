"use strict";
// POST /api/admin/drawing-config — protected admin endpoint for runtime overrides.
// Body: partial JSON matching the DEFAULTS shape. Any key present overrides the default;
// omitted keys remain at their default value.
// Auth: X-Admin-Key header must match GALLERY_ADMIN_KEY env var.

const { setConfig } = require("../../lib/db");
const { getDrawingConfig, invalidateDrawingConfigCache, DEFAULTS } = require("../../lib/drawing-config");

const ADMIN_KEY = process.env.GALLERY_ADMIN_KEY;

module.exports = async function adminDrawingConfigHandler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
    res.writeHead(204); res.end(); return;
  }

  if (!ADMIN_KEY || req.headers["x-admin-key"] !== ADMIN_KEY) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" })); return;
  }

  // GET — return current effective config + which keys are overridden
  if (req.method === "GET") {
    try {
      const current = await getDrawingConfig();
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(JSON.stringify({ defaults: DEFAULTS, current }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // POST — apply partial override
  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const overrides = JSON.parse(body);
        if (typeof overrides !== "object" || Array.isArray(overrides)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Body must be a JSON object" })); return;
        }
        await setConfig("drawing_config", overrides);
        invalidateDrawingConfigCache();
        const updated = await getDrawingConfig();
        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, config: updated }));
      } catch (err) {
        console.error("[admin/drawing-config] error:", err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Method not allowed" }));
};
