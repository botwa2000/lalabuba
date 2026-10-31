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
t("Play listing parser fails loudly when the page format changes", () => {
  assert.throws(() => imp._parsePlayListing("<html><body>captcha</body></html>"), /format changed/);
});
t("every import source declares its credentials", () => {
  assert.deepStrictEqual(imp.SOURCES.map((s) => s.id).sort(),
    ["asc_analytics", "asc_reviews", "asc_sales", "ios_ratings", "play_listing", "play_reports", "play_reviews"]);
});

console.log("otp-auth (admin vs docs)");
t("admin session validates, docs session does not open admin", () => {
  const a = adminAuth.generateSession();
  assert(adminAuth.validateSession(a));
  const d = docsAuth.generateSession();
  assert(docsAuth.validateSession(d));
  assert(!adminAuth.validateSession(d), "docs session must not validate as admin");
  assert(!docsAuth.validateSession(a), "admin session must not validate as docs");
});
t("OTP round-trip and rejection", () => {
  const { code, state } = adminAuth.generateOtp();
  assert.strictEqual(code.length, 6);
  assert(adminAuth.validateOtp(code, state));
  const wrong = String((Number(code) + 1) % 1000000).padStart(6, "1");
  assert(!adminAuth.validateOtp(wrong, state));
  assert(!docsAuth.validateOtp(code, state), "admin OTP must not validate for docs");
});
t("admin cookies are scoped and Secure on https", () => {
  const h = adminAuth.sessionCookieHeader("x", true);
  assert(/^admin_sess=x; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=43200$/.test(h), h);
  assert(/Path=\/docs/.test(docsAuth.sessionCookieHeader("x", true)));
});
t("only the owner email is allowed", () => {
  assert(adminAuth.isAllowedEmail(" Alexander.Perel@gmail.com "));
  assert(!adminAuth.isAllowedEmail("someone@else.com"));
});
t("X-Admin-Key check is constant-time and exact", () => {
  process.env.GALLERY_ADMIN_KEY = "k1";
  assert(adminAuth.hasAdminKey({ headers: { "x-admin-key": "k1" } }));
  assert(!adminAuth.hasAdminKey({ headers: { "x-admin-key": "k2" } }));
  assert(!adminAuth.hasAdminKey({ headers: {} }));
});

console.log(`\n${n} passed`);
process.exit(0);
