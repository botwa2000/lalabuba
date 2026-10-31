#!/usr/bin/env node
// Unit tests for the usage-stats pipeline helpers — no DB, no network.
//   node scripts/test-usage-stats.js
"use strict";
const assert = require("assert");
const zlib = require("zlib");

process.env.DOCS_SECRET = process.env.DOCS_SECRET || "test-secret-test-secret-test-secret";

const usage = require("../lib/usage");
const imp = require("../lib/store-import");
const adminAuth = require("../lib/admin-auth");
const docsAuth = require("../lib/docs-auth");
const analyticsMap = require("fs").readFileSync(require("path").join(__dirname, "../public/js/analytics.js"), "utf8");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ✓", name); };

console.log("usage.js");
t("platform from X-Platform header wins", () => {
  assert.strictEqual(usage.platformOf({ headers: { "x-platform": "ios" } }), "ios");
  assert.strictEqual(usage.platformOf({ headers: { "x-platform": "Android" } }), "android");
});
t("old app builds resolve platform from the App Check app ID", () => {
  assert.strictEqual(usage.platformOf({ headers: {} }, "1:909101543003:ios:abc"), "ios");
  assert.strictEqual(usage.platformOf({ headers: {} }, "1:909101543003:android:abc"), "android");
  assert.strictEqual(usage.platformOf({ headers: {} }), "app");
  assert.strictEqual(usage.platformOf({ headers: { origin: "https://lalabuba.com" } }), "web");
});
t("props keep only allow-listed keys with small scalar values", () => {
  assert.deepStrictEqual(usage._cleanProps({ difficulty: "easy", count: 3, fatal: true, "Bad-Key": 1, mode: { a: 1 }, reason: "x".repeat(200), subject: "Emma", name: "Emma" }),
    { difficulty: "easy", count: 3, fatal: true, reason: "x".repeat(80) });
  assert.strictEqual(usage._cleanProps(["a"]), null);
  assert.strictEqual(usage._cleanProps({}), null);
});
t("screen strips query strings and odd characters", () => {
  assert.strictEqual(usage._cleanScreen("/de/ausmalbilder/hund?utm_source=x#top"), "/de/ausmalbilder/hund");
  assert.strictEqual(usage._cleanScreen("/canvas/:id"), "/canvas/:id");
  assert.strictEqual(usage._cleanScreen("<script>"), "script");
});
t("referrer reduced to host, own domain ignored", () => {
  assert.strictEqual(usage._referrerHost("https://www.pinterest.de/pin/123?x=1"), "pinterest.de");
  assert.strictEqual(usage._referrerHost("https://dev.lalabuba.com/x"), null);
  assert.strictEqual(usage._referrerHost("not a url"), null);
});
t("acquisition prefers UTM, falls back to referrer", () => {
  assert.deepStrictEqual(usage._acquisitionOf({ acq: { utm_source: "Pinterest", utm_campaign: "xmas_de", referrer: "https://pinterest.com/" } }),
    { source: "pinterest", medium: "referral", campaign: "xmas_de" });
  assert.deepStrictEqual(usage._acquisitionOf({ acq: { referrer: "https://google.com/" } }),
    { source: "google.com", medium: "referral", campaign: null });
  assert.deepStrictEqual(usage._acquisitionOf({}), { source: null, medium: null, campaign: null });
});
t("event whitelist contains the client contract", () => {
  for (const e of ["app_open", "page_view", "screen_view", "complete", "save", "print", "share", "challenge_open"]) assert(usage.EVENTS.has(e), e);
  assert(!usage.EVENTS.has("image_generate_started"));
});
t("web analytics.js maps only to whitelisted events", () => {
  const mapped = [...analyticsMap.matchAll(/:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  assert(mapped.length >= 5);
  for (const e of mapped) assert(usage.EVENTS.has(e), e);
});

console.log("feedback.js");
const feedback = require("../api/feedback");
t("image path accepts relative and absolute served images only", () => {
  assert.strictEqual(feedback._imagePathOf("/img/c/123-abc.png"), "/img/c/123-abc.png");
  assert.strictEqual(feedback._imagePathOf("https://lalabuba.com/img/g/cat-easy-1.jpg"), "/img/g/cat-easy-1.jpg");
  assert.strictEqual(feedback._imagePathOf("https://evil.example/x.png"), null);
  assert.strictEqual(feedback._imagePathOf("/img/c/../../etc/passwd"), null);
  assert.strictEqual(feedback._imagePathOf(""), null);
});
t("comments are trimmed, capped and stripped of control characters", () => {
  assert.strictEqual(feedback._cleanComment("  great\u0000 app\u0007  "), "great app");
  assert.strictEqual(feedback._cleanComment("line1\nline2"), "line1\nline2");
  assert.strictEqual(feedback._cleanComment("x".repeat(1500)).length, 1000);
  assert.strictEqual(feedback._cleanComment("   "), null);
});
t("feedback_open is a whitelisted usage event", () => assert(usage.EVENTS.has("feedback_open")));

console.log("store-import.js");
t("CSV parser handles quotes, commas, newlines, BOM", () => {
  const rows = imp._parseCsv('﻿Date,Text,Stars\n2026-10-01,"Hello, ""kid""\nline 2",5\r\n2026-10-02,,4\n');
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows[0], { Date: "2026-10-01", Text: 'Hello, "kid"\nline 2', Stars: "5" });
  assert.strictEqual(rows[1].Stars, "4");
});
t("TSV parsing for ASC reports", () => {
  const rows = imp._parseCsv("Apple Identifier\tUnits\tProduct Type Identifier\n6761691648\t3\t1F\n", "\t");
  assert.deepStrictEqual(rows[0], { "Apple Identifier": "6761691648", Units: "3", "Product Type Identifier": "1F" });
});
t("decodes Play UTF-16LE and ASC gzip", () => {
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("Date,Daily User Installs\n2026-10-01,7\n", "utf16le")]);
  assert.strictEqual(imp._parseCsv(imp._decodeText(utf16))[0]["Daily User Installs"], "7");
  const gz = zlib.gzipSync(Buffer.from("A\tB\n1\t2\n"));
  assert.strictEqual(imp._parseCsv(imp._decodeText(gz), "\t")[0].B, "2");
});
t("Play listing parser: rated app → count, avg, histogram", () => {
  const fs = require("fs"), path = require("path");
  const r = imp._parsePlayListing(fs.readFileSync(path.join(__dirname, "fixtures/play-listing-rated.html"), "utf8"));
  assert.strictEqual(r.count, 51455480);
  assert(Math.abs(r.avg - 4.7466) < 0.001);
  assert.deepStrictEqual(Object.keys(r.histogram).sort(), ["1", "2", "3", "4", "5"]);
  assert.strictEqual(r.histogram["5"], 40712313);
});
t("Play listing parser: no public rating yet → 0, not an error", () => {
  const fs = require("fs"), path = require("path");
  const r = imp._parsePlayListing(fs.readFileSync(path.join(__dirname, "fixtures/play-listing-unrated.html"), "utf8"));
  assert.deepStrictEqual([r.count, r.avg, r.name], [0, null, "Lalabuba: Kids Coloring"]);
});
t("Play listing parser: install count = the triple matching the visible bucket", () => {
  const fs = require("fs"), path = require("path");
  const r = imp._parsePlayListing(fs.readFileSync(path.join(__dirname, "fixtures/play-listing-unrated.html"), "utf8"));
  assert.deepStrictEqual(r.installs, { bucket: "10+", min: 10, exact: 16 }); // not the "5+" decoy
  const noCount = imp._parsePlayListing(fs.readFileSync(path.join(__dirname, "fixtures/play-listing-rated.html"), "utf8"));
  assert.strictEqual(noCount.installs, null, "no visible Downloads bucket → no install number");
});
t("Play listing parser fails loudly when the page format changes", () => {
  assert.throws(() => imp._parsePlayListing("<html><body>captcha</body></html>"), /format changed/);
});
t("every import source declares its credentials", () => {
  assert.deepStrictEqual(imp.SOURCES.map((s) => s.id).sort(),
    ["asc_analytics", "asc_reviews", "asc_sales", "cf_traffic", "ios_ratings", "play_listing", "play_reports", "play_reviews", "play_vitals"]);
});
t("with every credential set, every source is ready (needs() === true, not just truthy)", () => {
  const keys = ["PLAY_SERVICE_ACCOUNT_JSON", "PLAY_REPORTS_BUCKET", "ASC_ISSUER_ID", "ASC_KEY_ID", "ASC_PRIVATE_KEY", "ASC_VENDOR_NUMBER", "CF_ANALYTICS_TOKEN"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) process.env[k] = "x";
  try {
    for (const s of imp.SOURCES) assert.strictEqual(s.needs(), true, s.id);
  } finally {
    for (const k of keys) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});

console.log("periods + traffic class");
const { _rangeWindow: rw } = require("../lib/stats");
const iso = (d) => d.toISOString().slice(0, 10);
const todayIso = iso(new Date());
const tomorrowMs = Date.parse(todayIso + "T00:00:00Z") + 86_400_000;
t("day / week / month / ytd / custom windows", () => {
  let w = rw("day", { at: "2026-03-04" });
  assert.deepStrictEqual([iso(w.from), iso(w.to), iso(w.prevFrom), iso(w.prevTo), w.days], ["2026-03-04", "2026-03-05", "2026-03-03", "2026-03-04", 1]);
  w = rw("week", { at: "2026-03-04" });          // a Wednesday → Mon 03-02 .. Sun 03-08
  assert.deepStrictEqual([iso(w.from), iso(w.to), iso(w.prevFrom), w.days], ["2026-03-02", "2026-03-09", "2026-02-23", 7]);
  w = rw("month", { at: "2026-03-31" });
  assert.deepStrictEqual([iso(w.from), iso(w.to), iso(w.prevFrom), iso(w.prevTo)], ["2026-03-01", "2026-04-01", "2026-02-01", "2026-03-01"], "Feb is shorter: prev period capped at its end");
  w = rw("ytd");
  assert.strictEqual(iso(w.from), todayIso.slice(0, 4) + "-01-01");
  assert.strictEqual(w.to.getTime(), tomorrowMs);
  assert.strictEqual(iso(w.prevFrom), (Number(todayIso.slice(0, 4)) - 1) + "-01-01");
  assert.strictEqual(w.prevTo - w.prevFrom, w.to - w.from, "ytd compares the same span last year");
  w = rw("custom", { from: "2026-02-10", to: "2026-02-01" });   // reversed → swapped
  assert.deepStrictEqual([iso(w.from), iso(w.to), w.days, iso(w.prevFrom), iso(w.prevTo)], ["2026-02-01", "2026-02-11", 10, "2026-01-22", "2026-02-01"]);
  w = rw("custom", { from: "2020-01-01", to: "2026-02-01" });
  assert.strictEqual(w.days, 400, "custom capped at event retention");
  w = rw("custom", { from: "garbage", to: "2026-02-30" });
  assert.strictEqual(iso(w.from), todayIso, "invalid dates fall back to today");
  w = rw("week");                                  // current week never runs past today
  assert(w.to.getTime() <= tomorrowMs && w.from.getUTCDay() === 1);
  w = rw("day", { at: "2999-01-01" });
  assert.strictEqual(iso(w.from), todayIso, "future anchor clamps to today");
  assert.strictEqual(rw("7d").days, 7);
});
t("traffic class: internal / bot / unengaged web / human app", () => {
  const req = (h) => ({ headers: h });
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36";
  assert.strictEqual(usage._baseTraffic(req({ "user-agent": UA }), "web"), "unengaged");
  assert.strictEqual(usage._baseTraffic(req({ "user-agent": UA, cookie: "a=1; lb_int=1" }), "web"), "internal");
  assert.strictEqual(usage._baseTraffic(req({ "x-internal": "1" }), "android"), "internal");
  assert.strictEqual(usage._baseTraffic(req({}), "ios"), "human");
  assert.strictEqual(usage._baseTraffic(req({ "user-agent": UA }), "web", { wd: true }), "bot", "navigator.webdriver");
  for (const ua of ["Mozilla/5.0 (compatible; Googlebot/2.1)", "facebookexternalhit/1.1", "Mozilla/5.0 HeadlessChrome/130", "WhatsApp/2.23", "curl/8.4", ""]) {
    assert.strictEqual(usage._baseTraffic(req({ "user-agent": ua }), "web"), "bot", ua);
  }
  assert(usage.EVENTS.has("engage"));
});

const tAsync = async (name, fn) => { await fn(); n++; console.log("  ✓", name); };
(async () => {
console.log("otp-auth (admin vs docs)");
// Fixture addresses only — the real allowlist lives in a Swarm secret, never in this public repo.
const OWNER = "owner@example.test";
process.env.ADMIN_EMAILS = ` ${OWNER.toUpperCase()} , second@example.test`;
delete process.env.DOCS_EMAILS;
const loginAs = (auth, email) => {
  const sent = [];
  const state = auth.beginLogin(email, (to, code) => { sent.push({ to, code }); });
  return { state, sent };
};
const flush = () => new Promise((r) => setImmediate(r));
t("allowlist comes from env, trimmed + case-insensitive; unset = nobody", () => {
  assert(adminAuth.isAllowedEmail(" Owner@Example.test "));
  assert(!adminAuth.isAllowedEmail("someone@else.com"));
  const saved = process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_EMAILS;
  assert(!adminAuth.isAllowedEmail(OWNER), "no allowlist must refuse everyone");
  process.env.ADMIN_EMAILS = saved;
});
await tAsync("allowed email: OTP mailed, round-trip opens a session", async () => {
  const { state, sent } = loginAs(adminAuth, OWNER);
  await flush();
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, OWNER);
  const tag = adminAuth.validateOtp(sent[0].code, state);
  assert(tag, "correct code must validate");
  const wrong = String((Number(sent[0].code) + 1) % 1000000).padStart(6, "1");
  assert(!adminAuth.validateOtp(wrong, state));
  assert(!docsAuth.validateOtp(sent[0].code, state), "admin OTP must not validate for docs");
  assert(adminAuth.validateSession(adminAuth.generateSession(tag)));
});
await tAsync("unknown email: no mail, same-shaped cookie, can never log in", async () => {
  const a = loginAs(adminAuth, OWNER), u = loginAs(adminAuth, "intruder@evil.test");
  await flush();
  assert.strictEqual(u.sent.length, 0);
  const shape = (s) => s.split(".").map((p) => p.length).join(",");
  assert.strictEqual(shape(u.state), shape(a.state), "state must look identical");
  for (let c = 0; c < 2000; c++) assert(!adminAuth.validateOtp(String(100000 + c), u.state));
});
t("cookies never contain the email address", () => {
  const { state } = loginAs(adminAuth, OWNER);
  const tag = adminAuth.validateOtp("000000", state); // wrong code → null, just checking the state
  assert(!tag);
  for (const s of [state, adminAuth.generateSession(state.split(".")[1])]) {
    assert(!/owner|example|@/i.test(s) && !/owner|example/i.test(Buffer.from(s.split(".")[1], "base64url").toString("latin1")), s);
  }
});
await tAsync("removing an email from the allowlist revokes its live session", async () => {
  const { state, sent } = loginAs(adminAuth, "second@example.test");
  await flush();
  const sess = adminAuth.generateSession(adminAuth.validateOtp(sent[0].code, state));
  assert(adminAuth.validateSession(sess));
  const saved = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = OWNER;
  assert(!adminAuth.validateSession(sess), "revoked address must lose access");
  process.env.ADMIN_EMAILS = saved;
});
t("forged / legacy / anonymous sessions are rejected for admin", () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  assert(!adminAuth.validateSession(`${exp}.${adminAuth.hmac(`sess:${exp}`)}`), "legacy 2-part session");
  assert(!adminAuth.validateSession(`${exp}.-.${adminAuth.hmac(`sess:${exp}:-`)}`), "anonymous session");
  assert.throws(() => adminAuth.generateSession(null), /anonymous/);
  assert(!adminAuth.validateSession(`${exp}.AAAAAAAAAAAAAAAAAAAAAA.xyz`));
});
t("admin and docs sessions never cross; docs share links stay anonymous", () => {
  const { state } = loginAs(adminAuth, OWNER);
  const tag = state.split(".")[1];
  const a = adminAuth.generateSession(tag);
  assert(!docsAuth.validateSession(a), "admin session must not validate as docs");
  const d = docsAuth.generateSession();
  assert(docsAuth.validateSession(d), "docs share-link session");
  assert(!adminAuth.validateSession(d), "docs session must not validate as admin");
});
t("admin cookies are scoped and Secure on https", () => {
  const h = adminAuth.sessionCookieHeader("x", true);
  assert(/^admin_sess=x; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=43200$/.test(h), h);
  assert(/Path=\/docs/.test(docsAuth.sessionCookieHeader("x", true)));
});
await tAsync("one-time link: single use, short session, allowlist + expiry + forgery checks", async () => {
  const link = adminAuth.generateLink(null, 600);
  assert(!/owner|example|@/i.test(link), "link must not contain the address");
  const tag = await adminAuth.redeemLink(link);
  assert(tag, "fresh link must redeem");
  assert.strictEqual(await adminAuth.redeemLink(link), null, "second use must fail");
  const sess = adminAuth.generateSession(tag, 3600);
  assert(adminAuth.validateSession(sess));
  assert(Number(sess.split(".")[0]) <= Math.floor(Date.now() / 1000) + 3600, "link session ≤ 1h");
  const [exp, tg, nonce] = adminAuth.generateLink(OWNER).split(".");
  assert.strictEqual(await adminAuth.redeemLink(`${exp}.${tg}.${nonce}.forged`), null, "bad mac");
  const past = Math.floor(Date.now() / 1000) - 1;
  assert.strictEqual(await adminAuth.redeemLink(`${past}.${tg}.${nonce}.${adminAuth.hmac(`link:${past}:${tg}:${nonce}`)}`), null, "expired");
  const far = Math.floor(Date.now() / 1000) + 86400;
  assert.strictEqual(await adminAuth.redeemLink(`${far}.${tg}.${nonce}.${adminAuth.hmac(`link:${far}:${tg}:${nonce}`)}`), null, "TTL beyond 15 min");
  assert.throws(() => adminAuth.generateLink("intruder@evil.test"), /allowlist/);
  assert.strictEqual(await docsAuth.redeemLink(adminAuth.generateLink()), null, "admin link must not open docs");
  const pending = adminAuth.generateLink("second@example.test");
  const saved = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = OWNER;
  assert.strictEqual(await adminAuth.redeemLink(pending), null, "removed address: link dies");
  process.env.ADMIN_EMAILS = saved;
});
t("X-Admin-Key check is constant-time and exact", () => {
  process.env.GALLERY_ADMIN_KEY = "k1";
  assert(adminAuth.hasAdminKey({ headers: { "x-admin-key": "k1" } }));
  assert(!adminAuth.hasAdminKey({ headers: { "x-admin-key": "k2" } }));
  assert(!adminAuth.hasAdminKey({ headers: {} }));
});

console.log(`\n${n} passed`);
process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
