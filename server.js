const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// Production + local server for Lalabuba on Hetzner (Docker Swarm).
//
// Single source of request logic: the route handlers in ./api/* are reused
// verbatim. They were written for Vercel's (req,res) shape, so we add a thin
// Express-like shim (req.body, res.status().json().send()) on top of Node's raw
// http req/res and dispatch to them. Secrets arrive as env vars, injected by
// docker-entrypoint.sh from Docker Swarm secrets (never on disk / in the image).

// Load .env for LOCAL dev only (no extra packages). In the container all config
// comes from the environment (Swarm secrets), so a missing .env is expected.
try {
  const envText = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch { /* .env is optional */ }

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1"; // container sets HOST=0.0.0.0
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

// Route handlers (reused as-is; require ../lib/* relative to ./api).
const generateHandler = require("./api/generate-image.js");
const contactHandler = require("./api/contact.js");

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

// Adapt a Node http response to the subset of the Vercel/Express API the
// handlers use: res.status(code).json(obj) / .send(buf) / .end().
function enhanceRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.headersSent && !res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => { res.end(body); return res; };
  return res;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body too large."));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("Invalid JSON body.")); }
    });
    req.on("error", reject);
  });
}

function serveStaticFile(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = path.join(PUBLIC_DIR, safePath);

  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(absolutePath, (error, contents) => {
    if (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      sendJson(res, 500, { error: "Failed to read static file." });
      return;
    }
    const extension = path.extname(absolutePath);
    const noCache = [".js", ".css", ".html", ".webmanifest"].includes(extension);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      ...(noCache ? { "Cache-Control": "no-store" } : {}),
    });
    res.end(contents);
  });
}

const server = http.createServer(async (req, res) => {
  enhanceRes(res);
  let parsedUrl;
  try { parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`); }
  catch { return sendJson(res, 400, { error: "Bad request" }); }
  const p = parsedUrl.pathname;

  // Health check (used by the Docker/Swarm healthcheck + deploy script).
  if (p === "/api/health") {
    return sendJson(res, 200, { status: "ok" });
  }

  // API routes — dispatch to the shared handlers.
  if (p === "/api/generate-image" || p === "/api/contact") {
    if (req.method === "POST") {
      try { req.body = await readJsonBody(req); }
      catch (e) { return res.status(400).json({ error: e.message || "Invalid JSON body." }); }
    } else {
      req.body = {};
    }
    const handler = p === "/api/contact" ? contactHandler : generateHandler;
    try {
      await handler(req, res);
    } catch (err) {
      console.error("handler error:", err && err.message ? err.message : err);
      if (!res.headersSent) res.status(500).json({ error: "Something went wrong — please try again." });
    }
    return;
  }

  if (req.method === "GET") {
    return serveStaticFile(req, res, p);
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

server.listen(PORT, HOST, () => {
  console.log(`Lalabuba server listening on http://${HOST}:${PORT}`);
});
