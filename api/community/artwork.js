"use strict";
const fs   = require("fs");
const path = require("path");
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");
const { sanitizeSubject, isSafeSubject } = require("../../lib/content-safety");

const browseLimiter  = auth.makeRateLimiter(60,  auth.HOUR);
const uploadLimiter  = auth.makeRateLimiter(10,  auth.HOUR);
const deleteLimiter  = auth.makeRateLimiter(20,  auth.HOUR);

const SHARED_IMG_DIR = path.join(__dirname, "../../data/images/s");

const VALID_TYPES = new Set(["colored", "template", "freehand"]);
const VALID_DIFFS = new Set(["easy", "medium", "hard", "extreme"]);

function corsHeaders(req, res) {
  const origin = req.headers.origin;
  if (auth.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-ID, X-Parental-Consent");
  }
}

// ── GET /api/community/gallery ───────────────────────────────────────────────
async function handleGallery(req, res, ip) {
  if (browseLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const enabled = await db.getConfigBool("community_enabled", true);
  if (!enabled) return res.status(503).json({ error: "Community gallery is currently unavailable." });

  const q = req.query || {};
  const page     = Math.max(0, parseInt(q.page) || 0);
  const rawType  = (q.type  || "").toLowerCase();
  const rawDiff  = (q.difficulty || "").toLowerCase();
  const rawSearch = (q.q || "").trim().slice(0, 100);
  const pageSize = await db.getConfigInt("gallery_page_size", 20);
  const offset   = page * pageSize;

  const conditions = [`a.moderation_status = 'approved'`, `a.expires_at > NOW()`];
  const params     = [];
  let   idx        = 1;

  if (rawType && rawType !== "all" && VALID_TYPES.has(rawType)) {
    conditions.push(`a.share_type = $${idx++}`);
    params.push(rawType);
  }
  if (rawDiff && VALID_DIFFS.has(rawDiff)) {
    conditions.push(`a.difficulty = $${idx++}`);
    params.push(rawDiff);
  }
  if (rawSearch) {
    conditions.push(`a.subject ILIKE $${idx++}`);
    params.push(`%${rawSearch}%`);
  }

  params.push(pageSize + 1, offset); // fetch one extra to detect next page
  const WHERE = conditions.join(" AND ");

  const { rows } = await db.query(
    `SELECT a.id, a.share_type, a.subject, a.difficulty, a.seed,
            a.image_path, a.star_count, a.view_count, a.shared_at,
            p.nickname, p.avatar_index
     FROM artworks a
     JOIN profiles p ON p.device_uuid = a.device_uuid
     WHERE ${WHERE}
     ORDER BY a.shared_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );

  const hasMore = rows.length > pageSize;
  const items   = rows.slice(0, pageSize);

  // Batch-increment view counts (fire-and-forget, non-blocking).
  if (items.length) {
    const ids = items.map(r => r.id);
    db.query(
      `UPDATE artworks SET view_count = view_count + 1 WHERE id = ANY($1::bigint[])`,
      [ids]
    ).catch(() => {});
  }

  const artworks = items.map(r => ({
    id:         r.id,
    shareType:  r.share_type,
    subject:    r.subject,
    difficulty: r.difficulty,
    seed:       r.seed ? String(r.seed) : null,
    imageUrl:   r.image_path,
    starCount:  r.star_count,
    viewCount:  r.view_count,
    sharedAt:   r.shared_at,
    nickname:   r.nickname || "Colorist",
    avatarIndex: r.avatar_index,
  }));

  return res.status(200).json({ artworks, nextPage: hasMore ? page + 1 : null });
}

// ── POST /api/community/artwork ──────────────────────────────────────────────
async function handleUpload(req, res, ip, uuid) {
  if (uploadLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const communityEnabled = await db.getConfigBool("community_enabled", true);
  const sharingEnabled   = await db.getConfigBool("sharing_enabled",   true);
  if (!communityEnabled || !sharingEnabled) {
    return res.status(503).json({ error: "Sharing is currently disabled." });
  }

  await auth.upsertProfile(uuid);

  // Check if parental consent is needed.
  const { rows: profileRows } = await db.query(
    "SELECT sharing_enabled FROM profiles WHERE device_uuid = $1",
    [uuid]
  );
  const profileSharingEnabled = profileRows[0]?.sharing_enabled || false;
  const hasConsent = req.headers["x-parental-consent"] === "yes";

  if (!profileSharingEnabled && !hasConsent) {
    return res.status(403).json({ error: "Parental consent required.", code: "PARENTAL_CONSENT_REQUIRED" });
  }

  if (hasConsent && !profileSharingEnabled) {
    await db.query(
      "UPDATE profiles SET sharing_enabled = TRUE, updated_at = NOW() WHERE device_uuid = $1",
      [uuid]
    );
  }

  // Enforce weekly share limit.
  if (await auth.isShareLimitExceeded(uuid)) {
    const max = await db.getConfigInt("max_shares_per_week", 5);
    return res.status(429).json({ error: `You can share up to ${max} artworks per week.`, code: "SHARE_LIMIT" });
  }

  // Enforce per-device total cap.
  const maxTotal = await db.getConfigInt("max_artworks_per_device", 50);
  const { rows: countRows } = await db.query(
    "SELECT COUNT(*) AS cnt FROM artworks WHERE device_uuid = $1",
    [uuid]
  );
  if (parseInt(countRows[0].cnt) >= maxTotal) {
    return res.status(429).json({ error: "Artwork limit reached. Delete old artworks to share more.", code: "DEVICE_LIMIT" });
  }

  const body = req.body || {};
  const shareType = (body.shareType || "").toLowerCase();
  if (!VALID_TYPES.has(shareType)) {
    return res.status(400).json({ error: "shareType must be 'colored', 'template', or 'freehand'." });
  }

  const rawSubject = typeof body.subject === "string" ? body.subject.slice(0, 200) : "";
  const subject    = rawSubject ? sanitizeSubject(rawSubject) : null;
  if (subject && !isSafeSubject(subject)) {
    return res.status(400).json({ error: "Subject contains disallowed content." });
  }
  const difficulty = typeof body.difficulty === "string" && VALID_DIFFS.has(body.difficulty.toLowerCase())
    ? body.difficulty.toLowerCase() : null;
  let seed = null;
  try { seed = body.seed !== undefined ? BigInt(body.seed).toString() : null; }
  catch { seed = null; }

  let imageResult;
  try {
    imageResult = await auth.validateImageData(body.imageData);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const imagePath  = auth.saveUploadedImage(imageResult.buffer, imageResult.ext);
  const expiresAt  = await auth.computeExpiresAt();

  const { rows: insertRows } = await db.query(
    `INSERT INTO artworks (device_uuid, share_type, subject, difficulty, seed, image_path, expires_at)
     VALUES ($1, $2, $3, $4, $5::bigint, $6, $7)
     RETURNING id, image_path, expires_at`,
    [uuid, shareType, subject, difficulty, seed, imagePath, expiresAt]
  );

  const row = insertRows[0];
  return res.status(201).json({
    id:        String(row.id),
    imageUrl:  row.image_path,
    expiresAt: row.expires_at,
  });
}

// ── DELETE /api/community/artwork/:id ────────────────────────────────────────
async function handleDelete(req, res, ip, uuid, artworkId) {
  if (deleteLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const id = parseInt(artworkId);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid artwork id." });

  const { rows } = await db.query(
    "SELECT image_path FROM artworks WHERE id = $1 AND device_uuid = $2",
    [id, uuid]
  );
  if (!rows.length) return res.status(404).json({ error: "Artwork not found or not yours." });

  const imagePath = rows[0].image_path; // e.g. /img/s/filename.jpg
  await db.query("DELETE FROM artworks WHERE id = $1 AND device_uuid = $2", [id, uuid]);

  // Remove file (best-effort).
  try {
    const filename = path.basename(imagePath);
    fs.unlinkSync(path.join(SHARED_IMG_DIR, filename));
  } catch (_) {}

  return res.status(200).json({ ok: true });
}

// ── Main export ───────────────────────────────────────────────────────────────
module.exports = async (req, res, artworkId) => {
  corsHeaders(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();

  if (req.method === "GET") return handleGallery(req, res, ip);

  const uuid = auth.requireDeviceUuid(req, res);
  if (!uuid) return;

  if (req.method === "POST" && !artworkId) return handleUpload(req, res, ip, uuid);
  if (req.method === "DELETE" && artworkId) return handleDelete(req, res, ip, uuid, artworkId);

  res.status(405).json({ error: "Method not allowed." });
};
