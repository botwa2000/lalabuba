"use strict";
const db   = require("../../lib/db");
const auth = require("../../lib/auth");
const commAuth = require("../../lib/community-auth");

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const { refreshToken } = req.body || {};
  if (refreshToken) {
    await db.query(
      "DELETE FROM refresh_tokens WHERE token_hash = $1",
      [auth.hashToken(refreshToken)]
    );
  }

  // Also handle "logout all" — delete all tokens for the account if Bearer is valid.
  const token = auth.bearerToken(req);
  const payload = token ? auth.verifyAccessToken(token) : null;
  if (payload && req.body?.logoutAll) {
    await db.query("DELETE FROM refresh_tokens WHERE account_id = $1", [payload.accountId]);
  }

  return res.status(200).json({ ok: true });
};

function setCors(res) {
  const origins = commAuth.ALLOWED_ORIGINS;
  res.setHeader("Access-Control-Allow-Origin", origins[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
