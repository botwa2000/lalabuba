"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/community-auth");

const rateLimiter = auth.makeRateLimiter(60, auth.HOUR);

// Returns Monday of the current week (UTC) as a Date.
function currentWeekStart() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

async function refreshWeeklyLeaderboard(weekStart, size) {
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEnd      = new Date(weekStart.getTime() + 7 * 86400_000);

  // Compute from artworks + profiles.
  const { rows } = await db.query(
    `SELECT p.device_uuid, p.nickname, p.avatar_index,
            COUNT(a.id)::int AS weekly_completed,
            COALESCE(SUM(a.star_count), 0)::int AS weekly_stars
     FROM profiles p
     LEFT JOIN artworks a
       ON a.device_uuid = p.device_uuid
       AND a.shared_at >= $1 AND a.shared_at < $2
       AND a.moderation_status = 'approved'
     WHERE p.nickname IS NOT NULL
     GROUP BY p.device_uuid, p.nickname, p.avatar_index
     ORDER BY weekly_completed DESC, weekly_stars DESC
     LIMIT $3`,
    [weekStart.toISOString(), weekEnd.toISOString(), size]
  );

  // Upsert into cache.
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    await db.query(
      `INSERT INTO leaderboard_cache
         (week_start, rank_position, device_uuid, nickname, avatar_index, weekly_completed, weekly_stars, refreshed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (week_start, rank_position) DO UPDATE SET
         device_uuid       = EXCLUDED.device_uuid,
         nickname          = EXCLUDED.nickname,
         avatar_index      = EXCLUDED.avatar_index,
         weekly_completed  = EXCLUDED.weekly_completed,
         weekly_stars      = EXCLUDED.weekly_stars,
         refreshed_at      = NOW()`,
      [weekStartStr, i + 1, r.device_uuid, r.nickname, r.avatar_index, r.weekly_completed, r.weekly_stars]
    );
  }

  return rows.map((r, i) => ({
    rank:             i + 1,
    nickname:         r.nickname,
    avatarIndex:      r.avatar_index,
    weeklyCompleted:  r.weekly_completed,
    weeklyStars:      r.weekly_stars,
    score:            r.weekly_completed,
  }));
}

async function refreshAllTimeLeaderboard(size) {
  const { rows } = await db.query(
    `SELECT p.nickname, p.avatar_index, p.total_completed, p.longest_streak
     FROM profiles p
     WHERE p.nickname IS NOT NULL AND p.total_completed > 0
     ORDER BY p.total_completed DESC, p.longest_streak DESC
     LIMIT $1`,
    [size]
  );
  return rows.map((r, i) => ({
    rank:            i + 1,
    nickname:        r.nickname,
    avatarIndex:     r.avatar_index,
    totalCompleted:  r.total_completed,
    longestStreak:   r.longest_streak,
    score:           r.total_completed,
  }));
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (auth.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const ip = (req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").toString().trim();
  if (rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const enabled = await db.getConfigBool("leaderboard_enabled", true);
  if (!enabled) return res.status(503).json({ error: "Leaderboard is currently unavailable." });

  const type = (req.query?.type || "weekly").toLowerCase();
  const size = await db.getConfigInt("leaderboard_size", 10);

  if (type === "alltime") {
    const entries = await refreshAllTimeLeaderboard(size);
    return res.status(200).json({ type: "alltime", entries, refreshedAt: new Date().toISOString() });
  }

  // Weekly — use cache; refresh if stale.
  const weekStart    = currentWeekStart();
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const refreshMins  = await db.getConfigInt("leaderboard_refresh_minutes", 60);

  const { rows: cached } = await db.query(
    `SELECT rank_position, nickname, avatar_index, weekly_completed, weekly_stars, refreshed_at
     FROM leaderboard_cache
     WHERE week_start = $1
     ORDER BY rank_position ASC`,
    [weekStartStr]
  );

  let entries;
  let refreshedAt;

  const isStale = !cached.length ||
    (Date.now() - new Date(cached[0].refreshed_at).getTime()) > refreshMins * 60_000;

  if (isStale) {
    entries     = await refreshWeeklyLeaderboard(weekStart, size);
    refreshedAt = new Date().toISOString();
  } else {
    entries = cached.map(r => ({
      rank:            r.rank_position,
      nickname:        r.nickname,
      avatarIndex:     r.avatar_index,
      weeklyCompleted: r.weekly_completed,
      weeklyStars:     r.weekly_stars,
      score:           r.weekly_completed,
    }));
    refreshedAt = cached[0].refreshed_at;
  }

  return res.status(200).json({ type: "weekly", weekStart: weekStartStr, entries, refreshedAt });
};
