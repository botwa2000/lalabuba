"use strict";
// First-party usage statistics (tables in migration 010). Powers /admin/stats.
//
// Privacy model (kids app — see docs/STORE_PRIVACY.md, public/privacy.html):
//   • No IP address, user agent or advertising ID is ever stored.
//   • Apps: the random per-install UUID they already send (X-Device-ID).
//   • Web with analytics consent: the random community ID from localStorage.
//   • Web without consent: a daily-rotating salted hash of (IP, user agent).
//     The salt is random, kept 2 days, then deleted — the hash can then never be
//     recomputed or linked across days. Counts unique visitors per day only.
//   • Country comes from Cloudflare's CF-IPCountry header (2 letters, aggregate).
//   • What children type (subject_raw) is nulled after 30 days.
// Every write is fire-and-forget: statistics must never slow or fail a request.

const crypto = require("crypto");
const db = require("./db");
const { clientIp } = require("./client-ip");

const PLATFORMS = new Set(["web", "ios", "android"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION_RE = /^[0-9A-Za-z.+_-]{1,32}$/;
const SHORT_RE = /^[a-z0-9_:-]{1,40}$/;

const RAW_SUBJECT_DAYS = 30;
const EVENT_RETENTION_DAYS = 400;  // 13 months: same-month-last-year comparisons

function header(req, name) {
  const v = req.headers[name];
  return typeof v === "string" ? v.trim() : "";
}

function cleanVersion(v) {
  const s = String(v || "").trim();
  return VERSION_RE.test(s) ? s : null;
}

function cleanUuid(v) {
  const s = String(v || "").trim().toLowerCase();
  return UUID_RE.test(s) ? s : null;
}

function cleanShort(v) {
  const s = String(v || "").trim().toLowerCase();
  return SHORT_RE.test(s) ? s : null;
}

function cleanLang(v) {
  const s = String(v || "").trim().toLowerCase().slice(0, 5);
  return /^[a-z]{2,3}(-[a-z]{2})?$/.test(s) ? s.slice(0, 2) : null;
}

function country(req) {
  const c = header(req, "cf-ipcountry").toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : null;
}

// Platform of a request. Apps send X-Platform (ios|android) since 1.0.24; older
// app builds are identified by their verified App Check app ID when available
// (`1:<project>:ios:<hash>`), else reported as "app".
function platformOf(req, appCheckAppId) {
  const h = header(req, "x-platform").toLowerCase();
  if (PLATFORMS.has(h)) return h;
  if (appCheckAppId) {
    if (appCheckAppId.includes(":ios:")) return "ios";
    if (appCheckAppId.includes(":android:")) return "android";
  }
  return req.headers.origin ? "web" : "app";
}

// ── Daily salt for the unconsented-web visitor hash ──────────────────────────
let saltCache = { day: null, salt: null };

function utcDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

async function todaysSalt() {
  const day = utcDay();
  if (saltCache.day === day) return saltCache.salt;
  // Shared across replicas: first writer wins, everyone reads the same salt.
  await db.query(
    "INSERT INTO usage_salts (day, salt) VALUES ($1, $2) ON CONFLICT (day) DO NOTHING",
    [day, crypto.randomBytes(32).toString("base64")]
  );
  const { rows } = await db.query("SELECT salt FROM usage_salts WHERE day = $1", [day]);
  saltCache = { day, salt: rows[0].salt };
  return saltCache.salt;
}

async function visitorHash(req) {
  const salt = await todaysSalt();
  return crypto.createHash("sha256")
    .update(`${salt}|${clientIp(req)}|${header(req, "user-agent")}|${header(req, "host")}`)
    .digest("base64url").slice(0, 22);
}

// Identity of a request: install_id when the client sent one (apps always, web
// only with consent), otherwise the daily visitor hash (web) / nothing.
async function identity(req, platform, bodyInstallId) {
  const installId = cleanUuid(bodyInstallId) || cleanUuid(header(req, "x-device-id"));
  if (installId) return { installId, visitorHash: null };
  if (platform === "web") return { installId: null, visitorHash: await visitorHash(req) };
  return { installId: null, visitorHash: null };
}

// ── Traffic class (migration 013) ────────────────────────────────────────────
// Only `human` rows reach the dashboard numbers. Web visitors start `unengaged`
// and become human on their first interaction (`engage` event from t.js) or a
// drawing that passed the bot check; their earlier rows are upgraded then.
const BOT_UA = /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|skype|discord|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|curl\/|wget|python|httpclient|axios|node-fetch|go-http|java\//i;
const INTERNAL_COOKIE = "lb_int";

function hasCookie(req, name) {
  return (req.headers.cookie || "").split(";").some((c) => c.trim().startsWith(`${name}=`));
}

function isInternal(req) {
  if (header(req, "x-internal") === "1") return true;   // debug/profile/emulator app builds
  if (hasCookie(req, INTERNAL_COOKIE)) return true;     // a browser that signed into /admin
  return require("./admin-auth").isAdminRequest(req);   // live admin session / X-Admin-Key
}

/** @returns {"internal"|"bot"|"unengaged"|"human"} before engagement upgrades */
function baseTraffic(req, platform, body = {}) {
  if (isInternal(req)) return "internal";
  if (platform !== "web") return "human";
  const ua = header(req, "user-agent");
  if (!ua || BOT_UA.test(ua) || body.wd === true) return "bot";
  return "unengaged";
}

// uid → day it was seen engaged; cleared at UTC midnight (visitor hashes rotate daily).
let engagedCache = { day: null, set: new Set() };
function cacheEngaged(uid) {
  const day = utcDay();
  if (engagedCache.day !== day) engagedCache = { day, set: new Set() };
  if (engagedCache.set.size > 50_000) engagedCache.set.clear();
  engagedCache.set.add(uid);
}

async function isEngaged(installId, vh) {
  const uid = installId || vh;
  if (!uid) return false;
  if (engagedCache.day === utcDay() && engagedCache.set.has(uid)) return true;
  const { rows } = await db.query(
    `SELECT 1 FROM usage_events
      WHERE traffic = 'human' AND platform = 'web' AND ts > NOW() - interval '1 day'
        AND (install_id = $1 OR visitor_hash = $2) LIMIT 1`, [installId, vh]);
  if (rows.length) cacheEngaged(uid);
  return rows.length > 0;
}

// First sign of a person: upgrade this visitor's earlier rows of the last day.
async function markEngaged(installId, vh) {
  cacheEngaged(installId || vh);
  const where = `traffic = 'unengaged' AND ts > NOW() - interval '1 day' AND (install_id = $1 OR visitor_hash = $2)`;
  await db.query(`UPDATE usage_events SET traffic = 'human' WHERE ${where}`, [installId, vh]);
  await db.query(`UPDATE generation_log SET traffic = 'human' WHERE ${where}`, [installId, vh]);
  if (installId) await db.query(`UPDATE usage_installs SET traffic = 'human' WHERE install_id = $1 AND traffic = 'unengaged'`, [installId]);
}

function logErr(where) {
  return (err) => console.error(`[usage] ${where} failed:`, err.message);
}

// First/last sighting of an install. Acquisition is first-touch: an existing
// source is never overwritten (COALESCE keeps the stored value).
// Traffic: once internal always internal; otherwise a human sighting wins.
function touchInstall(installId, platform, version, cc, acq = {}, traffic = "human") {
  if (!installId) return Promise.resolve();
  return db.query(
    `INSERT INTO usage_installs (install_id, platform, first_version, country, acq_source, acq_medium, acq_campaign, traffic)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (install_id) DO UPDATE SET
       last_seen    = NOW(),
       platform     = CASE WHEN usage_installs.platform = 'app' THEN EXCLUDED.platform ELSE usage_installs.platform END,
       acq_source   = COALESCE(usage_installs.acq_source, EXCLUDED.acq_source),
       acq_medium   = COALESCE(usage_installs.acq_medium, EXCLUDED.acq_medium),
       acq_campaign = COALESCE(usage_installs.acq_campaign, EXCLUDED.acq_campaign),
       traffic      = CASE WHEN 'internal' IN (usage_installs.traffic, EXCLUDED.traffic) THEN 'internal'
                           WHEN EXCLUDED.traffic = 'human' THEN 'human' ELSE usage_installs.traffic END`,
    [installId, platform, version, cc, acq.source || null, acq.medium || null, acq.campaign || null, traffic]
  );
}

/**
 * Record one generation attempt. Never throws, never awaited by the caller.
 * @param {object} req  the HTTP request
 * @param {object} g    { outcome, subjectRaw?, subjectEn?, difficulty?, source?, lang?, provider?, latencyMs?, appCheckAppId? }
 */
function recordGeneration(req, g) {
  (async () => {
    const platform = platformOf(req, g.appCheckAppId);
    const body = req.body || {};
    const { installId, visitorHash: vh } = await identity(req, platform, body.installId);
    const version = cleanVersion(header(req, "x-app-version"));
    const cc = country(req);
    // A drawing that passed the bot check proves a person; a blocked one counts
    // only for a visitor who already interacted.
    let traffic = baseTraffic(req, platform, body);
    if (traffic === "unengaged") {
      if (g.outcome !== "blocked") { traffic = "human"; await markEngaged(installId, vh); }
      else if (await isEngaged(installId, vh)) traffic = "human";
    }
    await db.query(
      `INSERT INTO generation_log
         (platform, app_version, install_id, visitor_hash, subject_raw, subject_en, lang, difficulty, source, provider, latency_ms, outcome, country, image_path, traffic)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [platform, version, installId, vh,
       g.subjectRaw ? String(g.subjectRaw).slice(0, 200) : null,
       g.subjectEn ? String(g.subjectEn).toLowerCase().slice(0, 200) : null,
       cleanLang(body.lang) || cleanLang(header(req, "accept-language")),
       g.difficulty || null,
       cleanShort(body.source),
       g.provider || null,
       Number.isFinite(g.latencyMs) ? Math.round(g.latencyMs) : null,
       g.outcome, cc, g.imagePath || null, traffic]
    );
    await touchInstall(installId, platform, version, cc, {}, traffic);
  })().catch(logErr("recordGeneration"));
}

// Everything a stats writer needs to know about the caller (api/feedback.js,
// api/contact.js reuse it so feedback follows the same privacy rules).
async function requestContext(req, bodyInstallId, bodyLang) {
  const platform = platformOf(req);
  const { installId, visitorHash: vh } = await identity(req, platform, bodyInstallId);
  return {
    platform, installId, visitorHash: vh,
    version: cleanVersion(header(req, "x-app-version")),
    lang: cleanLang(bodyLang) || cleanLang(header(req, "accept-language")),
    country: country(req),
  };
}

// ── Client events (POST /api/t) ──────────────────────────────────────────────
// The whitelist is the contract with the clients (public/js/t.js and the
// Flutter UsageService). Unknown events are dropped, never stored.
const EVENTS = new Set([
  "app_open",        // app cold start / resume; web: first page view of a visit
  "page_view",       // web page (path)
  "screen_view",     // app screen (route template)
  "complete",        // a picture was finished
  "save", "print", "share", "share_art", "community_share",
  "challenge_create", "challenge_open",
  "gallery_open", "scene_open", "journal_open",
  "report_content", "review_prompt", "review_store_open", "feedback_open",
  "engage",          // web: first tap / scroll / key of a page — marks the visitor human
  "error",
]);
const MAX_EVENTS_PER_BATCH = 50;
// Props are an allow-list too: small enums/flags only. Free text (a subject, a
// name) can never be stored through an event, whatever a client sends.
const PROP_KEYS = new Set(["difficulty", "source", "fatal", "reason", "mode", "count"]);

function cleanScreen(s) {
  const v = String(s || "").trim();
  if (!v) return null;
  // Web paths keep only the path (no query/hash); app routes are templates.
  return v.split(/[?#]/)[0].replace(/[^\w/:.\-]/g, "").slice(0, 120) || null;
}

function cleanProps(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(p)) {
    if (n >= 8 || !PROP_KEYS.has(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 80);
    else continue;
    n++;
  }
  return n ? out : null;
}

// Referrer → bare host (no path, never the full URL); own domain is not a referrer.
function referrerHost(ref) {
  try {
    const h = new URL(String(ref)).hostname.toLowerCase().replace(/^www\./, "");
    return h && !h.endsWith("lalabuba.com") ? h.slice(0, 80) : null;
  } catch { return null; }
}

function acquisitionOf(body) {
  const a = body.acq && typeof body.acq === "object" ? body.acq : {};
  const source = cleanShort(a.utm_source) || cleanShort(a.source) || referrerHost(a.referrer);
  return {
    source,
    medium: cleanShort(a.utm_medium) || cleanShort(a.medium) || (referrerHost(a.referrer) ? "referral" : null),
    campaign: cleanShort(a.utm_campaign) || cleanShort(a.campaign),
  };
}

/**
 * Store a batch from POST /api/t. Body:
 *   { iid?, v?, lang?, acq?: {utm_source, utm_medium, utm_campaign, referrer, source, medium, campaign},
 *     events: [{ e, s?, p?, t? }] }
 * Returns the number of accepted events.
 */
async function recordEvents(req, body) {
  const platform = platformOf(req);
  const list = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_BATCH) : [];
  const now = Date.now();
  const rows = [];
  for (const ev of list) {
    if (!ev || !EVENTS.has(ev.e)) continue;
    // Client timestamps (queued offline) are accepted up to 3 days back, never future.
    const t = Number(ev.t);
    const ts = Number.isFinite(t) && t <= now && t > now - 3 * 86_400_000 ? new Date(t) : new Date(now);
    rows.push({ e: ev.e, s: cleanScreen(ev.s), p: cleanProps(ev.p), ts });
  }
  if (!rows.length) return 0;

  const { installId, visitorHash: vh } = await identity(req, platform, body.iid);
  const version = cleanVersion(body.v) || cleanVersion(header(req, "x-app-version"));
  const lang = cleanLang(body.lang);
  const cc = country(req);
  const acq = acquisitionOf(body);
  if (acq.source || acq.campaign) {
    // Acquisition is also counted per visit (unconsented web has no install row).
    rows[0].p = { ...(rows[0].p || {}), acq_source: acq.source || "", acq_medium: acq.medium || "", acq_campaign: acq.campaign || "" };
  }

  let traffic = baseTraffic(req, platform, body);
  if (traffic === "unengaged") {
    if (rows.some((r) => r.e === "engage")) { traffic = "human"; await markEngaged(installId, vh); }
    else if (await isEngaged(installId, vh)) traffic = "human";
  }

  const values = [];
  const params = [];
  rows.forEach((r, i) => {
    const o = i * 11;
    values.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11})`);
    params.push(r.ts, platform, version, installId, vh, r.e, r.s, r.p ? JSON.stringify(r.p) : null, lang, cc, traffic);
  });
  await db.query(
    `INSERT INTO usage_events (ts, platform, app_version, install_id, visitor_hash, event, screen, props, lang, country, traffic)
     VALUES ${values.join(",")}`,
    params
  );
  await touchInstall(installId, platform, version, cc, acq, traffic);
  return rows.length;
}

// "Delete account" in the apps / web (DELETE /api/community/profile): erase every
// statistics row tied to this install. Prompts already nulled stay anonymous.
async function forgetInstall(rawId) {
  const id = cleanUuid(rawId);
  if (!id) return;
  await db.query("DELETE FROM usage_events WHERE install_id = $1", [id]);
  await db.query("DELETE FROM generation_log WHERE install_id = $1", [id]);
  await db.query("DELETE FROM usage_installs WHERE install_id = $1", [id]);
  await db.query("DELETE FROM feedback WHERE install_id = $1", [id]);
}

// ── Retention ────────────────────────────────────────────────────────────────
async function purge() {
  try {
    await db.query(
      `UPDATE generation_log SET subject_raw = NULL
       WHERE subject_raw IS NOT NULL AND ts < NOW() - ($1 || ' days')::interval`, [RAW_SUBJECT_DAYS]);
    await db.query(`DELETE FROM generation_log WHERE ts < NOW() - ($1 || ' days')::interval`, [EVENT_RETENTION_DAYS]);
    await db.query(`DELETE FROM usage_events WHERE ts < NOW() - ($1 || ' days')::interval`, [EVENT_RETENTION_DAYS]);
    await db.query(`DELETE FROM usage_installs WHERE last_seen < NOW() - ($1 || ' days')::interval`, [EVENT_RETENTION_DAYS]);
    await db.query(`DELETE FROM feedback WHERE ts < NOW() - ($1 || ' days')::interval`, [EVENT_RETENTION_DAYS]);
    await db.query(`DELETE FROM usage_salts WHERE day < (NOW() AT TIME ZONE 'UTC')::date - 1`);
  } catch (err) {
    console.error("[usage] purge failed:", err.message);
  }
}

module.exports = {
  recordGeneration, recordEvents, purge, forgetInstall, platformOf, requestContext,
  EVENTS, RAW_SUBJECT_DAYS, INTERNAL_COOKIE,
  // test hooks
  _baseTraffic: baseTraffic, _cleanProps: cleanProps, _cleanScreen: cleanScreen, _acquisitionOf: acquisitionOf, _referrerHost: referrerHost,
};
