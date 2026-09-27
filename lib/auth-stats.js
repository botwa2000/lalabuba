"use strict";
// Daily counters of how requests authenticated (table request_auth_stats,
// migration 008). Powers the metric-gated App Check enforcement decision:
// GET /api/admin/security shows native_attested vs native_unattested per day.
// Recording is fire-and-forget — metrics must never slow or fail a request.

const db = require("./db");

const CATEGORIES = [
  "web_turnstile_ok", "web_turnstile_fail",
  "native_attested", "native_attest_invalid", "native_attest_unavailable",
  "native_unattested_allowed", "native_unattested_blocked",
  "rate_limited", "budget_exhausted",
];

function record(category) {
  if (!CATEGORIES.includes(category)) return;
  db.query(
    `INSERT INTO request_auth_stats (day, category, count) VALUES ((NOW() AT TIME ZONE 'UTC')::date, $1, 1)
     ON CONFLICT (day, category) DO UPDATE SET count = request_auth_stats.count + 1`,
    [category]
  ).catch((err) => console.error("[auth-stats] record failed:", err.message));
}

async function recent(days = 14) {
  const { rows } = await db.query(
    `SELECT day::text AS day, category, count::int AS count FROM request_auth_stats
     WHERE day > (NOW() AT TIME ZONE 'UTC')::date - $1::int ORDER BY day DESC, category`,
    [days]
  );
  const byDay = {};
  for (const r of rows) (byDay[r.day] ||= {})[r.category] = r.count;
  return byDay;
}

module.exports = { record, recent, CATEGORIES };
