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
t("X-Admin-Key check is constant-time and exact", () => {
  process.env.GALLERY_ADMIN_KEY = "k1";
  assert(adminAuth.hasAdminKey({ headers: { "x-admin-key": "k1" } }));
  assert(!adminAuth.hasAdminKey({ headers: { "x-admin-key": "k2" } }));
  assert(!adminAuth.hasAdminKey({ headers: {} }));
});

console.log(`\n${n} passed`);
process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
