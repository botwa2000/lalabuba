"use strict";
// JWT + bcrypt utilities for account authentication.
// JWT_SECRET must be set in production (Swarm secret); falls back to a dev
// constant with a logged warning so local dev works without configuration.

const crypto  = require("crypto");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");

const BCRYPT_ROUNDS    = 12;
const ACCESS_TTL_SEC   = 15 * 60;         // 15 minutes
const REFRESH_TTL_DAYS = 30;

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[auth] JWT_SECRET must be set in production");
    }
    console.warn("[auth] JWT_SECRET not set — using insecure dev default");
    return "dev-insecure-secret-change-in-production";
  }
  return s;
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateAccessToken(accountId, email) {
  return jwt.sign(
    { accountId, email },
    getSecret(),
    { expiresIn: ACCESS_TTL_SEC, issuer: "lalabuba" }
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, getSecret(), { issuer: "lalabuba" });
  } catch {
    return null;
  }
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString("hex"); // 64-char hex
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TTL_DAYS);
  return d;
}

// Extract Bearer token from Authorization header.
function bearerToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

module.exports = {
  hashPassword,
  checkPassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiresAt,
  bearerToken,
  ACCESS_TTL_SEC,
  REFRESH_TTL_DAYS,
};
