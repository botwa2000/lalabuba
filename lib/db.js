"use strict";
// PostgreSQL client + config cache + migration runner.
// Pool is initialised lazily on first use — server.js calls runMigrations()
// at boot which forces the connection open before any requests arrive.

const { Pool } = require("pg");
const fs  = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "../db/migrations");

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Conservative limits — we run a single Node process on Hetzner.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on("error", (err) => {
      console.error("[db] pool error (idle client):", err.message);
    });
  }
  return pool;
}

// Thin query wrapper — always uses parameterised queries via $1/$2/... placeholders.
async function query(text, params) {
  return getPool().query(text, params);
}

// ── Config cache ────────────────────────────────────────────────────────────

let configCache = {};
let configLoadedAt = 0;
const CONFIG_TTL_MS = 60_000; // refresh every 60s

async function getAllConfig() {
  try {
    const result = await query("SELECT key, value FROM config");
    const map = {};
    for (const row of result.rows) map[row.key] = row.value;
    configCache = map;
    configLoadedAt = Date.now();
    return map;
  } catch (err) {
    console.error("[db] getAllConfig error:", err.message);
    return configCache; // return stale on error — better than crashing
  }
}

async function getConfig(key, defaultValue = null) {
  if (Date.now() - configLoadedAt > CONFIG_TTL_MS) await getAllConfig();
  const val = configCache[key];
  if (val === undefined) return defaultValue;
  return val;
}

async function getConfigInt(key, defaultValue = 0) {
  const v = await getConfig(key);
  const n = parseInt(v);
  return isNaN(n) ? defaultValue : n;
}

async function getConfigBool(key, defaultValue = false) {
  const v = await getConfig(key);
  if (v === null) return defaultValue;
  return v === "true" || v === "1";
}

// ── Migration runner ────────────────────────────────────────────────────────

async function runMigrations() {
  const db = getPool();

  // Ensure the migrations tracking table exists first.
  await db.query(`
    CREATE TABLE IF NOT EXISTS db_migrations (
      name       VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows: applied } = await db.query(
    "SELECT name FROM db_migrations ORDER BY name"
  );
  const appliedNames = new Set(applied.map((r) => r.name));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedNames.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[db] applying migration: ${file}`);
    await db.query(sql);
    await db.query("INSERT INTO db_migrations (name) VALUES ($1)", [file]);
    console.log(`[db] migration applied: ${file}`);
  }

  // Pre-warm config cache after migrations so first request is fast.
  await getAllConfig();
  console.log("[db] migrations complete, config loaded");
}

// ── Artwork cleanup ─────────────────────────────────────────────────────────

const SHARED_IMG_DIR = path.join(__dirname, "../data/images/s");

async function cleanupExpiredArtworks() {
  try {
    // Fetch expired artwork paths before deleting rows.
    const { rows } = await query(
      "SELECT id, image_path FROM artworks WHERE expires_at < NOW()"
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      // image_path is like /img/s/filename.jpg — extract filename
      const filename = path.basename(row.image_path);
      const filePath = path.join(SHARED_IMG_DIR, filename);
      try { fs.unlinkSync(filePath); } catch { /* file already gone */ }
    }

    const ids = rows.map((r) => r.id);
    // Cascades: stars + reports rows deleted automatically.
    await query(
      `DELETE FROM artworks WHERE id = ANY($1::bigint[])`,
      [ids]
    );
    console.log(`[db] cleaned up ${rows.length} expired artworks`);
  } catch (err) {
    console.error("[db] cleanupExpiredArtworks error:", err.message);
  }
}

module.exports = {
  query,
  getPool,
  getAllConfig,
  getConfig,
  getConfigInt,
  getConfigBool,
  runMigrations,
  cleanupExpiredArtworks,
};
