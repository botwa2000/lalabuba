"use strict";

const { clientIp } = require("../lib/client-ip");
const rateLimit = require("../lib/rate-limit");
const db = require("../lib/db");
const usage = require("../lib/usage");
const { sendContactMessage } = require("../lib/email");

// Durable, shared rate limit (lib/rate-limit.js): 3 messages per IP per hour.
const RATE_LIMIT_MAX    = 3;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

// ─── Turnstile verification ───────────────────────────────────────────────────
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;          // not configured — skip (dev mode only)
  if (!token) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      if (attempt === 1) return false; // unreachable after a retry → fail closed
    }
  }
  return false;
}

// ─── Email validation ─────────────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://lalabuba.com",
  "https://www.lalabuba.com",
  "http://localhost:3000",
];

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const ip = clientIp(req);
  if ((await rateLimit.consume("contact:ip", ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)).limited) {
    res.status(429).json({ error: "Too many messages — please wait a while before trying again." });
    return;
  }

  try {
    const body = req.body || {};

    // Honeypot — bots fill hidden fields
    if (body.website !== undefined && body.website !== "") {
      // Silently reject but return 200 to fool bots
      res.status(200).json({ ok: true });
      return;
    }

    // Turnstile verification
    const ok = await verifyTurnstile(body.turnstileToken, ip);
    if (!ok) {
      res.status(403).json({ error: "Bot check failed — please try again." });
      return;
    }

    // Input validation
    const name    = String(body.name    || "").trim();
    const email   = String(body.email   || "").trim();
    const message = String(body.message || "").trim();

    if (!name || name.length > 100) {
      res.status(400).json({ error: "Please provide your name (max 100 characters)." });
      return;
    }
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Please provide a valid email address." });
      return;
    }
    if (!message || message.length > 2000) {
      res.status(400).json({ error: "Please provide a message (max 2000 characters)." });
      return;
    }

    // Until 2026-10-30 this sent via Resend, whose key was never configured on
    // Hetzner — every message was dropped while the form showed success. Brevo
    // (lib/email.js) is the mail provider for everything else; a send failure
    // is now reported to the user instead of swallowed.
    const ctx = await usage.requestContext(req, null, body.lang);
    try {
      await sendContactMessage({ name, email, message,
        meta: `${ctx.platform}${ctx.country ? " · " + ctx.country : ""}${ctx.lang ? " · " + ctx.lang : ""} · ${new Date().toISOString()}` });
    } catch (err) {
      console.error("[contact] send failed:", err.message);
      res.status(500).json({ error: "Failed to send message. Please try again later." });
      return;
    }

    // Counted in /admin/stats → Feedback (message text only; name and email
    // live in the email to info@, never in the database).
    db.query(
      `INSERT INTO feedback (kind, platform, visitor_hash, install_id, comment, lang, country)
       VALUES ('contact', $1, $2, $3, $4, $5, $6)`,
      [ctx.platform, ctx.visitorHash, ctx.installId, message, ctx.lang, ctx.country]
    ).catch((err) => console.error("[contact] feedback row failed:", err.message));

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[contact] Unexpected error:", error);
    res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
  }
};
