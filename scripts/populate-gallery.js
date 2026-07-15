#!/usr/bin/env node
// URL-7: Fills all gallery slots to MAX_PER_SLOT (9) using the topup admin API.
// Usage: node scripts/populate-gallery.js [--dry-run] [--target N]
// Reads GALLERY_ADMIN_KEY and BASE_URL from .env (or environment).

const fs   = require('fs');
const path = require('path');
const https = require('https');

// Load .env from repo root
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const ADMIN_KEY = process.env.GALLERY_ADMIN_KEY;
const BASE_URL  = process.env.POPULATE_BASE_URL || 'https://lalabuba.com';
const DRY_RUN   = process.argv.includes('--dry-run');
const TARGET    = parseInt(process.argv.find(a => a.startsWith('--target='))?.split('=')[1]) || 9;
const BATCH     = 10; // max per topup call
const DELAY_MS  = 8000; // 8s between batches to avoid rate-limiting image gen

if (!ADMIN_KEY) { console.error('GALLERY_ADMIN_KEY missing from .env'); process.exit(1); }

function post(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`populate-gallery: target=${TARGET}, batch=${BATCH}, dry=${DRY_RUN}, base=${BASE_URL}`);
  let round = 0;
  let totalGenerated = 0;

  while (true) {
    round++;
    if (DRY_RUN) {
      console.log(`[dry] would POST /api/gallery/topup { target: ${TARGET}, batch: ${BATCH} }`);
      break;
    }
    const { status, body } = await post(
      `${BASE_URL}/api/gallery/topup`,
      { target: TARGET, batch: BATCH },
      { 'x-admin-key': ADMIN_KEY }
    );
    if (status !== 200) {
      console.error(`Round ${round}: HTTP ${status}`, body);
      break;
    }
    const generated = body.generated || 0;
    totalGenerated += generated;
    const ok     = body.results?.filter(r => r.ok).length || 0;
    const errors = body.results?.filter(r => r.error).length || 0;
    console.log(`Round ${round}: generated=${generated} (ok=${ok} err=${errors}) total=${totalGenerated}`);
    if (errors) {
      body.results.filter(r => r.error).forEach(r =>
        console.warn(`  ✗ ${r.topic}/${r.diff}: ${r.error}`)
      );
    }
    if (generated === 0) {
      console.log(`All slots at target=${TARGET}. Done after ${round} rounds, ${totalGenerated} images generated.`);
      break;
    }
    if (round > 100) { console.warn('Safety: 100 rounds reached, stopping.'); break; }
    await sleep(DELAY_MS);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
