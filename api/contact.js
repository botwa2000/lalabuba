"use strict";

// ─── Rate limiting (per serverless instance) ─────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_MAX    = 3;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    if (rateLimitMap.size > 5000) {
      for (const [k, v] of rateLimitMap) if (now > v.resetAt) rateLimitMap.delete(k);
    }
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

// ─── Turnstile verification ───────────────────────────────────────────────────
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;          // not configured — skip (dev mode)
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return true; // if Cloudflare is unreachable, don't block users
  }
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
  "capacitor://localhost",
  "ionic://localhost",
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

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
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

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      // Dev mode — log and return success silently
      console.log("[contact] RESEND_API_KEY not set — skipping email send.", { name, email });
      res.status(200).json({ ok: true });
      return;
    }

    // Send email via Resend REST API
    const timestamp = new Date().toISOString();
    const htmlBody = `
      <h2>New contact message from Lalabuba</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
        <tr><td style="padding:6px 12px;font-weight:bold;color:#555;">Name</td><td style="padding:6px 12px;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;color:#555;">Email</td><td style="padding:6px 12px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;color:#555;">IP</td><td style="padding:6px 12px;">${escapeHtml(ip)}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;color:#555;">Sent at</td><td style="padding:6px 12px;">${timestamp}</td></tr>
      </table>
      <hr style="margin:16px 0;border:none;border-top:1px solid #eee;" />
      <p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap;">${escapeHtml(message)}</p>
    `;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Lalabuba Contact <info@lalabuba.com>',
        to: ['info@lalabuba.com'],
        subject: `Contact from ${name}`,
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const errData = await emailRes.text();
      console.error("[contact] Resend API error:", emailRes.status, errData);
      res.status(500).json({ error: "Failed to send message. Please try again later." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[contact] Unexpected error:", error);
    res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
