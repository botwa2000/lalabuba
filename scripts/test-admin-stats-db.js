#!/usr/bin/env node
// /admin/stats SQL against a real, throwaway Postgres: buckets, traffic modes,
// tracked periods, retention, stickiness, core actions. It WIPES the usage tables,
// so it refuses anything but a local database with "test" in its name.
//   DATABASE_URL=postgres://user:pw@localhost:5432/lalabuba_test node scripts/test-admin-stats-db.js
"use strict";
const assert = require("assert");

const url = new URL(process.env.DATABASE_URL || "postgres://missing/");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/test/.test(url.pathname)) {
  console.error("Refusing to run: DATABASE_URL must be a local database with 'test' in its name.");
  process.exit(1);
}

const db = require("../lib/db");
const stats = require("../lib/stats");
const usage = require("../lib/usage");

const DAY = 86_400_000;
const midnight = new Date(); midnight.setUTCHours(0, 0, 0, 0);
const ago = (d, h = 12) => new Date(midnight.getTime() - d * DAY + h * 3600_000);
const isoDay = (d) => d.toISOString().slice(0, 10);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = id(1), B = id(2), C = id(3), REVIEW = id(4), TEST = id(5), CONSENTED = id(6);

const event = (ts, platform, install, traffic = "human", ev = "app_open", vh = null) => db.query(
  `INSERT INTO usage_events (ts, platform, install_id, visitor_hash, event, traffic) VALUES ($1,$2,$3,$4,$5,$6)`,
  [ts, platform, install, vh, ev, traffic]);
const drawing = (ts, platform, install, o = {}) => db.query(
  `INSERT INTO generation_log (ts, platform, install_id, outcome, source, latency_ms, subject_en, traffic) VALUES ($1,$2,$3,$4,$5,$6,'cat',$7)`,
  [ts, platform, install, o.outcome || "ok", o.source || "custom", o.latency ?? 1000, o.traffic || "human"]);
const install = (iid, platform, first, traffic = "human") => db.query(
  `INSERT INTO usage_installs (install_id, platform, first_seen, last_seen, traffic) VALUES ($1,$2,$3,$3,$4)`, [iid, platform, first, traffic]);

async function seed() {
  await db.query("TRUNCATE usage_events, generation_log, usage_installs, store_daily, store_reviews, store_import_status, feedback");
  await event(ago(45), "ios", A);   // tracking starts here
  // A returns on day 1, 7 and 30; B never does.
  await install(A, "ios", ago(45)); await install(B, "android", ago(45));
  for (const d of [44, 38, 15]) await event(ago(d), "ios", A);
  await event(ago(45), "android", B);
  // C is active three days of one Monday-to-Sunday week.
  const monday = new Date(midnight.getTime() - ((midnight.getUTCDay() + 6) % 7) * DAY - 7 * DAY);
  await install(C, "ios", new Date(monday.getTime() + 3600_000));
  for (const d of [0, 1, 2]) await event(new Date(monday.getTime() + d * DAY + 3600_000), "ios", C);
  // Thirty anonymous visitors: one a day, as one person with a rotating hash looks.
  for (let d = 0; d < 30; d++) await event(ago(d, 6), "web", null, "human", "page_view", `hash${d}`);
  // A consented web visitor is an install.
  await install(CONSENTED, "web", ago(3));
  await event(ago(3), "web", CONSENTED);
  // What Real leaves out.
  await install(REVIEW, "ios", ago(2), "review");
  await event(ago(2), "ios", REVIEW, "review");
  await drawing(ago(2), "ios", REVIEW, { traffic: "review" });
  await install(TEST, "android", ago(2), "test");
  await event(ago(2), "android", TEST, "test");
  await event(ago(2), "web", null, "bot", "page_view", "crawler");
  // Core actions.
  await drawing(ago(1), "web", null, { source: "card", latency: 1000 });
  await drawing(ago(0, 0), "ios", A, { source: "card", latency: 3000 });
  await drawing(ago(1), "android", B, { source: "custom", outcome: "fail", latency: 40000 });
  await drawing(ago(1), "web", null, { source: "custom", outcome: "blocked", latency: null });
  // Store downloads from before tracking.
  await db.query(`INSERT INTO store_daily (day, platform, metric, value) VALUES ($1, 'ios', 'downloads', 7)`, [isoDay(ago(200))]);
}

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("  ✓", name); };
const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

(async () => {
  await db.runMigrations();
  await seed();

  await t("every range, platform, traffic mode and bucket runs", async () => {
    for (const range of stats.RANGES) for (const platform of stats.PLATFORMS) for (const traffic of stats.TRAFFIC) {
      const d = await stats.getStats({ range, platform, traffic });
      assert.strictEqual(d.traffic, traffic);
      assert.strictEqual(d.daily.length, d.series.days.length);
    }
    for (const bucket of stats.BUCKETS) await stats.getStats({ range: "30d", bucket });
  });
  await t("invalid parameters fall back to the defaults", async () => {
    const d = await stats.getStats({ range: "nope", platform: "x", traffic: "x' OR 1=1", bucket: "'; DROP" });
    assert.deepStrictEqual([d.range, d.platform, d.traffic, d.bucket], ["7d", "all", "human", "day"]);
  });
  await t("default bucket follows the period", async () => {
    assert.strictEqual((await stats.getStats({ range: "30d" })).bucket, "day");
    assert.strictEqual((await stats.getStats({ range: "90d" })).bucket, "week");
    assert.strictEqual((await stats.getStats({ range: "12m" })).bucket, "month");
  });
  await t("a week counts a person once, however many days they came", async () => {
    const byDay = await stats.getStats({ range: "30d", platform: "ios", bucket: "day" });
    const byWeek = await stats.getStats({ range: "30d", platform: "ios", bucket: "week" });
    const monday = stats._bucketStart(isoDay(new Date(midnight.getTime() - 7 * DAY)), "week");
    const days = byDay.daily.filter((r) => r.day >= monday && stats._bucketStart(r.day, "week") === monday);
    assert.strictEqual(sum(days, "users"), 3, "three daily actives");
    assert.strictEqual(byWeek.daily.find((r) => r.day === monday).users, 1);
    assert.strictEqual(byWeek.series.activeUsers.find((p) => p.day === monday)._total, 1);
  });
  await t("buckets match Postgres date_trunc, newest first", async () => {
    const d = await stats.getStats({ range: "12m" });
    const { rows } = await db.query(`SELECT date_trunc('month', (NOW() AT TIME ZONE 'UTC'))::date::text AS m`);
    assert.strictEqual(d.daily[0].day, rows[0].m);
    assert.strictEqual(d.daily.length, 12 + (midnight.getUTCDate() === 1 ? 0 : 1));
  });
  await t("Real leaves out review, test and bots; All shows them and every class is listed", async () => {
    const human = await stats.getStats({ range: "7d" }), all = await stats.getStats({ range: "7d", traffic: "all" });
    assert.strictEqual(all.kpis.cur.activeUsers - human.kpis.cur.activeUsers, 3, "review + test + crawler");
    assert.strictEqual(all.kpis.cur.newUsers - human.kpis.cur.newUsers, 2);
    assert.strictEqual(all.kpis.cur.drawings - human.kpis.cur.drawings, 1);
    for (const d of [human, all]) {
      const by = Object.fromEntries(d.health.traffic.map((r) => [r.traffic, r]));
      assert.deepStrictEqual([by.review.visitors, by.review.drawings, by.test.visitors, by.bot.visitors], [1, 1, 1, 1]);
    }
    assert.strictEqual(human.traffic, "human");
    assert(all.edge === null || "days" in all.edge, "Cloudflare data moved to edge");
  });
  await t("a drawing with no events still counts in its class", async () => {
    await drawing(ago(1), "app", id(7), { traffic: "review" });
    const by = Object.fromEntries((await stats.getStats({ range: "7d" })).health.traffic.map((r) => [r.traffic, r]));
    assert.strictEqual(by.review.visitors, 2);
    await db.query("DELETE FROM generation_log WHERE install_id = $1", [id(7)]);
  });
  await t("trackingSince and prevTracked", async () => {
    const week = await stats.getStats({ range: "7d" }), year = await stats.getStats({ range: "12m" });
    assert.strictEqual(week.trackingSince, ago(45).toISOString());
    assert.deepStrictEqual([week.tracked, week.prevTracked], [true, true]);
    assert.deepStrictEqual([year.tracked, year.prevTracked], [true, false]);
    const before = await stats.getStats({ range: "month", at: isoDay(ago(120)) });
    assert.deepStrictEqual([before.tracked, before.prevTracked], [false, false]);
    assert(before.daily.every((r) => r.tracked === false && r.users === null));
  });
  await t("rows before tracking are unknown, store downloads remain", async () => {
    const d = await stats.getStats({ range: "12m" });
    const old = d.daily.find((r) => r.day === stats._bucketStart(isoDay(ago(200)), "month"));
    assert.deepStrictEqual([old.tracked, old.users, old.drawings, old.downloads], [false, null, null, 7]);
    const first = d.daily.find((r) => r.day === stats._bucketStart(isoDay(ago(45)), "month"));
    assert.strictEqual(first.tracked, true);
    assert.strictEqual(d.series.activeUsers.find((p) => p.day === old.day).tracked, false);
  });
  await t("the average per day ignores days before tracking", async () => {
    const d = await stats.getStats({ range: "12m" });
    const { rows } = await db.query(
      `SELECT COUNT(DISTINCT (COALESCE(install_id::text, visitor_hash), (ts AT TIME ZONE 'UTC')::date)) AS n
         FROM (SELECT * FROM (SELECT ts, install_id, visitor_hash, traffic FROM usage_events UNION ALL SELECT ts, install_id, visitor_hash, traffic FROM generation_log) u) x WHERE traffic = 'human'`);
    assert.strictEqual(d.kpis.cur.avgDailyUsers, Math.round((10 * Number(rows[0].n)) / 46) / 10);
  });
  await t("D1, D7 and D30 retention over a 60-day lookback", async () => {
    const r = (await stats.getStats({ range: "7d" })).retention;
    assert.strictEqual(r.d1Base, 4, "A, B, C and the consented visitor");
    assert.strictEqual(r.d1, 0.5, "A and C came back the next day");
    assert.strictEqual(r.d7Base, 3, "the consented visitor is too recent");
    assert.strictEqual(r.d7, 1 / 3, "only A came back on day 7");
    assert.strictEqual(r.d30Base, 2, "only cohorts with 30 days of follow-up");
    assert.strictEqual(r.d30, 0.5, "A of A and B came back on day 30");
  });
  await t("stickiness counts installs only: rotating web hashes stay out", async () => {
    const s = (await stats.getStats({ range: "7d" })).stickiness;
    // Installs in the last 30 days: A (1 day + a drawing day), B (1), C (3), consented (1).
    assert.strictEqual(s.mau, 4, "not 34");
    const expected = (2 + 1 + 3 + 1) / 30 / 4;
    assert(Math.abs(s.dauMau - expected) < 1e-9, `${s.dauMau} vs ${expected}`);
    assert.strictEqual((await stats.getStats({ range: "7d", platform: "web" })).stickiness.mau, 1);
  });
  await t("core actions: per source, rollup, percentiles of successful requests", async () => {
    const core = (await stats.getStats({ range: "7d" })).usage.core;
    const all = core[core.length - 1], card = core.find((r) => r.source === "card"), custom = core.find((r) => r.source === "custom");
    assert.strictEqual(all.source, null, "the rollup row comes last");
    assert.deepStrictEqual([all.n, all.ok, all.fail, all.rejected], [4, 2, 1, 1]);
    assert.deepStrictEqual([card.n, card.ok, card.p50, card.web, card.ios], [2, 2, 2000, 1, 1]);
    assert.deepStrictEqual([custom.ok, custom.fail, custom.rejected, custom.p50], [0, 1, 1, null], "a 40 s failure is not a latency");
  });

  await t("a request from Apple's network is stored as review, without the IP", async () => {
    const req = { headers: { "x-platform": "ios", "x-device-id": id(8), "cf-connecting-ip": "17.5.7.9" } };
    await usage.recordEvents(req, { events: [{ e: "app_open" }] });
    const ev = await db.query("SELECT * FROM usage_events WHERE install_id = $1", [id(8)]);
    assert.strictEqual(ev.rows[0].traffic, "review");
    assert(!JSON.stringify(ev.rows[0]).includes("17.5.7.9"), "the address is not stored");
    assert.strictEqual((await db.query("SELECT traffic FROM usage_installs WHERE install_id = $1", [id(8)])).rows[0].traffic, "review");
    // The same install later seen on an ordinary network is a person.
    await usage.recordEvents({ headers: { ...req.headers, "cf-connecting-ip": "8.8.8.8" } }, { events: [{ e: "app_open" }] });
    assert.strictEqual((await db.query("SELECT traffic FROM usage_installs WHERE install_id = $1", [id(8)])).rows[0].traffic, "human");
  });

  console.log(`\n${n} passed`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
