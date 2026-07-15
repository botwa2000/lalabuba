"use strict";
// Child profile CRUD: GET/POST/PUT/DELETE /api/auth/children[/:id]
const db       = require("../../lib/db");
const auth     = require("../../lib/auth");
const commAuth = require("../../lib/community-auth");
const bcrypt   = require("bcryptjs");

const AVATAR_COUNT = 20;
const AGE_GROUPS   = ["3-5", "6-8", "9-12", "13+"];

module.exports = async (req, res, p) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const token  = auth.bearerToken(req);
  const claims = token ? auth.verifyAccessToken(token) : null;
  if (!claims) return res.status(401).json({ error: "Authentication required.", code: "UNAUTHORIZED" });

  const { accountId } = claims;

  // Route: /api/auth/children/:id
  const idMatch = p.match(/^\/api\/auth\/children\/(\d+)$/);
  const childId = idMatch ? parseInt(idMatch[1], 10) : null;

  if (childId) {
    return handleSingle(req, res, accountId, childId);
  }
  return handleCollection(req, res, accountId);
};

async function handleCollection(req, res, accountId) {
  if (req.method === "GET") {
    const { rows } = await db.query(
      "SELECT id, nickname, avatar_index, age_group, sort_order FROM child_profiles WHERE account_id = $1 ORDER BY sort_order, created_at",
      [accountId]
    );
    return res.status(200).json({ children: rows });
  }

  if (req.method === "POST") {
    const { nickname, avatarIndex, ageGroup, accessPin } = req.body || {};
    const validationError = validateChild(nickname, avatarIndex, ageGroup);
    if (validationError) return res.status(400).json({ error: validationError, code: "VALIDATION_ERROR" });

    const pinHash = accessPin ? await bcrypt.hash(accessPin.toString(), 10) : null;
    const { rows: existing } = await db.query(
      "SELECT COUNT(*) AS cnt FROM child_profiles WHERE account_id = $1",
      [accountId]
    );
    if (parseInt(existing[0].cnt, 10) >= 6) {
      return res.status(400).json({ error: "Maximum 6 child profiles per account.", code: "MAX_CHILDREN" });
    }

    const { rows } = await db.query(
      `INSERT INTO child_profiles (account_id, nickname, avatar_index, age_group, access_pin_hash, sort_order)
       VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM child_profiles WHERE account_id = $6))
       RETURNING id, nickname, avatar_index, age_group, sort_order`,
      [accountId, nickname.trim(), avatarIndex ?? 0, ageGroup || null, pinHash, accountId]
    );
    return res.status(201).json({ child: rows[0] });
  }

  return res.status(405).json({ error: "Method not allowed." });
}

async function handleSingle(req, res, accountId, childId) {
  // Verify ownership
  const { rows: own } = await db.query(
    "SELECT id, nickname, avatar_index, age_group, sort_order FROM child_profiles WHERE id = $1 AND account_id = $2",
    [childId, accountId]
  );
  if (!own.length) return res.status(404).json({ error: "Child profile not found.", code: "NOT_FOUND" });

  if (req.method === "GET") {
    return res.status(200).json({ child: own[0] });
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    const { nickname, avatarIndex, ageGroup, accessPin, sortOrder } = req.body || {};

    const fields = [];
    const vals   = [];
    let idx = 1;

    if (nickname !== undefined) {
      const err = validateChild(nickname, null, null);
      if (err) return res.status(400).json({ error: err, code: "VALIDATION_ERROR" });
      fields.push(`nickname = $${idx++}`); vals.push(nickname.trim());
    }
    if (avatarIndex !== undefined) {
      if (!Number.isInteger(avatarIndex) || avatarIndex < 0 || avatarIndex >= AVATAR_COUNT) {
        return res.status(400).json({ error: "Invalid avatar index.", code: "VALIDATION_ERROR" });
      }
      fields.push(`avatar_index = $${idx++}`); vals.push(avatarIndex);
    }
    if (ageGroup !== undefined) {
      if (ageGroup !== null && !AGE_GROUPS.includes(ageGroup)) {
        return res.status(400).json({ error: "Invalid age group.", code: "VALIDATION_ERROR" });
      }
      fields.push(`age_group = $${idx++}`); vals.push(ageGroup || null);
    }
    if (accessPin !== undefined) {
      const pinHash = accessPin ? await bcrypt.hash(accessPin.toString(), 10) : null;
      fields.push(`access_pin_hash = $${idx++}`); vals.push(pinHash);
    }
    if (sortOrder !== undefined) {
      fields.push(`sort_order = $${idx++}`); vals.push(sortOrder);
    }

    if (!fields.length) return res.status(400).json({ error: "Nothing to update.", code: "NO_FIELDS" });

    fields.push(`updated_at = NOW()`);
    vals.push(childId);
    const { rows } = await db.query(
      `UPDATE child_profiles SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, nickname, avatar_index, age_group, sort_order`,
      vals
    );
    return res.status(200).json({ child: rows[0] });
  }

  if (req.method === "DELETE") {
    await db.query("DELETE FROM child_profiles WHERE id = $1 AND account_id = $2", [childId, accountId]);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed." });
}

function validateChild(nickname, avatarIndex, ageGroup) {
  if (nickname !== null && nickname !== undefined) {
    const n = (nickname || "").trim();
    if (!n || n.length < 1 || n.length > 60) return "Nickname must be 1–60 characters.";
    if (!/^[\p{L}\p{N}\s''-]+$/u.test(n))     return "Nickname contains invalid characters.";
  }
  if (avatarIndex !== null && avatarIndex !== undefined) {
    if (!Number.isInteger(avatarIndex) || avatarIndex < 0 || avatarIndex >= AVATAR_COUNT)
      return "Invalid avatar index.";
  }
  if (ageGroup !== null && ageGroup !== undefined) {
    if (!AGE_GROUPS.includes(ageGroup)) return "Invalid age group.";
  }
  return null;
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", commAuth.ALLOWED_ORIGINS[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
