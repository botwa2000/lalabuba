/**
 * Social posting — shared helpers: secret redaction, logging, Berlin time.
 */
import { createHash } from 'node:crypto';
import { TIMEZONE } from './config.mjs';

// ------------------------------------------------------------------ redaction

const secrets = new Set();

/** Register a secret value so every log line and error message masks it. */
export function registerSecret(value) {
  if (typeof value === 'string' && value.length >= 8) secrets.add(value);
}

/**
 * Mask registered secrets plus anything shaped like a credential, so a failed
 * request can never echo a token into the logs — even one we never registered
 * (e.g. a freshly refreshed token inside an error body).
 */
export function redact(input) {
  let s = String(input ?? '');
  for (const v of secrets) s = s.split(v).join('«redacted»');
  return s
    .replace(/((?:access|refresh)_token["'=:\s]+)["']?[A-Za-z0-9._\-|%]{8,}/gi, '$1«redacted»')
    .replace(/(Bearer\s+)[A-Za-z0-9._\-|%]{8,}/gi, '$1«redacted»')
    .replace(/(Basic\s+)[A-Za-z0-9+/=]{8,}/gi, '$1«redacted»')
    .replace(/\b(IGAA|IGQV|EAA|pina_|pinr_)[A-Za-z0-9._\-]{8,}/g, '«redacted»');
}

export function log(...parts) {
  const line = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
  console.log(`${new Date().toISOString()} ${redact(line)}`);
}

export function logError(...parts) {
  const line = parts.map((p) => (p instanceof Error ? p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
  console.error(`${new Date().toISOString()} ERROR ${redact(line)}`);
}

export function sha256(s) {
  return createHash('sha256').update(String(s)).digest('hex');
}

// --------------------------------------------------------------- Berlin time

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** { date: 'YYYY-MM-DD', minute: minutes since local midnight } in Berlin. */
export function berlinNow(d = new Date()) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}

/** 'HH:MM' → minutes. */
export function hhmm(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function fmtMinute(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' + n days (calendar arithmetic, zone-independent). */
export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The posting minute for one account on one day: deterministic (stable across
 * restarts and identical in the dry-run plan), varied day to day, and always
 * inside the brand's window. Leaves the last 15 minutes of the window as
 * slack so a slot is never placed where a brief outage would miss it.
 */
export function slotMinute(date, account, window) {
  const start = hhmm(window.start);
  const span = Math.max(1, hhmm(window.end) - start - 15);
  const h = parseInt(sha256(`${date}|${account}`).slice(0, 8), 16);
  return start + (h % span);
}
