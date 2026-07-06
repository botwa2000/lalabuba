const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const gallery = require("./lib/gallery");

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

  // Candidates to try in order:
  // 1. exact path  2. path + .html  3. path/index.html
  const candidates = [
    absolutePath,
    path.extname(absolutePath) === "" ? absolutePath + ".html" : null,
    absolutePath + "/index.html",
  ].filter(Boolean);

  function tryNext(i) {
    if (i >= candidates.length) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const candidate = candidates[i];
    fs.readFile(candidate, (error, contents) => {
      if (error) {
        if (error.code === "ENOENT" || error.code === "EISDIR") {
          tryNext(i + 1);
          return;
        }
        sendJson(res, 500, { error: "Failed to read static file." });
        return;
      }
      const extension = path.extname(candidate);
      const noCache = [".js", ".css", ".html", ".webmanifest"].includes(extension);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
        ...(noCache ? { "Cache-Control": "no-store" } : {}),
      });
      res.end(contents);
    });
  }
  tryNext(0);
}

// Returns the names of any SET critical secret whose VALUE is malformed
// (stray whitespace, a literal "\n"/CR, or wrong fixed format). Only checks
// secrets that are present, so an intentionally-unset secret in dev is fine.
function malformedSecrets() {
  const bad = [];
  const hasJunk = (v) => v !== v.trim() || /[\r\n]/.test(v) || v.includes("\\n");
  const checks = {
    TURNSTILE_SECRET_KEY: (v) => /^0x[A-Za-z0-9_-]{20,}$/.test(v),
    CF_ACCOUNT_ID: (v) => /^[0-9a-f]{32}$/.test(v),
    HF_TOKEN: (v) => /^hf_[A-Za-z0-9]{20,}$/.test(v),
  };
  for (const [name, ok] of Object.entries(checks)) {
    const v = process.env[name];
    if (v == null || v === "") continue; // unset is allowed (dev)
    if (hasJunk(v) || !ok(v)) bad.push(name);
  }
  return bad;
}

// ── Gallery HTML helpers ─────────────────────────────────────────────────────

function galleryCardHtml(entry, meta) {
  const label = entry.subject.charAt(0).toUpperCase() + entry.subject.slice(1);
  const diff  = entry.difficulty || "easy";
  // ?s=1&img=URL loads the CDN image directly in share.js without an AI call.
  const href  = `/?s=1&img=${encodeURIComponent(entry.url)}&q=${encodeURIComponent(entry.subject)}&d=${diff}`;
  return `<a href="${href}" class="gallery-card" title="Color: ${label}">
    <img src="${entry.url}" alt="${label} coloring page" loading="lazy" width="280" height="280"/>
    <div class="gallery-card-label">${label}</div>
    <div class="gallery-card-cta">Color this →</div>
  </a>`;
}

function gallerySection(topicImages, meta) {
  const diffLabel = { easy: "Easy 🌟", medium: "Medium 🌟🌟", hard: "Hard 🌟🌟🌟" };
  let html = `<section class="lp-section gallery-section">
    <h2 class="section-heading">Ready-Made ${meta.name} Coloring Pages</h2>
    <p class="section-sub">Pick one to color instantly — or <a href="/?s=1&q=${encodeURIComponent(meta.name.toLowerCase())}&d=easy">generate a fresh one</a>.</p>`;
  for (const diff of ["easy", "medium", "hard"]) {
    const imgs = topicImages[diff] || [];
    if (!imgs.length) continue;
    html += `<h3 class="gallery-diff-heading">${diffLabel[diff]}</h3>
    <div class="gallery-grid">${imgs.map(e => galleryCardHtml({ ...e, difficulty: diff }, meta)).join("")}</div>`;
  }
  html += `</section>`;
  return html;
}

function injectGalleryIntoHtml(staticHtml, galleryHtml) {
  // Inject before the last </div> that closes .legal-content
  return staticHtml.replace(
    /(<section[^>]*style="text-align:center"[\s\S]*?<\/section>\s*<\/div>)/,
    (m) => m.replace("</div>", galleryHtml + "\n</div>")
  );
}

function serveHtml(res, html) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
}

async function serveTopicPageWithGallery(res, topic) {
  const meta = gallery.TOPIC_META[topic];
  const staticPath = path.join(PUBLIC_DIR, "coloring-pages", topic, "index.html");
  let baseHtml;
  try { baseHtml = fs.readFileSync(staticPath, "utf8"); }
  catch { return sendJson(res, 404, { error: "Not found" }); }

  const topicImages = gallery.getAllForTopic(topic);
  const hasAny = ["easy","medium","hard"].some(d => (topicImages[d]||[]).length > 0);
  let enhanced = hasAny ? injectGalleryIntoHtml(baseHtml, gallerySection(topicImages, meta)) : baseHtml;

  // Inject first gallery image as og:image for Pinterest/social sharing
  const firstImg = ["easy","medium","hard"].reduce((found, d) => found || (topicImages[d]||[])[0], null);
  if (firstImg) {
    const absUrl = `https://lalabuba.com${firstImg.url}`;
    enhanced = enhanced.replace(
      /<meta property="og:image"[^>]*>/,
      `<meta property="og:image" content="${absUrl}"/>`
    );
  }

  serveHtml(res, enhanced);
}

function serveTodayPage(res) {
  const { word, date } = gallery.getDailyWord();
  const todayEntry = gallery.getTodayEntry();
  const imgs = todayEntry?.images || [];
  const diffLabel = { easy: "Easy 🌟", medium: "Medium 🌟🌟", hard: "Hard 🌟🌟🌟" };
  const wordTitle = word.charAt(0).toUpperCase() + word.slice(1);

  let galleryHtml = "";
  if (imgs.length) {
    galleryHtml = `<div class="gallery-grid">${imgs.map(e =>
      galleryCardHtml({ ...e, subject: word }, { name: wordTitle })
    ).join("")}</div>`;
  } else {
    galleryHtml = `<p class="gallery-empty">Today's coloring pages are being generated — check back in a few minutes, or
      <a href="/?s=1&q=${encodeURIComponent(word)}&d=easy" class="lp-cta-inline">generate your own ${wordTitle} now →</a></p>`;
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <script>(function(){var t=localStorage.getItem('lalabuba-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}})();</script>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Today's Coloring Page: ${wordTitle} (${date}) | Lalabuba</title>
  <meta name="description" content="Today's free AI coloring page is: ${wordTitle}! Color it easy, medium, or hard — free, instant, no account needed."/>
  <link rel="canonical" href="https://lalabuba.com/coloring-pages/today/"/>
  <meta property="og:title" content="Today's Coloring Page: ${wordTitle}"/>
  <meta property="og:description" content="Free AI coloring page of the day: ${wordTitle}. Easy, medium, and hard difficulty. Color online or print!"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="https://lalabuba.com/coloring-pages/today/"/>
  <meta property="og:site_name" content="Lalabuba"/>
  <meta name="theme-color" content="#7c4dff"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="icon" href="/favicon.png" type="image/png"/>
  <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
  <link rel="stylesheet" href="/css/legal.css"/>
  <link rel="stylesheet" href="/css/gallery.css"/>
  <script type="module" src="/js/lp-theme.js"></script>
  <script type="application/ld+json">{
    "@context":"https://schema.org","@type":"WebPage",
    "name":"Today's Coloring Page: ${wordTitle}",
    "description":"Daily free AI coloring page — ${wordTitle} — ${date}",
    "url":"https://lalabuba.com/coloring-pages/today/"
  }</script>
</head>
<body>
<nav class="legal-nav">
  <a href="/" class="legal-logo"><span class="legal-logo-emoji">🎨</span> Lalabuba</a>
  <span class="nav-sep">›</span>
  <a href="/coloring-pages/">Coloring Pages</a>
  <span class="nav-sep">›</span>
  <span class="nav-current">Today</span>
  <span class="nav-spacer"></span>
  <button id="lp-theme-btn" aria-label="Toggle dark/light mode">🌙</button>
</nav>
<div class="lp-hero">
  <div class="lp-hero-inner">
    <span class="lp-hero-emoji">📅</span>
    <h1>Today's Coloring Page</h1>
    <p class="lp-hero-desc">Every day a new word, a new coloring adventure. Today it's: <strong>${wordTitle}</strong>!</p>
    <a href="/?s=1&q=${encodeURIComponent(word)}&d=easy" class="lp-cta">Generate your own ${wordTitle} →</a>
  </div>
</div>
<div class="legal-content">
  <section class="lp-section gallery-section">
    <h2 class="section-heading">${wordTitle} — ${date}</h2>
    <p class="section-sub">Pick a difficulty and start coloring, or generate a brand-new one.</p>
    ${galleryHtml}
  </section>
  <section class="lp-section">
    <h2 class="section-heading">Try Other Difficulties</h2>
    <div class="lp-diff-grid">
      ${["easy","medium","hard"].map(d => `<div class="lp-diff-card">
        <span class="lp-diff-emoji">${{easy:"🌟",medium:"🌟🌟",hard:"🌟🌟🌟"}[d]}</span>
        <h3>${d.charAt(0).toUpperCase()+d.slice(1)}</h3>
        <a href="/?s=1&q=${encodeURIComponent(word)}&d=${d}" class="lp-diff-link">Generate ${d} →</a>
      </div>`).join("")}
    </div>
  </section>
  <section class="lp-section">
    <h2 class="section-heading">Browse All Topics</h2>
    <div class="lp-related-grid">
      ${Object.entries(gallery.TOPIC_META).map(([slug, m]) =>
        `<a href="/coloring-pages/${slug}/" class="lp-related-card"><span class="lp-rel-emoji">${m.emoji}</span> ${m.name}</a>`
      ).join("")}
    </div>
  </section>
</div>
<footer class="legal-footer">
  <span>© 2026 Lalabuba</span>
  <span class="sep">·</span>
  <a href="/">App</a>
  <span class="sep">·</span>
  <a href="/coloring-pages/">Coloring Pages</a>
  <span class="sep">·</span>
  <a href="/features">Features</a>
  <span class="sep">·</span>
  <a href="/privacy">Privacy</a>
  <span class="sep">·</span>
  <a href="/contact">Contact</a>
</footer>
</body>
</html>`;
  serveHtml(res, html);
}

function serveDailyPage(res, date, word) {
  const entry = gallery.getDailyEntry(date);
  const wordTitle = word.charAt(0).toUpperCase() + word.slice(1);
  const imgs = entry?.images || [];

  let galleryHtml = "";
  if (imgs.length) {
    galleryHtml = `<div class="gallery-grid">${imgs.map(e =>
      galleryCardHtml({ ...e, subject: word }, { name: wordTitle })
    ).join("")}</div>`;
  } else {
    galleryHtml = `<p class="gallery-empty">No saved coloring pages for this date yet. Try generating your own:
      <a href="/?s=1&q=${encodeURIComponent(word)}&d=easy" class="lp-cta-inline">Generate ${wordTitle} →</a></p>`;
  }

  const firstImg = imgs[0];
  const ogImage  = firstImg ? `https://lalabuba.com${firstImg.url}` : "https://lalabuba.com/og-image.png";
  const canonUrl = `https://lalabuba.com/coloring-pages/daily/${date}-${word}/`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <script>(function(){var t=localStorage.getItem('lalabuba-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}})();</script>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Free ${wordTitle} Coloring Page (${date}) | Lalabuba</title>
  <meta name="description" content="Free printable ${wordTitle} coloring page from ${date}. Color online at easy, medium, or hard difficulty — no account needed."/>
  <link rel="canonical" href="${canonUrl}"/>
  <meta property="og:title" content="${wordTitle} Coloring Page — ${date}"/>
  <meta property="og:description" content="Free AI ${wordTitle} coloring page. Easy, medium, and hard difficulty. Color online or print!"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${canonUrl}"/>
  <meta property="og:image" content="${ogImage}"/>
  <meta property="og:site_name" content="Lalabuba"/>
  <meta name="theme-color" content="#7c4dff"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="icon" href="/favicon.png" type="image/png"/>
  <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
  <link rel="stylesheet" href="/css/legal.css"/>
  <link rel="stylesheet" href="/css/gallery.css"/>
  <script type="module" src="/js/lp-theme.js"></script>
  <script type="application/ld+json">{
    "@context":"https://schema.org","@type":"WebPage",
    "name":"${wordTitle} Coloring Page — ${date}",
    "description":"Free AI ${wordTitle} coloring page from ${date}",
    "url":"${canonUrl}"
  }</script>
</head>
<body>
<nav class="legal-nav">
  <a href="/" class="legal-logo"><span class="legal-logo-emoji">🎨</span> Lalabuba</a>
  <span class="nav-sep">›</span>
  <a href="/coloring-pages/">Coloring Pages</a>
  <span class="nav-sep">›</span>
  <span class="nav-current">${wordTitle} (${date})</span>
  <span class="nav-spacer"></span>
  <button id="lp-theme-btn" aria-label="Toggle dark/light mode">🌙</button>
</nav>
<div class="lp-hero">
  <div class="lp-hero-inner">
    <span class="lp-hero-emoji">🖌️</span>
    <h1>${wordTitle} Coloring Page</h1>
    <p class="lp-hero-desc">Free printable ${wordTitle} coloring page — <strong>${date}</strong>. Pick a difficulty or generate your own!</p>
    <a href="/?s=1&q=${encodeURIComponent(word)}&d=easy" class="lp-cta">Generate your own ${wordTitle} →</a>
  </div>
</div>
<div class="legal-content">
  <section class="lp-section gallery-section">
    <h2 class="section-heading">${wordTitle} — ${date}</h2>
    ${galleryHtml}
  </section>
  <section class="lp-section">
    <h2 class="section-heading">Try Other Difficulties</h2>
    <div class="lp-diff-grid">
      ${["easy","medium","hard"].map(d => `<div class="lp-diff-card">
        <span class="lp-diff-emoji">${{easy:"🌟",medium:"🌟🌟",hard:"🌟🌟🌟"}[d]}</span>
        <h3>${d.charAt(0).toUpperCase()+d.slice(1)}</h3>
        <a href="/?s=1&q=${encodeURIComponent(word)}&d=${d}" class="lp-diff-link">Generate ${d} →</a>
      </div>`).join("")}
    </div>
  </section>
  <section class="lp-section">
    <h2 class="section-heading">Browse All Topics</h2>
    <div class="lp-related-grid">
      ${Object.entries(gallery.TOPIC_META).map(([slug, m]) =>
        `<a href="/coloring-pages/${slug}/" class="lp-related-card"><span class="lp-rel-emoji">${m.emoji}</span> ${m.name}</a>`
      ).join("")}
    </div>
  </section>
</div>
<footer class="legal-footer">
  <span>© 2026 Lalabuba</span>
  <span class="sep">·</span>
  <a href="/">App</a>
  <span class="sep">·</span>
  <a href="/coloring-pages/">Coloring Pages</a>
  <span class="sep">·</span>
  <a href="/features">Features</a>
  <span class="sep">·</span>
  <a href="/privacy">Privacy</a>
  <span class="sep">·</span>
  <a href="/contact">Contact</a>
</footer>
</body>
</html>`;
  serveHtml(res, html);
}

const server = http.createServer(async (req, res) => {
  enhanceRes(res);
  let parsedUrl;
  try { parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`); }
  catch { return sendJson(res, 400, { error: "Bad request" }); }
  const p = parsedUrl.pathname;

  // Health check (used by the Docker/Swarm healthcheck + deploy script).
  // Now also a READINESS check: it validates that critical secrets, when set,
  // are well-formed. A corrupted TURNSTILE_SECRET_KEY / CF_ACCOUNT_ID (the
  // migration "\n" bug) previously sailed through every health gate because this
  // returned ok unconditionally — so a broken bot check reached production. A
  // malformed secret now fails the health check, so the deploy/rollback catches it.
  if (p === "/api/health") {
    const bad = malformedSecrets();
    if (bad.length) return sendJson(res, 503, { status: "degraded", malformed: bad });
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

  // ── Serve generated images (coloring shares + gallery) ────────────────────
  const imgMatch = p.match(/^\/img\/(c|g)\/([A-Za-z0-9_.-]+)$/);
  if (imgMatch && req.method === "GET") {
    const imgPath = path.join(__dirname, "data", "images", imgMatch[1], imgMatch[2]);
    try {
      const buf = fs.readFileSync(imgPath);
      const ext = path.extname(imgMatch[2]).toLowerCase();
      const ct  = (ext === ".jpg" || ext === ".jpeg") ? "image/jpeg" : "image/png";
      res.writeHead(200, { "Content-Type": ct, "Cache-Control": "public, max-age=604800, immutable" });
      res.end(buf);
    } catch {
      return sendJson(res, 404, { error: "Image not found" });
    }
    return;
  }

  // ── Gallery API ────────────────────────────────────────────────────────────
  if (p === "/api/gallery" && req.method === "GET") {
    const topic      = parsedUrl.searchParams.get("topic");
    const difficulty = parsedUrl.searchParams.get("difficulty");
    if (topic && difficulty) {
      return sendJson(res, 200, { images: gallery.getImages(topic, difficulty) });
    }
    if (topic) {
      return sendJson(res, 200, gallery.getAllForTopic(topic));
    }
    return sendJson(res, 400, { error: "topic required" });
  }

  // Admin: generate gallery images. Requires GALLERY_ADMIN_KEY header matching env.
  if (p === "/api/gallery/generate" && req.method === "POST") {
    const adminKey = process.env.GALLERY_ADMIN_KEY;
    if (!adminKey || req.headers["x-admin-key"] !== adminKey) {
      return sendJson(res, 403, { error: "Forbidden" });
    }
    let body;
    try { body = await readJsonBody(req); } catch { body = {}; }
    const topic      = gallery.TOPICS.includes(body.topic) ? body.topic : null;
    const difficulty = gallery.DIFFICULTIES.includes(body.difficulty) ? body.difficulty : null;
    const subject    = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : null;
    if (!topic || !difficulty || !subject) {
      return sendJson(res, 400, { error: "topic, difficulty, subject required" });
    }
    try {
      const { url } = await gallery.generateAndUpload(subject, difficulty, `${topic}-${difficulty}`);
      const entry   = await gallery.addToGallery(topic, difficulty, subject, url);
      return sendJson(res, 200, { ok: true, entry });
    } catch (err) {
      console.error("gallery generate error:", err.message);
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Admin: generate today's daily page images.
  if (p === "/api/gallery/generate-daily" && req.method === "POST") {
    const adminKey = process.env.GALLERY_ADMIN_KEY;
    if (!adminKey || req.headers["x-admin-key"] !== adminKey) {
      return sendJson(res, 403, { error: "Forbidden" });
    }
    const { word } = gallery.getDailyWord();
    const results  = [];
    for (const diff of ["easy", "medium", "hard"]) {
      try {
        const { url } = await gallery.generateAndUpload(word, diff, `daily-${diff}`);
        await gallery.addDailyImage(word, diff, url);
        results.push({ difficulty: diff, url });
      } catch (err) {
        results.push({ difficulty: diff, error: err.message });
      }
    }
    return sendJson(res, 200, { word, results });
  }

  if (req.method === "GET") {
    // /challenge — Flutter QR codes link here; redirect to web share format.
    if (p === "/challenge") {
      const subject = parsedUrl.searchParams.get("subject") || "";
      const seed    = parsedUrl.searchParams.get("seed")    || "";
      const qs = new URLSearchParams({ s: "1", q: subject, seed }).toString();
      res.writeHead(301, { Location: `/?${qs}`, "Cache-Control": "no-store" });
      res.end();
      return;
    }

    // /today/ → 301 to dated archive URL so ranking power accumulates on dated URLs
    if (p === "/coloring-pages/today" || p === "/coloring-pages/today/") {
      const { word, date } = gallery.getDailyWord();
      res.writeHead(301, { Location: `/coloring-pages/daily/${date}-${word}/`, "Cache-Control": "no-store" });
      res.end();
      return;
    }
    // Dynamic: /coloring-pages/daily/YYYY-MM-DD-word/ — dated archive page
    const dailyMatch = p.match(/^\/coloring-pages\/daily\/(\d{4}-\d{2}-\d{2})-([a-z]+)\/?$/);
    if (dailyMatch) {
      return serveDailyPage(res, dailyMatch[1], dailyMatch[2]);
    }
    // Dynamic: /coloring-pages/:topic/ — inject gallery into static HTML
    const topicMatch = p.match(/^\/coloring-pages\/([a-z]+)\/?$/);
    if (topicMatch && gallery.TOPIC_META[topicMatch[1]]) {
      return serveTopicPageWithGallery(res, topicMatch[1]);
    }
    // German pages: /ausmalbilder/:slug/ — static HTML + optional gallery injection from mapped English topic
    const DE_TOPIC_MAP = {
      drache: "dragon", einhorn: "unicorn", schmetterling: "butterfly",
      dinosaurier: "dinosaur", katze: "cat", prinzessin: "princess",
      meerjungfrau: "mermaid", rakete: "rocket",
    };
    const deTopicMatch = p.match(/^\/ausmalbilder\/([a-z]+)\/?$/);
    if (deTopicMatch) {
      const deSlug   = deTopicMatch[1];
      const enTopic  = DE_TOPIC_MAP[deSlug];
      const staticPath = path.join(PUBLIC_DIR, "ausmalbilder", deSlug, "index.html");
      let baseHtml;
      try { baseHtml = fs.readFileSync(staticPath, "utf8"); } catch { /* fall through to static serve */ }
      if (baseHtml) {
        if (enTopic) {
          const topicImages = gallery.getAllForTopic(enTopic);
          const hasAny = ["easy","medium","hard"].some(d => (topicImages[d]||[]).length > 0);
          let enhanced = hasAny ? injectGalleryIntoHtml(baseHtml, gallerySection(topicImages, gallery.TOPIC_META[enTopic])) : baseHtml;
          const firstImg = ["easy","medium","hard"].reduce((f, d) => f || (topicImages[d]||[])[0], null);
          if (firstImg) {
            enhanced = enhanced.replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="https://lalabuba.com${firstImg.url}"/>`);
          }
          return serveHtml(res, enhanced);
        }
        return serveHtml(res, baseHtml);
      }
    }
    // German hub /ausmalbilder/ — static file
    if (p === "/ausmalbilder" || p === "/ausmalbilder/") {
      const hubPath = path.join(PUBLIC_DIR, "ausmalbilder", "index.html");
      try {
        const html = fs.readFileSync(hubPath, "utf8");
        return serveHtml(res, html);
      } catch { /* fall through */ }
    }
    return serveStaticFile(req, res, p);
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

server.listen(PORT, HOST, () => {
  console.log(`Lalabuba server listening on http://${HOST}:${PORT}`);
});
