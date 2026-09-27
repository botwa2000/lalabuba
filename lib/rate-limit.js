"use strict";
// Durable, shared rate limiting backed by Postgres (table rate_limit_counters,
// migration 008). Replaces the per-process in-memory Maps, which reset on every
// deploy and were not shared between replicas.
//
// Algorithm: sliding-window counter. A request's weight is
//   current_window_count + previous_window_count × (1 − elapsed_fraction)
// which approximates a true sliding window without per-request rows and without
// the 2× burst a plain fixed window allows at the boundary. `fixed: true` uses a
// hard calendar window instead (daily budgets).
//
// Privacy: keys are HMAC-SHA256 digests — raw client IPs are never stored.
//
// Failure mode: if the database is unreachable the limiter degrades to an
// in-process counter (same algorithm) and logs — it never fails open silently and
// never takes the endpoint down because the DB blipped.

const crypto = require("crypto");
const db = require("./db");

const KEY_SECRET = crypto.createHash("sha256")
  .update("lalabuba-rate-limit-v1:" + (process.env.JWT_SECRET || "local-dev-only"))
  .digest();
if (!process.env.JWT_SECRET && (process.env.APP_ENV === "prod" || process.env.NODE_ENV === "production")) {
  console.error("SECURITY: JWT_SECRET unset — rate-limit key hashing is using a public fallback secret");
}

function hashKey(key) {
  return crypto.createHmac("sha256", KEY_SECRET).update(String(key)).digest("base64url").slice(0, 32);
}

function windowOf(now, windowMs) {
  return Math.floor(now / windowMs) * windowMs;
}

// ── In-process fallback (only used while the DB is unreachable) ──────────────
const memory = new Map(); // `${bucket}|${key}|${windowStart}` → count
let lastDbErrorLog = 0;
function logDbError(err) {
  if (Date.now() - lastDbErrorLog < 60_000) return;
  lastDbErrorLog = Date.now();
  console.error("[rate-limit] DB unavailable — degraded to per-process limits:", err.message);
}
function memGet(bucket, key, ws) { return memory.get(`${bucket}|${key}|${ws}`) || 0; }
function memAdd(bucket, key, ws, n) {
  const k = `${bucket}|${key}|${ws}`;
  const v = (memory.get(k) || 0) + n;
  memory.set(k, v);
  if (memory.size > 20_000) memory.clear(); // bounded; fallback is best-effort
  return v;
}

function weight(cur, prev, now, windowMs, fixed) {
  if (fixed) return cur;
  const elapsed = (now - windowOf(now, windowMs)) / windowMs;
  return cur + prev * (1 - elapsed);
}

// Increment by `n` and return the resulting weighted count.
async function add(bucket, rawKey, windowMs, { fixed = false, n = 1 } = {}) {
  const key = hashKey(rawKey);
  const now = Date.now();
  const ws = windowOf(now, windowMs);
  const expires = new Date(ws + 2 * windowMs);
  try {
    const { rows } = await db.query(
      `WITH up AS (
         INSERT INTO rate_limit_counters (bucket, key, window_start, count, expires_at)
         VALUES ($1, $2, $3, $5, $4)
         ON CONFLICT (bucket, key, window_start)
         DO UPDATE SET count = rate_limit_counters.count + EXCLUDED.count
         RETURNING count
       )
       SELECT (SELECT count FROM up) AS cur,
              COALESCE((SELECT count FROM rate_limit_counters
                        WHERE bucket = $1 AND key = $2 AND window_start = $6), 0) AS prev`,
      [bucket, key, ws, expires, n, ws - windowMs]
    );
    return weight(Number(rows[0].cur), Number(rows[0].prev), now, windowMs, fixed);
  } catch (err) {
    logDbError(err);
    const cur = memAdd(bucket, key, ws, n);
    return weight(cur, memGet(bucket, key, ws - windowMs), now, windowMs, fixed);
  }
}

// Read the weighted count without incrementing.
async function peek(bucket, rawKey, windowMs, { fixed = false } = {}) {
  const key = hashKey(rawKey);
  const now = Date.now();
  const ws = windowOf(now, windowMs);
  try {
    const { rows } = await db.query(
      `SELECT window_start, count FROM rate_limit_counters
       WHERE bucket = $1 AND key = $2 AND window_start IN ($3, $4)`,
      [bucket, key, ws, ws - windowMs]
    );
    let cur = 0, prev = 0;
    for (const r of rows) { if (Number(r.window_start) === ws) cur = r.count; else prev = r.count; }
    return weight(cur, prev, now, windowMs, fixed);
  } catch (err) {
    logDbError(err);
    return weight(memGet(bucket, key, ws), memGet(bucket, key, ws - windowMs), now, windowMs, fixed);
  }
}

async function reset(bucket, rawKey) {
  const key = hashKey(rawKey);
  try {
    await db.query("DELETE FROM rate_limit_counters WHERE bucket = $1 AND key = $2", [bucket, key]);
  } catch (err) {
    logDbError(err);
  }
  for (const k of memory.keys()) if (k.startsWith(`${bucket}|${key}|`)) memory.delete(k);
}

// Count this request and report whether it is over `limit`.
async function consume(bucket, rawKey, limit, windowMs, opts = {}) {
  const w = await add(bucket, rawKey, windowMs, opts);
  return { limited: w > limit, count: w, limit };
}

// Drop-in successor to the old makeRateLimiter: returns async (key) → true when limited.
function makeRateLimiter(bucket, maxRequests, windowMs) {
  if (!bucket) throw new Error("makeRateLimiter: bucket name required");
  return async function isLimited(key) {
    return (await consume(bucket, key, maxRequests, windowMs)).limited;
  };
}

// Prune expired rows. Started once by server.js.
function startPruning(intervalMs = 10 * 60_000) {
  const run = () => db.query("DELETE FROM rate_limit_counters WHERE expires_at < NOW()")
    .catch((err) => logDbError(err));
  run();
  return setInterval(run, intervalMs).unref();
}

module.exports = { consume, add, peek, reset, makeRateLimiter, startPruning, _hashKey: hashKey, _weight: weight };
