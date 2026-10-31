#!/usr/bin/env node
"use strict";
// Mint a one-time /admin sign-in link. Runs INSIDE the app container (via
// scripts/admin-link.sh as root on the server): it needs the live DOCS_SECRET
// and ADMIN_EMAILS, which exist only in the main process environment.
// Prints the link, nothing else (never the address).
//
//   LINK_MIN=10 LINK_EMAIL=<optional, must be allowlisted> node scripts/admin-link.js

const fs = require("fs");
for (const kv of fs.readFileSync("/proc/1/environ", "utf8").split("\0")) {
  const i = kv.indexOf("=");
  if (i > 0 && !(kv.slice(0, i) in process.env)) process.env[kv.slice(0, i)] = kv.slice(i + 1);
}

const adminAuth = require("../lib/admin-auth");
const base = process.env.APP_ENV === "dev" ? "https://dev.lalabuba.com" : "https://lalabuba.com";
const token = adminAuth.generateLink(process.env.LINK_EMAIL || null, Number(process.env.LINK_MIN || 10) * 60);
console.log(`${base}/admin/link#${token}`);
