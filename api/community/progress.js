"use strict";
const db         = require("../../lib/db");
const auth       = require("../../lib/auth");
const commAuth   = require("../../lib/community-auth");

const rateLimiter = commAuth.makeRateLimiter(120, commAuth.HOUR);

// DB column → response key mappings for integer fields.
const INT_COLS = [
  ["total_completed",       "totalCompleted"],
  ["total_generated",       "totalGenerated"],
  ["current_streak",        "currentStreak"],
  ["longest_streak",        "longestStreak"],
  ["days_colored",          "daysColored"],
  ["easy_completed",        "easyCompleted"],
  ["medium_completed",      "mediumCompleted"],
  ["hard_completed",        "hardCompleted"],
  ["extreme_completed",     "extremeCompleted"],
  ["max_color_uses",        "maxColorUses"],
  ["numbers_completed",     "numbersCompleted"],
  ["free_color_completed",  "freeColorCompleted"],
  ["free_text_creations",   "freeTextCreations"],
  ["draw_pen_uses",         "drawPenUses"],
  ["saves",                 "saves"],
  ["shares",                "shares"],
  ["challenges_created",    "challengesCreated"],
  ["daily_words_completed", "dailyWordsCompleted"],
  ["unique_subjects",       "uniqueSubjects"],
];

// Merge an array of profile DB rows into one aggregate progress object.
function mergeRows(rows) {
  const out = {
    totalCompleted: 0, totalGenerated: 0, currentStreak: 0, longestStreak: 0,
    daysColored: 0, easyCompleted: 0, mediumCompleted: 0, hardCompleted: 0,
    extremeCompleted: 0, maxColorUses: 0, numbersCompleted: 0,
    freeColorCompleted: 0, freeTextCreations: 0, drawPenUses: 0,
    saves: 0, shares: 0, challengesCreated: 0, dailyWordsCompleted: 0,
    uniqueSubjects: 0, lastColoredDay: null,
    badges: [], palettesUsed: [], themesColored: [], subjects: {},
  };
  for (const row of rows) {
    for (const [col, key] of INT_COLS) {
      out[key] = Math.max(out[key], parseInt(row[col]) || 0);
    }
    const rowDay = row.last_active_date
      ? (row.last_active_date instanceof Date
          ? row.last_active_date.toISOString().slice(0, 10)
          : String(row.last_active_date).slice(0, 10))
      : null;
    if (rowDay && rowDay !== "1970-01-01" && (!out.lastColoredDay || rowDay > out.lastColoredDay)) {
      out.lastColoredDay = rowDay;
    }
    for (const badge of (row.badges || [])) {
      if (!out.badges.includes(badge)) out.badges.push(badge);
    }
    for (const p of (row.palettes_used || [])) {
      if (!out.palettesUsed.includes(p)) out.palettesUsed.push(p);
    }
    for (const t of (row.themes_colored || [])) {
      if (!out.themesColored.includes(t)) out.themesColored.push(t);
    }
    for (const [subj, cnt] of Object.entries(row.subjects || {})) {
      out.subjects[subj] = Math.max(out.subjects[subj] || 0, parseInt(cnt) || 0);
    }
  }
  out.uniqueSubjects = Math.max(out.uniqueSubjects, Object.keys(out.subjects).length);
  return out;
}

// Fetch the account aggregate or single-device row for the given device UUID.
async function getAggregate(deviceUuid, accountId) {
  if (accountId) {
    const { rows } = await db.query(
      `SELECT p.* FROM profiles p
       JOIN account_devices ad ON ad.device_uuid = p.device_uuid
       WHERE ad.account_id = $1`,
      [accountId]
    );
    if (rows.length) return { progress: mergeRows(rows), isAccountAggregate: true };
  }
  const { rows } = await db.query(
    "SELECT * FROM profiles WHERE device_uuid = $1",
    [deviceUuid]
  );
  return { progress: mergeRows(rows), isAccountAggregate: false };
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (commAuth.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-ID, Authorization");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const uuid = commAuth.requireDeviceUuid(req, res);
  if (!uuid) return;

  // Optional Bearer token for account-level aggregation.
  let accountId = null;
  const token = auth.bearerToken(req);
  if (token) {
    const payload = auth.verifyAccessToken(token);
    if (payload) accountId = payload.accountId;
  }

  if (req.method === "GET") {
    const { progress, isAccountAggregate } = await getAggregate(uuid, accountId);
    return res.status(200).json({ ok: true, progress, isAccountAggregate, anonymous: !accountId });
  }

  // POST — upsert this device's full progress, then return aggregate.
  await commAuth.upsertProfile(uuid);

  const b = req.body || {};

  function safeInt(v) {
    const n = parseInt(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  const lastActiveDate = typeof b.lastActiveDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.lastActiveDate)
    ? b.lastActiveDate : null;

  const badges        = Array.isArray(b.badges)        ? JSON.stringify(b.badges)        : "[]";
  const palettesUsed  = Array.isArray(b.palettesUsed)  ? JSON.stringify(b.palettesUsed)  : "[]";
  const themesColored = Array.isArray(b.themesColored) ? JSON.stringify(b.themesColored) : "[]";
  const subjects      = (b.subjects && typeof b.subjects === "object" && !Array.isArray(b.subjects))
    ? JSON.stringify(b.subjects) : "{}";

  await db.query(
    `UPDATE profiles SET
       total_completed       = GREATEST(total_completed,       $2),
       total_generated       = GREATEST(total_generated,       $3),
       current_streak        = GREATEST(current_streak,        $4),
       longest_streak        = GREATEST(longest_streak,        $5),
       last_active_date      = CASE
         WHEN $6::date IS NULL THEN last_active_date
         WHEN last_active_date IS NULL THEN $6::date
         ELSE GREATEST(last_active_date, $6::date)
       END,
       days_colored          = GREATEST(days_colored,          $7),
       easy_completed        = GREATEST(easy_completed,        $8),
       medium_completed      = GREATEST(medium_completed,      $9),
       hard_completed        = GREATEST(hard_completed,        $10),
       extreme_completed     = GREATEST(extreme_completed,     $11),
       max_color_uses        = GREATEST(max_color_uses,        $12),
       numbers_completed     = GREATEST(numbers_completed,     $13),
       free_color_completed  = GREATEST(free_color_completed,  $14),
       free_text_creations   = GREATEST(free_text_creations,   $15),
       draw_pen_uses         = GREATEST(draw_pen_uses,         $16),
       saves                 = GREATEST(saves,                 $17),
       shares                = GREATEST(shares,                $18),
       challenges_created    = GREATEST(challenges_created,    $19),
       daily_words_completed = GREATEST(daily_words_completed, $20),
       unique_subjects       = GREATEST(unique_subjects,       $21),
       badges                = $22::jsonb,
       palettes_used         = $23::jsonb,
       themes_colored        = $24::jsonb,
       subjects              = $25::jsonb,
       last_sync_at          = NOW(),
       updated_at            = NOW()
     WHERE device_uuid = $1`,
    [
      uuid,
      safeInt(b.totalCompleted),
      safeInt(b.totalGenerated),
      safeInt(b.currentStreak),
      safeInt(b.longestStreak),
      lastActiveDate,
      safeInt(b.daysColored),
      safeInt(b.easyCompleted),
      safeInt(b.mediumCompleted),
      safeInt(b.hardCompleted),
      safeInt(b.extremeCompleted),
      safeInt(b.maxColorUses),
      safeInt(b.numbersCompleted),
      safeInt(b.freeColorCompleted),
      safeInt(b.freeTextCreations),
      safeInt(b.drawPenUses),
      safeInt(b.saves),
      safeInt(b.shares),
      safeInt(b.challengesCreated),
      safeInt(b.dailyWordsCompleted),
      safeInt(b.uniqueSubjects),
      badges, palettesUsed, themesColored, subjects,
    ]
  );

  const { progress, isAccountAggregate } = await getAggregate(uuid, accountId);
  return res.status(200).json({ ok: true, progress, isAccountAggregate, anonymous: !accountId });
};
