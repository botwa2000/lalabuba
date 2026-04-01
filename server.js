const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const { sanitizeSubject, isSafeSubject } = require("./lib/content-safety");
const { buildPrompt, generateImage } = require("./lib/image-providers");

// Load .env file if present (no extra packages needed)
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
const PUBLIC_DIR = path.join(__dirname, "public");
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "huggingface";
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
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
      if (error.code === "ENOENT") {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      sendJson(res, 500, { error: "Failed to read static file." });
      return;
    }

    const extension = path.extname(absolutePath);
    const noCache = [".js", ".css", ".html"].includes(extension);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      ...(noCache ? { "Cache-Control": "no-store" } : {}),
    });
    res.end(contents);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large."));
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && parsedUrl.pathname === "/api/generate-image") {
    try {
      const body = await readJsonBody(req);
      const subject    = sanitizeSubject(body.subject);
      const difficulty = ["easy", "medium", "hard", "extreme"].includes(body.difficulty) ? body.difficulty : "medium";
      const width      = [512, 768, 1024].includes(body.width)  ? body.width  : 1024;
      const height     = [512, 768, 1024].includes(body.height) ? body.height : 1024;
      const seedRaw    = Number(body.seed);
      const seed       = (Number.isFinite(seedRaw) && seedRaw > 0) ? Math.floor(seedRaw) : Math.floor(Math.random() * 2_000_000_000);

      if (!subject) {
        sendJson(res, 400, { error: "Please provide a subject to draw." });
        return;
      }

      if (!isSafeSubject(subject)) {
        sendJson(res, 400, { error: "Please choose a fun topic for kids — animals, vehicles, fantasy creatures, food…" });
        return;
      }

      const prompt = buildPrompt(subject, difficulty);
      const result = await generateImage(prompt, width, height, seed, {
        provider: IMAGE_PROVIDER,
        hfToken: HF_TOKEN,
        hfModel: HF_MODEL,
      });
      res.writeHead(200, {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "X-Image-Seed": String(seed),
        "Access-Control-Expose-Headers": "X-Image-Seed",
      });
      res.end(result.buffer);
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Image generation failed." });
    }
    return;
  }

  if (req.method === "GET") {
    serveStaticFile(req, res, parsedUrl.pathname);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

server.listen(PORT, () => {
  console.log(`Valepic listening on http://localhost:${PORT}`);
});
