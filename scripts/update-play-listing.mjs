#!/usr/bin/env node
// Updates all 12 language listings in Google Play Console via Play Developer API v3.
// Uses only Node.js built-ins — no npm install needed.

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';

const PACKAGE_NAME = 'com.lalabuba.lalabuba';
const SA_PATH = 'C:/Users/Alexa/OneDrive/Dev/bonifatus-secrets/gcloud-codemagic-publisher.json';
const LISTING_PATH = new URL('../store-assets/store-listing-i18n.json', import.meta.url);

// Our JSON code → Play Console BCP-47 code
const LANG_MAP = {
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-BR',
  ru: 'ru-RU',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  zh: 'zh-CN',
  hi: 'hi-IN',
};

// ── JWT / OAuth2 ────────────────────────────────────────────────────────────

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const signingInput = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const sig = base64url(sign.sign(sa.private_key));
  return `${signingInput}.${sig}`;
}

function post(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = httpsRequest({
      hostname, path, method: 'POST',
      headers: {
        'Content-Type': headers['Content-Type'] || 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function apiRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = httpsRequest({
      hostname: 'androidpublisher.googleapis.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getAccessToken(sa) {
  const jwt = makeJwt(sa);
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const res = await post('oauth2.googleapis.com', '/token', body, { 'Content-Type': 'application/x-www-form-urlencoded' });
  const parsed = JSON.parse(res.body);
  if (!parsed.access_token) throw new Error(`Token error: ${res.body}`);
  return parsed.access_token;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
  const listings = JSON.parse(readFileSync(LISTING_PATH, 'utf8'));

  console.log('Getting OAuth2 access token…');
  const token = await getAccessToken(sa);

  // 1. Create edit
  console.log('Creating Play Store edit…');
  const editRes = await apiRequest('POST', `/androidpublisher/v3/applications/${PACKAGE_NAME}/edits`, token);
  if (editRes.status !== 200) throw new Error(`Create edit failed (${editRes.status}): ${editRes.body}`);
  const { id: editId } = JSON.parse(editRes.body);
  console.log(`Edit ID: ${editId}`);

  // 2. Update each language listing
  let updated = 0, skipped = 0;
  for (const [ourCode, playCode] of Object.entries(LANG_MAP)) {
    const entry = listings[ourCode];
    if (!entry) { console.warn(`  SKIP ${ourCode}: no entry in JSON`); skipped++; continue; }

    const listingBody = {
      language: playCode,
      title: entry.name,
      shortDescription: entry.short,
      fullDescription: entry.full,
    };

    // PUT creates-or-replaces; PATCH requires listing to already exist
    const r = await apiRequest(
      'PUT',
      `/androidpublisher/v3/applications/${PACKAGE_NAME}/edits/${editId}/listings/${playCode}`,
      token,
      listingBody,
    );
    if (r.status === 200) {
      console.log(`  ✓ ${ourCode} (${playCode}): "${entry.name}"`);
      updated++;
    } else {
      console.warn(`  ✗ ${ourCode} (${playCode}) HTTP ${r.status}: ${r.body.slice(0, 200)}`);
      skipped++;
    }
  }

  // 3. Commit edit
  console.log(`\nCommitting edit (${updated} updated, ${skipped} skipped)…`);
  const commitRes = await apiRequest('POST', `/androidpublisher/v3/applications/${PACKAGE_NAME}/edits/${editId}:commit`, token);
  if (commitRes.status !== 200) throw new Error(`Commit failed (${commitRes.status}): ${commitRes.body}`);
  const commit = JSON.parse(commitRes.body);
  console.log(`✅ Done! Edit ${commit.id} committed. Changes live in Play Console within a few minutes.`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
