// Request-security tests: durable rate limiter, App Check verification, and the
// /api/generate-image authentication gate. No network, no real database —
// lib/db.js is replaced by an in-memory fake that implements the exact SQL shapes
// lib/rate-limit.js and lib/auth-stats.js issue.
//   node scripts/test-request-security.js

"use strict";
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

let failures = 0;
function check(name, cond) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) failures++;
}

// ── Fake lib/db.js ─────────────────────────────────────────────────────────────
const rows = new Map();          // `${bucket}|${key}|${ws}` → count
const stats = new Map();         // category → count
let dbDown = false;
const fakeDb = {
  async query(sql, p) {
    if (dbDown) throw new Error("connect ECONNREFUSED");
    if (sql.includes("WITH up AS")) {
      const [bucket, key, ws, , n, prevWs] = p;
      const k = `${bucket}|${key}|${ws}`;
      rows.set(k, (rows.get(k) || 0) + n);
      return { rows: [{ cur: rows.get(k), prev: rows.get(`${bucket}|${key}|${prevWs}`) || 0 }] };
    }
    if (sql.includes("SELECT window_start, count")) {
      const [bucket, key, ws, prevWs] = p;
      const out = [];
      for (const w of [ws, prevWs]) { const c = rows.get(`${bucket}|${key}|${w}`); if (c) out.push({ window_start: String(w), count: c }); }
      return { rows: out };
    }
    if (sql.startsWith("DELETE FROM rate_limit_counters WHERE bucket")) {
      for (const k of [...rows.keys()]) if (k.startsWith(`${p[0]}|${p[1]}|`)) rows.delete(k);
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO request_auth_stats")) { stats.set(p[0], (stats.get(p[0]) || 0) + 1); return { rows: [] }; }
    if (sql.includes("DELETE FROM rate_limit_counters WHERE expires_at")) return { rows: [] };
    throw new Error("fake db: unexpected SQL " + sql.slice(0, 60));
  },
  async getConfig() { return "{}"; },
};
const dbPath = path.join(__dirname, "..", "lib", "db.js");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };

const rateLimit = require("../lib/rate-limit");
const { verifyAppCheckToken, _setKeysForTest } = require("../lib/app-check");
const { validateOverrides, DEFAULTS } = require("../lib/security-config");
const { clientIp } = require("../lib/client-ip");

(async () => {
  // ── client IP trust ─────────────────────────────────────────────────────────
  console.log("client-ip");
  check("uses CF-Connecting-IP", clientIp({ headers: { "cf-connecting-ip": "1.2.3.4" }, socket: {} }) === "1.2.3.4");
  check("ignores X-Forwarded-For", clientIp({ headers: { "x-forwarded-for": "6.6.6.6" }, socket: { remoteAddress: "10.0.0.9" } }) === "10.0.0.9");

  // ── rate limiter ────────────────────────────────────────────────────────────
  console.log("rate-limit");
  const W = 3_600_000;
  let limitedAt = 0;
  for (let i = 1; i <= 5; i++) { const r = await rateLimit.consume("t:gen", "1.1.1.1", 3, W); if (r.limited && !limitedAt) limitedAt = i; }
  check("4th request over a limit of 3 is limited", limitedAt === 4);
  check("other key unaffected", !(await rateLimit.consume("t:gen", "2.2.2.2", 3, W)).limited);
  check("other bucket unaffected", !(await rateLimit.consume("t:other", "1.1.1.1", 3, W)).limited);
  check("raw IP never stored", [...rows.keys()].every((k) => !k.includes("1.1.1.1")));
  // sliding window: previous window weighs (1 - elapsed fraction)
  check("sliding weight: prev fully counted at window start", rateLimit._weight(1, 10, 0, W, false) === 11);
  check("sliding weight: prev half counted mid-window", Math.abs(rateLimit._weight(1, 10, W / 2, W, false) - 6) < 1e-9);
  check("fixed window ignores prev", rateLimit._weight(1, 10, W / 2, W, true) === 1);
  // peek/add/reset (failure-count limiters)
  await rateLimit.add("t:fail", "9.9.9.9", W); await rateLimit.add("t:fail", "9.9.9.9", W);
  check("peek sees 2 recorded failures", (await rateLimit.peek("t:fail", "9.9.9.9", W)) === 2);
  await rateLimit.reset("t:fail", "9.9.9.9");
  check("reset clears failures", (await rateLimit.peek("t:fail", "9.9.9.9", W)) === 0);
  // daily budget = fixed window
  let budgetHit = false;
  for (let i = 0; i < 3; i++) budgetHit = (await rateLimit.consume("t:budget", "global", 2, 86_400_000, { fixed: true })).limited;
  check("3rd generation over a budget of 2 is refused", budgetHit);
  // degraded mode
  dbDown = true;
  const origErr = console.error; console.error = () => {};
  let degradedLimited = false;
  for (let i = 0; i < 3; i++) degradedLimited = (await rateLimit.consume("t:down", "3.3.3.3", 2, W)).limited;
  console.error = origErr;
  dbDown = false;
  check("DB down → still limits (in-process fallback), never throws", degradedLimited);

  // ── App Check verification ──────────────────────────────────────────────────
  console.log("app-check");
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  _setKeysForTest(new Map([["kid1", publicKey]]), Date.now() + 3600_000);
  const cfg = { projectNumber: DEFAULTS.appCheck.projectNumber, appIds: DEFAULTS.appCheck.appIds };
  const ANDROID = cfg.appIds[0];
  const sign = (claims = {}, opts = {}) => jwt.sign(
    { sub: ANDROID, ...claims },
    opts.key || privateKey,
    { algorithm: opts.alg || "RS256", keyid: opts.kid || "kid1", expiresIn: opts.exp || "1h",
      issuer: opts.iss || `https://firebaseappcheck.googleapis.com/${cfg.projectNumber}`,
      audience: opts.aud || [`projects/${cfg.projectNumber}`, "projects/lalabuba-app"] });
  const v = (t) => verifyAppCheckToken(t, cfg);
  check("valid token accepted", (await v(sign())).ok === true);
  check("iOS app id accepted", (await v(sign({ sub: cfg.appIds[1] }))).ok === true);
  check("wrong audience rejected", (await v(sign({}, { aud: "projects/123" }))).ok === false);
  check("wrong issuer rejected", (await v(sign({}, { iss: "https://evil.example/909101543003" }))).ok === false);
  check("expired rejected", (await v(sign({}, { exp: -10 }))).reason === "expired");
  check("unknown app id rejected", (await v(sign({ sub: "1:909101543003:android:deadbeef" }))).reason === "wrong-app");
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  check("forged signature rejected", (await v(sign({}, { key: other.privateKey }))).ok === false);
  check("HS256 alg-confusion rejected", (await v(jwt.sign({ sub: ANDROID }, "secret", { algorithm: "HS256", keyid: "kid1" }))).reason === "malformed");
  check("unknown kid rejected (no network)", (await v(sign({}, { kid: "nope" }))).reason === "unknown-key");
  check("garbage rejected", (await v("not.a.jwt")).ok === false);

  // ── generate gate ───────────────────────────────────────────────────────────
  console.log("generate authenticate()");
  delete process.env.TURNSTILE_SECRET_KEY; process.env.APP_ENV = "dev"; process.env.NODE_ENV = "test";
  const { _authenticate } = require("../api/generate-image");
  const sec = (enforce) => ({ appCheck: { ...cfg, enforce } });
  const req = (h) => ({ headers: h });
  const token = sign();
  check("web + Turnstile (dev: no secret) → ok", (await _authenticate(req({ origin: "https://lalabuba.com" }), {}, "ip", sec(true))).ok);
  check("native + valid App Check → ok (enforce)", (await _authenticate(req({ "x-firebase-appcheck": token }), {}, "ip", sec(true))).ok);
  check("native, no token, monitor → allowed", (await _authenticate(req({}), {}, "ip", sec(false))).ok);
  const blocked = await _authenticate(req({}), {}, "ip", sec(true));
  check("native, no token, enforce → 403", !blocked.ok && blocked.status === 403);
  const origWarn = console.warn; console.warn = () => {};
  const bad = await _authenticate(req({ "x-firebase-appcheck": sign({}, { key: other.privateKey }) }), {}, "ip", sec(false));
  console.warn = origWarn;
  check("native, forged token → 403 even in monitor", !bad.ok && bad.status === 403);
  await new Promise((r) => setTimeout(r, 20)); // let fire-and-forget stats land
  check("outcomes recorded in auth stats",
    ["web_turnstile_ok", "native_attested", "native_unattested_allowed", "native_unattested_blocked", "native_attest_invalid"].every((c) => stats.get(c) >= 1));

  // ── admin override validation ───────────────────────────────────────────────
  console.log("security-config validation");
  check("enforce toggle valid", validateOverrides({ appCheck: { enforce: true } }) === null);
  check("budget valid", validateOverrides({ generate: { dailyBudget: 2000 } }) === null);
  check("non-boolean enforce rejected", validateOverrides({ appCheck: { enforce: "yes" } }) !== null);
  check("unknown key rejected", validateOverrides({ generate: { unlimited: true } }) !== null);
  check("zero budget rejected", validateOverrides({ generate: { dailyBudget: 0 } }) !== null);
  check("bad app id rejected", validateOverrides({ appCheck: { appIds: ["x"] } }) !== null);

  console.log(failures ? `\n${failures} check(s) FAILED.` : "\nAll checks passed.");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
