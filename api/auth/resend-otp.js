"use strict";
// Same logic as send-otp but returns cooldownSeconds in success response.
const db       = require("../../lib/db");
const email    = require("../../lib/email");
const commAuth = require("../../lib/community-auth");

const emailRateLimiter = commAuth.makeRateLimiter(3, commAuth.HOUR);

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const { email: rawEmail, lang } = req.body || {};
  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return res.status(400).json({ error: "Invalid email.", code: "BAD_EMAIL" });
  }

  const normalEmail = rawEmail.trim().toLowerCase();
  const safeLang    = /^[a-z]{2,3}$/.test(lang || "") ? lang : "en";

  if (emailRateLimiter(normalEmail)) {
    return res.status(429).json({ error: "Too many OTP requests. Please wait before trying again.", code: "RATE_LIMIT" });
  }

  await db.query(
    "UPDATE email_otp_codes SET used_at = NOW() WHERE email = $1 AND used_at IS NULL AND expires_at > NOW()",
    [normalEmail]
  );

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.query(
    "INSERT INTO email_otp_codes (email, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')",
    [normalEmail, code]
  );

  try {
    await email.sendOtp(normalEmail, code, safeLang);
  } catch (err) {
    console.error("[resend-otp] Failed:", err.message);
    return res.status(503).json({ error: "Could not send verification email. Please try again.", code: "EMAIL_FAILED" });
  }

  return res.status(200).json({ ok: true, cooldownSeconds: 60 });
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", commAuth.ALLOWED_ORIGINS[0] || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
