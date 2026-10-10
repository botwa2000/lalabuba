/**
 * Social posting — persistent state on the data volume.
 *
 *   published.json   publish ledger (dedupe + daily ceiling) and alert throttle
 *   tokens.enc       refreshed credentials, AES-256-GCM under SOCIAL_TOKEN_KEY
 *
 * Writes are atomic (tmp + rename) and mode 0600.
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { join } from 'node:path';

export const DATA_DIR = process.env.SOCIAL_DATA_DIR || '/app/data/social';

function atomicWrite(file, content) {
  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, content, { mode: 0o600 });
  renameSync(tmp, file);
}

// ------------------------------------------------------------ publish ledger

const LEDGER = () => join(DATA_DIR, 'published.json');

export function emptyLedger() {
  return { version: 1, posts: [], alerts: {} };
}

export function loadLedger() {
  if (!existsSync(LEDGER())) return emptyLedger();
  return { ...emptyLedger(), ...JSON.parse(readFileSync(LEDGER(), 'utf8')) };
}

export function saveLedger(ledger) {
  atomicWrite(LEDGER(), `${JSON.stringify(ledger, null, 2)}\n`);
}

// --------------------------------------------------------------- token store

const TOKENS = () => join(DATA_DIR, 'tokens.enc');

function key() {
  const raw = (process.env.SOCIAL_TOKEN_KEY || '').trim();
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) throw new Error('SOCIAL_TOKEN_KEY must be 32 bytes, base64-encoded.');
  return k;
}

export function encrypt(obj, k = key()) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return JSON.stringify({ v: 1, alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') });
}

export function decrypt(text, k = key()) {
  const box = JSON.parse(text);
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(box.iv, 'base64'));
  d.setAuthTag(Buffer.from(box.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8'));
}

export function loadTokens() {
  if (!existsSync(TOKENS())) return { accounts: {} };
  return decrypt(readFileSync(TOKENS(), 'utf8'));
}

export function saveTokens(store) {
  atomicWrite(TOKENS(), encrypt(store));
}

// ----------------------------------------------------------------- heartbeat

export function heartbeat() {
  atomicWrite(join(DATA_DIR, 'heartbeat'), `${new Date().toISOString()}\n`);
}
