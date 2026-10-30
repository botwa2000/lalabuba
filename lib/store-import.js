"use strict";
// Nightly import of store numbers into store_daily / store_reviews
// (migration 010) for /admin/stats. Each source runs independently and writes
// its outcome to store_import_status, so the dashboard shows exactly which
// feeds are connected and why one is not.
//
//   iOS  ratings      public iTunes lookup per storefront     (no credentials)
//   iOS  reviews      ASC API customerReviews                 ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY
//   iOS  downloads    ASC API salesReports (daily SUMMARY)    + ASC_VENDOR_NUMBER
//   iOS  sources      ASC Analytics Reports (App Downloads)   ASC key with Admin role
//   Android reviews   Play Developer API reviews.list          PLAY_SERVICE_ACCOUNT_JSON
//   Android installs, ratings, reviews history, acquisition
//                     Play bulk reports in Cloud Storage       + PLAY_REPORTS_BUCKET
//
// Runs once a day (04:30 UTC) under a Postgres advisory lock so only one
// replica imports; POST /api/admin/stats {action:"import"} runs it on demand.

const zlib = require("zlib");
const jwt = require("jsonwebtoken");
const db = require("./db");

const IOS_APP_ID = process.env.APP_STORE_APPLE_ID || "6761691648";
const ANDROID_PACKAGE = "com.lalabuba.lalabuba";
const ASC_API = "https://api.appstoreconnect.apple.com/v1";
const LOCK_ID = 7_300_210; // pg advisory lock key for the importer

// Every App Store storefront (ISO 3166-1 alpha-2). The iTunes lookup API is
// per-storefront, so the worldwide rating total is the sum over all of them.
const STOREFRONTS = (
  "ae ag ai al am ao ar at au az bb be bf bg bh bj bm bn bo br bs bt bw by bz ca cg ch ci cl cm cn co cr cv cy cz " +
  "de dk dm do dz ec ee eg es fi fj fm fr ga gb gd ge gh gm gr gt gw gy hk hn hr hu id ie il in iq is it jm jo jp " +
  "ke kg kh kn kr kw ky kz la lb lc lk lr lt lu lv ly ma md me mg mk ml mm mn mo mr ms mt mu mv mw mx my mz na ne " +
  "ng ni nl no np nr nz om pa pe pg ph pk pl pt pw py qa ro rs ru rw sa sb sc se sg si sk sl sn sr st sv sz tc td " +
  "th tj tm tn to tr tt tw tz ua ug us uy uz vc ve vg vn vu ws xk ye za zm zw"
).split(" ");

// ── helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => isoDay(new Date(Date.now() - n * 86_400_000));

async function setStatus(source, ok, detail) {
  await db.query(
    `INSERT INTO store_import_status (source, ran_at, ok, detail) VALUES ($1, NOW(), $2, $3)
     ON CONFLICT (source) DO UPDATE SET ran_at = NOW(), ok = EXCLUDED.ok, detail = EXCLUDED.detail`,
    [source, ok, String(detail || "").slice(0, 500)]
  );
}

async function putMetric(day, platform, metric, value) {
  if (!Number.isFinite(Number(value))) return;
  await db.query(
    `INSERT INTO store_daily (day, platform, metric, value) VALUES ($1, $2, $3, $4)
     ON CONFLICT (day, platform, metric) DO UPDATE SET value = EXCLUDED.value`,
    [day, platform, metric.slice(0, 80), Number(value)]
  );
}

async function upsertReview(r) {
  await db.query(
    `INSERT INTO store_reviews (platform, review_id, created_at, rating, territory, lang, title, body, app_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (platform, review_id) DO UPDATE SET
       rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body,
       app_version = COALESCE(EXCLUDED.app_version, store_reviews.app_version)`,
    [r.platform, String(r.id).slice(0, 200), r.createdAt, r.rating, r.territory || null, r.lang || null,
     r.title ? String(r.title).slice(0, 300) : null, r.body ? String(r.body).slice(0, 4000) : null, r.version || null]
  );
}

// Minimal RFC 4180 parser (quoted fields, embedded commas/newlines) → array of objects.
function parseCsv(text, delimiter = ",") {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.replace(/^﻿/, "").trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// Play bulk reports are UTF-16LE with BOM; ASC reports are gzip UTF-8 TSV.
function decodeText(buf) {
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString("utf16le");
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.slice(2)).swap16().toString("utf16le");
  return buf.toString("utf8");
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, body, text };
}

// ── App Store Connect ─────────────────────────────────────────────────────────
function ascConfigured() {
  return !!(process.env.ASC_ISSUER_ID && process.env.ASC_KEY_ID && process.env.ASC_PRIVATE_KEY);
}

// Accepts PEM with real or escaped newlines, or the bare base64 body.
function ascPem() {
  const raw = process.env.ASC_PRIVATE_KEY.replace(/\\n/g, "\n").trim().replace(/^"|"$/g, "");
  const body = raw.replace(/-----(BEGIN|END)[A-Z ]*-----/g, "").replace(/\s+/g, "");
  return `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
}

function ascToken() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 900, aud: "appstoreconnect-v1" },
    ascPem(),
    { algorithm: "ES256", keyid: process.env.ASC_KEY_ID, header: { typ: "JWT" } }
  );
}

async function asc(pathOrUrl, opts = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : ASC_API + pathOrUrl;
  return fetchJson(url, {
    ...opts,
    headers: { Authorization: `Bearer ${ascToken()}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
}

async function ascRaw(path) {
  const res = await fetch(ASC_API + path, {
    headers: { Authorization: `Bearer ${ascToken()}`, Accept: "application/a-gzip" },
    signal: AbortSignal.timeout(60_000),
  });
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) };
}

const ascErr = (r) => `HTTP ${r.status}: ${(r.body?.errors?.[0]?.detail || r.text || "").slice(0, 200)}`;

// Public worldwide rating count + weighted average (stars-only ratings included —
// the ASC API only exposes written reviews). No credentials needed.
async function importIosRatings() {
  let count = 0, weighted = 0, failures = 0;
  for (const cc of STOREFRONTS) {
    try {
      const r = await fetchJson(`https://itunes.apple.com/lookup?id=${IOS_APP_ID}&country=${cc}`);
      const app = r.body?.results?.[0];
      const n = Number(app?.userRatingCount || 0);
      if (n > 0) {
        count += n;
        weighted += n * Number(app.averageUserRating || 0);
        await putMetric(daysAgo(0), "ios", `ratings_cc:${cc.toUpperCase()}`, n);
      }
    } catch { failures++; }
    await sleep(3200); // the iTunes lookup API allows ~20 calls/min
  }
  if (failures > STOREFRONTS.length / 2) throw new Error(`${failures}/${STOREFRONTS.length} storefront lookups failed`);
  await putMetric(daysAgo(0), "ios", "rating_count_total", count);
  if (count) await putMetric(daysAgo(0), "ios", "rating_avg_total", (weighted / count).toFixed(3));
  return `${count} ratings across ${STOREFRONTS.length} storefronts${failures ? `, ${failures} lookups failed` : ""}`;
}

async function importAscReviews() {
  let url = `/apps/${IOS_APP_ID}/customerReviews?limit=200&sort=-createdDate`;
  let n = 0;
  while (url) {
    const r = await asc(url);
    if (r.status !== 200) throw new Error(ascErr(r));
    for (const rev of r.body.data) {
      const a = rev.attributes;
      await upsertReview({ platform: "ios", id: rev.id, createdAt: a.createdDate, rating: a.rating,
        territory: a.territory, title: a.title, body: a.body });
      n++;
    }
    url = r.body.links?.next || null;
  }
  return `${n} written reviews`;
}

// Product Type Identifiers (Apple "Sales and Trends" guide): first-time
// downloads, re-downloads and updates of a free iOS/universal app.
const PTI_DOWNLOAD = new Set(["1", "1F", "1T", "F1", "1E", "1EP", "1EU"]);
const PTI_REDOWNLOAD = new Set(["3", "3F", "3T", "F3"]);
const PTI_UPDATE = new Set(["7", "7F", "7T", "F7"]);

async function importAscSales() {
  const vendor = process.env.ASC_VENDOR_NUMBER;
  if (!vendor) throw new Error("ASC_VENDOR_NUMBER not set");
  // Reports for day D are published on D+1; fill every missing day of the last 35.
  const { rows } = await db.query(
    `SELECT day::text FROM store_daily WHERE platform = 'ios' AND metric = 'downloads' AND day >= $1`, [daysAgo(35)]);
  const have = new Set(rows.map((r) => r.day));
  let imported = 0;
  for (let i = 35; i >= 1; i--) {
    const day = daysAgo(i);
    if (have.has(day) && i > 3) continue; // re-pull the last 3 days: Apple restates late units
    const q = new URLSearchParams({
      "filter[frequency]": "DAILY", "filter[reportType]": "SALES", "filter[reportSubType]": "SUMMARY",
      "filter[vendorNumber]": vendor, "filter[reportDate]": day, "filter[version]": "1_1",
    });
    const r = await ascRaw(`/salesReports?${q}`);
    if (r.status === 404) {
      // "There were no sales for the date specified" — a real zero, unless the
      // report simply isn't published yet (yesterday before ~noon PT).
      if (i > 1) await putMetric(day, "ios", "downloads", 0);
      continue;
    }
    if (r.status !== 200) throw new Error(`salesReports ${day}: HTTP ${r.status} ${decodeText(r.buf).slice(0, 200)}`);
    const sums = { downloads: 0, redownloads: 0, updates: 0 };
    const byCc = {};
    for (const row of parseCsv(decodeText(r.buf), "\t")) {
      if (row["Apple Identifier"] !== IOS_APP_ID) continue;
      const units = Number(row.Units) || 0;
      const pti = row["Product Type Identifier"];
      if (PTI_DOWNLOAD.has(pti)) {
        sums.downloads += units;
        const cc = row["Country Code"];
        if (cc) byCc[cc] = (byCc[cc] || 0) + units;
      } else if (PTI_REDOWNLOAD.has(pti)) sums.redownloads += units;
      else if (PTI_UPDATE.has(pti)) sums.updates += units;
    }
    for (const [m, v] of Object.entries(sums)) await putMetric(day, "ios", m, v);
    for (const [cc, v] of Object.entries(byCc)) await putMetric(day, "ios", `dl_cc:${cc}`, v);
    imported++;
  }
  return `${imported} daily reports`;
}

// ASC Analytics Reports: one ONGOING request per app delivers daily
// "App Downloads" reports with Source Type (search, browse, web referrer, app
// referrer, institutional) and Campaign (the ct= token in App Store links).
async function importAscAnalytics() {
  let r = await asc(`/apps/${IOS_APP_ID}/analyticsReportRequests?filter[accessType]=ONGOING`);
  if (r.status !== 200) throw new Error(ascErr(r));
  let reqId = r.body.data[0]?.id;
  if (!reqId) {
    r = await asc("/analyticsReportRequests", {
      method: "POST",
      body: JSON.stringify({ data: { type: "analyticsReportRequests", attributes: { accessType: "ONGOING" },
        relationships: { app: { data: { type: "apps", id: IOS_APP_ID } } } } }),
    });
    if (r.status !== 201) throw new Error(`create report request: ${ascErr(r)}`);
    return "ONGOING report request created — Apple delivers the first reports within ~48h";
  }
  r = await asc(`/analyticsReportRequests/${reqId}/reports?filter[category]=COMMERCE&limit=200`);
  if (r.status !== 200) throw new Error(ascErr(r));
  const report = r.body.data.find((x) => /download/i.test(x.attributes.name) && /standard/i.test(x.attributes.name));
  if (!report) return `no downloads report yet (have: ${r.body.data.map((x) => x.attributes.name).join(", ") || "none"})`;

  const done = new Set(JSON.parse((await db.getConfig("asc_analytics_done", "[]")) || "[]"));
  r = await asc(`/analyticsReports/${report.id}/instances?filter[granularity]=DAILY&limit=40`);
  if (r.status !== 200) throw new Error(ascErr(r));
  let processed = 0;
  for (const inst of r.body.data) {
    if (done.has(inst.id)) continue;
    const seg = await asc(`/analyticsReportInstances/${inst.id}/segments`);
    if (seg.status !== 200) throw new Error(ascErr(seg));
    const agg = {};
    for (const s of seg.body.data) {
      const file = await fetch(s.attributes.url, { signal: AbortSignal.timeout(60_000) });
      const rows = parseCsv(decodeText(Buffer.from(await file.arrayBuffer())), "\t");
      for (const row of rows) {
        if (row["App Apple Identifier"] && row["App Apple Identifier"] !== IOS_APP_ID) continue;
        if (row["Download Type"] && !/first/i.test(row["Download Type"])) continue;
        const day = row.Date;
        const n = Number(row.Counts || row.Count || 0);
        if (!day || !n) continue;
        const add = (k) => { agg[`${day}|${k}`] = (agg[`${day}|${k}`] || 0) + n; };
        if (row["Source Type"]) add(`src:${row["Source Type"]}`);
        if (row.Campaign && row.Campaign !== "-") add(`cmp:${row.Campaign}`);
        if (row["Source Info"] && /referrer/i.test(row["Source Type"] || "")) add(`ref:${row["Source Info"]}`);
      }
    }
    for (const [k, v] of Object.entries(agg)) {
      const [day, metric] = [k.slice(0, k.indexOf("|")), k.slice(k.indexOf("|") + 1)];
      await putMetric(day, "ios", metric, v);
    }
    done.add(inst.id);
    processed++;
  }
  await db.setConfig("asc_analytics_done", JSON.stringify([...done].slice(-200)));
  return `${processed} new daily instances of "${report.attributes.name}"`;
}

// ── Google Play ───────────────────────────────────────────────────────────────
function playSa() {
  const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  // Stored base64-encoded: the private key's literal backslash-n escapes are refused by
  // scripts/remote-secret.sh (they once corrupted other secrets). Raw JSON also works.
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw.trim(), "base64").toString("utf8");
  try { return JSON.parse(text); } catch { throw new Error("PLAY_SERVICE_ACCOUNT_JSON is not valid (base64) JSON"); }
}

let googleToken = { value: null, exp: 0 };
async function googleAccessToken(sa) {
  if (googleToken.value && googleToken.exp > Date.now() + 60_000) return googleToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign({
    iss: sa.client_email, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
    scope: "https://www.googleapis.com/auth/androidpublisher https://www.googleapis.com/auth/devstorage.read_only",
  }, sa.private_key, { algorithm: "RS256" });
  const r = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (r.status !== 200) throw new Error(`Google OAuth: HTTP ${r.status} ${r.text.slice(0, 200)}`);
  googleToken = { value: r.body.access_token, exp: Date.now() + r.body.expires_in * 1000 };
  return googleToken.value;
}

async function importPlayReviews() {
  const sa = playSa();
  if (!sa) throw new Error("PLAY_SERVICE_ACCOUNT_JSON not set");
  const token = await googleAccessToken(sa);
  let next = "", n = 0;
  do {
    const r = await fetchJson(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE}/reviews?maxResults=100${next ? `&token=${encodeURIComponent(next)}` : ""}`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (r.status !== 200) throw new Error(`reviews.list: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    for (const rev of r.body?.reviews || []) {
      const c = rev.comments?.find((x) => x.userComment)?.userComment;
      if (!c) continue;
      await upsertReview({ platform: "android", id: rev.reviewId,
        createdAt: new Date(Number(c.lastModified.seconds) * 1000), rating: c.starRating,
        lang: c.reviewerLanguage, body: c.text, version: c.appVersionName });
      n++;
    }
    next = r.body?.tokenPagination?.nextPageToken || "";
  } while (next);
  return `${n} reviews from the last 7 days`;
}

async function gcsList(token, bucket, prefix) {
  const out = [];
  let pageToken = "";
  do {
    const r = await fetchJson(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=${encodeURIComponent(prefix)}${pageToken ? `&pageToken=${pageToken}` : ""}`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (r.status !== 200) throw new Error(`GCS list ${prefix}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    out.push(...(r.body.items || []).map((i) => i.name));
    pageToken = r.body.nextPageToken || "";
  } while (pageToken);
  return out;
}

async function gcsGet(token, bucket, name) {
  const res = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) });
  if (res.status !== 200) throw new Error(`GCS get ${name}: HTTP ${res.status}`);
  return decodeText(Buffer.from(await res.arrayBuffer()));
}

const num = (v) => { const n = Number(String(v || "").replace(/,/g, "")); return Number.isFinite(n) ? n : null; };

async function importPlayReports() {
  const sa = playSa();
  if (!sa) throw new Error("PLAY_SERVICE_ACCOUNT_JSON not set");
  const bucket = (process.env.PLAY_REPORTS_BUCKET || "").replace(/^gs:\/\//, "").replace(/\/.*$/, "");
  if (!bucket) throw new Error("PLAY_REPORTS_BUCKET not set");
  const token = await googleAccessToken(sa);
  const months = [0, 1].map((k) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - k); return d.toISOString().slice(0, 7).replace("-", ""); });
  const notes = [];

  for (const ym of months) {
    // Installs: daily user installs (= downloads), active devices, cumulative installs.
    const inst = `stats/installs/installs_${ANDROID_PACKAGE}_${ym}_overview.csv`;
    try {
      for (const row of parseCsv(await gcsGet(token, bucket, inst))) {
        if (!row.Date) continue;
        const pairs = { downloads: row["Daily User Installs"], uninstalls: row["Daily User Uninstalls"],
          active_devices: row["Active Device Installs"], installs_total: row["Total User Installs"],
          updates: row["Daily Device Upgrades"] };
        for (const [m, v] of Object.entries(pairs)) if (num(v) !== null) await putMetric(row.Date, "android", m, num(v));
      }
    } catch (e) { notes.push(e.message); }

    // Ratings: daily and cumulative average (Play exports no rating count).
    try {
      for (const row of parseCsv(await gcsGet(token, bucket, `stats/ratings/ratings_${ANDROID_PACKAGE}_${ym}_overview.csv`))) {
        if (!row.Date) continue;
        if (num(row["Total Average Rating"])) await putMetric(row.Date, "android", "rating_avg_total", num(row["Total Average Rating"]));
        if (num(row["Daily Average Rating"])) await putMetric(row.Date, "android", "rating_avg_day", num(row["Daily Average Rating"]));
      }
    } catch (e) { notes.push(e.message); }

    // Written reviews (full history, unlike the 7-day reviews API).
    try {
      for (const row of parseCsv(await gcsGet(token, bucket, `reviews/reviews_${ANDROID_PACKAGE}_${ym}.csv`))) {
        const rating = num(row["Star Rating"]);
        const millis = num(row["Review Submit Millis Since Epoch"]);
        if (!rating || !millis) continue;
        await upsertReview({ platform: "android", id: row["Review Link"] || `bulk:${millis}:${rating}`,
          createdAt: new Date(millis), rating, lang: row["Reviewer Language"], title: row["Review Title"],
          body: row["Review Text"], version: row["App Version Name"] });
      }
    } catch (e) { notes.push(e.message); }

    // Acquisition: store-listing acquisitions per channel and per UTM campaign.
    const acq = await gcsList(token, bucket, `acquisition/retained_installers/retained_installers_${ANDROID_PACKAGE}_${ym}_`).catch((e) => { notes.push(e.message); return []; });
    for (const name of acq) {
      const kind = /_channel\.csv$/.test(name) ? "channel" : /_utm_tagged\.csv$/.test(name) ? "utm" : null;
      if (!kind) continue;
      const agg = {};
      for (const row of parseCsv(await gcsGet(token, bucket, name))) {
        const n = num(row.Installers ?? row["Store listing acquisitions"]);
        if (!row.Date || !n) continue;
        const label = kind === "channel"
          ? `src:${row["Acquisition Channel"] || "Other"}`
          : `cmp:${[row["UTM Source"], row["UTM Campaign"]].filter(Boolean).join("/") || "(none)"}`;
        agg[`${row.Date}|${label}`] = (agg[`${row.Date}|${label}`] || 0) + n;
      }
      for (const [k, v] of Object.entries(agg)) {
        const i = k.indexOf("|");
        await putMetric(k.slice(0, i), "android", k.slice(i + 1), v);
      }
    }
  }
  // A report for the current month may not exist on the 1st — only fail if nothing worked.
  if (notes.length >= 6) throw new Error(notes.slice(0, 3).join(" | "));
  return notes.length ? `partial: ${notes.slice(0, 2).join(" | ")}` : `months ${months.join(", ")}`;
}

// ── orchestration ─────────────────────────────────────────────────────────────
const SOURCES = [
  { id: "play_reviews", needs: () => !!process.env.PLAY_SERVICE_ACCOUNT_JSON || "PLAY_SERVICE_ACCOUNT_JSON", run: importPlayReviews },
  { id: "play_reports", needs: () => (process.env.PLAY_SERVICE_ACCOUNT_JSON && process.env.PLAY_REPORTS_BUCKET) || "PLAY_SERVICE_ACCOUNT_JSON + PLAY_REPORTS_BUCKET", run: importPlayReports },
  { id: "asc_reviews", needs: () => ascConfigured() || "ASC_ISSUER_ID + ASC_KEY_ID + ASC_PRIVATE_KEY", run: importAscReviews },
  { id: "asc_sales", needs: () => (ascConfigured() && !!process.env.ASC_VENDOR_NUMBER) || "ASC key + ASC_VENDOR_NUMBER", run: importAscSales },
  { id: "asc_analytics", needs: () => ascConfigured() || "ASC key (Admin role)", run: importAscAnalytics },
  { id: "ios_ratings", needs: () => true, run: importIosRatings },
];

let running = false;

async function runAll({ only } = {}) {
  if (running) return { skipped: "already running" };
  running = true;
  const client = await db.getPool().connect();
  try {
    const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS got", [LOCK_ID]);
    if (!rows[0].got) return { skipped: "another replica is importing" };
    const results = {};
    try {
      for (const s of SOURCES) {
        if (only && !only.includes(s.id)) continue;
        const ready = s.needs();
        if (ready !== true) { await setStatus(s.id, false, `not configured — needs ${ready}`); results[s.id] = "not configured"; continue; }
        try {
          const detail = await s.run();
          await setStatus(s.id, true, detail);
          results[s.id] = detail;
        } catch (err) {
          console.error(`[store-import] ${s.id}:`, err.message);
          await setStatus(s.id, false, err.message);
          results[s.id] = `error: ${err.message}`;
        }
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
    }
    console.log("[store-import] done", JSON.stringify(results));
    return results;
  } finally {
    client.release();
    running = false;
  }
}

// Daily at 04:30 UTC; also once ~2 min after boot if the last run is >20h old
// (deploys must not skip a night, and must not re-import on every restart).
function start() {
  const scheduleNext = () => {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 30));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    setTimeout(() => { runAll().catch(() => {}).finally(scheduleNext); }, next - now);
  };
  scheduleNext();
  setTimeout(async () => {
    try {
      const { rows } = await db.query("SELECT MAX(ran_at) AS last FROM store_import_status");
      const last = rows[0]?.last ? new Date(rows[0].last).getTime() : 0;
      if (Date.now() - last > 20 * 3600_000) await runAll();
    } catch (err) { console.error("[store-import] boot check:", err.message); }
  }, 2 * 60_000);
}

module.exports = { runAll, start, SOURCES, _parseCsv: parseCsv, _decodeText: decodeText };
