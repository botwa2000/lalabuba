const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

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

function sanitizeSubject(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// Multilingual blocklist — terms inappropriate for a children's coloring app.
// Add new languages by appending to the same set.
const BLOCKED_TERMS = new Set([
  // English
  "nude","naked","nudity","blood","bloody","gore","gory","kill","killing",
  "murder","murderer","dead","death","dying","corpse","weapon","weapons",
  "gun","guns","rifle","pistol","knife","knives","bomb","bombs","explosive",
  "sex","sexy","sexual","porn","pornography","erotic","erotica",
  "violence","violent","torture","abuse","drug","drugs","cocaine","heroin",
  "meth","terror","terrorist","suicide","rape","racist","racism","nazi",
  // German
  "nackt","nackten","blut","blutig","töten","tötung","mord","mörder",
  "tot","leiche","waffe","waffen","gewehr","messer","bombe","bomben",
  "sex","sexuell","pornografie","gewalt","folter","missbrauch","droge",
  "drogen","terror","terrorist","selbstmord","vergewaltigung",
  // Russian (Cyrillic)
  "голый","голая","голые","кровь","кровавый","убить","убийство","убийца",
  "мертвый","мёртвый","труп","смерть","оружие","пистолет","нож","бомба",
  "секс","порно","насилие","пытка","наркотик","наркотики","террор",
  "суицид","изнасилование","расизм",
  // French
  "nu","nue","nus","nues","sang","sanglant","tuer","meurtre","meurtrier",
  "mort","cadavre","arme","armes","pistolet","couteau","bombe","bombes",
  "sexe","sexuel","pornographie","violence","torture","abus","drogue",
  "drogues","terreur","terroriste","suicide","viol","racisme",
]);

function isSafeSubject(subject) {
  const words = subject.toLowerCase().split(/[\s,!?;:'"()\[\]{}\-_/\\@#]+/);
  return !words.some(w => w.length > 0 && BLOCKED_TERMS.has(w));
}

function buildPrompt(subject, difficulty = "medium") {
  const diffHint = {
    easy:   "only 3-4 very large simple shapes, no small details, toddler coloring book",
    medium: "simple cartoon with 6-10 clearly enclosed regions",
    hard:   "detailed cartoon with many small fully enclosed decorative regions",
  }[difficulty] || "simple cartoon with 6-10 clearly enclosed regions";

  return [
    `coloring book page of ${subject}`,
    "simple cartoon illustration style",
    "thick bold continuous black outlines",
    "every single outline is a fully closed loop",
    "every shape sealed at the bottom by a ground line or base edge",
    "flat white interior inside every closed shape",
    "white background",
    "absolutely no interior texture lines",
    "absolutely no hatching or crosshatching inside shapes",
    "absolutely no shading or shadow lines inside shapes",
    "no open lines",
    "no loose line ends",
    "every panel door and window has a fully closed border",
    "no gradients",
    "no color",
    "no detail strokes inside shapes",
    diffHint,
    "clean professional coloring book illustration",
    "no text",
    "no watermark",
  ].join(", ");
}

function buildPollinationsUrl(prompt) {
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  url.searchParams.set("width", "1024");
  url.searchParams.set("height", "1024");
  url.searchParams.set("nologo", "true");
  url.searchParams.set("model", "flux");
  url.searchParams.set("enhance", "false");
  url.searchParams.set("safe", "true");
  url.searchParams.set("seed", String(Math.floor(Math.random() * 2_000_000_000)));
  url.searchParams.set("referrer", "valepic");
  return url.toString();
}

async function generateWithPollinations(prompt, width = 1024, height = 1024) {
  const url = buildPollinationsUrl(prompt);
  // override dimensions
  const u = new URL(url);
  u.searchParams.set("width",  String(width));
  u.searchParams.set("height", String(height));
  const upstream = await fetch(u.toString(), {
    headers: {
      Accept: "image/*",
      "User-Agent": "Mozilla/5.0 (compatible; Valepic/0.1)",
      "Referer": "https://valepic.app",
    },
  });

  if (!upstream.ok) {
    const details = await upstream.text();
    throw new Error(`Pollinations failed (${upstream.status}): ${details.slice(0, 200)}`);
  }

  return {
    contentType: upstream.headers.get("content-type") || "image/png",
    buffer: Buffer.from(await upstream.arrayBuffer()),
  };
}

async function generateWithHuggingFace(prompt, width = 1024, height = 1024) {
  if (!HF_TOKEN) {
    throw new Error(
      "No HF_TOKEN set. Add your free Hugging Face token to the .env file. " +
      "Get one free at https://huggingface.co/settings/tokens"
    );
  }

  const upstream = await fetch(`https://router.huggingface.co/hf-inference/models/${encodeURIComponent(HF_MODEL)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        width,
        height,
        guidance_scale: 3.5,
        num_inference_steps: 8,
      },
    }),
  });

  if (!upstream.ok) {
    const details = await upstream.text();
    throw new Error(`Hugging Face failed (${upstream.status}): ${details.slice(0, 300)}`);
  }

  return {
    contentType: upstream.headers.get("content-type") || "image/jpeg",
    buffer: Buffer.from(await upstream.arrayBuffer()),
  };
}

function isQuotaError(err) {
  const msg = (err.message || "").toLowerCase();
  return msg.includes("402") || msg.includes("429") ||
         msg.includes("credit") || msg.includes("quota") ||
         msg.includes("limit") || msg.includes("exceeded") ||
         msg.includes("payment") || msg.includes("billing");
}

async function generateImage(prompt, width = 1024, height = 1024) {
  if (IMAGE_PROVIDER === "pollinations") {
    return generateWithPollinations(prompt, width, height);
  }

  // HuggingFace with automatic Pollinations fallback on quota/limit errors.
  try {
    return await generateWithHuggingFace(prompt, width, height);
  } catch (err) {
    if (isQuotaError(err)) {
      console.warn(`HuggingFace quota error — falling back to Pollinations. (${err.message.slice(0, 80)})`);
      return generateWithPollinations(prompt, width, height);
    }
    throw err;
  }
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
      const subject = sanitizeSubject(body.subject);
      const difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
      const width  = [512, 768, 1024].includes(body.width)  ? body.width  : 1024;
      const height = [512, 768, 1024].includes(body.height) ? body.height : 1024;

      if (!subject) {
        sendJson(res, 400, { error: "Please provide a subject to draw." });
        return;
      }

      if (!isSafeSubject(subject)) {
        sendJson(res, 400, { error: "Please choose a fun topic for kids — animals, vehicles, fantasy creatures, food…" });
        return;
      }

      const prompt = buildPrompt(subject, difficulty);
      const result = await generateImage(prompt, width, height);
      res.writeHead(200, {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
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
