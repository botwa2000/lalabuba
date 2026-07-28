'use strict';
// Seeds the community gallery with artworks for store screenshot purposes.
// Usage: node scripts/seed-community.js [prod|dev]
const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

const TARGET = process.argv[2] === 'dev'
  ? 'http://localhost:3021'
  : 'https://lalabuba.com';

const ART_DIR = path.resolve(__dirname, '..', 'store_assets', 'journal_art');

// Profiles to create (device UUIDs + nickname + avatar)
const PROFILES = [
  { uuid: 'aaaaaaaa-1111-4111-8111-111111111001', nickname: 'Sparkly Dragon',   avatarIndex: 0 },
  { uuid: 'aaaaaaaa-1111-4111-8111-111111111002', nickname: 'Rainbow Unicorn',  avatarIndex: 3 },
  { uuid: 'aaaaaaaa-1111-4111-8111-111111111003', nickname: 'Cosmic Panda',     avatarIndex: 9 },
  { uuid: 'aaaaaaaa-1111-4111-8111-111111111004', nickname: 'Bouncy Bunny',     avatarIndex: 6 },
];

// Artworks to upload: { profile index, file, subject, difficulty }
const ARTWORKS = [
  { profileIdx: 0, file: 'art1.png', subject: 'dragon',   difficulty: 'medium' },
  { profileIdx: 1, file: 'art3.png', subject: 'unicorn',  difficulty: 'easy'   },
  { profileIdx: 2, file: 'art2.png', subject: 'dragon',   difficulty: 'hard'   },
  { profileIdx: 3, file: 'art4.png', subject: 'unicorn',  difficulty: 'easy'   },
];

function doRequest(urlStr, method, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers,
    };
    const req = mod.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function setupProfile(profile) {
  const payload = JSON.stringify({ nickname: profile.nickname, avatarIndex: profile.avatarIndex });
  const r = await doRequest(`${TARGET}/api/community/profile`, 'POST', {
    'Content-Type':       'application/json',
    'Content-Length':     Buffer.byteLength(payload),
    'X-Device-ID':        profile.uuid,
    'X-Parental-Consent': 'yes',
  }, payload);
  console.log(`  Profile ${profile.nickname}: ${r.status}`);
  if (r.status !== 200 && r.status !== 201) console.log('  →', r.body);
  return r.status < 300;
}

async function uploadArtwork(profile, artFile, subject, difficulty) {
  const imgPath = path.join(ART_DIR, artFile);
  if (!fs.existsSync(imgPath)) { console.log(`  ⚠ missing ${artFile}`); return false; }
  const imgBytes = fs.readFileSync(imgPath);
  const b64 = 'data:image/png;base64,' + imgBytes.toString('base64');
  const payload = JSON.stringify({
    shareType: 'colored',
    subject,
    difficulty,
    seed: Math.floor(Math.random() * 1e12),
    imageData: b64,
  });
  const r = await doRequest(`${TARGET}/api/community/artwork`, 'POST', {
    'Content-Type':       'application/json',
    'Content-Length':     Buffer.byteLength(payload),
    'X-Device-ID':        profile.uuid,
    'X-Parental-Consent': 'yes',
  }, payload);
  console.log(`  Artwork ${artFile} for ${profile.nickname}: ${r.status}`);
  if (r.status !== 200 && r.status !== 201) console.log('  →', JSON.stringify(r.body).slice(0, 200));
  return r.status < 300;
}

async function checkGallery() {
  const r = await doRequest(`${TARGET}/api/community/gallery`, 'GET', {}, null);
  if (r.status === 200) {
    const count = r.body?.artworks?.length || 0;
    console.log(`\n✓ Gallery now has ${count} artwork(s)`);
    if (r.body?.artworks?.length) {
      for (const a of r.body.artworks.slice(0, 4)) {
        console.log(`  - ${a.subject} (${a.shareType}) by ${a.nickname} | ${a.imageUrl}`);
      }
    }
  } else {
    console.log('Gallery check failed:', r.status, r.body);
  }
}

async function main() {
  console.log(`Seeding community gallery → ${TARGET}\n`);

  console.log('Setting up profiles...');
  for (const p of PROFILES) await setupProfile(p);

  console.log('\nUploading artworks...');
  for (const aw of ARTWORKS) {
    const profile = PROFILES[aw.profileIdx];
    await uploadArtwork(profile, aw.file, aw.subject, aw.difficulty);
  }

  await checkGallery();
}

main().catch(e => { console.error(e); process.exit(1); });
