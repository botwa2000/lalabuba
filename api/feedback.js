"use strict";
// POST /api/feedback — ratings from the website and the apps (table feedback,
// migration 011). Shown in the "Feedback & ratings" section of /admin/stats.
//
//   { kind: "picture", rating: 1..3, image: "/img/c/…" | absolute URL, difficulty? }
//       😕 / 🙂 / 😍 for one coloring page, from the completion celebration.
//       Joined to generation_log by image path → subject, provider, difficulty.
//       One rating per rater per picture; tapping again changes it.
//   { kind: "site", rating: 1..5, comment? }
//       Grown-ups' rating of Lalabuba. One per rater per 30 days (a newer one
//       replaces it). Comments are emailed to the team inbox.
// Identity/platform/country follow lib/usage.js (no IP, no user agent stored).

const db = require("../lib/db");
const rateLimit = require("../lib/rate-limit");
const { clientIp } = require("../lib/client-ip");
const usage = require("../lib/usage");
const { sendAdminAlert } = require("../lib/email");

const LIMIT = 30;                  // feedback posts per IP per hour
const WINDOW_MS = 60 * 60_000;
const SITE_REPEAT_DAYS = 30;
const COMMENT_MAX = 1000;

const ALLOWED_ORIGINS = ["https://lalabuba.com", "https://www.lalabuba.com", "https://dev.lalabuba.com", "http://localhost:3000"];
const DIFFICULTIES = new Set(["easy", "medium", "hard", "extreme"]);

// Accept "/img/c/x.png" or "https://lalabuba.com/img/c/x.png" → "/img/c/x.png".
function imagePathOf(v) {
  const m = String(v || "").match(/\/img\/(c|g|s)\/[A-Za-z0-9_.-]{1,120}$/);
  return m ? m[0] : null;
}

function cleanComment(v) {
  const s = String(v || "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  return s ? s.slice(0, COMMENT_MAX) : null;
}

async function ratePicture(ctx, body) {
  const rating = Number(body.rating);
  if (![1, 2, 3].includes(rating)) return { status: 400, error: "rating must be 1..3" };
  const image = imagePathOf(body.image);
  if (!image) return { status: 400, error: "image required" };

  // The generation that served this image (none for gallery /img/g pictures).
  const { rows } = await db.query(
    `SELECT id, subject_en, provider, difficulty FROM generation_log
      WHERE image_path = $1 ORDER BY ts DESC LIMIT 1`, [image]);
  const g = rows[0] || {};
  const provider = g.provider || (image.startsWith("/img/g/") ? "gallery" : null);
  const difficulty = g.difficulty || (DIFFICULTIES.has(body.difficulty) ? body.difficulty : null);

  await db.query(
    `INSERT INTO feedback (kind, platform, app_version, install_id, visitor_hash, rating, image_path,
                           generation_id, subject_en, provider, difficulty, lang, country)
     VALUES ('picture', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (COALESCE(install_id::text, visitor_hash), image_path) WHERE kind = 'picture'
     DO UPDATE SET rating = EXCLUDED.rating, ts = NOW()`,
    [ctx.platform, ctx.version, ctx.installId, ctx.visitorHash, rating, image,
     g.id || null, g.subject_en || null, provider, difficulty, ctx.lang, ctx.country]);
  return { status: 204 };
}

async function rateSite(ctx, body) {
  const rating = Number(body.rating);
  if (![1, 2, 3, 4, 5].includes(rating)) return { status: 400, error: "rating must be 1..5" };
  const comment = cleanComment(body.comment);
  const who = ctx.installId || ctx.visitorHash;

  // A newer rating from the same rater within 30 days replaces the old one, so
  // the average reflects people, not clicks.
  const upd = await db.query(
    `UPDATE feedback SET rating = $1, comment = COALESCE($2, comment), ts = NOW(), lang = $3
      WHERE id = (SELECT id FROM feedback WHERE kind = 'site'
                    AND COALESCE(install_id::text, visitor_hash) = $4
                    AND ts > NOW() - ($5 || ' days')::interval
                  ORDER BY ts DESC LIMIT 1)
      RETURNING id`, [rating, comment, ctx.lang, who, SITE_REPEAT_DAYS]);
  if (!upd.rowCount) {
    await db.query(
      `INSERT INTO feedback (kind, platform, app_version, install_id, visitor_hash, rating, comment, lang, country)
       VALUES ('site', $1, $2, $3, $4, $5, $6, $7, $8)`,
      [ctx.platform, ctx.version, ctx.installId, ctx.visitorHash, rating, comment, ctx.lang, ctx.country]);
  }
  if (comment) {
    sendAdminAlert(`Lalabuba feedback ${"★".repeat(rating)} (${ctx.platform}${ctx.country ? ", " + ctx.country : ""})`,
      `${"★".repeat(rating)}${"☆".repeat(5 - rating)}  ${ctx.platform} ${ctx.version || ""} ${ctx.lang || ""}\n\n${comment}\n\n— /admin/stats`);
  }
  return { status: 204 };
}

module.exports = async function feedbackHandler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const rl = await rateLimit.consume("feedback:ip", clientIp(req), LIMIT, WINDOW_MS);
  if (rl.limited) return res.status(429).json({ error: "Too many requests." });

  const body = req.body || {};
  // Honeypot: bots fill every field; pretend success.
  if (body.website) return res.status(204).end();

  try {
    const ctx = await usage.requestContext(req, body.iid, body.lang);
    const r = body.kind === "picture" ? await ratePicture(ctx, body)
      : body.kind === "site" ? await rateSite(ctx, body)
      : { status: 400, error: "unknown kind" };
    if (r.status === 204) return res.status(204).end();
    return res.status(r.status).json({ error: r.error });
  } catch (err) {
    console.error("[feedback]", err.message);
    return res.status(500).json({ error: "Could not save feedback." });
  }
};

module.exports._imagePathOf = imagePathOf;
module.exports._cleanComment = cleanComment;
