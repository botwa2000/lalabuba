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
t("browser beacons without an Origin header are still web", () => {
  assert.strictEqual(usage.platformOf({ headers: { referer: "https://lalabuba.com/c/abc" } }), "web");
  assert.strictEqual(usage.platformOf({ headers: { "sec-fetch-site": "same-origin" } }), "web");
  assert.strictEqual(usage.platformOf({ headers: { "x-device-id": "3a27f915-71c4-4c13-82ee-ba38ef65100c", "user-agent": "Dart/3.5 (dart:io)" } }), "app");
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

t("store review and test devices are recognised by network, on every platform", () => {
  const ip = (addr, h = {}) => ({ headers: { "cf-connecting-ip": addr, ...h } });
  const UA = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148" };
  assert.strictEqual(usage._baseTraffic(ip("17.5.7.9"), "ios"), "review");
  assert.strictEqual(usage._baseTraffic(ip("17.5.7.9"), "app"), "review", "old builds too");
  assert.strictEqual(usage._baseTraffic(ip("17.5.7.9", UA), "web"), "review");
  assert.strictEqual(usage._baseTraffic(ip("108.177.6.1"), "android"), "test");
  assert.strictEqual(usage._baseTraffic(ip("2001:4860:1008::1"), "android"), "test", "IPv6 range");
  assert.strictEqual(usage._baseTraffic(ip("34.68.194.70"), "android"), "test");
  assert.strictEqual(usage._baseTraffic(ip("18.0.0.1"), "ios"), "human", "next to Apple's /8");
  assert.strictEqual(usage._baseTraffic(ip("16.255.255.255"), "ios"), "human");
  assert.strictEqual(usage._baseTraffic(ip("8.8.8.8"), "android"), "human");
  assert.strictEqual(usage._baseTraffic(ip("2001:4860:4860::8888"), "android"), "human", "Google DNS is not Test Lab");
  assert.strictEqual(usage._baseTraffic(ip("unknown"), "ios"), "human", "unparsable address");
  assert.strictEqual(usage._baseTraffic({ headers: {}, socket: { remoteAddress: "::ffff:17.1.2.3" } }, "ios"), "review", "IPv4-mapped socket address");
});
t("team and crawlers keep their class on those networks", () => {
  assert.strictEqual(usage._baseTraffic({ headers: { "cf-connecting-ip": "17.5.7.9", "x-internal": "1" } }, "ios"), "internal");
  assert.strictEqual(usage._baseTraffic({ headers: { "cf-connecting-ip": "17.5.7.9", "user-agent": "Mozilla/5.0 (compatible; Applebot/0.1)" } }, "web"), "bot");
});
t("X-Forwarded-For cannot change the class (lib/client-ip.js is the only source)", () => {
  assert.strictEqual(usage._baseTraffic({ headers: { "cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "17.5.7.9" } }, "ios"), "human");
});

console.log("stats windows + buckets");
const stats = require("../lib/stats");
t("12 months is a rolling period and an accepted range", () => {
  assert(stats.RANGES.includes("12m"));
  const w = rw("12m");
  assert.strictEqual(w.days, 365);
  assert.strictEqual(w.to.getTime(), tomorrowMs);
  assert.strictEqual(w.prevTo.getTime(), w.from.getTime());
});
t("default bucket: day to 31 days, week to 120, then month", () => {
  assert.deepStrictEqual([1, 31, 32, 120, 121, 365].map(stats._defaultBucket), ["day", "day", "week", "week", "month", "month"]);
});
t("bucket starts match date_trunc: weeks start on Monday", () => {
  assert.strictEqual(stats._bucketStart("2026-11-08", "week"), "2026-11-02", "Sunday → its Monday");
  assert.strictEqual(stats._bucketStart("2026-11-02", "week"), "2026-11-02");
  assert.strictEqual(stats._bucketStart("2026-11-08", "month"), "2026-11-01");
  assert.strictEqual(stats._bucketStart("2026-11-08", "day"), "2026-11-08");
  const w = { from: new Date("2026-10-30T00:00:00Z"), to: new Date("2026-11-03T00:00:00Z") };
  assert.deepStrictEqual(stats._bucketList(w, "week"), ["2026-10-26", "2026-11-02"]);
  assert.deepStrictEqual(stats._bucketList(w, "month"), ["2026-10-01", "2026-11-01"]);
  assert.strictEqual(stats._bucketList(w, "day").length, 4);
});
t("usage before tracking is unknown, store downloads stay", () => {
  const row = { day: "2026-10-26", users: 0, web: 0, ios: 0, android: 0, newUsers: 0, pageViews: 0, screenViews: 0, drawings: 0, failed: 0, completed: 0, downloads: 7 };
  const since = "2026-10-30T12:00:00.000Z";
  const week = stats._markTracked(row, since, "week"), day = stats._markTracked(row, since, "day");
  assert.strictEqual(week.tracked, true, "the week tracking started in counts");
  assert.strictEqual(week.users, 0);
  assert.strictEqual(day.tracked, false);
  assert.strictEqual(day.users, null);
  assert.strictEqual(day.drawings, null);
  assert.strictEqual(day.downloads, 7, "downloads are not tracked by us");
  assert.strictEqual(stats._markTracked(row, null, "day").tracked, false, "nothing recorded yet");
});
t("averages divide by tracked days only", () => {
  const from = new Date("2026-10-01T00:00:00Z"), to = new Date("2026-11-01T00:00:00Z");
  assert.strictEqual(stats._trackedDays(from, to, null), 31);
  assert.strictEqual(stats._trackedDays(from, to, "2026-09-01T00:00:00.000Z"), 31);
  assert.strictEqual(stats._trackedDays(from, to, "2026-10-25T09:00:00.000Z"), 7);
  assert.strictEqual(stats._trackedDays(from, to, "2026-12-01T00:00:00.000Z"), 1, "never zero");
});
t("the traffic filter is one of two constants", () => {
  assert.strictEqual(stats._trafficFilter("human"), "traffic = 'human'");
  assert.strictEqual(stats._trafficFilter("all"), "TRUE");
  assert.strictEqual(stats._trafficFilter("x' OR 1=1 --"), "traffic = 'human'");
});

console.log("login pages");
const { renderLoginPage, renderOtpPage, waitLabel } = require("../lib/render-docs-page");
const ADMIN = { name: "Lalabuba Admin", base: "/admin", backHref: "/", backLabel: "←", limits: adminAuth.limits };
t("each scope shows its own code lifetime", () => {
  assert.strictEqual(adminAuth.limits.otpTtlSec, 600);
  assert.strictEqual(docsAuth.limits.otpTtlSec, 900);
  assert(renderLoginPage({ site: ADMIN }).includes("valid 10 min"));
  assert(renderLoginPage().includes("valid 15 min"));
});
t("waits follow the real windows: send 1 hour, wrong codes 15 minutes", () => {
  assert.strictEqual(waitLabel(3600), "1 hour");
  assert.strictEqual(waitLabel(7200), "2 hours");
  assert.strictEqual(waitLabel(900), "15 minutes");
  assert.strictEqual(waitLabel(60), "1 minute");
  for (const site of [ADMIN, undefined]) {
    assert(renderLoginPage({ rateLimited: true, site }).includes("Please wait 1 hour and try again."));
    assert(renderOtpPage({ rateLimited: true, site }).includes("Please wait 15 minutes."));
  }
});
t("a failed bot check never looks like an allowlist answer", () => {
  for (const site of [ADMIN, undefined]) {
    const html = renderLoginPage({ botCheckFailed: true, site });
    assert(html.includes("Bot check failed. Please try again."));
    assert(!/authorised|not allowed/i.test(html));
  }
});
t("wrong code keeps the address, escaped, in the text and a hidden field", () => {
  const html = renderOtpPage({ email: 'a"><script>x@y.test', error: true, site: ADMIN });
  assert(html.includes('<input type="hidden" name="email" value="a&quot;&gt;&lt;script&gt;x@y.test">'));
  assert(html.includes("<strong>a&quot;&gt;&lt;script&gt;x@y.test</strong>"));
  assert(!html.includes('a"><script>x'));
  assert(renderOtpPage({ site: ADMIN }).includes("<br>your email</p>"), "no address → no blank");
});
t("verify routes read the address before answering 401 and 429", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../server.js"), "utf8");
  assert.strictEqual((src.match(/renderOtpPage\(\{ email, (error|rateLimited): true/g) || []).length, 4, "admin + docs, 401 + 429");
});
t("Send starts disabled and waits for every Turnstile callback", () => {
  const saved = process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_SECRET_KEY = "x";
  try {
    const html = renderLoginPage({ site: ADMIN });
    assert(/<button type="submit" id="send" disabled>/.test(html));
    for (const a of ['data-callback="tsOk"', 'data-error-callback="tsErr"', 'data-expired-callback="tsWait"', 'data-timeout-callback="tsErr"']) assert(html.includes(a), a);
    assert(html.includes("Checking with Cloudflare…") && html.includes("✓ Verified by Cloudflare") && html.includes("20000"));
    assert(html.indexOf("window.tsOk") < html.indexOf("turnstile/v0/api.js"), "callbacks exist before the script loads");
    assert(/onerror="tsErr\(\)"/.test(html), "a blocked script is a failure too");
  } finally { if (saved === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = saved; }
});
t("a Turnstile checkbox is a question, not a failure", () => {
  const saved = process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_SECRET_KEY = "x";
  let html;
  try { html = renderLoginPage({ site: ADMIN }); } finally { if (saved === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = saved; }
  assert(html.includes('data-before-interactive-callback="tsAsk"'));
  const run = () => {
    const el = { textContent: "", className: "" }, send = { disabled: true }, sb = { window: {}, timers: [] };
    sb.setTimeout = (fn, ms) => sb.timers.push({ fn, ms });
    sb.document = { getElementById: (id) => (id === "tstat" ? el : send) };
    new (require("vm").Script)(html.match(/<script>\s*\(function \(\) \{\s*function set[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, "")).runInNewContext(sb);
    return { ...sb.window, el, send, fire: () => sb.timers[0].fn(), ms: sb.timers[0].ms };
  };
  const asked = run();
  asked.tsAsk();
  asked.fire();
  assert.strictEqual(asked.el.textContent, "Please tick the box above.", "20 s passing changes nothing");
  assert.strictEqual(asked.send.disabled, true);
  asked.tsOk();
  assert.strictEqual(asked.send.disabled, false, "ticking it enables Send");
  const silent = run();
  silent.fire();
  assert.strictEqual(silent.ms, 20000);
  assert(/failed/.test(silent.el.textContent), "no answer and no checkbox is still a failure");
  const gaveUp = run();
  gaveUp.tsAsk();
  gaveUp.tsErr();
  assert(/failed/.test(gaveUp.el.textContent) && gaveUp.send.disabled, "a real error after the checkbox");
});
t("local dev without a secret has no widget and an enabled button", () => {
  const saved = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  try {
    const html = renderLoginPage({ site: ADMIN });
    assert(!html.includes('class="cf-turnstile"') && /<button type="submit" id="send">/.test(html));
  } finally { if (saved !== undefined) process.env.TURNSTILE_SECRET_KEY = saved; }
});
t("the code field takes pasted spaces and submits on the sixth digit", () => {
  const html = renderOtpPage({ email: "a@b.test", site: ADMIN });
  assert(/maxlength="16"/.test(html), "maxlength 6 would cut off a pasted '123 456'");
  const handlers = {}, form = { submitted: 0, submit() { this.submitted++; } };
  const code = { value: "", addEventListener: (ev, fn) => { handlers[ev] = fn; } };
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new (require("vm").Script)(script).runInNewContext({
    document: { getElementById: (id) => (id === "code" ? code : form) }, window: { addEventListener() {} },
  });
  const type = (v) => { code.value = v; handlers.input(); };
  type("12345");
  assert.strictEqual(form.submitted, 0, "five digits wait");
  type("123 456");
  assert.strictEqual(code.value, "123456");
  assert.strictEqual(form.submitted, 1);
  type("123456");
  assert.strictEqual(form.submitted, 1, "submits once");
  type("12");
  type(" 65 43 21 ");
  assert.strictEqual(code.value, "654321");
  assert.strictEqual(form.submitted, 2, "a corrected code submits again");
});

console.log("dashboard view");
const V = require("../lib/admin-stats-view").viewHelpers();
const count = (s, re) => (s.match(re) || []).length;
const tips = (svg) => [...svg.matchAll(/data-tip="([^"]*)"/g)].map((m) => m[1].replace(/&#10;/g, "\n").replace(/&#39;/g, "'"));
const pts = (n) => Array.from({ length: n }, (_, i) => ({ day: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, web: 3, ios: 2, _total: 4 }));
t("the page inlines the helpers and its script parses", () => {
  const html = require("../lib/render-admin-stats").renderAdminStatsPage();
  assert(html.includes("function viewHelpers()"));
  new (require("vm").Script)(html.match(/<script>([\s\S]*)<\/script>/)[1]);
});
t("platform colours: validated values, gray only for the old-build app", () => {
  const html = require("../lib/render-admin-stats").renderAdminStatsPage();
  for (const c of ["--web:#7c3aed", "--ios:#0a9490", "--android:#d97706", "--web:#8d6ef2", "--ios:#17a394", "--android:#c4851f"]) assert(html.includes(c), c);
  assert(!/--ios:#2F80ED|--android:#1E9E5A|--ios:#5aa2ff/.test(html));
});
t("one shared tooltip, delegated, textContent only", () => {
  const html = require("../lib/render-admin-stats").renderAdminStatsPage();
  assert.strictEqual(count(html, /id="tip"/g), 1);
  assert(html.includes('addEventListener("pointermove", showTip)') && html.includes('addEventListener("pointerdown", showTip)'));
  assert(html.includes('tip.textContent = t.getAttribute("data-tip")'));
  assert(!/tip\.innerHTML/.test(html));
});
t("stacked bars: one full-height hit column per period, listing each series + total", () => {
  const svg = V.stacked(pts(5), ["web", "ios"], "day");
  assert.strictEqual(count(svg, /class="hit"/g), 5);
  assert.strictEqual(count(svg, /<title>/g), 0);
  assert(/class="hit"[^>]*height="132"/.test(svg), "as tall as the plot");
  assert.strictEqual(tips(svg)[0], "Thu 2026-10-01\nWeb: 3\niOS: 2\nTotal: 4", "the distinct total, not the bars' sum");
  assert.strictEqual(tips(V.stacked([{ day: "2026-10-01", web: 3, ios: 2 }], ["web", "ios"], "day"))[0].split("\n").pop(), "Total: 5");
  assert.strictEqual(tips(V.stacked([{ day: "2026-10-01", web: 3 }], ["web"], "day"))[0], "Thu 2026-10-01\nWeb: 3", "one series needs no total");
  assert.strictEqual(tips(V.stacked([{ day: "2026-10-01", tracked: false }], ["web"], "day"))[0], "Thu 2026-10-01\nNot tracked yet");
});
t("line charts: hit columns, each series, total only where a total means something", () => {
  const rows = [{ day: "2026-10-01", a: 2, b: 3 }, { day: "2026-10-02", a: 4, b: 5 }];
  const s = [{ key: "a", color: "red", name: "A" }, { key: "b", color: "blue", name: "B" }];
  assert.strictEqual(tips(V.lineChart(rows, s))[0], "2026-10-01\nA: 2\nB: 3");
  assert.strictEqual(tips(V.lineChart(rows, s, { total: true }))[1], "2026-10-02\nA: 4\nB: 5\nTotal: 9");
  assert.strictEqual(count(V.lineChart(rows, s), /<title>/g), 0);
});
t("tooltip text cannot break out of the attribute", () => {
  const svg = V.lineChart([{ day: "2026-10-01", a: 1 }], [{ key: "a", color: "red", name: '"><script>' }]);
  assert(!svg.includes("<script>"));
});
t("y gridlines are whole numbers", () => {
  assert.deepStrictEqual(V.wholeTicks(0, 5), [0, 3, 6]);
  assert.deepStrictEqual(V.wholeTicks(3, 4), [3, 4]);
  assert.deepStrictEqual(V.wholeTicks(5, 5), [4, 5, 6]);
  assert.deepStrictEqual(V.wholeTicks(0, 0), [0, 1]);
  assert.deepStrictEqual(V.wholeTicks(1.2, 7.8), [1, 5, 9]);
  for (const [a, b] of [[0, 1], [0, 3], [2, 9], [10, 1234], [7, 8]]) {
    const ticks = V.wholeTicks(a, b);
    assert(ticks.every(Number.isInteger) && ticks[0] <= a && ticks[ticks.length - 1] >= b, `${a}..${b}`);
  }
  const axis = (svg) => [...svg.matchAll(/text-anchor="end">([^<]+)</g)].map((m) => m[1]);
  assert.deepStrictEqual(axis(V.stacked([{ day: "2026-10-01", web: 3 }], ["web"], "day")), ["0", "2", "4"]);
  assert.deepStrictEqual(axis(V.stacked([{ day: "2026-10-01", web: 1 }], ["web"], "day")), ["0", "1"]);
  assert.deepStrictEqual(axis(V.lineChart([{ day: "2026-10-01", a: 3 }, { day: "2026-10-02", a: 4 }], [{ key: "a", color: "red", name: "A" }])), ["3", "4"]);
});
t("the top y label is not clipped by the chart edge", () => {
  const lowest = (svg) => Math.min(...[...svg.matchAll(/<text x="[\d.]+" y="([\d.]+)" text-anchor="end">/g)].map((m) => Number(m[1])));
  assert(lowest(V.stacked(pts(3), ["web"], "day")) >= 10, "font-size 10 needs a baseline at y ≥ 10");
  assert(lowest(V.lineChart(pts(3), [{ key: "web", color: "red", name: "W" }])) >= 10);
});
t("fractional charts keep their format; a flat line stays in range", () => {
  const rate = (v) => (v * 100).toFixed(2) + "%";
  const svg = V.lineChart([{ day: "2026-10-01", a: 0.02 }, { day: "2026-10-02", a: 0.02 }], [{ key: "a", color: "red", name: "A" }], { fmtY: rate });
  assert(svg.includes("2.00%") && !svg.includes("102"));
});
t("stacked segments have a 1px surface gap", () => {
  assert(/<rect x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" fill="var\(--web\)" rx="1.5" stroke="var\(--surface\)" stroke-width="1"\/>/.test(V.stacked(pts(2), ["web"], "day")));
});
t("no dots above 31 points", () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ day: "2026-10-01", a: i }));
  const s = [{ key: "a", color: "red", name: "A" }];
  assert.strictEqual(count(V.lineChart(rows(31), s), /<circle/g), 31);
  assert.strictEqual(count(V.lineChart(rows(32), s), /<circle/g), 0);
});
t("the last x label stays inside the chart", () => {
  const charWidth = 6, W = 560;
  const last = (svg) => Math.max(...[...svg.matchAll(/<text x="([\d.]+)" y="146" text-anchor="middle">([^<]+)</g)].map((m) => Number(m[1]) + (m[2].length * charWidth) / 2));
  for (const n of [2, 5, 8, 9, 17, 29, 31]) {
    assert(last(V.stacked(pts(n), ["web"], "day")) <= W, `stacked ${n}`);
    assert(last(V.lineChart(pts(n), [{ key: "web", color: "red", name: "W" }])) <= W, `line ${n}`);
  }
});
t("bucket labels", () => {
  assert.strictEqual(V.periodLabel("2026-11-07", "day"), "Sat 2026-11-07");
  assert.strictEqual(V.periodLabel("2026-11-02", "week"), "Week of 2026-11-02");
  assert.strictEqual(V.periodLabel("2026-11-01", "month"), "Nov 2026");
  assert(V.stacked([{ day: "2026-11-01", web: 1 }], ["web"], "month").includes(">Nov<"));
});
t("no delta against a period before tracking", () => {
  assert.strictEqual(V.delta(5, 0, false), "");
  assert.strictEqual(V.delta(5, 2, false), "");
  assert(V.delta(5, 0, true).includes("new"));
  assert(V.delta(4, 2, true).includes("100%"));
  assert.strictEqual(V.delta(0, 0, true), "");
});
t("platform dots are named, never colour-only", () => {
  assert.strictEqual(V.dot("ios"), '<i class="dot" title="iOS" role="img" aria-label="iOS" style="background:var(--ios)"></i>');
  assert(V.dot("app").includes('aria-label="App (old build)"') && V.dot("app").includes("var(--app)"));
  assert(V.dot("<x>").includes("&lt;x&gt;"));
  assert(V.dot(null).includes('aria-label="App"'));
});
t("store-feed hints follow health.imports", () => {
  const f = V.feedStates([
    { source: "asc_reviews", ok: true, detail: "12 reviews" },
    { source: "play_reviews", ok: false, detail: "not configured — needs PLAY_SERVICE_ACCOUNT_JSON" },
    { source: "cf_traffic", ok: false, detail: "HTTP 500" },
  ]);
  assert.deepStrictEqual(f, { asc_reviews: "ok", play_reviews: "missing", cf_traffic: "failing" });
  assert(!V.iosHistogramNote(f).includes("needs"), "working feed: no credential hint");
  assert(V.iosHistogramNote({}).includes("needs the App Store Connect key"), "never ran");
  assert(V.iosHistogramNote({ asc_reviews: "failing" }).includes("failed"));
  const both = V.noReviewsNote(f, ["ios", "android"]);
  assert(!both.includes("App Store Connect") && both.includes("Play service account"));
  assert(!V.noReviewsNote(f, ["ios"]).includes("needs"));
  assert(!V.noStoreSourcesNote({ asc_analytics: "ok", play_reports: "ok" }).includes("needs"));
  assert(V.noEdgeNote({ cf_traffic: "ok" }).includes("connected ✓"));
  assert(V.noEdgeNote({}).includes("CF_ANALYTICS_TOKEN"));
  assert(!V.noEdgeNote(f).includes("Not connected"));
  assert(V.noVitalsNote({ play_vitals: "ok" }).includes("connected ✓"));
  assert(V.noVitalsNote({}).includes("Reporting API"));
});
t("load() reports the status of a failed request and refreshes politely", () => {
  const html = require("../lib/render-admin-stats").renderAdminStatsPage();
  assert(html.includes('if (!r.ok) throw new Error("HTTP " + r.status);'));
  assert(/\$\("meta"\)\.textContent = "";/.test(html));
  assert(html.includes("60 * 1000") && !html.includes("5 * 60 * 1000"));
  assert(html.includes("/^(INPUT|SELECT)$/.test(a.tagName)"));
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

await tAsync("journey lookup refuses anything but an install UUID (no query runs)", async () => {
  const stats = require("../lib/stats");
  for (const bad of ["", "x", "1; DROP TABLE usage_events", "11111111-2222-4333-8444-55555555550"]) {
    assert.strictEqual(await stats.getJourney(bad), null, bad);
  }
});
t("journeys page script parses and has the timeline wiring", () => {
  const html = require("../lib/render-admin-stats").renderAdminStatsPage({});
  const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new Function(js);
  assert(/openJourney\(/.test(js) && /data-journey=/.test(js) && /\?journey=/.test(js));
});

console.log(`\n${n} passed`);
process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
