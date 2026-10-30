"use strict";
// Aggregations behind GET /api/admin/stats (rendered by lib/render-admin-stats.js).
// All days are UTC. `platform` filters every section: all | web | ios | android.
// "app" rows are native requests from builds older than 1.0.24 that sent no
// X-Platform header and no verifiable App Check token.

const db = require("./db");
const authStats = require("./auth-stats");
const rateLimit = require("./rate-limit");
const { getSecurityConfig } = require("./security-config");

const RANGES = { today: 1, "7d": 7, "30d": 30, "90d": 90 };
const PLATFORMS = ["all", "web", "ios", "android"];

function rangeWindow(range) {
  const days = RANGES[range] || 7;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const from = new Date(today.getTime() - (days - 1) * 86_400_000);
  const to = new Date(today.getTime() + 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);
  return { days, from, to, prevFrom };
}

const int = (v) => Number(v || 0);

// Union of every row that proves a user was active.
const ACTIVITY = `
  SELECT ts, platform, COALESCE(install_id::text, visitor_hash) AS uid, install_id
    FROM usage_events  WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
  UNION ALL
  SELECT ts, platform, COALESCE(install_id::text, visitor_hash) AS uid, install_id
    FROM generation_log WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)`;

async function kpis(w, p) {
  const one = async (from, to) => {
    const [act, gen, ev, inst] = await Promise.all([
      // Unconsented web visitors rotate their hash daily, so a multi-day distinct
      // count is "visitor-days" for them; installs are counted once.
      db.query(`SELECT COUNT(DISTINCT uid) AS users,
                       COUNT(DISTINCT (uid, (ts AT TIME ZONE 'UTC')::date)) AS user_days
                  FROM (${ACTIVITY}) a WHERE uid IS NOT NULL`, [from, to, p]),
      db.query(`SELECT COUNT(*) FILTER (WHERE outcome = 'ok') AS ok,
                       COUNT(*) FILTER (WHERE outcome = 'fail') AS fail,
                       COUNT(*) AS attempts
                  FROM generation_log WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)`, [from, to, p]),
      db.query(`SELECT COUNT(*) FILTER (WHERE event = 'complete') AS completed
                  FROM usage_events WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)`, [from, to, p]),
      db.query(`SELECT COUNT(*) AS n FROM usage_installs
                 WHERE first_seen >= $1 AND first_seen < $2 AND ($3 = 'all' OR platform = $3)`, [from, to, p]),
    ]);
    const days = Math.max(1, Math.round((to - from) / 86_400_000));
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
  const [cur, prev] = await Promise.all([one(w.from, w.to), one(w.prevFrom, w.from)]);
  return { cur, prev };
}

async function store(w, p) {
  const plats = p === "all" ? ["ios", "android"] : p === "web" ? [] : [p];
  if (!plats.length) return { downloads: {}, prevDownloads: {}, reviews: null };
  const dl = await db.query(
    `SELECT platform,
            SUM(value) FILTER (WHERE day >= $1::date) AS cur,
            SUM(value) FILTER (WHERE day <  $1::date) AS prev
       FROM store_daily WHERE metric = 'downloads' AND day >= $2::date AND day < $3::date AND platform = ANY($4)
      GROUP BY platform`, [w.from, w.prevFrom, w.to, plats]);
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
    `SELECT platform, created_at, rating, territory, lang, title, body, app_version
       FROM store_reviews WHERE platform = ANY($1) ORDER BY created_at DESC LIMIT 8`, [plats]);

  const per = {};
  for (const pl of plats) per[pl] = { ratings: null, avg: null, written: 0, writtenAvg: null, writtenPeriod: 0, installsTotal: null, activeDevices: null };
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
  // Play exports no rating count — the written-review count is the best total we have.
  for (const t of Object.values(per)) {
    if (t.ratings === null) { t.ratings = t.written; t.ratingsIsWrittenOnly = true; }
    if (t.avg === null) t.avg = t.writtenAvg;
  }
  const total = Object.values(per).reduce((a, t) => a + (t.ratings || 0), 0);
  const wsum = Object.values(per).reduce((a, t) => a + (t.ratings || 0) * (t.avg || 0), 0);
  return {
    downloads, prevDownloads,
    reviews: { total, avg: total ? wsum / total : null, perPlatform: per, recent: recent.rows },
  };
}

async function series(w, p) {
  const [dau, gen, dl] = await Promise.all([
    db.query(`SELECT (ts AT TIME ZONE 'UTC')::date::text AS day, platform, COUNT(DISTINCT uid) AS n
                FROM (${ACTIVITY}) a WHERE uid IS NOT NULL GROUP BY 1, 2 ORDER BY 1`, [w.from, w.to, p]),
    db.query(`SELECT (ts AT TIME ZONE 'UTC')::date::text AS day, platform,
                     COUNT(*) FILTER (WHERE outcome = 'ok') AS ok,
                     COUNT(*) FILTER (WHERE outcome = 'fail') AS fail
                FROM generation_log WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1, 2 ORDER BY 1`, [w.from, w.to, p]),
    db.query(`SELECT day::text, platform, value FROM store_daily
               WHERE metric = 'downloads' AND day >= $1::date AND day < $2::date AND ($3 = 'all' OR platform = $3)
               ORDER BY day`, [w.from, w.to, p]),
  ]);
  const days = [];
  for (let d = new Date(w.from); d < w.to; d = new Date(d.getTime() + 86_400_000)) days.push(d.toISOString().slice(0, 10));
  const fold = (rows, key) => {
    const m = {};
    for (const r of rows) ((m[r.day] ||= {})[r.platform] = int(r[key]));
    return days.map((day) => ({ day, ...(m[day] || {}) }));
  };
  const fails = {};
  for (const r of gen.rows) fails[r.day] = (fails[r.day] || 0) + int(r.fail);
  return {
    days,
    activeUsers: fold(dau.rows, "n"),
    drawings: fold(gen.rows, "ok").map((x) => ({ ...x, _fail: fails[x.day] || 0 })),
    downloads: fold(dl.rows, "value"),
  };
}

async function prompts(w, p) {
  const [top, bySource, latest] = await Promise.all([
    db.query(`SELECT COALESCE(subject_en, lower(subject_raw)) AS subject, COUNT(*) AS n,
                     COUNT(*) FILTER (WHERE platform = 'web') AS web,
                     COUNT(*) FILTER (WHERE platform = 'ios') AS ios,
                     COUNT(*) FILTER (WHERE platform = 'android') AS android,
                     COUNT(*) FILTER (WHERE platform = 'app') AS app
                FROM generation_log WHERE outcome = 'ok' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1 ORDER BY n DESC LIMIT 25`, [w.from, w.to, p]),
    db.query(`SELECT COALESCE(source, 'unknown') AS source, COUNT(*) AS n
                FROM generation_log WHERE outcome = 'ok' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1 ORDER BY n DESC`, [w.from, w.to, p]),
    // Typed text only (not card/daily picks), newest first; raw text exists for 30 days.
    db.query(`SELECT ts, platform, subject_raw, subject_en, lang, outcome, source
                FROM generation_log
               WHERE subject_raw IS NOT NULL AND COALESCE(source, 'custom') IN ('custom', 'voice')
                 AND ($1 = 'all' OR platform = $1)
               ORDER BY ts DESC LIMIT 50`, [p]),
  ]);
  return { top: top.rows, bySource: bySource.rows, latestTyped: latest.rows };
}

async function usage(w, p) {
  const [screens, pages, actions] = await Promise.all([
    db.query(`SELECT screen, COUNT(*) AS n, COUNT(DISTINCT COALESCE(install_id::text, visitor_hash)) AS users
                FROM usage_events WHERE event = 'screen_view' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1 ORDER BY n DESC LIMIT 15`, [w.from, w.to, p]),
    db.query(`SELECT screen, COUNT(*) AS n, COUNT(DISTINCT COALESCE(install_id::text, visitor_hash)) AS users
                FROM usage_events WHERE event = 'page_view' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1 ORDER BY n DESC LIMIT 15`, [w.from, w.to, p]),
    db.query(`SELECT event, platform, COUNT(*) AS n
                FROM usage_events WHERE event NOT IN ('page_view', 'screen_view', 'app_open')
                 AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1, 2 ORDER BY 1`, [w.from, w.to, p]),
  ]);
  const act = {};
  for (const r of actions.rows) ((act[r.event] ||= { total: 0 })[r.platform] = int(r.n), act[r.event].total += int(r.n));
  return { screens: screens.rows, pages: pages.rows, actions: act };
}

async function acquisition(w, p) {
  const [visits, installs, challenge, storeSrc] = await Promise.all([
    // Per-visit sources from web beacons and app first opens (props set by lib/usage.js).
    db.query(`SELECT props->>'acq_source' AS source, NULLIF(props->>'acq_medium', '') AS medium,
                     NULLIF(props->>'acq_campaign', '') AS campaign, COUNT(*) AS n
                FROM usage_events WHERE props ? 'acq_source' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 20`, [w.from, w.to, p]),
    db.query(`SELECT platform, COALESCE(acq_source, '(direct / store)') AS source, acq_campaign AS campaign, COUNT(*) AS n
                FROM usage_installs WHERE first_seen >= $1 AND first_seen < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 20`, [w.from, w.to, p]),
    db.query(`SELECT
                (SELECT COUNT(*) FROM usage_events WHERE event = 'challenge_create' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)) AS created,
                (SELECT COUNT(*) FROM usage_events WHERE event = 'challenge_open'   AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)) AS opened,
                (SELECT COUNT(*) FROM usage_installs WHERE acq_source = 'challenge' AND first_seen >= $1 AND first_seen < $2 AND ($3 = 'all' OR platform = $3)) AS new_users`,
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

// D1 / D7: share of installs first seen on day X that were active again on X+1 / X+7.
async function retention(w, p) {
  const { rows } = await db.query(
    `WITH cohort AS (
       SELECT install_id, (first_seen AT TIME ZONE 'UTC')::date AS d0 FROM usage_installs
        WHERE first_seen >= $1 AND first_seen < $2 AND ($3 = 'all' OR platform = $3)),
     act AS (
       SELECT install_id, (ts AT TIME ZONE 'UTC')::date AS d FROM usage_events WHERE install_id IS NOT NULL AND ts >= $1
       UNION
       SELECT install_id, (ts AT TIME ZONE 'UTC')::date FROM generation_log WHERE install_id IS NOT NULL AND ts >= $1)
     SELECT
       COUNT(*) FILTER (WHERE c.d0 <= (NOW() AT TIME ZONE 'UTC')::date - 1) AS d1_base,
       COUNT(*) FILTER (WHERE c.d0 <= (NOW() AT TIME ZONE 'UTC')::date - 1 AND EXISTS (SELECT 1 FROM act a WHERE a.install_id = c.install_id AND a.d = c.d0 + 1)) AS d1,
       COUNT(*) FILTER (WHERE c.d0 <= (NOW() AT TIME ZONE 'UTC')::date - 7) AS d7_base,
       COUNT(*) FILTER (WHERE c.d0 <= (NOW() AT TIME ZONE 'UTC')::date - 7 AND EXISTS (SELECT 1 FROM act a WHERE a.install_id = c.install_id AND a.d = c.d0 + 7)) AS d7
     FROM cohort c`,
    // Cohorts need at least 7 days of follow-up, so look back past short ranges.
    [new Date(Math.min(w.from.getTime(), Date.now() - 37 * 86_400_000)), w.to, p]);
  const r = rows[0];
  const pct = (a, b) => (int(b) ? int(a) / int(b) : null);
  return { d1: pct(r.d1, r.d1_base), d1Base: int(r.d1_base), d7: pct(r.d7, r.d7_base), d7Base: int(r.d7_base) };
}

async function health(w, p) {
  const [providers, outcomes, countries, langs, versions, reports, imports, sec] = await Promise.all([
    db.query(`SELECT COALESCE(provider, '—') AS provider, COUNT(*) AS n,
                     percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
                     percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
                FROM generation_log WHERE outcome = 'ok' AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1 ORDER BY n DESC`, [w.from, w.to, p]),
    db.query(`SELECT outcome, COUNT(*) AS n FROM generation_log
               WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) GROUP BY 1 ORDER BY n DESC`, [w.from, w.to, p]),
    db.query(`SELECT country, COUNT(DISTINCT uid) AS users FROM (
                SELECT country, COALESCE(install_id::text, visitor_hash) AS uid FROM usage_events WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
                UNION ALL
                SELECT country, COALESCE(install_id::text, visitor_hash) FROM generation_log WHERE ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)) x
               WHERE country IS NOT NULL GROUP BY 1 ORDER BY users DESC LIMIT 12`, [w.from, w.to, p]),
    db.query(`SELECT lang, COUNT(*) AS n FROM generation_log
               WHERE lang IS NOT NULL AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3) GROUP BY 1 ORDER BY n DESC LIMIT 12`, [w.from, w.to, p]),
    db.query(`SELECT platform, app_version, COUNT(DISTINCT install_id) AS installs FROM usage_events
               WHERE app_version IS NOT NULL AND platform IN ('ios', 'android') AND ts >= $1 AND ts < $2 AND ($3 = 'all' OR platform = $3)
               GROUP BY 1, 2 ORDER BY installs DESC LIMIT 10`, [w.from, w.to, p]),
    db.query(`SELECT COUNT(*) FILTER (WHERE status = 'open') AS open FROM content_reports`),
    db.query(`SELECT source, ran_at, ok, detail FROM store_import_status ORDER BY source`),
    getSecurityConfig(),
  ]);
  const budgetUsed = await rateLimit.peek("generate:budget", "global", 86_400_000, { fixed: true });
  return {
    providers: providers.rows.map((r) => ({ provider: r.provider, n: int(r.n), p50: r.p50 && Math.round(r.p50), p95: r.p95 && Math.round(r.p95) })),
    outcomes: outcomes.rows,
    countries: countries.rows, languages: langs.rows, versions: versions.rows,
    openReports: int(reports.rows[0].open),
    budget: { used: Math.round(budgetUsed), limit: sec.generate.dailyBudget },
    botGate: await authStats.recent(Math.min(14, Math.max(1, w.days))),
    imports: imports.rows,
  };
}

async function getStats({ range = "7d", platform = "all" } = {}) {
  if (!RANGES[range]) range = "7d";
  if (!PLATFORMS.includes(platform)) platform = "all";
  const w = rangeWindow(range);
  const [k, s, ser, pr, us, acq, ret, h] = await Promise.all([
    kpis(w, platform), store(w, platform), series(w, platform), prompts(w, platform),
    usage(w, platform), acquisition(w, platform), retention(w, platform), health(w, platform),
  ]);
  return {
    generatedAt: new Date().toISOString(), range, platform,
    from: w.from.toISOString().slice(0, 10), to: new Date(w.to - 1).toISOString().slice(0, 10),
    kpis: k, store: s, series: ser, prompts: pr, usage: us, acquisition: acq, retention: ret, health: h,
  };
}

module.exports = { getStats, RANGES, PLATFORMS };
