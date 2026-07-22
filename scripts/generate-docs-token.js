#!/usr/bin/env node
// Generate a time-limited share link for /docs/internal
// Usage:
//   node scripts/generate-docs-token.js           → 24-hour link
//   node scripts/generate-docs-token.js 48        → 48-hour link
//   node scripts/generate-docs-token.js 168       → 7-day link
//   node scripts/generate-docs-token.js --secret  → generate a new DOCS_SECRET

"use strict";
const path = require("path");
const fs   = require("fs");
const crypto = require("crypto");

// Load .env (same logic as server.js)
try {
  const envText = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (k && !(k in process.env)) process.env[k] = v;
  }
} catch { /* .env optional */ }

const arg = process.argv[2];

// ── Generate a DOCS_SECRET (first-time setup) ─────────────────────────────────
if (arg === "--secret") {
  const s = crypto.randomBytes(32).toString("base64");
  console.log("\nAdd this to your .env (or Swarm secret DOCS_SECRET):\n");
  console.log(`DOCS_SECRET=${s}\n`);
  process.exit(0);
}

// ── Share token ───────────────────────────────────────────────────────────────
const hours = parseFloat(arg) || 24;
if (!process.env.DOCS_SECRET) {
  console.error("\nError: DOCS_SECRET not set.\nRun: node scripts/generate-docs-token.js --secret\nthen add it to .env\n");
  process.exit(1);
}

const { generateShareToken } = require("../lib/docs-auth");
const { exp, token } = generateShareToken(hours);
const expDate = new Date(exp * 1000).toUTCString();
const base    = process.env.DOCS_BASE_URL || "https://lalabuba.com";

console.log(`\nShare link (valid ${hours}h until ${expDate}):\n`);
console.log(`  ${base}/docs/internal?t=${encodeURIComponent(token)}\n`);
