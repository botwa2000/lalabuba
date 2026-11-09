"use strict";
// DELETE /api/auth/account — erase the signed-in parent account.
//
// Google Play's account-deletion policy: an app that lets people create an
// account must let them delete it in the app and request it on the web
// (/delete-account). Removes the account row; ON DELETE CASCADE takes the
// linked devices, refresh tokens and child profiles with it. Pending sign-in
// codes for the address go too. Device-level data (community profile, shared
// artworks, usage statistics) is erased separately by the app's
// DELETE /api/community/profile, which the same "Delete account" button calls.
const db       = require("../../lib/db");
const auth     = require("../../lib/auth");
const commAuth = require("../../lib/community-auth");

const rateLimiter = commAuth.makeRateLimiter("auth:delete-account", 10, commAuth.HOUR);

function setCors(res) {
  const origins = commAuth.ALLOWED_ORIGINS;
  res.setHeader("Access-Control-Allow-Origin", origins[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed." });

  const ip = commAuth.clientIp(req);
  if (await rateLimiter(ip)) return res.status(429).json({ error: "Too many requests." });

  const token = auth.bearerToken(req);
  if (!token) return res.status(401).json({ error: "Authorization required.", code: "NO_TOKEN" });
  const payload = auth.verifyAccessToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token.", code: "TOKEN_INVALID" });

  const { rows } = await db.query("DELETE FROM accounts WHERE id = $1 RETURNING email", [payload.accountId]);
  if (!rows.length) return res.status(404).json({ error: "Account not found." });
  await db.query("DELETE FROM email_otp_codes WHERE email = $1", [rows[0].email]).catch(() => {});
  return res.status(200).json({ ok: true });
};
