"use strict";
// POST /api/community/report-content — a child/parent flags an AI-generated
// picture as offensive from the coloring screen (Google Play AI-Generated
// Content policy). Body:
//   { reason, subject, seed?, difficulty?, source?, imageUrl?, imageData?,
//     platform?, appVersion? }
// The reported picture is copied to private storage (data/reports/, never
// served) so it can be reviewed via /api/admin/content-reports even after the
// public /img/c copy expires. imageData (base64) is only used when the picture
// is not one of ours on disk. No free text is accepted — kids app, no PII.

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const db     = require("../../lib/db");
const auth   = require("../../lib/community-auth");
const { sanitizeSubject } = require("../../lib/content-safety");
const { sendAdminAlert } = require("../../lib/email");

const REPORTS_DIR = path.join(__dirname, "../../data/reports");
const IMAGES_DIR  = path.join(__dirname, "../../data/images");
const REASONS     = new Set(["scary", "inappropriate", "wrong", "other"]);
const SOURCES     = new Set(["custom", "card", "daily", "surprise", "explore", "challenge", "share"]);
// Same shape server.js serves at /img/(c|g|s)/<file>.
const IMG_PATH_RE = /^\/img\/(c|g|s)\/([A-Za-z0-9_.-]+)$/;

const deviceLimiter = auth.makeRateLimiter("content-report:device", 20, auth.HOUR);
const ipLimiter     = auth.makeRateLimiter("content-report:ip", 60, auth.HOUR);

// Accept "/img/c/x.png" or "https://lalabuba.com/img/c/x.png"; anything else → null.
function toImagePath(url) {
  if (typeof url !== "string" || !url) return null;
  let p = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      if (!/(^|\.)lalabuba\.com$/i.test(u.hostname)) return null;
      p = u.pathname;
    } catch {
      return null;
    }
  }
  return IMG_PATH_RE.test(p) ? p : null;
}

function short(v, max) {
  return typeof v === "string" ? v.replace(/[\x00-\x1F\x7F]+/g, " ").trim().slice(0, max) || null : null;
}

// Copy the reported picture into private storage. Returns the filename or null.
async function saveEvidence(imagePath, imageData) {
  let buffer = null;
  let ext = "png";
  if (imagePath) {
    const [, dir, file] = IMG_PATH_RE.exec(imagePath);
    try {
      buffer = fs.readFileSync(path.join(IMAGES_DIR, dir, file));
      ext = path.extname(file).slice(1).toLowerCase() || "png";
    } catch { /* expired or never saved — fall back to imageData */ }
  }
  if (!buffer && imageData) {
    try {
      ({ buffer, ext } = await auth.validateImageData(imageData));
    } catch {
      return null;
    }
  }
  if (!buffer) return null;
  // Never let a storage problem lose the report itself — the row still records
  // subject/seed/image_path, so the picture can be regenerated for review.
  try {
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext === "jpeg" ? "jpg" : ext}`;
    fs.writeFileSync(path.join(REPORTS_DIR, filename), buffer);
    return filename;
  } catch (err) {
    console.error("[content-report] evidence save failed:", err.message);
    return null;
  }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (auth.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-ID");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const uuid = auth.requireDeviceUuid(req, res);
  if (!uuid) return;
  const ip = auth.clientIp(req);
  if ((await ipLimiter(ip)) || (await deviceLimiter(uuid))) {
    return res.status(429).json({ error: "Too many requests." });
  }

  const body    = req.body || {};
  const reason  = REASONS.has(body.reason) ? body.reason : null;
  const subject = sanitizeSubject(body.subject);
  if (!reason)  return res.status(400).json({ error: "Invalid reason." });
  if (!subject) return res.status(400).json({ error: "subject required." });

  const seedNum    = Number(body.seed);
  const seed       = Number.isSafeInteger(seedNum) && seedNum > 0 ? seedNum : null;
  const difficulty = ["easy", "medium", "hard", "extreme"].includes(body.difficulty) ? body.difficulty : null;
  const source     = SOURCES.has(body.source) ? body.source : null;
  const imagePath  = toImagePath(body.imageUrl);
  const platform   = short(body.platform, 20);
  const appVersion = short(body.appVersion, 30);

  // Idempotent: the same device re-reporting the same picture is a no-op.
  const { rows: existing } = await db.query(
    `SELECT id FROM content_reports
     WHERE reporter_uuid = $1 AND subject = $2
       AND COALESCE(seed, 0) = COALESCE($3::bigint, 0)
       AND COALESCE(image_path, '') = COALESCE($4, '')`,
    [uuid, subject, seed, imagePath]
  );
  if (existing.length) return res.status(200).json({ ok: true, id: existing[0].id });

  const evidence = await saveEvidence(imagePath, body.imageData);

  let id;
  try {
    const { rows } = await db.query(
      `INSERT INTO content_reports
         (reporter_uuid, subject, seed, difficulty, source, reason, image_path, evidence_file, platform, app_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [uuid, subject, seed, difficulty, source, reason, imagePath, evidence, platform, appVersion]
    );
    id = rows[0].id;
  } catch (e) {
    if (e.code === "23505") return res.status(200).json({ ok: true }); // raced a duplicate
    throw e;
  }

  console.warn(`[content-report] #${id} reason=${reason} subject="${subject}" seed=${seed} source=${source} evidence=${evidence ? "yes" : "no"}`);
  sendAdminAlert(
    `[Lalabuba] Content report #${id}: ${reason} — "${subject}"`,
    [
      `A user reported an AI-generated picture.`,
      ``,
      `Report:     #${id}`,
      `Reason:     ${reason}`,
      `Subject:    ${subject}`,
      `Seed:       ${seed ?? "-"}`,
      `Difficulty: ${difficulty ?? "-"}`,
      `Source:     ${source ?? "-"}`,
      `Image:      ${imagePath ? `https://lalabuba.com${imagePath}` : "-"}`,
      `Evidence:   ${evidence ? "saved" : "not available"}`,
      `Platform:   ${platform ?? "-"} ${appVersion ?? ""}`,
      ``,
      `Review: GET /api/admin/content-reports (X-Admin-Key).`,
    ].join("\n")
  ); // fire-and-forget; never throws

  return res.status(200).json({ ok: true, id });
};

module.exports._toImagePath = toImagePath;
