/**
 * Social posting — operator alerts by email (Brevo transactional API, the same
 * account lib/email.js uses). Throttled to one email per alert key per 24 h so
 * a persistent fault nags daily instead of flooding.
 */
import { cred } from './config.mjs';
import { log, logError, redact } from './util.mjs';

const THROTTLE_MS = 24 * 3600 * 1000;

/** Returns true if an email went out. Records the send in ledger.alerts. */
export async function alert(ledger, key, subject, text, { now = Date.now() } = {}) {
  const last = ledger.alerts[key];
  if (last && now - Date.parse(last) < THROTTLE_MS) return false;

  const apiKey = cred('BREVO_API_KEY');
  const to = cred('SOCIAL_ALERT_EMAIL');
  const body = redact(text);
  if (!apiKey || !to) {
    logError(`ALERT (email not configured) [${key}] ${subject} — ${body}`);
    return false;
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Lalabuba social bot', email: 'no-reply@lalabuba.com' },
        to: [{ email: to }],
        subject: `[social] ${subject}`,
        textContent: `${body}\n\n— social service on Hetzner (lalabuba-prod_social).\n` +
          `Logs: docker service logs lalabuba-prod_social --since 24h`,
      }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
    ledger.alerts[key] = new Date(now).toISOString();
    log(`alert emailed [${key}] ${subject}`);
    return true;
  } catch (err) {
    logError(`alert email FAILED [${key}] ${subject}:`, err);
    return false;
  }
}
