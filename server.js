const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const gallery = require("./lib/gallery");
const i18n = require("./lib/coloring-i18n");
const db = require("./lib/db");
const communityRouter = require("./api/community/router");
const authRouter      = require("./api/auth/router");
const { buildNav }    = require("./lib/lp-nav-component");

// Production + local server for Lalabuba on Hetzner (Docker Swarm).
//
// Single source of request logic: the route handlers in ./api/* are reused
// verbatim. We add a thin Express-like shim (req.body, res.status().json().send())
// on top of Node's raw http req/res and dispatch to them. Secrets arrive as env vars, injected by
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

// German slug → English topic (for gallery image injection on DE pages)
const DE_TOPIC_MAP = {
  drache: "dragon", einhorn: "unicorn", schmetterling: "butterfly",
  dinosaurier: "dinosaur", katze: "cat", prinzessin: "princess",
  meerjungfrau: "mermaid", rakete: "rocket",
  schultuete: "schultuete", einschulung: "einschulung",
};
// English topic → German slug (inverse)
const EN_TO_DE_SLUG = Object.fromEntries(Object.entries(DE_TOPIC_MAP).map(([de, en]) => [en, de]));

// German display names for topics (used in gallery section titles on static DE pages)
const DE_TOPIC_NAMES = {
  dragon: 'Drachen', unicorn: 'Einhorn', butterfly: 'Schmetterling',
  dinosaur: 'Dinosaurier', cat: 'Katze', princess: 'Prinzessin',
  mermaid: 'Meerjungfrau', rocket: 'Rakete',
};

// Translations for gallery section injected into DE static pages
const DE_GALLERY_T = {
  colorThis:      'Ausmalen →',
  diffLabels:     { easy: 'Einfach 🌟', medium: 'Mittel 🌟🌟', hard: 'Schwer 🌟🌟🌟' },
  readyMadeTitle: (name) => `${name} Ausmalbilder zum Sofort-Ausmalen`,
  readyMadeSub:   (name, q) => `Gleich loslegen — oder <a href="/?s=1&q=${q}&d=easy">ein neues ${name} erstellen</a>.`,
};

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

// Adapt a Node http response to the subset of the Express API the
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

function readJsonBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) reject(new Error("Request body too large."));
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

// pageCtx = { basePath: '/en/coloring-pages/dinosaur/' } → links to individual image pages
// If no basePath or no slug, falls back to ?s=1&img= direct-load link.
function galleryCardHtml(entry, meta, t, pageCtx = {}) {
  const label = entry.subject.charAt(0).toUpperCase() + entry.subject.slice(1);
  const diff  = entry.difficulty || "easy";
  const href  = (entry.slug && pageCtx.basePath)
    ? `${pageCtx.basePath}${entry.slug}/`
    : `/?s=1&img=${encodeURIComponent(entry.url)}&q=${encodeURIComponent(entry.subject)}&d=${diff}`;
  const cta   = t?.colorThis || "Color this →";
  return `<a href="${href}" class="gallery-card" title="${label}">
    <img src="${entry.url}" alt="${label} coloring page" loading="lazy" width="280" height="280"/>
    <div class="gallery-card-label">${label}</div>
    <div class="gallery-card-cta">${cta}</div>
  </a>`;
}

function gallerySection(topicImages, meta, t, pageCtx = {}) {
  const diffLabel = t?.diffLabels || { easy: "Easy 🌟", medium: "Medium 🌟🌟", hard: "Hard 🌟🌟🌟" };
  const name = meta.name;
  const q    = encodeURIComponent(name.toLowerCase());
  const title    = t?.readyMadeTitle ? t.readyMadeTitle(name) : `Ready-Made ${name} Coloring Pages`;
  const subtitle = t?.readyMadeSub  ? t.readyMadeSub(name, q) : `Pick one to color instantly — or <a href="/?s=1&q=${q}&d=easy">generate a fresh one</a>.`;
  let html = `<section class="lp-section gallery-section">
    <h2 class="section-heading">${title}</h2>
    <p class="section-sub">${subtitle}</p>`;
  for (const diff of ["easy", "medium", "hard"]) {
    const imgs = topicImages[diff] || [];
    if (!imgs.length) continue;
    html += `<h3 class="gallery-diff-heading">${diffLabel[diff]}</h3>
    <div class="gallery-grid">${imgs.map(e => galleryCardHtml({ ...e, difficulty: diff }, meta, t, pageCtx)).join("")}</div>`;
  }
  html += `</section>`;
  return html;
}

function injectGalleryIntoHtml(staticHtml, galleryHtml) {
  // Find <footer, then inject before the last </div> preceding it (closes .legal-content).
  // The old regex approach broke on pages where .lp-related-grid's </div> appeared first.
  const footerIdx = staticHtml.indexOf('<footer');
  if (footerIdx === -1) return staticHtml;
  const divCloseIdx = staticHtml.lastIndexOf('</div>', footerIdx);
  if (divCloseIdx === -1) return staticHtml;
  return staticHtml.slice(0, divCloseIdx) + '\n' + galleryHtml + '\n' + staticHtml.slice(divCloseIdx);
}

function serveHtml(res, html) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
}

// Replace the old <nav class="legal-nav">...</nav> block in static HTML with the
// unified server-rendered nav from lp-nav-component.js.
function injectUnifiedNav(html, navHtml) {
  const start = html.indexOf('<nav class="legal-nav"');
  if (start === -1) return html; // already branded or missing
  const end = html.indexOf('</nav>', start);
  if (end === -1) return html;
  return html.slice(0, start) + navHtml + html.slice(end + 6);
}

async function serveTopicPageWithGallery(res, topic) {
  const meta = gallery.TOPIC_META[topic];
  const staticPath = path.join(PUBLIC_DIR, "coloring-pages", topic, "index.html");
  let baseHtml;
  try { baseHtml = fs.readFileSync(staticPath, "utf8"); }
  catch { return sendJson(res, 404, { error: "Not found" }); }

  const topicImages = gallery.getAllForTopic(topic);
  const hasAny = ["easy","medium","hard"].some(d => (topicImages[d]||[]).length > 0);
  const basePath = `/en/coloring-pages/${topic}/`;
  let enhanced = hasAny ? injectGalleryIntoHtml(baseHtml, gallerySection(topicImages, meta, null, { basePath })) : baseHtml;

  // Inject first gallery image as og:image for Pinterest/social sharing
  const firstImg = ["easy","medium","hard"].reduce((found, d) => found || (topicImages[d]||[])[0], null);
  if (firstImg) {
    const absUrl = `https://lalabuba.com${firstImg.url}`;
    enhanced = enhanced.replace(
      /<meta property="og:image"[^>]*>/,
      `<meta property="og:image" content="${absUrl}"/>`
    );
  }

  // Update canonical + hreflang self-reference to /en/ prefix
  enhanced = enhanced.replace(
    /<link rel="canonical" href="https:\/\/lalabuba\.com\/coloring-pages\//,
    '<link rel="canonical" href="https://lalabuba.com/en/coloring-pages/'
  );
  enhanced = enhanced.replace(
    /hreflang="en" href="https:\/\/lalabuba\.com\/coloring-pages\//g,
    `hreflang="en" href="https://lalabuba.com/en/coloring-pages/`
  );

  // Inject unified nav (replaces old legal-nav block in static HTML)
  const topicNav = buildNav({
    lang: 'en',
    breadcrumbs: [{ href: '/en/coloring-pages/', label: 'Coloring Pages' }, { label: meta.name }],
    hreflangMap: topicHreflangMap(topic),
    ctaHref: `/?s=1&q=${encodeURIComponent(topic)}&d=easy`,
  });
  enhanced = injectUnifiedNav(enhanced, topicNav);

  serveHtml(res, enhanced);
}

// Extracted DE topic page handler — shared by /ausmalbilder/:slug/ (old) and /de/ausmalbilder/:slug/ (new)
function serveDeTopicPageBySlug(res, deSlug) {
  const enTopic  = DE_TOPIC_MAP[deSlug];
  const staticPath = path.join(PUBLIC_DIR, "ausmalbilder", deSlug, "index.html");
  let baseHtml;
  try { baseHtml = fs.readFileSync(staticPath, "utf8"); } catch { /* fall through */ }
  if (!baseHtml) return sendJson(res, 404, { error: "Not found" });

  const deTopicName = enTopic ? (DE_TOPIC_NAMES[enTopic] || deSlug) : deSlug;
  const deNav = buildNav({
    lang: 'de',
    breadcrumbs: [{ href: '/de/ausmalbilder/', label: 'Ausmalbilder' }, { label: deTopicName }],
    hreflangMap: enTopic ? topicHreflangMap(enTopic) : { de: `https://lalabuba.com/de/ausmalbilder/${deSlug}/` },
    ctaHref: enTopic ? `/?s=1&q=${encodeURIComponent(enTopic)}&d=easy` : '/',
  });
  let enhanced = injectUnifiedNav(baseHtml, deNav);
  if (enTopic) {
    const topicImages = gallery.getAllForTopic(enTopic);
    const hasAny = ["easy","medium","hard"].some(d => (topicImages[d]||[]).length > 0);
    const deMeta = { ...gallery.TOPIC_META[enTopic], name: deTopicName };
    if (hasAny) enhanced = injectGalleryIntoHtml(enhanced, gallerySection(topicImages, deMeta, DE_GALLERY_T, { basePath: `/de/ausmalbilder/${deSlug}/` }));
    const firstImg = ["easy","medium","hard"].reduce((f, d) => f || (topicImages[d]||[])[0], null);
    if (firstImg) {
      enhanced = enhanced.replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="https://lalabuba.com${firstImg.url}"/>`);
    }
    enhanced = enhanced.replace(
      /<link rel="canonical" href="https:\/\/lalabuba\.com\/ausmalbilder\//,
      '<link rel="canonical" href="https://lalabuba.com/de/ausmalbilder/'
    );
    enhanced = enhanced.replace(
      /hreflang="de" href="https:\/\/lalabuba\.com\/ausmalbilder\//g,
      `hreflang="de" href="https://lalabuba.com/de/ausmalbilder/`
    );
  }
  return serveHtml(res, enhanced);
}

// Serve individual coloring-page image (URL-4): /en/coloring-pages/:topic/:slug/
function serveIndividualImagePage(res, lang, topic, imageSlug) {
  const topicImages = gallery.getAllForTopic(topic);
  let entry = null;
  let difficulty = null;
  for (const diff of ["easy","medium","hard"]) {
    const found = (topicImages[diff] || []).find(e => e.slug === imageSlug);
    if (found) { entry = { ...found, difficulty: diff }; difficulty = diff; break; }
  }
  if (!entry) return sendJson(res, 404, { error: "Not found" });

  const meta        = gallery.TOPIC_META[topic];
  const topicName   = meta?.name || topic;
  const subject     = entry.subject || topic;
  const subjectTitle = subject.charAt(0).toUpperCase() + subject.slice(1);
  const diffLabel   = { easy: "Easy", medium: "Medium", hard: "Hard" }[difficulty] || difficulty;
  const isDE        = lang === "de";
  const htmlLang    = isDE ? "de" : "en";
  const deSlug      = EN_TO_DE_SLUG[topic];
  const hubHref     = isDE ? "/de/ausmalbilder/" : "/en/coloring-pages/";
  const hubLabel    = isDE ? "Ausmalbilder" : "Coloring Pages";
  const topicPath   = isDE && deSlug ? `/de/ausmalbilder/${deSlug}/` : `/en/coloring-pages/${topic}/`;
  const basePath    = topicPath;
  const canonical   = `https://lalabuba.com${basePath}${imageSlug}/`;
  const title       = isDE
    ? `${subjectTitle} Ausmalbild (${diffLabel}) — Kostenlos | Lalabuba`
    : `${subjectTitle} Coloring Page (${diffLabel}) — Free Printable | Lalabuba`;
  const desc        = isDE
    ? `Kostenloses ${subject} Ausmalbild für Kinder. ${diffLabel}. Online ausmalen oder ausdrucken.`
    : `Free printable ${subject} coloring page for kids. ${diffLabel} difficulty. Color online or print at Lalabuba.`;
  const colorHref   = `/?s=1&img=${encodeURIComponent(entry.url)}&q=${encodeURIComponent(subject)}&d=${difficulty}`;
  const printHref   = `${basePath}${imageSlug}/print`;
  const dlHref      = `${basePath}${imageSlug}/print?download=1`;
  const colorLabel  = isDE ? "Online ausmalen →" : "Color Online →";
  const printLabel  = isDE ? "Drucken" : "Print";
  const dlLabel     = isDE ? "Herunterladen" : "Download PNG";

  const hreflangLines = [`  <link rel="alternate" hreflang="en" href="https://lalabuba.com/en/coloring-pages/${topic}/${imageSlug}/"/>`];
  if (deSlug) hreflangLines.push(`  <link rel="alternate" hreflang="de" href="https://lalabuba.com/de/ausmalbilder/${deSlug}/${imageSlug}/"/>`);
  hreflangLines.push(`  <link rel="alternate" hreflang="x-default" href="https://lalabuba.com/en/coloring-pages/${topic}/${imageSlug}/"/>`);

  const jsonLd = JSON.stringify({ "@context":"https://schema.org", "@graph": [
    { "@type":"ImageObject", "name":title, "description":desc,
      "contentUrl":`https://lalabuba.com${entry.url}`, "url":canonical,
      "encodingFormat": entry.url.endsWith(".jpg") ? "image/jpeg" : "image/png",
      "license":"https://creativecommons.org/licenses/by/4.0/",
      "creator":{"@type":"Organization","name":"Lalabuba"} },
    { "@type":"BreadcrumbList", "itemListElement":[
      {"@type":"ListItem","position":1,"name":hubLabel,"item":`https://lalabuba.com${hubHref}`},
      {"@type":"ListItem","position":2,"name":topicName,"item":`https://lalabuba.com${topicPath}`},
      {"@type":"ListItem","position":3,"name":subjectTitle,"item":canonical},
    ]},
  ]});

  const allImages = ["easy","medium","hard"].flatMap(d => (topicImages[d]||[]).map(e => ({...e,difficulty:d})));
  const related   = allImages.filter(e => e.slug !== imageSlug).slice(0, 4);
  const relatedHtml = related.length ? `
  <section class="lp-section gallery-section">
    <h2 class="section-heading">${isDE ? `Mehr ${topicName} Ausmalbilder` : `More ${topicName} Coloring Pages`}</h2>
    <div class="gallery-grid">${related.map(e => galleryCardHtml(e, meta, null, { basePath })).join("")}</div>
  </section>` : "";

  const html = `<!doctype html>
<html lang="${htmlLang}">
<head>
  <meta charset="utf-8"/>
  ${THEME_SCRIPT}
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <meta name="description" content="${desc}"/>
  <link rel="canonical" href="${canonical}"/>
${hreflangLines.join('\n')}
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${desc}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:image" content="https://lalabuba.com${entry.url}"/>
  <meta property="og:site_name" content="Lalabuba"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="theme-color" content="#7c4dff"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="icon" href="/favicon.png" type="image/png"/>
  <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
  <link rel="stylesheet" href="/css/legal.css?v=272"/>
  <link rel="stylesheet" href="/css/gallery.css?v=272"/>
  <link rel="stylesheet" href="/css/image-page.css?v=272"/>
  <script type="module" src="/js/lp-nav.js"></script>
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
${buildNav({ lang: htmlLang, breadcrumbs: [
  { href: hubHref, label: hubLabel },
  { href: topicPath, label: topicName },
  { label: subjectTitle },
], hreflangMap: { en:`https://lalabuba.com/en/coloring-pages/${topic}/${imageSlug}/`,
    ...(deSlug?{de:`https://lalabuba.com/de/ausmalbilder/${deSlug}/${imageSlug}/`}:{}) },
   ctaHref: colorHref })}
<main class="lp-main lp-image-page">
  <div class="lp-image-hero">
    <img src="${entry.url}" alt="${subjectTitle} coloring page — ${diffLabel}" class="lp-coloring-img" width="800" height="800" loading="eager"/>
    <div class="lp-image-actions">
      <a href="${colorHref}" class="lp-btn lp-btn-primary">✏️ ${colorLabel}</a>
      <a href="${printHref}" class="lp-btn lp-btn-secondary" target="_blank" rel="noopener">🖨️ ${printLabel}</a>
      <a href="${dlHref}" class="lp-btn lp-btn-outline" download="lalabuba-${imageSlug}.png">💾 ${dlLabel}</a>
    </div>
  </div>
  <div class="lp-image-info lp-section">
    <h1 class="lp-image-title">${subjectTitle}</h1>
    <div class="lp-image-meta">
      <span class="lp-diff-badge lp-diff-${difficulty}">${diffLabel}</span>
      <a href="${topicPath}" class="lp-topic-link">${topicName}</a>
    </div>
    <p class="lp-image-desc">${desc}</p>
    <a href="/?s=1&q=${encodeURIComponent(topic)}&d=${difficulty}" class="lp-generate-link">✨ ${isDE?`Mehr ${topicName} generieren`:`Generate more ${topicName}`} →</a>
  </div>
  ${relatedHtml}
</main>
<footer class="legal-footer">
  <span>© 2026 Lalabuba</span>
  <span class="sep">·</span>
  <a href="/privacy">Privacy</a>
  <span class="sep">·</span>
  <a href="/imprint">Imprint</a>
</footer>
</body>
</html>`;
  serveHtml(res, html);
}

// Print / download route (URL-5): /en/coloring-pages/:topic/:slug/print?download=1
function serveImagePrint(req, res, lang, topic, imageSlug) {
  const topicImages = gallery.getAllForTopic(topic);
  let entry = null;
  for (const diff of ["easy","medium","hard"]) {
    const found = (topicImages[diff] || []).find(e => e.slug === imageSlug);
    if (found) { entry = found; break; }
  }
  if (!entry) return sendJson(res, 404, { error: "Not found" });

  // ?download=1 → serve the PNG/JPG as attachment
  const qs = new URL(req.url, "https://lalabuba.com").searchParams;
  if (qs.get("download") === "1") {
    const relPath = entry.url.replace(/^\/img\//, "");
    const imgPath = path.join(__dirname, "data", "images", relPath);
    try {
      const buf = fs.readFileSync(imgPath);
      const ext = entry.url.endsWith(".jpg") ? "jpg" : "png";
      res.writeHead(200, {
        "Content-Type":        ext === "jpg" ? "image/jpeg" : "image/png",
        "Content-Disposition": `attachment; filename="lalabuba-${imageSlug}.${ext}"`,
        "Content-Length":      buf.length,
        "Cache-Control":       "public, max-age=31536000",
      });
      return res.end(buf);
    } catch {
      return sendJson(res, 404, { error: "Image file not found" });
    }
  }

  // Print page — minimal HTML, triggers window.print() on load
  const subjectTitle = (entry.subject || topic).charAt(0).toUpperCase() + (entry.subject || topic).slice(1);
  const html = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <title>${subjectTitle} — Print | Lalabuba</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{display:flex;flex-direction:column;align-items:center;min-height:100vh;background:#fff;padding:16px;font-family:sans-serif;}
    img{max-width:100%;height:auto;display:block;}
    .print-bar{display:flex;gap:12px;margin:0 0 16px;padding-bottom:16px;}
    .btn-print{padding:10px 20px;background:#7c4dff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;}
    .btn-close{padding:10px 20px;background:#eee;color:#333;border:none;border-radius:8px;cursor:pointer;font-size:1rem;text-decoration:none;}
    @media print{.print-bar{display:none!important;}body{padding:0;}img{width:100%;max-height:100vh;object-fit:contain;}}
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">🖨️ Print</button>
    <a class="btn-close" href="javascript:history.back()">← Back</a>
  </div>
  <img src="${entry.url}" alt="${subjectTitle} coloring page"/>
  <script>window.addEventListener('load', () => window.print());</script>
</body>
</html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
}

// Build hreflangMap object (lang→absolute-URL) for the language picker in the nav.
// Hub pages: each lang links to its own hub root.
function hubHreflangMap() {
  const m = { en: 'https://lalabuba.com/en/coloring-pages/', de: 'https://lalabuba.com/de/ausmalbilder/' };
  for (const [lang, cfg] of Object.entries(i18n.LANGS)) {
    m[lang] = `https://lalabuba.com/${cfg.root}/`;
  }
  return m;
}
// Topic pages: each lang links to its own topic page (or hub if no topic slug exists).
function topicHreflangMap(enTopic) {
  const m = { en: `https://lalabuba.com/en/coloring-pages/${enTopic}/` };
  const deSlug = EN_TO_DE_SLUG[enTopic];
  if (deSlug) m.de = `https://lalabuba.com/de/ausmalbilder/${deSlug}/`;
  for (const [lang, cfg] of Object.entries(i18n.LANGS)) {
    const slug = cfg.topicSlugs[enTopic];
    m[lang] = slug ? `https://lalabuba.com/${cfg.root}/${slug}/` : `https://lalabuba.com/${cfg.root}/`;
  }
  return m;
}
// Daily pages only exist in EN + DE; other langs fall back to their hub.
function dailyHreflangMap(enUrl, deUrl) {
  const m = { en: enUrl };
  if (deUrl) m.de = deUrl;
  for (const [lang, cfg] of Object.entries(i18n.LANGS)) {
    m[lang] = `https://lalabuba.com/${cfg.root}/`;
  }
  return m;
}

// ── i18n coloring-page SSR ───────────────────────────────────────────────────

const THEME_SCRIPT = `<script>(function(){var t=localStorage.getItem('lalabuba-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}})();</script>`;

const HEAD_COMMON = `  <meta name="theme-color" content="#7c4dff"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="icon" href="/favicon.png" type="image/png"/>
  <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
  <link rel="stylesheet" href="/css/legal.css?v=272"/>
  <link rel="stylesheet" href="/css/gallery.css"/>
  <script type="module" src="/js/lp-nav.js"></script>`;

// Build full hreflang block for coloring hub pages across all languages
function hubHreflang(currentLang) {
  const lines = [
    `  <link rel="alternate" hreflang="en" href="https://lalabuba.com/en/coloring-pages/"/>`,
    `  <link rel="alternate" hreflang="de" href="https://lalabuba.com/de/ausmalbilder/"/>`,
  ];
  for (const [lang, cfg] of Object.entries(i18n.LANGS)) {
    lines.push(`  <link rel="alternate" hreflang="${cfg.htmlLang}" href="https://lalabuba.com/${cfg.root}/"/>`);
  }
  lines.push(`  <link rel="alternate" hreflang="x-default" href="https://lalabuba.com/en/coloring-pages/"/>`);
  return lines.join('\n');
}

// Build full hreflang for a topic page across all languages
function topicHreflang(enTopic) {
  const lines = [
    `  <link rel="alternate" hreflang="en" href="https://lalabuba.com/en/coloring-pages/${enTopic}/"/>`,
  ];
  const deSlug = EN_TO_DE_SLUG[enTopic];
  if (deSlug) lines.push(`  <link rel="alternate" hreflang="de" href="https://lalabuba.com/de/ausmalbilder/${deSlug}/"/>`);
  for (const [lang, cfg] of Object.entries(i18n.LANGS)) {
    const slug = cfg.topicSlugs[enTopic];
    if (slug) lines.push(`  <link rel="alternate" hreflang="${cfg.htmlLang}" href="https://lalabuba.com/${cfg.root}/${slug}/"/>`);
  }
  lines.push(`  <link rel="alternate" hreflang="x-default" href="https://lalabuba.com/en/coloring-pages/${enTopic}/"/>`);
  return lines.join('\n');
}

function serveI18nHub(res, lang) {
  const cfg = i18n.LANGS[lang];
  if (!cfg) return sendJson(res, 404, { error: 'Not found' });
  const { root, htmlLang, t } = cfg;
  const canon = `https://lalabuba.com/${root}/`;

  const topicCards = i18n.TOPICS.map(enTopic => {
    const slug   = cfg.topicSlugs[enTopic] || enTopic;
    const name   = t.topicNames[enTopic] || enTopic;
    const emoji  = i18n.TOPIC_EMOJIS[enTopic] || '🎨';
    return `<a href="/${root}/${slug}/" class="lp-hub-card">
        <span class="lp-hub-emoji">${emoji}</span>
        <span class="lp-hub-name">${name}</span>
        <span class="lp-hub-cta">${t.topicCta}</span>
      </a>`;
  }).join('\n      ');

  const ldJson = JSON.stringify({
    "@context": "https://schema.org", "@type": "CollectionPage",
    "name": t.hubH1, "description": t.hubDesc, "url": canon,
    "hasPart": i18n.TOPICS.map(enTopic => ({
      "@type": "WebPage",
      "name": `${t.topicNames[enTopic] || enTopic}`,
      "url": `${canon}${cfg.topicSlugs[enTopic] || enTopic}/`,
    })),
  });

  const html = `<!doctype html>
<html lang="${htmlLang}">
<head>
  <meta charset="utf-8"/>
  ${THEME_SCRIPT}
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${t.hubTitle}</title>
  <meta name="description" content="${t.hubDesc}"/>
  <link rel="canonical" href="${canon}"/>
${hubHreflang(lang)}
  <meta property="og:title" content="${t.hubTitle}"/>
  <meta property="og:description" content="${t.hubDesc}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${canon}"/>
  <meta property="og:image" content="https://lalabuba.com/og-image.png"/>
  <meta property="og:site_name" content="Lalabuba"/>
${HEAD_COMMON}
  <script type="application/ld+json">${ldJson}</script>
</head>
<body>
${buildNav({ lang, breadcrumbs: [{ label: t.hubH1 }], hreflangMap: hubHreflangMap(), ctaHref: '/' })}
<div class="lp-hero">
  <div class="lp-hero-inner">
    <span class="lp-hero-emoji">🖍️</span>
    <h1>${t.hubH1}</h1>
    <p class="lp-hero-desc">${t.hubSub}</p>
    <a href="/" class="lp-cta">${t.hubCta}</a>
  </div>
</div>
<div class="legal-content">
  <section class="lp-section">
    <h2 class="section-heading">${t.hubSectionTitle}</h2>
    <p class="section-sub">${t.hubSectionSub}</p>
    <div class="lp-hub-grid">
      ${topicCards}
    </div>
  </section>
</div>
<footer class="legal-footer">
  ${t.footerLinks(root).map(([href, label], i) => (i ? `<span class="sep">·</span>\n  <a href="${href}">${label}</a>` : `<span>© 2026 Lalabuba</span>\n  <span class="sep">·</span>\n  <a href="${href}">${label}</a>`)).join('\n  ')}
</footer>
</body>
</html>`;
  serveHtml(res, html);
}

async function serveI18nTopic(res, lang, enTopic) {
  const cfg = i18n.LANGS[lang];
  if (!cfg || !gallery.TOPIC_META[enTopic]) return sendJson(res, 404, { error: 'Not found' });
  const { root, htmlLang, t } = cfg;
  const topicSlug  = cfg.topicSlugs[enTopic] || enTopic;
  const topicName  = t.topicNames[enTopic] || enTopic;
  const canon      = `https://lalabuba.com/${root}/${topicSlug}/`;
  const q          = encodeURIComponent(enTopic);
  const emoji      = i18n.TOPIC_EMOJIS[enTopic] || '🎨';

  const topicImages = gallery.getAllForTopic(enTopic);
  const hasAny  = ["easy","medium","hard"].some(d => (topicImages[d]||[]).length > 0);
  let galSection = '';
  if (hasAny) {
    const topicMeta = { name: topicName };
    galSection = gallerySection(topicImages, topicMeta, t, { basePath: `/${root}/${topicSlug}/` });
  }

  const firstImg = ["easy","medium","hard"].reduce((f, d) => f || (topicImages[d]||[])[0], null);
  const ogImage  = firstImg ? `https://lalabuba.com${firstImg.url}` : 'https://lalabuba.com/og-image.png';

  const relatedTopics = i18n.TOPICS
    .filter(et => et !== enTopic)
    .map(et => {
      const sl = cfg.topicSlugs[et] || et;
      const nm = t.topicNames[et] || et;
      return `<a href="/${root}/${sl}/" class="lp-related-card"><span class="lp-rel-emoji">${i18n.TOPIC_EMOJIS[et]}</span> ${nm}</a>`;
    }).join('');

  const html = `<!doctype html>
<html lang="${htmlLang}">
<head>
  <meta charset="utf-8"/>
  ${THEME_SCRIPT}
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${t.topicPageTitle(topicName)}</title>
  <meta name="description" content="${t.topicPageDesc(topicName)}"/>
  <link rel="canonical" href="${canon}"/>
${topicHreflang(enTopic)}
  <meta property="og:title" content="${t.topicPageTitle(topicName)}"/>
  <meta property="og:description" content="${t.topicPageDesc(topicName)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${canon}"/>
  <meta property="og:image" content="${ogImage}"/>
  <meta property="og:site_name" content="Lalabuba"/>
${HEAD_COMMON}
  <script type="application/ld+json">${JSON.stringify({
    "@context":"https://schema.org","@type":"WebPage",
    "name": t.topicPageTitle(topicName),
    "description": t.topicPageDesc(topicName),
    "url": canon,
  })}</script>
</head>
<body>
${buildNav({ lang, breadcrumbs: [{ href: `/${root}/`, label: t.hubH1 ? t.hubH1.split(' ').slice(0,3).join(' ') : 'Coloring' }, { label: topicName }], hreflangMap: topicHreflangMap(enTopic), ctaHref: `/?s=1&q=${q}&d=easy` })}
<div class="lp-hero">
  <div class="lp-hero-inner">
    <span class="lp-hero-emoji">${emoji}</span>
    <h1>${t.topicPageH1(topicName)}</h1>
    <p class="lp-hero-desc">${t.topicPageSub(topicName)}</p>
    <a href="/?s=1&q=${q}&d=easy" class="lp-cta">${t.generateCta(topicName)}</a>
  </div>
</div>
<div class="legal-content lp-wide">
  ${galSection}
  <section class="lp-section">
    <h2 class="section-heading">${t.topicsHeading}</h2>
    <div class="lp-related-grid">${relatedTopics}</div>
  </section>
  <section class="lp-section" style="text-align:center">
    <a href="/?s=1&q=${q}&d=easy" class="lp-cta">${t.generateCta(topicName)}</a>
  </section>
</div>
<footer class="legal-footer">
  ${t.footerLinks(root).map(([href, label], i) => (i ? `<span class="sep">·</span>\n  <a href="${href}">${label}</a>` : `<span>© 2026 Lalabuba</span>\n  <span class="sep">·</span>\n  <a href="${href}">${label}</a>`)).join('\n  ')}
</footer>
</body>
</html>`;
  serveHtml(res, html);
}

// Serve the main app (index.html) with lang-specific meta for /fr/, /es/, etc.
let _indexHtmlCache = null;
function getIndexHtml() {
  if (!_indexHtmlCache) {
    _indexHtmlCache = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  }
  return _indexHtmlCache;
}

function serveLanguageRoot(res, lang) {
  const meta = i18n.LANG_ROOT_META[lang];
  if (!meta) return sendJson(res, 404, { error: 'Not found' });
  const cfg  = i18n.LANGS[lang];
  const htmlLang = meta.htmlLang || cfg?.htmlLang || lang;
  const base = getIndexHtml();

  // Inject lang attr, meta title/desc, lang preset, canonical for this lang root
  const langRoot = `https://lalabuba.com/${lang}/`;
  let html = base
    .replace('<html lang="en">', `<html lang="${htmlLang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${meta.desc}"/>`)
    .replace('<link rel="canonical" href="https://lalabuba.com/" />', `<link rel="canonical" href="${langRoot}"/>`)
    .replace('content="en_US"', `content="${meta.ogLocale}"`)
    // Pre-seed the language in localStorage so the app boots in the right language
    .replace(
      '(function(){var t=localStorage.getItem(\'lalabuba-theme\')',
      `(function(){localStorage.setItem('lalabuba-lang','${lang}');var t=localStorage.getItem('lalabuba-theme')`
    );
  serveHtml(res, html);
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
  <link rel="stylesheet" href="/css/legal.css?v=272"/>
  <link rel="stylesheet" href="/css/gallery.css"/>
  <script type="module" src="/js/lp-nav.js"></script>
  <script type="application/ld+json">{
    "@context":"https://schema.org","@type":"WebPage",
    "name":"Today's Coloring Page: ${wordTitle}",
    "description":"Daily free AI coloring page — ${wordTitle} — ${date}",
    "url":"https://lalabuba.com/coloring-pages/today/"
  }</script>
</head>
<body>
${buildNav({ lang: 'en', breadcrumbs: [{ href: '/coloring-pages/', label: 'Coloring Pages' }, { label: 'Today' }], hreflangMap: dailyHreflangMap('https://lalabuba.com/coloring-pages/today/', 'https://lalabuba.com/ausmalbilder/heute/') })}
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
  const canonUrl  = `https://lalabuba.com/coloring-pages/daily/${date}-${word}/`;
  const deSlugDe  = gallery.DE_DAILY_WORDS[word];
  const deAltLink = deSlugDe ? `\n  <link rel="alternate" hreflang="de" href="https://lalabuba.com/ausmalbilder/taeglich/${date}-${deSlugDe}/"/>` : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <script>(function(){var t=localStorage.getItem('lalabuba-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}})();</script>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Free ${wordTitle} Coloring Page (${date}) | Lalabuba</title>
  <meta name="description" content="Free printable ${wordTitle} coloring page from ${date}. Color online at easy, medium, or hard difficulty — no account needed."/>
  <link rel="canonical" href="${canonUrl}"/>
  <link rel="alternate" hreflang="en" href="${canonUrl}"/>
  <link rel="alternate" hreflang="x-default" href="${canonUrl}"/>${deAltLink}
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
  <link rel="stylesheet" href="/css/legal.css?v=272"/>
  <link rel="stylesheet" href="/css/gallery.css"/>
  <script type="module" src="/js/lp-nav.js"></script>
  <script type="application/ld+json">{
    "@context":"https://schema.org","@type":"WebPage",
    "name":"${wordTitle} Coloring Page — ${date}",
    "description":"Free AI ${wordTitle} coloring page from ${date}",
    "url":"${canonUrl}"
  }</script>
</head>
<body>
${buildNav({ lang: 'en', breadcrumbs: [{ href: '/coloring-pages/', label: 'Coloring Pages' }, { label: `${wordTitle} (${date})` }], hreflangMap: dailyHreflangMap(`https://lalabuba.com/coloring-pages/daily/${date}-${word}/`, deAltLink ? `https://lalabuba.com/ausmalbilder/taeglich/${date}-${deWord}/` : null) })}
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

function serveGermanDailyPage(res, date, deWord) {
  const entry      = gallery.getDailyEntry(date);
  const enWord     = gallery.getDailyWordForDate(date);
  const deDisplay  = deWord.charAt(0).toUpperCase() + deWord.slice(1);
  const imgs       = entry?.images || [];
  const deCanon    = `https://lalabuba.com/ausmalbilder/taeglich/${date}-${deWord}/`;
  const enUrl      = `https://lalabuba.com/coloring-pages/daily/${date}-${enWord}/`;

  let galleryHtml = "";
  if (imgs.length) {
    galleryHtml = `<div class="gallery-grid">${imgs.map(e =>
      galleryCardHtml({ ...e, subject: deDisplay }, { name: deDisplay }, { colorThis: 'Ausmalen →' })
    ).join("")}</div>`;
  } else {
    galleryHtml = `<p class="gallery-empty">Das Ausmalbild für dieses Datum ist noch nicht verfügbar. <a href="/?s=1&q=${encodeURIComponent(deDisplay)}&d=easy" class="lp-cta-inline">Jetzt ${deDisplay} erstellen →</a></p>`;
  }

  const firstImg = imgs[0];
  const ogImage  = firstImg ? `https://lalabuba.com${firstImg.url}` : "https://lalabuba.com/og-image.png";

  const relatedHtml = Object.entries(gallery.TOPIC_META)
    .filter(([, m]) => !m.seasonal)
    .map(([slug, m]) => {
      const deSlug = EN_TO_DE_SLUG[slug] || slug;
      return `<a href="/ausmalbilder/${deSlug}/" class="lp-related-card"><span class="lp-rel-emoji">${m.emoji}</span> ${m.name}</a>`;
    }).join("");

  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <script>(function(){var t=localStorage.getItem('lalabuba-theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}})();</script>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Kostenloses ${deDisplay} Ausmalbild (${date}) | Lalabuba</title>
  <meta name="description" content="Kostenloses ${deDisplay} Ausmalbild zum Ausdrucken vom ${date}. Online ausmalen in leicht, mittel oder schwer — kostenlos, sofort, ohne Anmeldung."/>
  <link rel="canonical" href="${deCanon}"/>
  <link rel="alternate" hreflang="de" href="${deCanon}"/>
  <link rel="alternate" hreflang="en" href="${enUrl}"/>
  <link rel="alternate" hreflang="x-default" href="${enUrl}"/>
  <meta property="og:title" content="${deDisplay} Ausmalbild — ${date}"/>
  <meta property="og:description" content="Kostenloses KI-${deDisplay}-Ausmalbild. Leicht, mittel und schwer. Online ausmalen oder ausdrucken!"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${deCanon}"/>
  <meta property="og:image" content="${ogImage}"/>
  <meta property="og:site_name" content="Lalabuba"/>
  <meta name="theme-color" content="#7c4dff"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="icon" href="/favicon.png" type="image/png"/>
  <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
  <link rel="stylesheet" href="/css/legal.css?v=272"/>
  <link rel="stylesheet" href="/css/gallery.css"/>
  <script type="module" src="/js/lp-nav.js"></script>
  <script type="application/ld+json">{
    "@context":"https://schema.org","@type":"WebPage",
    "name":"${deDisplay} Ausmalbild — ${date}",
    "description":"Kostenloses KI-${deDisplay}-Ausmalbild vom ${date}",
    "url":"${deCanon}"
  }</script>
</head>
<body>
${buildNav({ lang: 'de', breadcrumbs: [{ href: '/ausmalbilder/', label: 'Ausmalbilder' }, { label: `${deDisplay} (${date})` }], hreflangMap: dailyHreflangMap(`https://lalabuba.com/coloring-pages/daily/${date}-${enWord}/`, `https://lalabuba.com/ausmalbilder/taeglich/${date}-${deWord}/`) })}
<div class="lp-hero">
  <div class="lp-hero-inner">
    <span class="lp-hero-emoji">🖌️</span>
    <h1>${deDisplay} Ausmalbild</h1>
    <p class="lp-hero-desc">Kostenloses ${deDisplay}-Ausmalbild vom <strong>${date}</strong>. Wähle eine Schwierigkeit oder erstelle dein eigenes!</p>
    <a href="/?s=1&q=${encodeURIComponent(deDisplay)}&d=easy" class="lp-cta">Eigenes ${deDisplay} erstellen →</a>
  </div>
</div>
<div class="legal-content">
  <section class="lp-section gallery-section">
    <h2 class="section-heading">${deDisplay} — ${date}</h2>
    ${galleryHtml}
  </section>
  <section class="lp-section">
    <h2 class="section-heading">Schwierigkeitsgrad wählen</h2>
    <div class="lp-diff-grid">
      ${[["easy","Leicht","🌟"],["medium","Mittel","🌟🌟"],["hard","Schwer","🌟🌟🌟"]].map(([d,dDE,stars]) =>
        `<div class="lp-diff-card"><span class="lp-diff-emoji">${stars}</span><h3>${dDE}</h3><a href="/?s=1&q=${encodeURIComponent(deDisplay)}&d=${d}" class="lp-diff-link">${dDE} erstellen →</a></div>`
      ).join("")}
    </div>
  </section>
  <section class="lp-section">
    <h2 class="section-heading">Alle Themen entdecken</h2>
    <div class="lp-related-grid">${relatedHtml}</div>
  </section>
</div>
<footer class="legal-footer">
  <span>© 2026 Lalabuba</span>
  <span class="sep">·</span><a href="/">App</a>
  <span class="sep">·</span><a href="/ausmalbilder/">Ausmalbilder</a>
  <span class="sep">·</span><a href="/features">Features</a>
  <span class="sep">·</span><a href="/privacy">Datenschutz</a>
  <span class="sep">·</span><a href="/contact">Kontakt</a>
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

  // ── Serve generated images (coloring shares + gallery + community shared) ──
  const imgMatch = p.match(/^\/img\/(c|g|s)\/([A-Za-z0-9_.-]+)$/);
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

  // Admin: top up gallery — generates up to `batch` images for slots below `target`.
  // Cycles through TOPIC_META subjects so no external subject list needed.
  if (p === "/api/gallery/topup" && req.method === "POST") {
    const adminKey = process.env.GALLERY_ADMIN_KEY;
    if (!adminKey || req.headers["x-admin-key"] !== adminKey) {
      return sendJson(res, 403, { error: "Forbidden" });
    }
    let body;
    try { body = await readJsonBody(req); } catch { body = {}; }
    const target = Math.min(parseInt(body.target) || 4, gallery.MAX_PER_SLOT || 9);
    const batch  = Math.min(parseInt(body.batch)  || 3, 10);

    const results = [];
    let generated = 0;
    outer: for (const topic of gallery.TOPICS) {
      for (const diff of gallery.DIFFICULTIES) {
        if (generated >= batch) break outer;
        const images   = gallery.getImages(topic, diff);
        if (images.length >= target) continue;
        const subjects = gallery.TOPIC_META[topic].subjects;
        const subject  = subjects[images.length % subjects.length];
        try {
          const { url } = await gallery.generateAndUpload(subject, diff, `${topic}-${diff}`);
          const entry   = await gallery.addToGallery(topic, diff, subject, url);
          results.push({ topic, diff, url, ok: true });
          generated++;
        } catch (err) {
          console.error(`topup error ${topic}/${diff}:`, err.message);
          results.push({ topic, diff, error: err.message });
        }
      }
    }
    return sendJson(res, 200, { generated, target, results });
  }

  // ── Auth API ───────────────────────────────────────────────────────────────
  if (p.startsWith("/api/auth/")) {
    if (req.method !== "GET" && req.method !== "OPTIONS") {
      try { req.body = await readJsonBody(req, 64_000); }
      catch (e) { return res.status(400).json({ error: e.message || "Invalid JSON body." }); }
    } else {
      req.body = {};
    }
    return authRouter(req, res, p);
  }

  // ── Community API ──────────────────────────────────────────────────────────
  if (p.startsWith("/api/community/")) {
    req.query = Object.fromEntries(parsedUrl.searchParams);
    if (req.method !== "GET" && req.method !== "OPTIONS") {
      // Community artwork uploads are up to 900KB image (~1.3MB base64 in JSON).
      const bodyLimit = p === "/api/community/artwork" ? 2_000_000 : 1_000_000;
      try { req.body = await readJsonBody(req, bodyLimit); }
      catch (e) { return res.status(400).json({ error: e.message || "Invalid JSON body." }); }
    } else {
      req.body = {};
    }
    return communityRouter(req, res, p);
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

    // ── URL-3: Language-prefixed EN routes (/en/coloring-pages/...) ────────────
    if (p === "/en/coloring-pages" || p === "/en/coloring-pages/") {
      const hubPath = path.join(PUBLIC_DIR, "coloring-pages", "index.html");
      try { return serveHtml(res, fs.readFileSync(hubPath, "utf8")); } catch { /* 404 below */ }
    }
    if (p === "/en/coloring-pages/today" || p === "/en/coloring-pages/today/") {
      const { word, date } = gallery.getDailyWord();
      res.writeHead(301, { Location: `/en/coloring-pages/daily/${date}-${word}/`, "Cache-Control": "no-store" });
      return res.end();
    }
    const enDailyMatch = p.match(/^\/en\/coloring-pages\/daily\/(\d{4}-\d{2}-\d{2})-([a-z]+)\/?$/);
    if (enDailyMatch) return serveDailyPage(res, enDailyMatch[1], enDailyMatch[2]);
    const enPrintMatch = p.match(/^\/en\/coloring-pages\/([a-z]+)\/([a-z0-9-]+)\/print\/?$/);
    if (enPrintMatch && gallery.TOPIC_META[enPrintMatch[1]]) {
      return serveImagePrint(req, res, "en", enPrintMatch[1], enPrintMatch[2]);
    }
    const enImageMatch = p.match(/^\/en\/coloring-pages\/([a-z]+)\/([a-z0-9-]+)\/?$/);
    if (enImageMatch && gallery.TOPIC_META[enImageMatch[1]]) {
      return serveIndividualImagePage(res, "en", enImageMatch[1], enImageMatch[2]);
    }
    const enTopicMatch2 = p.match(/^\/en\/coloring-pages\/([a-z]+)\/?$/);
    if (enTopicMatch2 && gallery.TOPIC_META[enTopicMatch2[1]]) {
      return serveTopicPageWithGallery(res, enTopicMatch2[1]);
    }

    // ── URL-3: Language-prefixed DE routes (/de/ausmalbilder/...) ─────────────
    if (p === "/de/ausmalbilder" || p === "/de/ausmalbilder/") {
      const hubPath = path.join(PUBLIC_DIR, "ausmalbilder", "index.html");
      try { return serveHtml(res, fs.readFileSync(hubPath, "utf8")); } catch { /* 404 below */ }
    }
    if (p === "/de/ausmalbilder/heute" || p === "/de/ausmalbilder/heute/") {
      const { word: dw, date } = gallery.getDailyWordDE();
      res.writeHead(301, { Location: `/de/ausmalbilder/taeglich/${date}-${dw}/`, "Cache-Control": "no-store" });
      return res.end();
    }
    const deLangDailyMatch = p.match(/^\/de\/ausmalbilder\/taeglich\/(\d{4}-\d{2}-\d{2})-([a-z]+)\/?$/);
    if (deLangDailyMatch) return serveGermanDailyPage(res, deLangDailyMatch[1], deLangDailyMatch[2]);
    const dePrintMatch = p.match(/^\/de\/ausmalbilder\/([a-z]+)\/([a-z0-9-]+)\/print\/?$/);
    if (dePrintMatch) {
      const et = DE_TOPIC_MAP[dePrintMatch[1]];
      if (et) return serveImagePrint(req, res, "de", et, dePrintMatch[2]);
    }
    const deLangImageMatch = p.match(/^\/de\/ausmalbilder\/([a-z]+)\/([a-z0-9-]+)\/?$/);
    if (deLangImageMatch) {
      const et = DE_TOPIC_MAP[deLangImageMatch[1]];
      if (et) return serveIndividualImagePage(res, "de", et, deLangImageMatch[2]);
    }
    const deLangTopicMatch = p.match(/^\/de\/ausmalbilder\/([a-z]+)\/?$/);
    if (deLangTopicMatch) return serveDeTopicPageBySlug(res, deLangTopicMatch[1]);

    // ── URL-2: 301 redirects — old bare paths → language-prefixed canonicals ──
    if (p === "/coloring-pages" || p === "/coloring-pages/") {
      res.writeHead(301, { Location: "/en/coloring-pages/", "Cache-Control": "public, max-age=31536000" });
      return res.end();
    }
    if (p === "/ausmalbilder" || p === "/ausmalbilder/") {
      res.writeHead(301, { Location: "/de/ausmalbilder/", "Cache-Control": "public, max-age=31536000" });
      return res.end();
    }

    // Old /coloring-pages/* → 301 to /en/coloring-pages/* (URL-2)
    if (p === "/coloring-pages/today" || p === "/coloring-pages/today/") {
      const { word, date } = gallery.getDailyWord();
      res.writeHead(301, { Location: `/en/coloring-pages/daily/${date}-${word}/`, "Cache-Control": "no-store" });
      return res.end();
    }
    const dailyMatch = p.match(/^\/coloring-pages\/daily\/(\d{4}-\d{2}-\d{2})-([a-z]+)\/?$/);
    if (dailyMatch) {
      res.writeHead(301, { Location: `/en/coloring-pages/daily/${dailyMatch[1]}-${dailyMatch[2]}/`, "Cache-Control": "public, max-age=31536000" });
      return res.end();
    }
    const topicMatch = p.match(/^\/coloring-pages\/([a-z]+)\/?$/);
    if (topicMatch && gallery.TOPIC_META[topicMatch[1]]) {
      res.writeHead(301, { Location: `/en/coloring-pages/${topicMatch[1]}/`, "Cache-Control": "public, max-age=31536000" });
      return res.end();
    }
    // Old /ausmalbilder/* → 301 to /de/ausmalbilder/* (URL-2)
    if (p === "/ausmalbilder/heute" || p === "/ausmalbilder/heute/") {
      const { word: deWord, date } = gallery.getDailyWordDE();
      res.writeHead(301, { Location: `/de/ausmalbilder/taeglich/${date}-${deWord}/`, "Cache-Control": "no-store" });
      return res.end();
    }
    const deDailyMatch = p.match(/^\/ausmalbilder\/taeglich\/(\d{4}-\d{2}-\d{2})-([a-z]+)\/?$/);
    if (deDailyMatch) {
      res.writeHead(301, { Location: `/de/ausmalbilder/taeglich/${deDailyMatch[1]}-${deDailyMatch[2]}/`, "Cache-Control": "public, max-age=31536000" });
      return res.end();
    }
    const deTopicMatch = p.match(/^\/ausmalbilder\/([a-z]+)\/?$/);
    if (deTopicMatch) {
      const staticPath = path.join(PUBLIC_DIR, "ausmalbilder", deTopicMatch[1], "index.html");
      if (fs.existsSync(staticPath)) {
        res.writeHead(301, { Location: `/de/ausmalbilder/${deTopicMatch[1]}/`, "Cache-Control": "public, max-age=31536000" });
        return res.end();
      }
    }

    // ── Language root pages: /de/, /fr/, /es/, /pt/, /ru/, /it/, /nl/, /pl/, /tr/, /zh/, /hi/ ──
    const langRootMatch = p.match(/^\/([a-z]{2,3})\/?$/);
    if (langRootMatch) {
      const lrCode = langRootMatch[1];
      if (lrCode === 'de' || i18n.LANGS[lrCode]) {
        return serveLanguageRoot(res, lrCode);
      }
    }

    // ── i18n coloring-page hub: /pages-a-colorier/, /paginas-para-colorear/, etc. ──
    // Build a fast lookup of root → lang on first use
    if (!serveI18nHub._roots) {
      serveI18nHub._roots = {};
      for (const [lang, cfg] of Object.entries(i18n.LANGS)) {
        serveI18nHub._roots[cfg.root] = lang;
      }
    }

    // Match /<root>/ (hub) or /<root>/<slug>/ (topic)
    const pathNoSlash = p.replace(/\/$/, '');
    const parts = pathNoSlash.split('/').filter(Boolean); // ['pages-a-colorier'] or ['pages-a-colorier','dragon']

    if (parts.length === 1 && serveI18nHub._roots[parts[0]]) {
      return serveI18nHub(res, serveI18nHub._roots[parts[0]]);
    }

    if (parts.length === 2 && serveI18nHub._roots[parts[0]]) {
      const lang     = serveI18nHub._roots[parts[0]];
      const topicSlug = parts[1];
      const cfg      = i18n.LANGS[lang];
      // Reverse slug → enTopic
      const enTopic  = Object.entries(cfg.topicSlugs).find(([, s]) => s === topicSlug)?.[0];
      if (enTopic) return serveI18nTopic(res, lang, enTopic);
    }

    return serveStaticFile(req, res, p);
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

(async () => {
  await db.runMigrations();
  gallery.backfillSlugs();
  db.cleanupExpiredArtworks().catch(err => console.error("[cleanup]", err.message));
  setInterval(() => db.cleanupExpiredArtworks().catch(() => {}), 24 * 60 * 60 * 1000);
  server.listen(PORT, HOST, () => {
    console.log(`Lalabuba server listening on http://${HOST}:${PORT}`);
  });
})().catch(err => {
  console.error("Fatal startup error:", err.message || err);
  process.exit(1);
});
