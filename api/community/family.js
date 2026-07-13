"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");

const getRateLimiter  = auth.makeRateLimiter(30,  auth.HOUR);
const postRateLimiter = auth.makeRateLimiter(20,  auth.HOUR);

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (auth.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-ID, X-Parental-Consent");
  }
  if (req.method === "OPTIONS") return res.status(204).end();

  const ip   = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  const uuid = auth.requireDeviceUuid(req, res);
  if (!uuid) return;

  const familyEnabled = await db.getConfigBool("family_enabled", true);
  if (!familyEnabled) return res.status(503).json({ error: "Family groups are currently unavailable." });

  await auth.upsertProfile(uuid);

  // ── GET — return own family members ──────────────────────────────────────────
  if (req.method === "GET") {
    if (getRateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

    const { rows: profileRows } = await db.query(
      "SELECT family_id FROM profiles WHERE device_uuid = $1",
      [uuid]
    );
    const familyId = profileRows[0]?.family_id;
    if (!familyId) return res.status(200).json({ inFamily: false });

    const { rows: familyRows } = await db.query(
      "SELECT family_code, member_count FROM families WHERE id = $1",
      [familyId]
    );
    if (!familyRows.length) return res.status(200).json({ inFamily: false });

    const { rows: members } = await db.query(
      `SELECT p.nickname, p.avatar_index, p.total_completed, p.current_streak,
              (SELECT json_agg(a ORDER BY a.shared_at DESC)
               FROM (SELECT id, share_type, subject, image_path, star_count, shared_at
                     FROM artworks
                     WHERE device_uuid = p.device_uuid
                       AND moderation_status = 'approved'
                     ORDER BY shared_at DESC LIMIT 3) a) AS recent_artworks
       FROM profiles p WHERE p.family_id = $1`,
      [familyId]
    );

    return res.status(200).json({
      inFamily:    true,
      familyId,
      familyCode:  familyRows[0].family_code,
      memberCount: familyRows[0].member_count,
      members: members.map(m => ({
        nickname:       m.nickname || "Colorist",
        avatarIndex:    m.avatar_index,
        totalCompleted: m.total_completed,
        currentStreak:  m.current_streak,
        recentArtworks: (m.recent_artworks || []).map(a => ({
          id:        String(a.id),
          shareType: a.share_type,
          subject:   a.subject,
          imageUrl:  a.image_path,
          starCount: a.star_count,
          sharedAt:  a.shared_at,
        })),
      })),
    });
  }

  // ── POST — create / join / leave ─────────────────────────────────────────────
  if (req.method === "POST") {
    if (postRateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

    const body    = req.body || {};
    const action  = body.action;
    const consent = req.headers["x-parental-consent"] === "yes";

    if (!["create", "join", "leave"].includes(action)) {
      return res.status(400).json({ error: "action must be 'create', 'join', or 'leave'." });
    }

    if ((action === "create" || action === "join") && !consent) {
      return res.status(403).json({ error: "Parental consent required.", code: "PARENTAL_CONSENT_REQUIRED" });
    }

    if (action === "leave") {
      const { rows: curr } = await db.query(
        "SELECT family_id FROM profiles WHERE device_uuid = $1",
        [uuid]
      );
      const fid = curr[0]?.family_id;
      if (fid) {
        await db.query("UPDATE profiles SET family_id = NULL, updated_at = NOW() WHERE device_uuid = $1", [uuid]);
        await db.query(
          "UPDATE families SET member_count = GREATEST(0, member_count - 1) WHERE id = $1",
          [fid]
        );
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "create") {
      // Must not already be in a family.
      const { rows: curr } = await db.query(
        "SELECT family_id FROM profiles WHERE device_uuid = $1",
        [uuid]
      );
      if (curr[0]?.family_id) {
        return res.status(409).json({ error: "You are already in a family group. Leave first." });
      }

      // Generate a unique code (retry on collision, max 5 attempts).
      let familyCode, familyId;
      for (let attempt = 0; attempt < 5; attempt++) {
        familyCode = auth.generateFamilyCode();
        try {
          const { rows: ins } = await db.query(
            "INSERT INTO families (family_code) VALUES ($1) RETURNING id",
            [familyCode]
          );
          familyId = ins[0].id;
          break;
        } catch (e) {
          if (e.code !== "23505") throw e; // only retry on unique violation
        }
      }
      if (!familyId) return res.status(500).json({ error: "Could not generate a unique family code. Try again." });

      await db.query(
        "UPDATE profiles SET family_id = $1, sharing_enabled = TRUE, updated_at = NOW() WHERE device_uuid = $2",
        [familyId, uuid]
      );

      return res.status(201).json({ familyCode, familyId });
    }

    if (action === "join") {
      const code = typeof body.familyCode === "string" ? body.familyCode.toUpperCase().trim() : "";
      if (!auth.isValidFamilyCode(code)) {
        return res.status(400).json({ error: "Invalid family code format." });
      }

      const expiryDays = await db.getConfigInt("family_code_expiry_days", 90);
      const maxMembers = await db.getConfigInt("max_family_members", 6);

      const { rows: familyRows } = await db.query(
        `SELECT id, member_count FROM families
         WHERE family_code = $1
           AND code_active = TRUE
           AND created_at > NOW() - ($2 || ' days')::interval`,
        [code, expiryDays]
      );
      if (!familyRows.length) {
        return res.status(404).json({ error: "Family code not found or expired." });
      }
      const family = familyRows[0];
      if (family.member_count >= maxMembers) {
        return res.status(409).json({ error: `This family group is full (max ${maxMembers} members).` });
      }

      // Must not already be in a family.
      const { rows: curr } = await db.query(
        "SELECT family_id FROM profiles WHERE device_uuid = $1",
        [uuid]
      );
      if (curr[0]?.family_id) {
        return res.status(409).json({ error: "You are already in a family group. Leave first." });
      }

      await db.query(
        "UPDATE profiles SET family_id = $1, sharing_enabled = TRUE, updated_at = NOW() WHERE device_uuid = $2",
        [family.id, uuid]
      );
      const { rows: updatedFamily } = await db.query(
        "UPDATE families SET member_count = member_count + 1 WHERE id = $1 RETURNING member_count",
        [family.id]
      );

      return res.status(200).json({ familyId: family.id, memberCount: updatedFamily[0].member_count });
    }
  }

  res.status(405).json({ error: "Method not allowed." });
};
