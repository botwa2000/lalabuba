#!/usr/bin/env node
// Publish the Play listing drafts in docs/store-listing/{en,de,tr,es,pl,fr}.md
// (title, short + full description only) via the Play Developer API v3:
//   edits.insert → edits.listings.update (per language) → edits.commit
// Screenshots, graphics and all other languages are untouched (images are a
// separate resource; the existing listing's video URL is carried over).
//
//   node scripts/publish-play-listing-drafts.mjs           # validate only
//   node scripts/publish-play-listing-drafts.mjs --publish # validate, publish, read back
//   node scripts/publish-play-listing-drafts.mjs --verify  # read back only
//
// Node built-ins only; same service account as update-play-listing.mjs.

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const PACKAGE_NAME = 'com.lalabuba.lalabuba';
const SA_PATH = process.env.PLAY_SA_PATH || 'C:/Users/Alexa/OneDrive/Dev/bonifatus-secrets/gcloud-codemagic-publisher.json';
const DRAFTS = { en: 'en-US', de: 'de-DE', tr: 'tr-TR', es: 'es-ES', pl: 'pl-PL', fr: 'fr-FR' };
const LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000 };
// Play metadata policy: no ranking / price / promo terms in the title.
const BANNED_IN_TITLE = /\bfree\b|#\s*1\b|\bbest\b|kostenlos|gratis|gratuit|ücretsiz|darmow|bezpłatn|\bbeste[nr]?\b|meilleur|\bmejor|najlepsz|en iyi|\bno\.?\s*1\b|\bnr\.?\s*1\b/i;

const len = (s) => [...s].length; // Play counts characters (code points), not bytes

function parseDraft(code) {
  const lines = readFileSync(new URL(`../docs/store-listing/${code}.md`, import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n').split('\n');
  const heads = lines.map((l, i) => (/^\*\*.+\*\*\s*$/.test(l) ? i : -1)).filter((i) => i >= 0);
  if (heads.length !== 4) throw new Error(`${code}.md: expected 4 bold section headings, found ${heads.length}`);
  const section = (n) => lines.slice(heads[n] + 1, heads[n + 1]).join('\n').trim();
  return { title: section(0), shortDescription: section(1), fullDescription: section(2) };
}

function validate(drafts) {
  const problems = [];
  for (const [code, d] of Object.entries(drafts)) {
    for (const [field, max] of Object.entries(LIMITS)) {
      const n = len(d[field]);
      if (!n) problems.push(`${code}.${field} is empty`);
      if (n > max) problems.push(`${code}.${field} is ${n} > ${max}`);
    }
    if (d.title.includes('\n') || d.shortDescription.includes('\n')) problems.push(`${code}: title/short must be one line`);
    const hit = d.title.match(BANNED_IN_TITLE);
    if (hit) problems.push(`${code}.title contains banned term "${hit[0]}"`);
    console.log(`  ${code}: title ${len(d.title)}/30 "${d.title}" · short ${len(d.shortDescription)}/80 · full ${len(d.fullDescription)}/4000`);
  }
  return problems;
}

async function token() {
  const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
  const b64 = (s) => Buffer.from(s).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(input);
  const assertion = `${input}.${signer.sign(sa.private_key).toString('base64url')}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`OAuth failed (${r.status})`);
  return j.access_token;
}

function api(tok) {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/edits`;
  return async (method, path, body) => {
    const r = await fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 600)}`);
    return text ? JSON.parse(text) : {};
  };
}

async function verify(call, drafts) {
  const { id } = await call('POST', '');
  let mismatches = 0;
  try {
    for (const [code, lang] of Object.entries(DRAFTS)) {
      const live = await call('GET', `/${id}/listings/${lang}`);
      const bad = Object.keys(LIMITS).filter((f) => (live[f] || '').replace(/\r\n/g, '\n').trim() !== drafts[code][f]);
      if (bad.length) mismatches++;
      console.log(`  ${bad.length ? '✗' : '✓'} ${lang}: ${bad.length ? `differs in ${bad.join(', ')}` : 'title, short, full match draft'}`);
    }
    const all = await call('GET', `/${id}/listings`);
    console.log(`  (${(all.listings || []).length} languages on the listing in total)`);
  } finally {
    await call('DELETE', `/${id}`); // read-only edit, discard
  }
  return mismatches;
}

const mode = process.argv.includes('--publish') ? 'publish' : process.argv.includes('--verify') ? 'verify' : 'check';
const drafts = Object.fromEntries(Object.keys(DRAFTS).map((c) => [c, parseDraft(c)]));

console.log('Validating drafts:');
const problems = validate(drafts);
if (problems.length) { console.error('\n✗ ' + problems.join('\n✗ ')); process.exit(1); }
console.log('✓ all fields within limits, no banned title terms');
if (mode === 'check') process.exit(0);

const call = api(await token());

if (mode === 'publish') {
  const { id } = await call('POST', '');
  console.log(`\nEdit ${id}`);
  try {
    for (const [code, lang] of Object.entries(DRAFTS)) {
      const cur = await call('GET', `/${id}/listings/${lang}`).catch(() => ({}));
      const body = { language: lang, ...drafts[code], ...(cur.video ? { video: cur.video } : {}) };
      await call('PUT', `/${id}/listings/${lang}`, body);
      console.log(`  ✓ ${lang} updated (was "${cur.title || '—'}")`);
    }
    const res = await call('POST', `/${id}:commit`);
    console.log(`✓ committed edit ${res.id}`);
  } catch (e) {
    await call('DELETE', `/${id}`).catch(() => {});
    throw e;
  }
}

console.log('\nReading back:');
const mismatches = await verify(call, drafts);
if (mismatches) { console.error(`✗ ${mismatches} language(s) differ`); process.exit(1); }
console.log('✓ all 6 languages match the drafts');
