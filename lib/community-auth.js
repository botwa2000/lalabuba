"use strict";
// Shared auth + validation helpers for all /api/community/* handlers.

const fs   = require("fs");
const path = require("path");
const crypto = require("crypto");
const db   = require("./db");

const SHARED_IMG_DIR = path.join(__dirname, "../data/images/s");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Ensure shared image directory exists.
function ensureSharedDir() {
  if (!fs.existsSync(SHARED_IMG_DIR)) fs.mkdirSync(SHARED_IMG_DIR, { recursive: true });
}

// Read and validate the X-Device-ID header. Returns null if missing/malformed.
function getDeviceUuid(req) {
  const id = (req.headers["x-device-id"] || "").trim();
  return UUID_RE.test(id) ? id : null;
}

// Respond 401 and return false if device UUID is missing.
function requireDeviceUuid(req, res) {
  const uuid = getDeviceUuid(req);
  if (!uuid) {
    res.status(401).json({ error: "X-Device-ID header required." });
    return null;
  }
  return uuid;
}

// Ensure a profile row exists for this device UUID (INSERT ... ON CONFLICT DO NOTHING).
async function upsertProfile(uuid) {
  await db.query(
    `INSERT INTO profiles (device_uuid) VALUES ($1) ON CONFLICT (device_uuid) DO NOTHING`,
    [uuid]
  );
}

// Returns true if the device has exceeded max_shares_per_week.
async function isShareLimitExceeded(uuid) {
  const maxPerWeek = await db.getConfigInt("max_shares_per_week", 5);
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM artworks
     WHERE device_uuid = $1 AND shared_at > NOW() - INTERVAL '7 days'`,
    [uuid]
  );
  return parseInt(rows[0].cnt) >= maxPerWeek;
}

// Validate base64-encoded image data. Returns { buffer, ext } or throws.
async function validateImageData(b64) {
  if (typeof b64 !== "string" || !b64) throw new Error("imageData required.");

  // Strip data URI prefix if present (data:image/jpeg;base64,...)
  const stripped = b64.replace(/^data:image\/[a-z]+;base64,/, "");
  const buffer = Buffer.from(stripped, "base64");

  // Check MIME magic bytes: FF D8 = JPEG, 89 50 4E 47 = PNG
  let ext;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    ext = "jpg";
  } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    ext = "png";
  } else {
    throw new Error("imageData must be a JPEG or PNG image.");
  }

  const maxKb = await db.getConfigInt("max_image_kb", 900);
  if (buffer.length > maxKb * 1024) {
    throw new Error(`Image too large — maximum ${maxKb} KB.`);
  }

  return { buffer, ext };
}

// Save a validated image buffer to data/images/s/ and return the public URL path.
function saveUploadedImage(buffer, ext) {
  ensureSharedDir();
  const rand = crypto.randomBytes(4).toString("hex");
  const ts   = Date.now();
  const filename = `${ts}-${rand}.${ext}`;
  fs.writeFileSync(path.join(SHARED_IMG_DIR, filename), buffer);
  return `/img/s/${filename}`;
}

// Compute expiry timestamp from DB config artwork_ttl_days.
async function computeExpiresAt() {
  const ttlDays = await db.getConfigInt("artwork_ttl_days", 30);
  const d = new Date();
  d.setDate(d.getDate() + ttlDays);
  return d.toISOString();
}

// Hash an email address (SHA-256 of lowercased trimmed email). Never store raw email.
function hashEmail(email) {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

// Generate a random family code: 6 uppercase alphanumeric chars, excluding I/O/0/1.
function generateFamilyCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// Validate a family code format (6 chars, uppercase alpha-numeric, no I/O/0/1).
function isValidFamilyCode(code) {
  return typeof code === "string" && /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}

// Rate limiting — per-endpoint in-memory Maps (keyed by IP).
function makeRateLimiter(maxRequests, windowMs) {
  const map = new Map();
  return function isLimited(ip) {
    const now = Date.now();
    const entry = map.get(ip);
    if (!entry || now > entry.resetAt) {
      map.set(ip, { count: 1, resetAt: now + windowMs });
      if (map.size > 5000) {
        for (const [k, v] of map) if (now > v.resetAt) map.delete(k);
      }
      return false;
    }
    if (entry.count >= maxRequests) return true;
    entry.count++;
    return false;
  };
}

const HOUR = 60 * 60 * 1000;

module.exports = {
  getDeviceUuid,
  requireDeviceUuid,
  upsertProfile,
  isShareLimitExceeded,
  validateImageData,
  saveUploadedImage,
  computeExpiresAt,
  hashEmail,
  generateFamilyCode,
  isValidFamilyCode,
  makeRateLimiter,
  HOUR,
  // CORS origins — same as other handlers
  ALLOWED_ORIGINS: [
    "https://lalabuba.com",
    "https://www.lalabuba.com",
    "https://dev.lalabuba.com",
    "http://localhost:3000",
  ],
};
