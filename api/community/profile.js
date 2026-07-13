"use strict";
const db               = require("../../lib/db");
const auth             = require("../../lib/community-auth");
const { isValidNickname } = require("../../lib/nicknames");
const { isValidAvatar }   = require("../../lib/avatar");

const getRateLimiter  = auth.makeRateLimiter(60,  auth.HOUR);
const postRateLimiter = auth.makeRateLimiter(5,   auth.HOUR);

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (auth.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-ID, X-Parental-Consent");
  }
  if (req.method === "OPTIONS") return res.status(204).end();

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  const uuid = auth.requireDeviceUuid(req, res);
  if (!uuid) return;

  // ── GET own profile ─────────────────────────────────────────────────────────
  if (req.method === "GET") {
    if (getRateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });
    await auth.upsertProfile(uuid);
    const { rows } = await db.query(
      `SELECT nickname, avatar_index, family_id, total_completed, current_streak,
              longest_streak, sharing_enabled, nickname_set_at
       FROM profiles WHERE device_uuid = $1`,
      [uuid]
    );
    if (!rows.length) return res.status(404).json({ error: "Profile not found." });
    const r = rows[0];
    return res.status(200).json({
      nickname:       r.nickname,
      avatarIndex:    r.avatar_index,
      familyId:       r.family_id,
      totalCompleted: r.total_completed,
      currentStreak:  r.current_streak,
      longestStreak:  r.longest_streak,
      sharingEnabled: r.sharing_enabled,
      hasNickname:    !!r.nickname,
    });
  }

  // ── POST upsert nickname + avatar ────────────────────────────────────────────
  if (req.method === "POST") {
    if (postRateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

    const body = req.body || {};
    const nickname    = typeof body.nickname === "string" ? body.nickname.trim() : null;
    const avatarIndex = parseInt(body.avatarIndex);
    const hasConsent  = req.headers["x-parental-consent"] === "yes";

    if (nickname !== null && !isValidNickname(nickname)) {
      return res.status(400).json({ error: "Invalid nickname — please choose from the provided list." });
    }
    if (body.avatarIndex !== undefined && !isValidAvatar(avatarIndex)) {
      return res.status(400).json({ error: "Invalid avatar selection." });
    }

    await auth.upsertProfile(uuid);

    // Enforce minimum change interval for nickname if one is already set.
    if (nickname !== null) {
      const { rows: existing } = await db.query(
        "SELECT nickname_set_at FROM profiles WHERE device_uuid = $1",
        [uuid]
      );
      const nicknameSetAt = existing[0]?.nickname_set_at;
      if (nicknameSetAt) {
        const minDays = await db.getConfigInt("nickname_min_change_days", 7);
        const daysSince = (Date.now() - new Date(nicknameSetAt).getTime()) / (86400_000);
        if (daysSince < minDays) {
          return res.status(429).json({
            error: `You can change your nickname once every ${minDays} days.`,
            code: "NICKNAME_COOLDOWN",
          });
        }
      }
    }

    // Build the SET clause dynamically to only update what was provided.
    const updates = [];
    const params  = [uuid];
    let   idx     = 2;

    if (nickname !== null) {
      updates.push(`nickname = $${idx++}`, `nickname_set_at = NOW()`);
      params.push(nickname);
    }
    if (!isNaN(avatarIndex)) {
      updates.push(`avatar_index = $${idx++}`);
      params.push(avatarIndex);
    }
    // Parental consent enables sharing for this device permanently.
    if (hasConsent) {
      updates.push(`sharing_enabled = TRUE`);
    }
    updates.push(`updated_at = NOW()`);

    if (updates.length > 1) { // more than just updated_at
      await db.query(
        `UPDATE profiles SET ${updates.join(", ")} WHERE device_uuid = $1`,
        params
      );
    }

    const { rows } = await db.query(
      "SELECT nickname, avatar_index, sharing_enabled FROM profiles WHERE device_uuid = $1",
      [uuid]
    );
    const r = rows[0];
    return res.status(200).json({
      ok:             true,
      nickname:       r.nickname,
      avatarIndex:    r.avatar_index,
      sharingEnabled: r.sharing_enabled,
    });
  }

  res.status(405).json({ error: "Method not allowed." });
};
