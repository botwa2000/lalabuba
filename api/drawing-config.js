"use strict";
// GET /api/drawing-config — public endpoint serving the full drawing model config.
// Clients (web + Flutter) fetch this at boot to get unified parameters.
// Response is cached 5 minutes (max-age=300) with stale-while-revalidate=60.

const { getDrawingConfig } = require("../lib/drawing-config");

module.exports = async function drawingConfigHandler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.writeHead(204); res.end(); return;
  }
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" })); return;
  }

  try {
    const config = await getDrawingConfig();
    const body = JSON.stringify(config);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.writeHead(200);
    res.end(body);
  } catch (err) {
    console.error("[drawing-config] handler error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal error" }));
  }
};
