"use strict";
// Renders the Lalabuba product & technical documentation as a self-contained
// HTML page. Pass { internal: true } to include protected technical sections.
// The caller is responsible for auth gating — this function never checks auth.

const BASE = "https://lalabuba.com";

const SCREENSHOTS = {
  phone: [
    { file: "final_phone_port_01_home.png",      alt: "Home screen — type a subject to draw" },
    { file: "final_phone_port_02_coloring.png",   alt: "Coloring mode — color by number" },
    { file: "final_phone_port_03_completed.png",  alt: "Completed artwork + achievement" },
    { file: "final_phone_port_04_explore.png",    alt: "Explore — ready-made coloring pages" },
    { file: "final_phone_port_05_community.png",  alt: "Community gallery" },
  ],
  tablet: [
    { file: "final_tablet_land_01_home.png",      alt: "Tablet home — landscape layout" },
    { file: "final_tablet_land_02_coloring.png",  alt: "Tablet coloring mode" },
    { file: "final_tablet_land_03_completed.png", alt: "Tablet completed + achievement" },
    { file: "final_tablet_land_04_explore.png",   alt: "Tablet explore gallery" },
    { file: "final_tablet_land_05_community.png", alt: "Tablet community" },
  ],
};

function imgTag(file, alt, style = "") {
  return `<img src="/docs/screenshots/${file}" alt="${esc(alt)}" loading="lazy"${style ? ` style="${style}"` : ""} class="doc-img">`;
}

function phoneRow(indices = [0, 1, 2]) {
  return `<div class="screenshot-row">${indices.map(i => {
    const s = SCREENSHOTS.phone[i];
    return s ? `<figure><div class="phone-frame">${imgTag(s.file, s.alt)}</div><figcaption>${esc(s.alt)}</figcaption></figure>` : "";
  }).join("")}</div>`;
}

function tabletRow(indices = [0]) {
  return `<div class="screenshot-row screenshot-row--wide">${indices.map(i => {
    const s = SCREENSHOTS.tablet[i];
    return s ? `<figure>${imgTag(s.file, s.alt)}</figure>` : "";
  }).join("")}</div>`;
}

function badge(label, color = "#7C4DFF") {
  return `<span class="badge" style="background:${color}">${esc(label)}</span>`;
}

function internalBadge() {
  return `<span class="internal-badge">🔒 Internal</span>`;
}

function section(id, title, content, opts = {}) {
  const isInternal = opts.internal;
  const cls = ["doc-section", isInternal ? "doc-section--internal" : ""].filter(Boolean).join(" ");
  return `<section id="${id}" class="${cls}">
  <h2>${esc(title)}${isInternal ? " " + internalBadge() : ""}</h2>
  ${content}
</section>`;
}

function subsection(title, content) {
  return `<div class="doc-subsection"><h3>${esc(title)}</h3>${content}</div>`;
}

function codeBlock(code, lang = "") {
  return `<pre class="code-block${lang ? ` lang-${lang}` : ""}"><code>${esc(code)}</code></pre>`;
}

function table(headers, rows) {
  const th = headers.map(h => `<th>${esc(h)}</th>`).join("");
  const tr = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Sections ──────────────────────────────────────────────────────────────────

const S_OVERVIEW = section("overview", "What is Lalabuba", `
<p>Lalabuba is a kids AI coloring web app and native mobile application (iOS + Android). A child types any word — <em>dragon breathing fire</em>, <em>bunny skateboarding</em>, <em>space princess</em> — and AI generates a line-art coloring page in seconds. The child then colors it by number, paints freehand, or doodles with a pencil overlay.</p>
<p>Completed art is saved to a personal <strong>My Journal</strong>, earns achievement badges, and can be shared to a public community gallery. An Explore screen provides hundreds of pre-generated ready-to-color pages organized by topic.</p>
<div class="callout">
  <strong>Audience:</strong> Children 3–12 and their parents. Free to use, no accounts, no in-app purchases.
</div>
${phoneRow([0,1,2])}
`);

const S_PLATFORM = section("platform", "Platform & URLs", `
<div class="grid-2">
  <div class="platform-card">
    <h3>🌐 Web</h3>
    <p><a href="https://lalabuba.com">lalabuba.com</a></p>
    <ul>
      <li>Vanilla JavaScript ES modules</li>
      <li>HTML5 Canvas coloring engine</li>
      <li>No build step, no framework</li>
      <li>English + German (+ 10 more via i18n)</li>
      <li>PWA-ready (manifest + service worker)</li>
    </ul>
  </div>
  <div class="platform-card">
    <h3>📱 Mobile</h3>
    <p>iOS (App Store) · Android (Google Play)</p>
    <ul>
      <li>Flutter — single codebase</li>
      <li>Full feature parity with web</li>
      <li>iOS: built via Codemagic</li>
      <li>Android: built via GitHub Actions</li>
      <li>Package: <code>com.lalabuba.lalabuba</code></li>
    </ul>
  </div>
</div>
`);

const S_FEATURES = section("features", "Core Features", `

${subsection("AI Image Generation", `
<p>The user types a subject and selects a difficulty. The server calls the AI provider waterfall to produce a segmented line-art image with numbered regions. The image is stored on the server and served via Cloudflare CDN.</p>
<ul>
  <li><strong>Difficulty:</strong> Easy (3–4 large regions, toddler style) · Medium (6–10 regions, cartoon) · Hard (15–30 detailed regions) · Extreme (mandala-style, dozens of tiny cells — unlocks after completing Easy + Medium + Hard at least once)</li>
  <li><strong>Palette:</strong> Classic · Pastel · Nature (all unlocked) · Neon (5 completions) · Candy (15) · Galaxy (30) — 24 colors each</li>
  <li><strong>Color count:</strong> 6 · 12 · 18 · 24 · max</li>
  <li><strong>Art style:</strong> Classic (structured regions + numbers) · Sketch (artistic, no numbers)</li>
  <li><strong>Surprise me (💡):</strong> fills a random subject</li>
  <li><strong>Daily word pill:</strong> deterministic word of the day (same for all users), fixed seed so all get the same image</li>
  <li><strong>Suggestion cards:</strong> 4 rotating thematic cards shuffled with 🎲</li>
  <li><strong>Scene-of-the-week pill:</strong> picks a scene by ISO week number, shows a random subject from that scene's list</li>
  <li><strong>Voice input:</strong> microphone button (hidden if SpeechRecognition unavailable) — speak a word to fill the input</li>
</ul>
${phoneRow([0])}
`)}

${subsection("Coloring Modes", `
<ul>
  <li><strong>Tap mode:</strong> tap a numbered region to flood-fill it. Double-tap fills all regions assigned that number simultaneously. Uses pre-computed region map from a background Web Worker; falls back to BFS before segmentation completes.</li>
  <li><strong>Pencil/Draw mode (✏️):</strong> freehand strokes on an overlay canvas. Strokes covering ≥70% of a region auto-convert to a fill. Easy/Medium assist mode keeps strokes inside boundaries.</li>
  <li><strong>Brush/Paint mode:</strong> locked until 3 total completions. Thicker freehand strokes, same coverage detection.</li>
  <li><strong>Erase mode:</strong> drag across regions to remove fills and restore base line art.</li>
  <li><strong>Free mode:</strong> one-way unlock that disables color enforcement — any tap fills any region with any color.</li>
</ul>
<p><strong>Undo:</strong> up to 10 steps (Ctrl/Cmd+Z or undo button). Batch fills count as one undo entry. Undo history is in-memory, reset on new image.</p>
<p><strong>Canvas customisation:</strong> background color picker · shape (square/circle/oval/diamond, last two locked at 5/10 completions) · frame (none/wooden/gold, locked at 5/10). All persisted in localStorage.</p>
<p><strong>Zoom:</strong> pinch-to-zoom and pan via Pointer Events. Pan mode prevents accidental fills during navigation.</p>
${phoneRow([1])}
`)}

${subsection("Explore — Ready-Made Gallery", `
<p>A curated library of pre-generated coloring pages organized by topic. Available from the home screen (🖼️ button) and via dedicated SEO pages.</p>
<ul>
  <li><strong>Topics:</strong> Dragon · Unicorn · Butterfly · Dinosaur · Cat · Princess · Mermaid · Rocket</li>
  <li><strong>German topics:</strong> /de/ausmalbilder/ with localized names</li>
  <li>One-tap "Color this →" opens a gallery image directly in coloring mode with no generation wait</li>
  <li>Images organized by difficulty (Easy/Medium/Hard)</li>
  <li>Individual image pages with print/download, SEO-optimized, JSON-LD structured data</li>
</ul>
${tabletRow([3])}
`)}

${subsection("Community Gallery", `
<p>Users can share their colored artworks, templates, or freehand drawings to a public community feed. Parental consent is required on first share.</p>
<ul>
  <li><strong>Filter tabs:</strong> All · Colorings · Templates · Drawings · Daily</li>
  <li><strong>Star artworks:</strong> one star per device per artwork</li>
  <li><strong>Report:</strong> report inappropriate content; auto-hides at threshold</li>
  <li><strong>Nicknames:</strong> curated adjective+animal combos (e.g. "Sparkly Penguin")</li>
  <li><strong>Avatar:</strong> emoji chosen from a set of 20</li>
</ul>
${tabletRow([4])}
`)}

${subsection("Scenes & FX", `
<p>Once an image is generated, the user can add animated scene backgrounds and visual effects before or after coloring.</p>
<ul>
  <li><strong>Scenes:</strong> Meadow · Space · Underwater · Rainbow · Winter and more</li>
  <li><strong>FX overlays:</strong> Sparkles · Confetti · Fireflies · Snow</li>
  <li><strong>Narration:</strong> AI-generated short story read aloud via Web Speech API</li>
  <li><strong>Voice:</strong> character voices for the narration</li>
</ul>
`)}

${subsection("My Journal & Achievements", `
<p>Every completed coloring (≥90% coverage OR manual "I'm finished!" tap) is auto-saved to My Journal — a per-device gallery stored in localStorage and synced to the community profile.</p>
<ul>
  <li>Saved as PNG via HTML5 Canvas <code>toDataURL</code></li>
  <li>Achievement badges unlock on milestones: First Masterpiece, Color Explorer, etc.</li>
  <li>Sticker shelf shows all earned badges</li>
  <li>Journal grid shows thumbnail previews of all saved art</li>
</ul>
${phoneRow([2])}
`)}

${subsection("Share & Challenge", `
<ul>
  <li><strong>🏆 Challenge:</strong> generates a QR code / share URL so others can color the same template</li>
  <li><strong>🖼️ Share art:</strong> shares the completed artwork image via OS share sheet (mobile) or download (web)</li>
  <li><strong>💾 Save:</strong> downloads the coloring as a PNG</li>
  <li><strong>🖨️ Print:</strong> opens the browser print dialog with a clean layout</li>
  <li><strong>🎲 Again!:</strong> regenerates a new image with the same subject and settings</li>
</ul>
`)}

${subsection("Settings & Accessibility", `
<ul>
  <li><strong>Theme toggle (🌙/☀️):</strong> dark/light mode, persisted in localStorage</li>
  <li><strong>Language picker:</strong> 12 languages, updates all UI text immediately</li>
  <li><strong>Config panel:</strong> collapsible sidebar on desktop; drawer on mobile (hamburger ☰)</li>
  <li><strong>Landscape mobile:</strong> left sidebar config, canvas fills remaining width</li>
  <li><strong>Help panel (❓):</strong> in-app how-to guide</li>
</ul>
`)}
`);

const S_USERFLOW = section("userflow", "User Flow", `
<ol class="flow-list">
  <li><strong>Land on lalabuba.com</strong> → hero state: suggestion cards, daily word, settings chips</li>
  <li><strong>Type a subject</strong> (or tap a suggestion card / daily word / Surprise me)</li>
  <li><strong>Choose settings:</strong> difficulty, palette, color count, number mode</li>
  <li><strong>Click Draw! ✨</strong> → loading overlay with bouncing dots</li>
  <li><strong>Image renders</strong> → coloring hint banner, palette sidebar, canvas</li>
  <li><strong>Color the image</strong> via Tap / Paint / Draw modes</li>
  <li><strong>Complete</strong> → "Well done!" dialog, achievement badge, auto-save to Journal</li>
  <li><strong>Share / Again! / Explore more</strong></li>
</ol>
`);

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL SECTIONS (only rendered when internal: true)
// ─────────────────────────────────────────────────────────────────────────────

const S_ARCH = section("architecture", "Technical Architecture", `
<div class="callout callout--warn">This section is confidential. Do not share with external parties.</div>
<div class="grid-2">
  <div>
    <h3>Web</h3>
    <ul>
      <li>Vanilla JS ES modules, zero build step</li>
      <li>HTML5 Canvas fill engine (<code>public/js/fill-core.js</code>)</li>
      <li>Single-page app: <code>.app.app-hero</code> ↔ coloring state toggle</li>
      <li>No React, no bundler, no TypeScript</li>
      <li><code>public/js/</code>: ~20 modules (generate, gallery, community, share, scenes, fx, narration, i18n, …)</li>
    </ul>
  </div>
  <div>
    <h3>Server</h3>
    <ul>
      <li>Node.js raw HTTP (no Express)</li>
      <li>Hetzner VPS: <code>91.99.212.17</code></li>
      <li>Docker Swarm, single node</li>
      <li>Prod stack port 3020, Dev stack port 3021</li>
      <li>Admin panel port 3030</li>
      <li>Cloudflare in front (CDN + DDoS + Turnstile)</li>
    </ul>
  </div>
  <div>
    <h3>Database</h3>
    <ul>
      <li>PostgreSQL on the same Hetzner box</li>
      <li>Databases: <code>lalabuba_prod</code> / <code>lalabuba_dev</code></li>
      <li>Connection via <code>DATABASE_URL</code> env (Swarm secret)</li>
      <li>Auto-migrations on boot (<code>lib/db.js → runMigrations()</code>)</li>
    </ul>
  </div>
  <div>
    <h3>Mobile (Flutter)</h3>
    <ul>
      <li>Flutter single codebase → iOS + Android</li>
      <li>iOS: Codemagic <code>flutter-release</code> workflow</li>
      <li>Android: GitHub Actions → Play Store</li>
      <li>Talks to same <code>lalabuba.com</code> API</li>
      <li>Device UUID as identity (<code>DeviceIdService</code>)</li>
    </ul>
  </div>
</div>
`, { internal: true });

const S_PROVIDERS = section("providers", "AI Provider Waterfall", `
<p>Image generation uses a cost-optimised 5-tier waterfall (<code>lib/image-providers.js</code>) — free tiers first, paid Novita is the final fallback. Each tier is skipped if its key is absent. <strong>Hard/Extreme difficulty skips tiers 1–3 entirely</strong> (they time out on complex prompts) and goes straight to Novita.</p>
${table(
  ["Tier", "Provider", "Cost", "Limit", "Key(s)", "Notes"],
  [
    ["1", "Pollinations.ai", "Free, no key", "Unlimited (rate-limited)", "None", "Easy/Medium only. 50s timeout. Seed hashed with FNV-1a for cache isolation."],
    ["2", "Together AI", "Free", "~10,000 imgs/month", "TOGETHER_API_KEY", "Easy/Medium only. Model: FLUX.1-schnell-Free, 4 steps."],
    ["3", "Cloudflare Workers AI", "Free / ~$0.003/img overage", "~35 imgs/day free", "CF_ACCOUNT_ID + CF_API_TOKEN", "Easy/Medium only. 8 steps."],
    ["4", "Novita.ai (paid)", "~$0.001–0.003/img", "Daily cap (default 300/day)", "NOVITA_API_KEY", "All difficulties. Two-step: request URL → download."],
    ["5", "HuggingFace (legacy)", "Free (rate-limited)", "Low", "HF_TOKEN + HF_MODEL", "Final fallback only if Novita also unavailable."],
  ]
)}
<p><strong>All providers:</strong> 45-second abort controller, 25 MB response cap, magic-byte image validation (JPEG FF D8 / PNG 89 50 4E 47) before passing to client.</p>
<p><strong>Bot protection:</strong> Cloudflare Turnstile required on web (<code>TURNSTILE_SECRET_KEY</code>). Flutter sends <code>X-App-Key: $APP_API_KEY</code> instead. Translation: non-English subjects are translated to English before prompt building (<code>lib/translate.js</code>).</p>
`, { internal: true });

const S_API = section("api", "Server API Reference", `
<p>All routes are in <code>server.js</code> with handlers in <code>api/</code> and <code>api/community/</code>.</p>

${subsection("Core", `
${table(
  ["Method", "Path", "Auth", "Description"],
  [
    ["GET", "/api/health", "None", "Health + secrets format check. Returns 503 if critical secrets are malformed."],
    ["POST", "/api/generate-image", "Turnstile (web) / X-App-Key (mobile)", "Generate an AI coloring image. Body: { subject, difficulty, palette, colors, seed, turnstileToken }"],
    ["POST", "/api/contact", "None", "Contact form submission. Rate-limited per IP."],
    ["GET", "/api/gallery", "None", "Get gallery images. Params: topic, difficulty."],
    ["GET", "/img/c/:file", "None", "Serve coloring share images (data/images/c/)"],
    ["GET", "/img/g/:file", "None", "Serve gallery images (data/images/g/)"],
    ["GET", "/img/s/:file", "None", "Serve community shared images (data/images/s/)"],
  ]
)}
`)}

${subsection("Community API (/api/community/…)", `
${table(
  ["Method", "Path", "Auth", "Description"],
  [
    ["GET", "/api/community/config", "None", "Returns DB config flags as JSON (communityEnabled, maxSharesPerWeek, etc.)"],
    ["GET", "/api/community/nicknames", "None", "Returns curated nickname list + avatar emoji set"],
    ["GET|POST", "/api/community/profile", "X-Device-ID", "Get or update community profile (nickname, avatar)"],
    ["GET", "/api/community/gallery", "None", "Paginated approved artworks. Params: page, type, difficulty."],
    ["POST", "/api/community/artwork", "X-Device-ID + Turnstile/App-Key", "Upload artwork (base64 JPEG/PNG). First share requires X-Parental-Consent: yes."],
    ["DELETE", "/api/community/artwork/:id", "X-Device-ID (own artwork only)", "Delete own artwork + image file."],
    ["POST", "/api/community/star/:id", "X-Device-ID", "Toggle star on an artwork."],
    ["POST", "/api/community/report/:id", "X-Device-ID", "Report artwork. Auto-hides at report_auto_hide_threshold."],
    ["GET", "/api/community/leaderboard", "None", "Weekly or all-time leaderboard. Param: type=weekly|alltime."],
    ["POST", "/api/community/progress", "X-Device-ID", "Sync local completion stats to server for leaderboard."],
    ["GET|POST", "/api/community/family", "X-Device-ID + X-Parental-Consent", "Create/join/leave/view family group."],
  ]
)}
`)}

${subsection("Admin API", `
${table(
  ["Method", "Path", "Auth", "Description"],
  [
    ["POST", "/api/gallery/generate", "X-Admin-Key", "Generate + store a gallery image for a topic/difficulty/subject."],
    ["POST", "/api/gallery/generate-daily", "X-Admin-Key", "Generate today's daily word images (Easy/Medium/Hard)."],
    ["POST", "/api/gallery/topup", "X-Admin-Key", "Fill gallery slots below target count. Body: { target, batch }."],
  ]
)}
<p>Admin key: <code>GALLERY_ADMIN_KEY</code> env var, sent as <code>X-Admin-Key</code> header.</p>
`)}

${subsection("Auth API (/api/auth/…)", `
<p>JWT-based account auth for the admin panel. Handlers in <code>api/auth/router.js</code>.</p>
${table(
  ["Method", "Path", "Description"],
  [
    ["POST", "/api/auth/register", "Create admin account (bcrypt password)"],
    ["POST", "/api/auth/login", "Returns access token (15 min) + sets refresh cookie (30 days)"],
    ["POST", "/api/auth/refresh", "Rotate access token using refresh cookie"],
    ["POST", "/api/auth/logout", "Clears refresh cookie"],
  ]
)}
`)}
`, { internal: true });

const S_DB = section("database", "Database Schema", `
${table(
  ["Table", "Purpose"],
  [
    ["<code>db_migrations</code>", "Tracks applied SQL migration files"],
    ["<code>config</code>", "Runtime feature flags & caps (key/value). Editable via admin panel. Refreshed every 60s."],
    ["<code>profiles</code>", "Community profiles: nickname, avatar, streak, sharing_enabled, family_id"],
    ["<code>artworks</code>", "Shared artworks: image path, subject, difficulty, star/view/report counts, TTL"],
    ["<code>families</code>", "Family groups: 6-char code, member count, parent email hash (SHA-256, never plaintext)"],
    ["<code>stars</code>", "Many-to-many: device_uuid × artwork_id votes"],
    ["<code>reports</code>", "Report log: artwork_id × reporter_uuid (unique — one report per device per artwork)"],
    ["<code>leaderboard_cache</code>", "Cached weekly top-10 (recomputed on schedule)"],
  ]
)}
<p>Migrations: <code>db/migrations/001_schema.sql</code>, <code>002_config_defaults.sql</code>. Auto-applied on server boot via <code>lib/db.js → runMigrations()</code>.</p>
<p>Key config keys: <code>community_enabled</code>, <code>max_shares_per_week</code>, <code>artwork_ttl_days</code>, <code>report_auto_hide_threshold</code>, <code>gallery_page_size</code>.</p>
`, { internal: true });

const S_INFRA = section("infrastructure", "Infrastructure & Deployment", `

${subsection("Server topology", `
<ul>
  <li>Hetzner VPS (shared box with taxalex project) — <code>91.99.212.17</code></li>
  <li>Docker Swarm (single node). Two stacks: <code>lalabuba-prod</code> (port 3020) and <code>lalabuba-dev</code> (port 3021)</li>
  <li>Nginx reverse proxy on host → forwards to stacks</li>
  <li>Cloudflare → Nginx → Docker (SSL terminated at CF)</li>
  <li>Persistent volumes: <code>data/images/</code> (generated + community images)</li>
</ul>
`)}

${subsection("Deploy commands", `
${codeBlock(`# Deploy to dev (auto-triggered by push to dev branch)
./scripts/deploy.sh dev

# Deploy to prod (prompts for "deploy" confirmation)
./scripts/deploy.sh prod

# Sync Swarm secrets from .env
./scripts/deploy.sh secrets [dev|prod]

# Quick commit + push (GitHub key)
./scripts/deploy.sh push "commit message"`, "bash")}
`)}

${subsection("CI/CD", `
<ul>
  <li><strong>GitHub Actions:</strong> push to <code>dev</code> → auto-deploys dev stack. Push to <code>main</code> → manual trigger only.</li>
  <li><strong>iOS (Codemagic):</strong> <code>flutter-release</code> workflow. Triggered via GitHub Actions → Codemagic API (<code>CODEMAGIC_API_TOKEN</code>). CFBundleVersion = latest TestFlight build + 1.</li>
  <li><strong>Android:</strong> GitHub Actions → Gradle build → Play Store via service account.</li>
</ul>
`)}

${subsection("Secrets model", `
<p>All secrets are Docker Swarm secrets, prefix <code>lalabuba_prod_</code> / <code>lalabuba_dev_</code>, mounted at <code>/run/secrets/</code>. <code>docker-entrypoint.sh</code> strips the prefix and exports them as env vars before starting Node.</p>
<p>No secrets in the Docker image, on-disk env files, or the repo.</p>
`)}
`, { internal: true });

const S_ENV = section("environment", "Environment Variables", `
${table(
  ["Variable", "Required", "Description"],
  [
    ["<code>DATABASE_URL</code>", "✅ Prod", "PostgreSQL connection string"],
    ["<code>JWT_SECRET</code>", "✅ Prod", "32+ byte secret for admin panel JWT signing"],
    ["<code>GALLERY_ADMIN_KEY</code>", "✅ Prod", "Secret for admin gallery generation API"],
    ["<code>TURNSTILE_SECRET_KEY</code>", "✅ Prod", "Cloudflare Turnstile server key (format: 0x…)"],
    ["<code>APP_API_KEY</code>", "✅ Prod", "Flutter/native request gate. Flutter sends X-App-Key header."],
    ["<code>RESEND_API_KEY</code>", "✅ Prod", "Email delivery for OTP auth. ⚠️ Swarm secret is named BREVO_API_KEY — entrypoint.sh maps it to RESEND_API_KEY."],
    ["<code>NOVITA_API_KEY</code>", "Recommended", "Paid image gen (Tier 4, ~$0.001–0.003/img)"],
    ["<code>NOVITA_DAILY_CAP</code>", "Optional", "Max paid generations/day (default 300)"],
    ["<code>TOGETHER_API_KEY</code>", "Optional", "Free tier 2 — ~10k imgs/month"],
    ["<code>CF_ACCOUNT_ID</code>", "Optional", "Cloudflare Workers AI account ID (32 hex chars)"],
    ["<code>CF_API_TOKEN</code>", "Optional", "Cloudflare Workers AI API token"],
    ["<code>POLLINATIONS_TIMEOUT_MS</code>", "Optional", "Tier 1 timeout override (default 50000ms)"],
    ["<code>HF_TOKEN</code>", "Optional", "HuggingFace fallback (Tier 5, legacy)"],
    ["<code>HF_MODEL</code>", "Optional", "HuggingFace model ID (default FLUX.1-schnell)"],
    ["<code>DOCS_SECRET</code>", "✅ Prod (if /docs)", "HMAC secret for docs auth (openssl rand -base64 32)"],
    ["<code>DOCS_MASTER_HASH</code>", "✅ Prod (if /docs)", "SHA-256 hex of the docs master password"],
    ["<code>PORT</code>", "Optional", "HTTP port (default 3000; stacks override to 3020/3021)"],
    ["<code>HOST</code>", "Optional", "Bind host (default 127.0.0.1; containers set 0.0.0.0)"],
  ]
)}
`, { internal: true });

const S_SECURITY = section("security", "Security Model", `
<ul>
  <li><strong>No user accounts on web:</strong> identity is a random UUID in localStorage (<code>lalabuba-community-id</code>), sent as <code>X-Device-ID</code> header. No PII collected from children.</li>
  <li><strong>Parental consent gate:</strong> first community share requires <code>X-Parental-Consent: yes</code> header (Flutter: parental gate widget; Web: checkbox modal). Stored as <code>sharing_enabled=true</code> in profiles table — not re-checked on subsequent shares.</li>
  <li><strong>Content safety:</strong> <code>lib/content-safety.js</code> — all subjects pass through <code>isSafeSubject()</code> blocklist before generation.</li>
  <li><strong>Rate limiting:</strong> in-memory per-IP Map on all API endpoints. Generation: 10/hour. Community upload: <code>max_shares_per_week</code> from DB config. Auth: 5 failures/15 min lockout.</li>
  <li><strong>Image validation:</strong> community uploads validated by MIME magic bytes (JPEG FF D8 / PNG 89 50 4E 47) before saving.</li>
  <li><strong>SQL injection:</strong> all queries use parameterised placeholders (<code>$1, $2</code>) — never string concatenation.</li>
  <li><strong>Family email:</strong> parent email stored as SHA-256 hash only — raw email never persisted.</li>
  <li><strong>Community moderation:</strong> auto-hides artworks at <code>report_auto_hide_threshold</code> reports. Manual review via admin panel.</li>
  <li><strong>Admin panel:</strong> separate JWT auth (<code>lib/auth.js</code>), bcrypt passwords, 15-min access token + 30-day refresh cookie.</li>
  <li><strong>Docs auth:</strong> stateless HMAC-SHA256 session cookies + timed share tokens. No accounts, no database. Rate-limited login (5 fails/15 min lockout). <code>X-Robots-Tag: noindex</code> on all /docs routes.</li>
</ul>
`, { internal: true });

const S_FLUTTER = section("flutter", "Flutter Mobile App", `
${subsection("Screen map", `
${table(
  ["Screen", "Route / Feature", "Description"],
  [
    ["Home / Generate", "<code>features/generate/</code>", "Main generation screen — subject input, settings, Draw! button"],
    ["Canvas / Coloring", "<code>features/canvas/</code>", "Coloring mode — same Tap/Paint/Draw modes, palette sidebar"],
    ["Gallery / Explore", "<code>features/gallery/</code>", "Explore pre-made images + My Journal tab + Community tab"],
    ["Community", "<code>features/community/</code>", "Community gallery, star, report, share artwork"],
    ["Settings", "<code>features/settings/</code>", "Profile setup, avatar, nickname, family group, theme"],
    ["Scenes", "<code>features/scenes/</code>", "Animated scene backgrounds"],
    ["Achievements", "Widget in canvas/journal", "Badge sticker shelf"],
  ]
)}
`)}

${subsection("Key implementation details", `
<ul>
  <li>Coloring canvas: Flutter <code>CustomPainter</code> with same fill algorithm as web (<code>fill-core.js</code> logic ported)</li>
  <li>Image generation: <code>GenerateService</code> → same <code>/api/generate-image</code> endpoint</li>
  <li>Identity: <code>DeviceIdService</code> — UUID stored in <code>SharedPreferences</code>, sent as <code>X-Device-ID</code></li>
  <li>Auth on API calls: <code>X-App-Key</code> header replaces Turnstile for mobile</li>
  <li>Offline fonts: <code>google_fonts/</code> directory, <code>allowRuntimeFetching: false</code></li>
  <li>Persistence: SQLite (<code>sqflite</code>) for journal + achievements; SharedPreferences for settings</li>
  <li>Image save: <code>Gal</code> package for photo library save (iOS + Android)</li>
  <li>Share: <code>share_plus</code> package for OS share sheet</li>
</ul>
`)}
`, { internal: true });

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_PUBLIC = [
  { id: "overview",  label: "Overview" },
  { id: "platform",  label: "Platform" },
  { id: "features",  label: "Features" },
  { id: "userflow",  label: "User Flow" },
];

const NAV_INTERNAL = [
  { id: "architecture",    label: "Architecture" },
  { id: "providers",       label: "AI Providers" },
  { id: "api",             label: "API Reference" },
  { id: "database",        label: "Database" },
  { id: "infrastructure",  label: "Infrastructure" },
  { id: "environment",     label: "Env Variables" },
  { id: "security",        label: "Security" },
  { id: "flutter",         label: "Flutter App" },
];

// ── Full page renderer ─────────────────────────────────────────────────────────

function renderDocsPage({ internal = false } = {}) {
  const navItems = internal ? [...NAV_PUBLIC, ...NAV_INTERNAL] : NAV_PUBLIC;
  const navHtml = navItems.map(n =>
    `<a href="#${n.id}" class="nav-item${n.internal ? " nav-item--internal" : ""}">${esc(n.label)}</a>`
  ).join("\n");

  const sections = [
    S_OVERVIEW, S_PLATFORM, S_FEATURES, S_USERFLOW,
    ...(internal ? [S_ARCH, S_PROVIDERS, S_API, S_DB, S_INFRA, S_ENV, S_SECURITY, S_FLUTTER] : []),
  ].join("\n");

  const sessionNote = internal
    ? `<span class="session-badge">🔒 Internal view · <a href="/docs/logout">Log out</a></span>`
    : `<span class="session-badge">Public view · <a href="/docs/internal">Log in for full docs</a></span>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lalabuba — Product Documentation</title>
<meta name="robots" content="noindex,nofollow">
<style>
/* ── Reset & tokens ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --purple:#7C4DFF;--purple-light:#EDE7FF;--purple-dark:#5B35D6;
  --text:#1a1a2e;--text-muted:#5a5a7a;--bg:#f9f9fc;--surface:#fff;
  --border:#e2e2f0;--code-bg:#1e1e2e;--code-text:#cdd6f4;
  --warn-bg:#fff8e1;--warn-border:#f59e0b;
  --radius:10px;--sidebar:260px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
}
@media(prefers-color-scheme:dark){
  :root{--text:#e2e2f0;--text-muted:#9090b0;--bg:#0f0f1a;--surface:#1a1a2e;--border:#2a2a4a;--purple-light:#2a1f5a}
}
:root[data-theme=light]{--text:#1a1a2e;--text-muted:#5a5a7a;--bg:#f9f9fc;--surface:#fff;--border:#e2e2f0;--purple-light:#EDE7FF}
:root[data-theme=dark]{--text:#e2e2f0;--text-muted:#9090b0;--bg:#0f0f1a;--surface:#1a1a2e;--border:#2a2a4a;--purple-light:#2a1f5a}
body{background:var(--bg);color:var(--text);line-height:1.65}
a{color:var(--purple);text-decoration:none}a:hover{text-decoration:underline}
code{font-family:'JetBrains Mono','Fira Code',Consolas,monospace;font-size:.85em;background:var(--purple-light);padding:.1em .35em;border-radius:4px}

/* ── Layout ── */
.layout{display:grid;grid-template-columns:var(--sidebar) 1fr;min-height:100vh;max-width:1200px;margin:0 auto}
@media(max-width:768px){.layout{grid-template-columns:1fr}}

/* ── Sidebar ── */
.sidebar{position:sticky;top:0;height:100vh;overflow-y:auto;padding:24px 16px;border-right:1px solid var(--border);background:var(--surface)}
@media(max-width:768px){.sidebar{position:static;height:auto;border-right:none;border-bottom:1px solid var(--border)}}
.sidebar-logo{display:flex;align-items:center;gap:10px;margin-bottom:24px;font-weight:700;font-size:1.1rem;color:var(--text)}
.sidebar-logo svg{flex-shrink:0}
.nav-group{margin-bottom:8px;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);padding:0 8px}
.nav-item{display:block;padding:6px 10px;border-radius:6px;color:var(--text);font-size:.88rem;transition:background .15s}
.nav-item:hover,.nav-item.active{background:var(--purple-light);color:var(--purple);text-decoration:none}
.nav-item--internal{color:var(--text-muted)}
.nav-item--internal:hover,.nav-item--internal.active{background:var(--purple-light);color:var(--purple)}
.nav-divider{height:1px;background:var(--border);margin:12px 8px}
.session-badge{display:block;margin-top:24px;font-size:.75rem;color:var(--text-muted);padding:0 8px}

/* ── Main content ── */
.main{padding:48px 48px 80px;max-width:900px}
@media(max-width:768px){.main{padding:24px 20px 60px}}

.doc-header{margin-bottom:48px;padding-bottom:24px;border-bottom:1px solid var(--border)}
.doc-header h1{font-size:2rem;font-weight:800;color:var(--purple);margin-bottom:8px}
.doc-header p{color:var(--text-muted)}
.version-tag{display:inline-block;background:var(--purple-light);color:var(--purple);font-size:.75rem;padding:3px 10px;border-radius:20px;font-weight:600;margin-left:8px}

/* ── Sections ── */
.doc-section{margin-bottom:56px;scroll-margin-top:24px}
.doc-section h2{font-size:1.4rem;font-weight:700;margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid var(--border)}
.doc-section--internal{border-left:3px solid var(--purple);padding-left:20px}
.doc-section--internal h2{border-bottom-color:var(--purple)}
.doc-subsection{margin:20px 0}
.doc-subsection h3{font-size:1rem;font-weight:600;margin-bottom:10px;color:var(--text)}
.internal-badge{font-size:.7rem;background:var(--purple);color:#fff;padding:2px 8px;border-radius:10px;vertical-align:middle;font-weight:600}

/* ── Text elements ── */
p{margin-bottom:12px}
ul,ol{padding-left:22px;margin-bottom:12px}
li{margin-bottom:4px}
.flow-list{counter-reset:flow;list-style:none;padding:0}
.flow-list li{counter-increment:flow;display:flex;gap:12px;padding:10px 14px;margin-bottom:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px}
.flow-list li::before{content:counter(flow);min-width:24px;height:24px;background:var(--purple);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0;margin-top:2px}

/* ── Cards & grids ── */
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
@media(max-width:600px){.grid-2{grid-template-columns:1fr}}
.platform-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.platform-card h3{font-size:.9rem;font-weight:700;margin-bottom:8px;color:var(--purple)}
.platform-card ul{font-size:.85rem}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;color:#fff;font-size:.72rem;font-weight:600;margin-right:4px}
.callout{background:var(--purple-light);border-left:4px solid var(--purple);padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;font-size:.9rem}
.callout--warn{background:var(--warn-bg);border-color:var(--warn-border)}

/* ── Screenshots ── */
.screenshot-row{display:flex;gap:16px;margin:20px 0;flex-wrap:wrap}
.screenshot-row figure{flex:1;min-width:140px;max-width:200px;text-align:center}
.screenshot-row--wide figure{max-width:100%}
.phone-frame{background:#111;border-radius:20px;padding:8px;display:inline-block;box-shadow:0 4px 20px rgba(0,0,0,.25)}
.doc-img{width:100%;border-radius:12px;display:block}
figure figcaption{font-size:.72rem;color:var(--text-muted);margin-top:6px}

/* ── Tables ── */
.table-wrap{overflow-x:auto;margin:12px 0}
table{border-collapse:collapse;width:100%;font-size:.84rem}
th{background:var(--purple-light);color:var(--purple);padding:8px 12px;text-align:left;font-weight:600;white-space:nowrap}
td{padding:7px 12px;border-bottom:1px solid var(--border)}
tr:last-child td{border-bottom:none}
tr:hover td{background:var(--purple-light)}

/* ── Code blocks ── */
.code-block{background:var(--code-bg);color:var(--code-text);padding:16px 20px;border-radius:var(--radius);overflow-x:auto;font-family:'JetBrains Mono','Fira Code',Consolas,monospace;font-size:.82rem;line-height:1.6;margin:12px 0}
.code-block code{background:none;padding:0;font-size:inherit;color:inherit}

/* ── Login / token form ── */
.auth-card{max-width:400px;margin:80px auto;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:40px;text-align:center}
.auth-card h1{font-size:1.5rem;font-weight:800;color:var(--purple);margin-bottom:8px}
.auth-card p{color:var(--text-muted);font-size:.9rem;margin-bottom:24px}
.auth-card input{width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:1rem;margin-bottom:12px}
.auth-card button{width:100%;padding:11px;background:var(--purple);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer}
.auth-card button:hover{background:var(--purple-dark)}
.error-msg{color:#dc2626;font-size:.85rem;margin-top:8px}
</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <div class="sidebar-logo">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="8" fill="#7C4DFF"/><text x="14" y="20" font-size="16" text-anchor="middle" fill="white">🎨</text></svg>
      Lalabuba Docs
    </div>
    <div class="nav-group">Product</div>
    ${navItems.slice(0, 4).map(n => `<a href="#${n.id}" class="nav-item">${esc(n.label)}</a>`).join("\n")}
    ${internal ? `<div class="nav-divider"></div>
    <div class="nav-group">Technical</div>
    ${navItems.slice(4).map(n => `<a href="#${n.id}" class="nav-item">${esc(n.label)}</a>`).join("\n")}` : ""}
    ${sessionNote}
  </nav>
  <main class="main">
    <div class="doc-header">
      <h1>Lalabuba <span class="version-tag">v1.0</span></h1>
      <p>Product &amp; Technical Documentation${internal ? " — Full internal view" : " — Public overview"}</p>
    </div>
    ${sections}
  </main>
</div>
<script>
// Highlight active nav item on scroll
const items = document.querySelectorAll('.nav-item[href^="#"]');
const sections = [...items].map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      items.forEach(a => a.classList.remove('active'));
      const a = document.querySelector('.nav-item[href="#'+e.target.id+'"]');
      if (a) a.classList.add('active');
    }
  });
}, { threshold: 0.2 });
sections.forEach(s => obs.observe(s));
</script>
</body>
</html>`;
}

// ── Shared auth page styles ───────────────────────────────────────────────────
const AUTH_STYLES = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--purple:#7C4DFF;--purple-dark:#5B35D6;--text:#1a1a2e;--text-muted:#5a5a7a;--bg:#f9f9fc;--surface:#fff;--border:#e2e2f0}
@media(prefers-color-scheme:dark){:root{--text:#e2e2f0;--text-muted:#9090b0;--bg:#0f0f1a;--surface:#1a1a2e;--border:#2a2a4a}}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.card{max-width:380px;margin:72px auto;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:40px;text-align:center}
h1{font-size:1.4rem;font-weight:800;color:var(--purple);margin-bottom:6px}
.sub{color:var(--text-muted);font-size:.88rem;margin-bottom:28px;line-height:1.5}
label{display:block;text-align:left;font-size:.8rem;font-weight:600;color:var(--text-muted);margin-bottom:5px}
input{width:100%;padding:11px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:1rem;margin-bottom:14px;outline:none;transition:border-color .15s}
input:focus{border-color:var(--purple)}
button[type=submit]{width:100%;padding:12px;background:var(--purple);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;transition:background .15s}
button[type=submit]:hover{background:var(--purple-dark)}
.err{color:#dc2626;font-size:.82rem;margin-top:10px;padding:8px 12px;background:#fef2f2;border-radius:6px}
.back{display:block;margin-top:20px;font-size:.82rem;color:var(--text-muted)}
.cf-turnstile{margin:0 auto 14px;display:flex;justify-content:center}
.otp-input{font-size:2rem;font-weight:700;letter-spacing:.4em;text-align:center;padding:14px;font-family:monospace}
.hint{font-size:.78rem;color:var(--text-muted);margin-top:12px}
`;

// ── Step 1: Email + Turnstile ─────────────────────────────────────────────────
const TURNSTILE_SITE_KEY = "0x4AAAAAAC1F8nOkL4VkmWEd";

function renderLoginPage({ error = false, rateLimited = false } = {}) {
  const turnstileSiteKey = TURNSTILE_SITE_KEY;
  const errMsg = rateLimited
    ? "Too many attempts. Please wait 15 minutes and try again."
    : error
      ? "That email address is not authorised."
      : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lalabuba Docs — Sign in</title>
<meta name="robots" content="noindex,nofollow">
<style>${AUTH_STYLES}</style>
</head>
<body>
<div class="card">
  <h1>🎨 Lalabuba Docs</h1>
  <p class="sub">Enter your email to receive a<br>6-digit access code (valid 15 min)</p>
  <form method="POST" action="/docs/login">
    <label for="email">Email address</label>
    <input type="email" id="email" name="email" placeholder="your@email.com"
           autofocus autocomplete="email" required>
    ${turnstileSiteKey
      ? `<div class="cf-turnstile" data-sitekey="${esc(turnstileSiteKey)}" data-theme="auto"></div>`
      : ""}
    <button type="submit">Send code →</button>
    ${errMsg ? `<p class="err">${esc(errMsg)}</p>` : ""}
  </form>
  <a href="/docs" class="back">← Back to public docs</a>
</div>
${turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ""}
</body>
</html>`;
}

// ── Step 2: OTP entry ─────────────────────────────────────────────────────────
function renderOtpPage({ email = "", error = false, rateLimited = false } = {}) {
  const errMsg = rateLimited
    ? "Too many wrong codes. Please wait 15 minutes."
    : error
      ? "Incorrect code. Please check your email and try again."
      : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lalabuba Docs — Enter code</title>
<meta name="robots" content="noindex,nofollow">
<style>${AUTH_STYLES}</style>
</head>
<body>
<div class="card">
  <h1>🔑 Check your email</h1>
  <p class="sub">We sent a 6-digit code to<br><strong>${esc(email)}</strong></p>
  <form method="POST" action="/docs/verify">
    <label for="code">6-digit code</label>
    <input type="text" id="code" name="code" class="otp-input"
           placeholder="000000" maxlength="6" pattern="[0-9]{6}"
           inputmode="numeric" autocomplete="one-time-code" autofocus required>
    <button type="submit">Verify →</button>
    ${errMsg ? `<p class="err">${esc(errMsg)}</p>` : ""}
  </form>
  <p class="hint">Didn't receive it? Check spam or <a href="/docs/login">request a new code</a>.</p>
  <a href="/docs" class="back">← Back to public docs</a>
</div>
</body>
</html>`;
}

module.exports = { renderDocsPage, renderLoginPage, renderOtpPage };
