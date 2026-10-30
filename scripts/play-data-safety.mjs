#!/usr/bin/env node
// Push a Data safety CSV to Google Play via the Play Developer API
// (applications.dataSafety). Play has no "read" endpoint, so the workflow is:
//   1. Play Console → App content → Data safety → Export to CSV
//   2. set the answers from docs/STORE_PRIVACY.md in that CSV (or in the Console)
//   3. node scripts/play-data-safety.mjs path/to/data_safety.csv
// Uses only Node built-ins; same service account as update-play-listing.mjs.

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const PACKAGE_NAME = 'com.lalabuba.lalabuba';
const SA_PATH = process.env.PLAY_SA_PATH || 'C:/Users/Alexa/OneDrive/Dev/bonifatus-secrets/gcloud-codemagic-publisher.json';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('usage: node scripts/play-data-safety.mjs <data_safety.csv>');
  process.exit(2);
}
const csv = readFileSync(csvPath, 'utf8');
if (!/^Question ID/i.test(csv.replace(/^\uFEFF/, ''))) {
  console.error('This does not look like a Play Console Data safety export (first column must be "Question ID").');
  process.exit(2);
}

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

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
});
const { access_token: token } = await tokenRes.json();
if (!token) { console.error('OAuth failed', tokenRes.status); process.exit(1); }

const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/dataSafety`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ safetyLabels: csv }),
});
const text = await res.text();
console.log(res.status, text.slice(0, 2000));
process.exit(res.ok ? 0 : 1);
