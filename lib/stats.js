"use strict";
// Aggregations behind GET /api/admin/stats (rendered by lib/render-admin-stats.js).
// All days are UTC. `platform` filters every section: all | web | ios | android.
// `traffic` = human (default) counts people only; all counts every row, so what
// the default leaves out (bots, store review, test devices, ...) can be inspected.
// `bucket` = day | week | month groups the charts and the activity table.
// "app" rows are native requests from builds older than 1.0.24 that sent no
// X-Platform header and no verifiable App Check token.

const db = require("./db");
const authStats = require("./auth-stats");
const rateLimit = require("./rate-limit");
const { getSecurityConfig } = require("./security-config");

// Periods: rolling (today, 7d, 30d, 90d, 12m — ending today), calendar (day, week =
// Mon–Sun, month — around the anchor date `at`, default today), ytd, and
// custom `from`..`to` (inclusive). A period never runs past today; the
// comparison period has the same length, starting at the previous day / week /
// month / year (ytd: same dates last year), otherwise right before `from`.
const ROLLING = { today: 1, "7d": 7, "30d": 30, "90d": 90, "12m": 365 };
const RANGES = [...Object.keys(ROLLING), "day", "week", "month", "ytd", "custom"];
const PLATFORMS = ["all", "web", "ios", "android"];
const TRAFFIC = ["human", "all"];
const BUCKETS = ["day", "week", "month"];
const DAY_MS = 86_400_000;
const MAX_DAYS = 400;  // event retention (lib/usage.js)

function parseDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

function rangeWindow(range, { at, from: fromArg, to: toArg } = {}) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const anchor = new Date(Math.min((parseDay(at) || today).getTime(), today.getTime()));
  const y = anchor.getUTCFullYear(), m = anchor.getUTCMonth();
  let from, prevFrom, customTo;
  if (range === "day") {
    from = anchor; prevFrom = new Date(from.getTime() - DAY_MS);
  } else if (range === "week") {
    from = new Date(anchor.getTime() - ((anchor.getUTCDay() + 6) % 7) * DAY_MS);
    prevFrom = new Date(from.getTime() - 7 * DAY_MS);
  } else if (range === "month") {
    from = new Date(Date.UTC(y, m, 1)); prevFrom = new Date(Date.UTC(y, m - 1, 1));
  } else if (range === "ytd") {
    from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    prevFrom = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1));
  } else if (range === "custom") {
    let a = parseDay(fromArg) || today, b = parseDay(toArg) || today;
    if (a > b) [a, b] = [b, a];
    if (b > today) b = today;
    if (a > b) a = b;
    if ((b - a) / DAY_MS >= MAX_DAYS) a = new Date(b.getTime() - (MAX_DAYS - 1) * DAY_MS);
    from = a; customTo = new Date(b.getTime() + DAY_MS);
    prevFrom = new Date(from.getTime() - (customTo - from));
  } else {
    const days = ROLLING[range] || 7;
    from = new Date(today.getTime() - (days - 1) * DAY_MS);
    prevFrom = new Date(from.getTime() - days * DAY_MS);
  }
  const end = { day: 1, week: 7 }[range];
  let to = end ? new Date(from.getTime() + end * DAY_MS)
    : range === "month" ? new Date(Date.UTC(y, m + 1, 1))
    : range === "custom" ? customTo
    : tomorrow;
  if (to > tomorrow) to = tomorrow;
  const span = to - from;
  const prevTo = new Date(Math.min(prevFrom.getTime() + span, from.getTime()));
  return { range, days: Math.max(1, Math.round(span / DAY_MS)), from, to, prevFrom, prevTo };
}

const defaultBucket = (days) => (days <= 31 ? "day" : days <= 120 ? "week" : "month");

// Row filter for the traffic mode. Only these two constants ever reach the SQL.
const trafficFilter = (traffic) => (traffic === "all" ? "TRUE" : "traffic = 'human'");

// Same day expression everywhere, truncated to the bucket in parameter $n. COUNT
// (DISTINCT uid) runs on these groups: a week's actives are never summed days.
const per = (col, n) => `date_trunc($${n}, (${col} AT TIME ZONE 'UTC')::date::timestamp)::date::text`;

/** Start of the bucket containing a UTC day (weeks start on Monday, like date_trunc). */
function bucketStart(day, bucket) {
  if (bucket === "month") return `${day.slice(0, 7)}-01`;
  const d = new Date(`${day}T00:00:00Z`);
  if (bucket === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Start days of the buckets a window touches, oldest first. */
function bucketList(w, bucket) {
  const out = new Set();
  for (let d = new Date(w.from); d < w.to; d = new Date(d.getTime() + DAY_MS)) out.add(bucketStart(d.toISOString().slice(0, 10), bucket));
  return [...out];
}

// Usage rows before the first tracked bucket are unknown, not zero. Store
// downloads come from the stores and keep their numbers.
const USAGE_COLUMNS = ["users", "web", "ios", "android", "newUsers", "pageViews", "screenViews", "drawings", "failed", "completed"];
const isTracked = (period, since, bucket) => !!since && period >= bucketStart(since.slice(0, 10), bucket);
function markTracked(row, since, bucket) {
  const tracked = isTracked(row.day, since, bucket);
  return tracked ? { ...row, tracked } : { ...row, tracked, ...Object.fromEntries(USAGE_COLUMNS.map((k) => [k, null])) };
}

// Days of a window that had tracking at all: averages must not divide by the
// untracked ones.
function trackedDays(from, to, since) {
  const start = since ? Math.max(from.getTime(), Date.parse(`${since.slice(0, 10)}T00:00:00Z`)) : from.getTime();
  return Math.max(1, Math.round((to.getTime() - start) / DAY_MS));
}

const int = (v) => Number(v || 0);

// Union of every row that proves a user was active.
const activity = (T) => `
  SELECT ts, platform, COALESCE(install_id::text, visitor_hash) AS uid, install_id
    FROM usage_events  WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
  UNION ALL
  SELECT ts, platform, COALESCE(install_id::text, visitor_hash) AS uid, install_id
    FROM generation_log WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}`;

async function kpis(w, p, T, since) {
  const one = async (from, to) => {
    const [act, gen, ev, inst] = await Promise.all([
      // Unconsented web visitors rotate their hash daily, so a multi-day distinct
      // count is "visitor-days" for them; installs are counted once.
      db.query(`SELECT COUNT(DISTINCT uid) AS users,
                       COUNT(DISTINCT (uid, (ts AT TIME ZONE 'UTC')::date)) AS user_days
                  FROM (${activity(T)}) a WHERE uid IS NOT NULL`, [from, to, p]),
      db.query(`SELECT COUNT(*) FILTER (WHERE outcome = 'ok') AS ok,
                       COUNT(*) FILTER (WHERE outcome = 'fail') AS fail,
                       COUNT(*) AS attempts
                  FROM generation_log WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}`, [from, to, p]),
      db.query(`SELECT COUNT(*) FILTER (WHERE event = 'complete') AS completed
                  FROM usage_events WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}`, [from, to, p]),
      db.query(`SELECT COUNT(*) AS n FROM usage_installs
                 WHERE first_seen >= $1 AND first_seen < $2 AND ($3 = 'all' OR platform = $3) AND ${T}`, [from, to, p]),
    ]);
    const days = trackedDays(from, to, since);
    return {
      activeUsers: int(act.rows[0].users),
      avgDailyUsers: Math.round(10 * int(act.rows[0].user_days) / days) / 10,
      newUsers: int(inst.rows[0].n),
      drawings: int(gen.rows[0].ok),
      failed: int(gen.rows[0].fail),
      attempts: int(gen.rows[0].attempts),
      completed: int(ev.rows[0].completed),
    };
  };
  const [cur, prev] = await Promise.all([one(w.from, w.to), one(w.prevFrom, w.prevTo)]);
  return { cur, prev };
}

async function store(w, p) {
  const plats = p === "all" ? ["ios", "android"] : p === "web" ? [] : [p];
  if (!plats.length) return { downloads: {}, prevDownloads: {}, reviews: null };
  const dl = await db.query(
    `SELECT platform,
            SUM(value) FILTER (WHERE day >= $1::date AND day < $3::date) AS cur,
            SUM(value) FILTER (WHERE day >= $2::date AND day < $5::date) AS prev
       FROM store_daily WHERE metric = 'downloads' AND day >= $2::date AND day < $3::date AND platform = ANY($4)
      GROUP BY platform`, [w.from, w.prevFrom, w.to, plats, w.prevTo]);
  const downloads = {}, prevDownloads = {};
  for (const r of dl.rows) { downloads[r.platform] = int(r.cur); prevDownloads[r.platform] = int(r.prev); }

  // Latest value of each cumulative rating metric per platform.
  const latest = await db.query(
    `SELECT DISTINCT ON (platform, metric) platform, metric, value, day::text
       FROM store_daily WHERE metric IN ('rating_count_total', 'rating_avg_total', 'installs_total', 'active_devices')
        AND platform = ANY($1)
      ORDER BY platform, metric, day DESC`, [plats]);
  const written = await db.query(
    `SELECT platform, COUNT(*) AS n, AVG(rating)::float AS avg,
            COUNT(*) FILTER (WHERE created_at >= $2) AS n_period
       FROM store_reviews WHERE platform = ANY($1) GROUP BY platform`, [plats, w.from]);
  const recent = await db.query(
    `SELECT platform, created_at, rating, territory, lang, title, body, app_version, replied
       FROM store_reviews WHERE platform = ANY($1) ORDER BY created_at DESC LIMIT 8`, [plats]);
  // Store's own 1–5★ histogram (Play listing), else counted from written reviews.
  const hist = await db.query(
    `SELECT DISTINCT ON (platform, metric) platform, metric, value FROM store_daily
      WHERE metric LIKE 'hist:%' AND platform = ANY($1) ORDER BY platform, metric, day DESC`, [plats]);
  const writtenHist = await db.query(
    `SELECT platform, rating, COUNT(*) AS n FROM store_reviews WHERE platform = ANY($1) GROUP BY 1, 2`, [plats]);
  const replied = await db.query(
    `SELECT platform, COUNT(*) FILTER (WHERE replied) AS replied, COUNT(*) FILTER (WHERE replied IS NOT NULL) AS known
       FROM store_reviews WHERE platform = ANY($1) GROUP BY 1`, [plats]);
  // Daily rating snapshots inside the range + the last snapshot before it (delta base).
  const trend = await db.query(
    `SELECT day::text, platform, metric, value FROM store_daily
      WHERE metric IN ('rating_count_total', 'rating_avg_total') AND platform = ANY($1)
        AND day >= $2::date AND day < $3::date ORDER BY day`, [plats, w.from, w.to]);
  const base = await db.query(
    `SELECT DISTINCT ON (platform, metric) platform, metric, value FROM store_daily
      WHERE metric IN ('rating_count_total', 'rating_avg_total') AND platform = ANY($1) AND day < $2::date
      ORDER BY platform, metric, day DESC`, [plats, w.from]);
  const countries = await db.query(
    `SELECT DISTINCT ON (metric) substring(metric FROM 12) AS country, value FROM store_daily
      WHERE platform = 'ios' AND metric LIKE 'ratings_cc:%' AND 'ios' = ANY($1)
        AND day = (SELECT MAX(day) FROM store_daily WHERE platform = 'ios' AND metric = 'rating_count_total')
      ORDER BY metric, day DESC`, [plats]);

  const per = {};
  for (const pl of plats) per[pl] = { ratings: null, avg: null, written: 0, writtenAvg: null, writtenPeriod: 0, installsTotal: null, activeDevices: null,
    histogram: null, histogramSource: null, replied: 0, repliedKnown: 0, ratingsAtStart: null, avgAtStart: null };
  for (const r of hist.rows) (per[r.platform].histogram ||= {})[r.metric.slice(5)] = int(r.value);
  for (const t of Object.values(per)) if (t.histogram) t.histogramSource = "store";
  for (const r of writtenHist.rows) {
    const t = per[r.platform];
    if (t.histogramSource === "store") continue;
    (t.histogram ||= {})[String(r.rating)] = int(r.n);
    t.histogramSource = "written reviews";
  }
  for (const r of replied.rows) Object.assign(per[r.platform], { replied: int(r.replied), repliedKnown: int(r.known) });
  for (const r of base.rows) {
    if (r.metric === "rating_count_total") per[r.platform].ratingsAtStart = int(r.value);
    if (r.metric === "rating_avg_total") per[r.platform].avgAtStart = Number(r.value);
  }
  for (const r of latest.rows) {
    const t = per[r.platform];
    if (r.metric === "rating_count_total") t.ratings = int(r.value);
    if (r.metric === "rating_avg_total") t.avg = Number(r.value);
    if (r.metric === "installs_total") t.installsTotal = int(r.value);
    if (r.metric === "active_devices") t.activeDevices = int(r.value);
  }
  for (const r of written.rows) {
    Object.assign(per[r.platform], { written: int(r.n), writtenAvg: r.avg, writtenPeriod: int(r.n_period) });
  }
  // No store total yet (feed not run) → the written-review count is the floor.
  // Play hides its public total until an app has enough ratings, so written
  // reviews can exceed the listing's 0 — the larger number is the honest one.
  for (const t of Object.values(per)) {
    if (t.ratings === null || t.written > t.ratings) { t.ratings = t.written; t.ratingsIsWrittenOnly = true; }
    if (t.avg === null) t.avg = t.writtenAvg;
  }
  const trendByDay = {};
  for (const r of trend.rows) {
    const d = (trendByDay[r.day] ||= { day: r.day });
    d[`${r.platform}_${r.metric === "rating_count_total" ? "count" : "avg"}`] = Number(r.value);
  }
  const total = Object.values(per).reduce((a, t) => a + (t.ratings || 0), 0);
  const wsum = Object.values(per).reduce((a, t) => a + (t.ratings || 0) * (t.avg || 0), 0);
  return {
    downloads, prevDownloads,
    reviews: {
      total, avg: total ? wsum / total : null, perPlatform: per, recent: recent.rows,
      totalAtStart: Object.values(per).reduce((a, t) => a + (t.ratingsAtStart || 0), 0),
      trend: Object.values(trendByDay),
      iosCountries: countries.rows.map((r) => ({ country: r.country, n: int(r.value) })).sort((a, b) => b.n - a.n),
    },
  };
}

async function series(w, p, T, bucket, since) {
  const args = [w.from, w.to, p, bucket];
  const [dau, total, gen, dl] = await Promise.all([
    db.query(`SELECT ${per("ts", 4)} AS day, platform, COUNT(DISTINCT uid) AS n
                FROM (${activity(T)}) a WHERE uid IS NOT NULL GROUP BY 1, 2 ORDER BY 1`, args),
    db.query(`SELECT ${per("ts", 4)} AS day, COUNT(DISTINCT uid) AS n
                FROM (${activity(T)}) a WHERE uid IS NOT NULL GROUP BY 1`, args),
    db.query(`SELECT ${per("ts", 4)} AS day, platform,
                     COUNT(*) FILTER (WHERE outcome = 'ok') AS ok,
                     COUNT(*) FILTER (WHERE outcome = 'fail') AS fail
                FROM generation_log WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY 1, 2 ORDER BY 1`, args),
    db.query(`SELECT date_trunc($4, day::timestamp)::date::text AS day, platform, SUM(value) AS value FROM store_daily
               WHERE metric = 'downloads' AND day >= $1::date AND day < $2::date AND ($3 = 'all' OR platform = $3)
               GROUP BY 1, 2 ORDER BY 1`, args),
  ]);
  const days = bucketList(w, bucket);
  const fold = (rows, key) => {
    const m = {};
    for (const r of rows) ((m[r.day] ||= {})[r.platform] = int(r[key]));
    return days.map((day) => ({ day, ...(m[day] || {}) }));
  };
  const fails = {};
  for (const r of gen.rows) fails[r.day] = (fails[r.day] || 0) + int(r.fail);
  const totals = Object.fromEntries(total.rows.map((r) => [r.day, int(r.n)]));
  const tracked = (x) => ({ ...x, tracked: isTracked(x.day, since, bucket) });
  return {
    days,
    // _total = distinct people of the bucket, what the tooltip and table report.
    activeUsers: fold(dau.rows, "n").map((x) => tracked({ ...x, _total: totals[x.day] || 0 })),
    drawings: fold(gen.rows, "ok").map((x) => tracked({ ...x, _fail: fails[x.day] || 0 })),
    downloads: fold(dl.rows, "value"),
  };
}

async function prompts(w, p, T) {
  const [top, bySource, latest] = await Promise.all([
    db.query(`SELECT COALESCE(subject_en, lower(subject_raw)) AS subject, COUNT(*) AS n,
                     COUNT(*) FILTER (WHERE platform = 'web') AS web,
                     COUNT(*) FILTER (WHERE platform = 'ios') AS ios,
                     COUNT(*) FILTER (WHERE platform = 'android') AS android,
                     COUNT(*) FILTER (WHERE platform = 'app') AS app
                FROM generation_log WHERE outcome = 'ok' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY 1 ORDER BY n DESC LIMIT 25`, [w.from, w.to, p]),
    db.query(`SELECT COALESCE(source, 'unknown') AS source, COUNT(*) AS n
                FROM generation_log WHERE outcome = 'ok' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY 1 ORDER BY n DESC`, [w.from, w.to, p]),
    // Typed text only (not card/daily picks), newest first; raw text exists for 30 days.
    db.query(`SELECT ts, platform, subject_raw, subject_en, lang, outcome, source
                FROM generation_log
               WHERE subject_raw IS NOT NULL AND COALESCE(source, 'custom') IN ('custom', 'voice')
                 AND ($1 = 'all' OR platform = $1) AND ${T}
               ORDER BY ts DESC LIMIT 50`, [p]),
  ]);
  return { top: top.rows, bySource: bySource.rows, latestTyped: latest.rows };
}

async function usage(w, p, T) {
  const [core, screens, pages, actions] = await Promise.all([
    // Drawing is the core action: every request by where it started, with a
    // ROLLUP row for all of them (percentiles cannot be summed in the page).
    db.query(`SELECT COALESCE(source, 'unknown') AS source, GROUPING(COALESCE(source, 'unknown')) AS is_total, COUNT(*) AS n,
                     COUNT(*) FILTER (WHERE outcome = 'ok') AS ok,
                     COUNT(*) FILTER (WHERE outcome = 'fail') AS fail,
                     COUNT(*) FILTER (WHERE outcome NOT IN ('ok', 'fail')) AS rejected,
                     percentile_cont(0.5)  WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE outcome = 'ok') AS p50,
                     percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE outcome = 'ok') AS p95,
                     COUNT(*) FILTER (WHERE platform = 'web') AS web,
                     COUNT(*) FILTER (WHERE platform = 'ios') AS ios,
                     COUNT(*) FILTER (WHERE platform = 'android') AS android,
                     COUNT(*) FILTER (WHERE platform = 'app') AS app
                FROM generation_log WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY ROLLUP (COALESCE(source, 'unknown')) ORDER BY is_total, n DESC`, [w.from, w.to, p]),
    db.query(`SELECT screen, COUNT(*) AS n, COUNT(DISTINCT COALESCE(install_id::text, visitor_hash)) AS users
                FROM usage_events WHERE event = 'screen_view' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY 1 ORDER BY n DESC LIMIT 15`, [w.from, w.to, p]),
    db.query(`SELECT screen, COUNT(*) AS n, COUNT(DISTINCT COALESCE(install_id::text, visitor_hash)) AS users
                FROM usage_events WHERE event = 'page_view' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY 1 ORDER BY n DESC LIMIT 15`, [w.from, w.to, p]),
    db.query(`SELECT event, platform, COUNT(*) AS n
                FROM usage_events WHERE event NOT IN ('page_view', 'screen_view', 'app_open', 'engage')
                 AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY 1, 2 ORDER BY 1`, [w.from, w.to, p]),
  ]);
  const act = {};
  for (const r of actions.rows) ((act[r.event] ||= { total: 0 })[r.platform] = int(r.n), act[r.event].total += int(r.n));
  const ms = (v) => (v == null ? null : Math.round(Number(v)));
  return {
    core: core.rows.map((r) => ({
      source: Number(r.is_total) ? null : r.source, n: int(r.n), ok: int(r.ok), fail: int(r.fail), rejected: int(r.rejected),
      p50: ms(r.p50), p95: ms(r.p95), web: int(r.web), ios: int(r.ios), android: int(r.android), app: int(r.app),
    })),
    screens: screens.rows, pages: pages.rows, actions: act,
  };
}

async function acquisition(w, p, T) {
  const [visits, installs, challenge, storeSrc] = await Promise.all([
    // Per-visit sources from web beacons and app first opens (props set by lib/usage.js).
    db.query(`SELECT props->>'acq_source' AS source, NULLIF(props->>'acq_medium', '') AS medium,
                     NULLIF(props->>'acq_campaign', '') AS campaign, COUNT(*) AS n
                FROM usage_events WHERE props ? 'acq_source' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 20`, [w.from, w.to, p]),
    db.query(`SELECT platform, COALESCE(acq_source, '(direct / store)') AS source, acq_campaign AS campaign, COUNT(*) AS n
                FROM usage_installs WHERE first_seen >= $1 AND first_seen < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 20`, [w.from, w.to, p]),
    db.query(`SELECT
                (SELECT COUNT(*) FROM usage_events WHERE event = 'challenge_create' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}) AS created,
                (SELECT COUNT(*) FROM usage_events WHERE event = 'challenge_open'   AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}) AS opened,
                (SELECT COUNT(*) FROM usage_installs WHERE acq_source = 'challenge' AND first_seen >= $1 AND first_seen < $2 AND ($3 = 'all' OR platform = $3) AND ${T}) AS new_users`,
      [w.from, w.to, p]),
    db.query(`SELECT platform, metric, SUM(value) AS n FROM store_daily
               WHERE (metric LIKE 'src:%' OR metric LIKE 'cmp:%' OR metric LIKE 'ref:%')
                 AND day >= $1::date AND day < $2::date AND ($3 = 'all' OR platform = $3)
               GROUP BY 1, 2 ORDER BY n DESC LIMIT 30`, [w.from, w.to, p]),
  ]);
  return {
    visits: visits.rows, installs: installs.rows,
    challenge: { created: int(challenge.rows[0].created), opened: int(challenge.rows[0].opened), newUsers: int(challenge.rows[0].new_users) },
    store: storeSrc.rows,
  };
}

// D1 / D7 / D30: share of installs first seen on day X active again on X+1 / X+7 / X+30.
async function retention(w, p, T) {
  const { rows } = await db.query(
    `WITH cohort AS (
       SELECT install_id, (first_seen AT TIME ZONE 'UTC')::date AS d0 FROM usage_installs
        WHERE first_seen >= $1 AND first_seen < $2 AND ($3 = 'all' OR platform = $3) AND ${T}),
     act AS (
       SELECT install_id, (ts AT TIME ZONE 'UTC')::date AS d FROM usage_events WHERE install_id IS NOT NULL AND ts >= $1 AND ${T}
       UNION
       SELECT install_id, (ts AT TIME ZONE 'UTC')::date FROM generation_log WHERE install_id IS NOT NULL AND ts >= $1 AND ${T})
     SELECT
       COUNT(*) FILTER (WHERE c.d0 <= (NOW() AT TIME ZONE 'UTC')::date - 1) AS d1_base,
       COUNT(*) FILTER (WHERE c.d0 <= (NOW() AT TIME ZONE 'UTC')::date - 1 AND EXISTS (SELECT 1 FROM act a WHERE a.install_id = c.install_id AND a.d = c.d0 + 1)) AS d1,
       COUNT(*) FILTER (WHERE c.d0 <= (NOW() AT TIME ZONE 'UTC')::date - 7) AS d7_base,
       COUNT(*) FILTER (WHERE c.d0 <= (NOW() AT TIME ZONE 'UTC')::date - 7 AND EXISTS (SELECT 1 FROM act a WHERE a.install_id = c.install_id AND a.d = c.d0 + 7)) AS d7,
       COUNT(*) FILTER (WHERE c.d0 <= (NOW() AT TIME ZONE 'UTC')::date - 30) AS d30_base,
       COUNT(*) FILTER (WHERE c.d0 <= (NOW() AT TIME ZONE 'UTC')::date - 30 AND EXISTS (SELECT 1 FROM act a WHERE a.install_id = c.install_id AND a.d = c.d0 + 30)) AS d30
     FROM cohort c`,
    // Cohorts need at least 30 days of follow-up, so look back past short ranges.
    [new Date(Math.min(w.from.getTime(), Date.now() - 60 * DAY_MS)), w.to, p]);
  const r = rows[0];
  const pct = (a, b) => (int(b) ? int(a) / int(b) : null);
  return {
    d1: pct(r.d1, r.d1_base), d1Base: int(r.d1_base),
    d7: pct(r.d7, r.d7_base), d7Base: int(r.d7_base),
    d30: pct(r.d30, r.d30_base), d30Base: int(r.d30_base),
  };
}

// Stickiness: average daily users ÷ monthly users over the 30 days up to the end
// of the period. Installs only: an anonymous web visitor's hash rotates daily, so
// one person would count as thirty monthly users.
async function stickiness(w, p, T, since) {
  const from = new Date(w.to.getTime() - 30 * DAY_MS);
  const { rows } = await db.query(
    `SELECT COUNT(DISTINCT install_id) AS mau,
            COUNT(DISTINCT (install_id, (ts AT TIME ZONE 'UTC')::date)) AS user_days
       FROM (${activity(T)}) a WHERE install_id IS NOT NULL`, [from, w.to, p]);
  const mau = int(rows[0].mau);
  return { mau, dauMau: mau ? int(rows[0].user_days) / trackedDays(from, w.to, since) / mau : null };
}

async function health(w, p, T) {
  const [providers, outcomes, countries, langs, versions, reports, imports, sec, safety] = await Promise.all([
    db.query(`SELECT COALESCE(provider, '—') AS provider, COUNT(*) AS n,
                     percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
                     percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
                FROM generation_log WHERE outcome = 'ok' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY 1 ORDER BY n DESC`, [w.from, w.to, p]),
    db.query(`SELECT outcome, COUNT(*) AS n FROM generation_log
               WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T} GROUP BY 1 ORDER BY n DESC`, [w.from, w.to, p]),
    db.query(`SELECT country, COUNT(DISTINCT uid) AS users FROM (
                SELECT country, COALESCE(install_id::text, visitor_hash) AS uid FROM usage_events WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
                UNION ALL
                SELECT country, COALESCE(install_id::text, visitor_hash) FROM generation_log WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}) x
               WHERE country IS NOT NULL GROUP BY 1 ORDER BY users DESC LIMIT 12`, [w.from, w.to, p]),
    db.query(`SELECT lang, COUNT(*) AS n FROM generation_log
               WHERE lang IS NOT NULL AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T} GROUP BY 1 ORDER BY n DESC LIMIT 12`, [w.from, w.to, p]),
    db.query(`SELECT platform, app_version, COUNT(DISTINCT install_id) AS installs FROM usage_events
               WHERE app_version IS NOT NULL AND platform IN ('ios', 'android') AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T}
               GROUP BY 1, 2 ORDER BY installs DESC LIMIT 10`, [w.from, w.to, p]),
    db.query(`SELECT COUNT(*) FILTER (WHERE status = 'open') AS open FROM content_reports`),
    db.query(`SELECT source, ran_at, ok, detail FROM store_import_status ORDER BY source`),
    getSecurityConfig(),
    safetyReview(w),
  ]);
  const budgetUsed = await rateLimit.peek("generate:budget", "global", 86_400_000, { fixed: true });
  // Every traffic class in the period, whichever mode is on, so nothing is hidden.
  const filtered = await db.query(
    `SELECT traffic, COUNT(DISTINCT (uid, (ts AT TIME ZONE 'UTC')::date)) FILTER (WHERE uid IS NOT NULL) AS visitors,
            COUNT(*) FILTER (WHERE kind = 'event') AS events, COUNT(*) FILTER (WHERE kind = 'drawing') AS drawings FROM (
       SELECT traffic, ts, COALESCE(install_id::text, visitor_hash) AS uid, 'event' AS kind
         FROM usage_events WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
       UNION ALL
       SELECT traffic, ts, COALESCE(install_id::text, visitor_hash), 'drawing'
         FROM generation_log WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)) x
     GROUP BY 1 ORDER BY 1`, [w.from, w.to, p]);
  return {
    traffic: filtered.rows.map((r) => ({ traffic: r.traffic, visitors: int(r.visitors), events: int(r.events), drawings: int(r.drawings) })),
    providers: providers.rows.map((r) => ({ provider: r.provider, n: int(r.n), p50: r.p50 && Math.round(r.p50), p95: r.p95 && Math.round(r.p95) })),
    outcomes: outcomes.rows,
    countries: countries.rows, languages: langs.rows, versions: versions.rows,
    openReports: int(reports.rows[0].open),
    budget: { used: Math.round(budgetUsed), limit: sec.generate.dailyBudget },
    botGate: await authStats.recent(Math.min(14, Math.max(1, w.days))),
    imports: imports.rows,
    safety,
  };
}

// What the filter refused in the period, and the reports still waiting for a person
// (migration 014 + 009). A rising refusal count of normal subjects means over-blocking.
async function safetyReview(w) {
  const [byStage, recent, open] = await Promise.all([
    db.query(`SELECT stage, category, COUNT(*) AS n FROM moderation_events
               WHERE ts >= $1 AND ts < $2 GROUP BY 1, 2 ORDER BY n DESC`, [w.from, w.to]),
    db.query(`SELECT ts, stage, category, platform, subject, subject_en FROM moderation_events
               WHERE ts >= $1 AND ts < $2 ORDER BY ts DESC LIMIT 25`, [w.from, w.to]),
    db.query(`SELECT id, created_at, subject, source, reason, platform, app_version,
                     evidence_file IS NOT NULL AS has_evidence
                FROM content_reports WHERE status = 'open' ORDER BY created_at LIMIT 25`),
  ]);
  return { byStage: byStage.rows, recent: recent.rows, openReports: open.rows };
}

// User feedback & ratings (migration 011): grown-ups' site rating (1..5 ★),
// kids' picture rating (1 😕 / 2 🙂 / 3 😍), contact messages, content reports,
// store-review prompts, and the implicit quality signal "re-roll" (Again on the
// same subject) relative to all successful drawings.
async function feedback(w, p, T) {
  const F = `ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)`;
  const [site, siteDist, sitePrev, comments, pic, picBy, worst, contact, contactLatest, reports, prompts, reroll] = await Promise.all([
    db.query(`SELECT COUNT(*) AS n, AVG(rating)::float AS avg,
                     COUNT(*) FILTER (WHERE platform = 'web') AS web,
                     COUNT(*) FILTER (WHERE platform = 'ios') AS ios,
                     COUNT(*) FILTER (WHERE platform = 'android') AS android
                FROM feedback WHERE kind = 'site' AND ${F}`, [w.from, w.to, p]),
    db.query(`SELECT rating, COUNT(*) AS n FROM feedback WHERE kind = 'site' AND ${F} GROUP BY 1`, [w.from, w.to, p]),
    db.query(`SELECT COUNT(*) AS n, AVG(rating)::float AS avg FROM feedback WHERE kind = 'site' AND ${F}`, [w.prevFrom, w.prevTo, p]),
    db.query(`SELECT ts, platform, rating, comment, lang, country FROM feedback
               WHERE kind = 'site' AND comment IS NOT NULL AND ${F} ORDER BY ts DESC LIMIT 15`, [w.from, w.to, p]),
    db.query(`SELECT COUNT(*) AS n,
                     COUNT(*) FILTER (WHERE rating = 3) AS loved,
                     COUNT(*) FILTER (WHERE rating = 2) AS ok,
                     COUNT(*) FILTER (WHERE rating = 1) AS meh
                FROM feedback WHERE kind = 'picture' AND ${F}`, [w.from, w.to, p]),
    db.query(`SELECT 'provider' AS dim, COALESCE(provider, '—') AS key, COUNT(*) AS n, AVG(rating)::float AS avg
                FROM feedback WHERE kind = 'picture' AND ${F} GROUP BY 2
              UNION ALL
              SELECT 'difficulty', COALESCE(difficulty, '—'), COUNT(*), AVG(rating)::float
                FROM feedback WHERE kind = 'picture' AND ${F} GROUP BY 2
              ORDER BY 1, 3 DESC`, [w.from, w.to, p]),
    db.query(`SELECT subject_en AS subject, COUNT(*) AS n, AVG(rating)::float AS avg
                FROM feedback WHERE kind = 'picture' AND subject_en IS NOT NULL AND ${F}
               GROUP BY 1 HAVING COUNT(*) >= 2 ORDER BY avg ASC, n DESC LIMIT 10`, [w.from, w.to, p]),
    db.query(`SELECT COUNT(*) AS n FROM feedback WHERE kind = 'contact' AND ${F}`, [w.from, w.to, p]),
    db.query(`SELECT ts, platform, lang, country, LEFT(comment, 300) AS comment FROM feedback
               WHERE kind = 'contact' AND ${F} ORDER BY ts DESC LIMIT 5`, [w.from, w.to, p]),
    db.query(`SELECT reason, COUNT(*) AS n FROM content_reports
               WHERE created_at >= $1 AND created_at < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1 ORDER BY n DESC`, [w.from, w.to, p]),
    db.query(`SELECT event, COUNT(*) AS n FROM usage_events
               WHERE event IN ('review_prompt', 'review_store_open', 'feedback_open') AND ${T} AND ${F} GROUP BY 1`, [w.from, w.to, p]),
    db.query(`SELECT COUNT(*) FILTER (WHERE source = 'again') AS again, COUNT(*) AS ok
                FROM generation_log WHERE outcome = 'ok' AND ${T} AND ${F}`, [w.from, w.to, p]),
  ]);
  const dist = [1, 2, 3, 4, 5].map((r) => ({ rating: r, n: int(siteDist.rows.find((x) => x.rating === r)?.n) }));
  const ev = Object.fromEntries(prompts.rows.map((r) => [r.event, int(r.n)]));
  const pr = pic.rows[0];
  return {
    site: {
      n: int(site.rows[0].n), avg: site.rows[0].avg,
      prevN: int(sitePrev.rows[0].n), prevAvg: sitePrev.rows[0].avg,
      byPlatform: { web: int(site.rows[0].web), ios: int(site.rows[0].ios), android: int(site.rows[0].android) },
      distribution: dist, comments: comments.rows,
    },
    pictures: {
      n: int(pr.n), loved: int(pr.loved), ok: int(pr.ok), meh: int(pr.meh),
      byProvider: picBy.rows.filter((r) => r.dim === "provider").map((r) => ({ key: r.key, n: int(r.n), avg: r.avg })),
      byDifficulty: picBy.rows.filter((r) => r.dim === "difficulty").map((r) => ({ key: r.key, n: int(r.n), avg: r.avg })),
      lowestSubjects: worst.rows.map((r) => ({ subject: r.subject, n: int(r.n), avg: r.avg })),
    },
    contact: { n: int(contact.rows[0].n), latest: contactLatest.rows },
    contentReports: reports.rows.map((r) => ({ reason: r.reason, n: int(r.n) })),
    reviewPrompts: { shown: ev.review_prompt || 0, storeOpened: ev.review_store_open || 0, feedbackOpened: ev.feedback_open || 0 },
    reroll: { again: int(reroll.rows[0].again), drawings: int(reroll.rows[0].ok) },
  };
}

// Android vitals (Play Developer Reporting API, imported nightly). Rates are
// fractions; Play's "bad behaviour" thresholds are 1.09% crash / 0.47% ANR.
async function vitals(w, p) {
  if (p !== "all" && p !== "android") return null;
  const { rows } = await db.query(
    `SELECT day::text, metric, value FROM store_daily
      WHERE platform = 'android' AND metric IN ('crash_rate', 'crash_rate_user', 'anr_rate', 'anr_rate_user', 'vitals_users')
        AND day >= $1::date - 30 ORDER BY day`, [w.from]);
  const byDay = {};
  for (const r of rows) (byDay[r.day] ||= { day: r.day })[r.metric] = Number(r.value);
  const days = Object.values(byDay);
  return { days, latest: days[days.length - 1] || null, thresholds: { crash_rate_user: 0.0109, anr_rate_user: 0.0047 } };
}

// Cloudflare edge traffic for lalabuba.com (humans + bots), imported nightly.
async function edge(w, p) {
  if (p !== "all" && p !== "web") return null;
  const daily = await db.query(
    `SELECT day::text, metric, value FROM store_daily
      WHERE platform = 'web' AND metric IN ('cf_requests', 'cf_pageviews', 'cf_uniques', 'cf_threats', 'cf_cached')
        AND day >= $1::date AND day < $2::date ORDER BY day`, [w.from, w.to]);
  const countries = await db.query(
    `SELECT substring(metric FROM 7) AS country, SUM(value) AS n FROM store_daily
      WHERE platform = 'web' AND metric LIKE 'cf_cc:%' AND day >= $1::date AND day < $2::date
      GROUP BY 1 ORDER BY 2 DESC LIMIT 15`, [w.from, w.to]);
  const byDay = {};
  for (const r of daily.rows) (byDay[r.day] ||= { day: r.day })[r.metric.slice(3)] = Number(r.value);
  const days = Object.values(byDay);
  const sum = (k) => days.reduce((a, d) => a + (d[k] || 0), 0);
  return {
    days,
    totals: { requests: sum("requests"), pageviews: sum("pageviews"), threats: sum("threats"), cached: sum("cached"),
      uniquesPerDay: days.length ? sum("uniques") / days.length : null },
    countries: countries.rows.map((r) => ({ country: r.country, n: int(r.n) })),
  };
}

// User activity per bucket, newest first — the table under the charts.
// Per-platform users, drawings and downloads come from series().
async function daily(w, p, T, bucket, ser, since) {
  const args = [w.from, w.to, p, bucket];
  const [news, ev] = await Promise.all([
    db.query(`SELECT ${per("first_seen", 4)} AS day, COUNT(*) AS n FROM usage_installs
               WHERE first_seen >= $1 AND first_seen < $2 AND ($3 = 'all' OR platform = $3) AND ${T} GROUP BY 1`, args),
    db.query(`SELECT ${per("ts", 4)} AS day,
                     COUNT(*) FILTER (WHERE event = 'page_view') AS page_views,
                     COUNT(*) FILTER (WHERE event = 'screen_view') AS screen_views,
                     COUNT(*) FILTER (WHERE event = 'complete') AS completed
                FROM usage_events WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) AND ${T} GROUP BY 1`, args),
  ]);
  const by = (rows) => Object.fromEntries(rows.map((r) => [r.day, r]));
  const n = by(news.rows), e = by(ev.rows);
  const sum = (o) => ["web", "ios", "android", "app"].reduce((a, k) => a + (o[k] || 0), 0);
  return ser.days.map((day, i) => {
    const u = ser.activeUsers[i], d = ser.drawings[i], dl = ser.downloads[i];
    return markTracked({
      day, users: u._total, web: u.web || 0, ios: u.ios || 0, android: (u.android || 0) + (u.app || 0),
      newUsers: int(n[day]?.n), pageViews: int(e[day]?.page_views), screenViews: int(e[day]?.screen_views),
      drawings: sum(d), failed: d._fail || 0, completed: int(e[day]?.completed), downloads: sum(dl),
    }, since, bucket);
  }).reverse();
}

// First recorded row. Retention deletes old rows, so this also moves forward with
// it: older periods really are unknown.
async function trackingSince() {
  const { rows } = await db.query(
    `SELECT LEAST((SELECT MIN(ts) FROM usage_events), (SELECT MIN(ts) FROM generation_log)) AS since`);
  return rows[0].since ? new Date(rows[0].since).toISOString() : null;
}

async function getStats({ range = "7d", platform = "all", at, from, to, traffic = "human", bucket } = {}) {
  if (!RANGES.includes(range)) range = "7d";
  if (!PLATFORMS.includes(platform)) platform = "all";
  if (!TRAFFIC.includes(traffic)) traffic = "human";
  const w = rangeWindow(range, { at, from, to });
  if (!BUCKETS.includes(bucket)) bucket = defaultBucket(w.days);
  const T = trafficFilter(traffic);
  const since = await trackingSince();
  const [k, s, ser, pr, us, acq, ret, stick, h, fb, vit, ed] = await Promise.all([
    kpis(w, platform, T, since), store(w, platform), series(w, platform, T, bucket, since), prompts(w, platform, T),
    usage(w, platform, T), acquisition(w, platform, T), retention(w, platform, T), stickiness(w, platform, T, since),
    health(w, platform, T), feedback(w, platform, T), vitals(w, platform), edge(w, platform),
  ]);
  // Store builds older than 1.0.24 cannot tell iOS from Android ("app"), so an
  // iOS or Android view says how much of the period it cannot include.
  let unsplit = null;
  if (platform === "ios" || platform === "android") {
    const { rows } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE outcome = 'ok') AS drawings, COUNT(DISTINCT install_id) AS users
         FROM generation_log WHERE platform = 'app' AND ts >= $1 AND ts < $2 AND ${T}`, [w.from, w.to]);
    unsplit = { drawings: int(rows[0].drawings), users: int(rows[0].users) };
  }
  const day = (d) => d.toISOString().slice(0, 10);
  const sinceMs = since ? new Date(since).getTime() : null;
  return {
    generatedAt: new Date().toISOString(), range, platform, traffic, bucket,
    from: day(w.from), to: day(new Date(w.to - 1)), days: w.days,
    prevFrom: day(w.prevFrom), prevTo: day(new Date(w.prevTo - 1)),
    // Usage numbers of a period before tracking started are unknown, not zero.
    trackingSince: since,
    tracked: sinceMs != null && w.to.getTime() > sinceMs,
    prevTracked: sinceMs != null && w.prevTo.getTime() > sinceMs,
    kpis: k, store: s, series: ser, daily: await daily(w, platform, T, bucket, ser, since),
    prompts: pr, usage: us, acquisition: acq, retention: ret, stickiness: stick, health: h, feedback: fb,
    vitals: vit, edge: ed, unsplit,
  };
}

module.exports = {
  getStats, RANGES, PLATFORMS, TRAFFIC, BUCKETS,
  _rangeWindow: rangeWindow, _bucketStart: bucketStart, _bucketList: bucketList, _defaultBucket: defaultBucket,
  _markTracked: markTracked, _trackedDays: trackedDays, _trafficFilter: trafficFilter,
};
