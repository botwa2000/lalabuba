// Regression test: a quality-rejected Cloudflare image is retried (fresh
// composition each call) up to providers.cloudflareAttempts times before the
// waterfall falls through to Novita; a quota/auth error exits the tier at once.
// A stochastic NSFW false positive (code 8007) is retried on its own budget;
// the daily-allocation error (4006) skips the tier until UTC midnight.
// Run: node scripts/test-cloudflare-retry.js
process.env.CF_ACCOUNT_ID = 'dummy-account';
process.env.CF_API_TOKEN = 'dummy-token';
process.env.NOVITA_API_KEY = 'dummy-novita';
process.env.NOVITA_TIMEOUT_MS = '200';
process.env.NOVITA_BREAKER_THRESHOLD = '1000'; // every scenario must reach Novita
delete process.env.TOGETHER_API_KEY;
delete process.env.HF_TOKEN;

const { generateImage } = require('../lib/image-providers.js');
const HEDGE = require('../lib/drawing-config.js').DEFAULTS?.providers?.novitaHedge ?? 2;
let failures = 0;
const check = (n, c) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failures++; };

// A solid-black PNG: fails the brightness gate and has no line structure, so
// tryProvider rejects it (stands in for a medallion / silhouette image).
const zlib = require('zlib');
function blackPng(w = 64, h = 64) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((w + 1) * h); // filter 0 + all-zero (black) gray pixels
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const BLACK_B64 = blackPng().toString('base64');

let cfCalls = 0, novitaCalls = 0, cfMode = 'reject', nsfwLeft = 0;
const cfError = (status, code) => ({ ok: false, status, json: async () => ({ errors: [{ code, message: 'AiError (00000000-0000-0000-0000-000000000000)' }] }) });
global.fetch = async (url) => {
  const u = String(url);
  if (u.includes('pollinations')) return { ok: false, status: 429, text: async () => 'x' };
  if (u.includes('cloudflare.com')) {
    cfCalls++;
    if (cfMode === 'quota') return { ok: false, status: 429, json: async () => ({}) };
    if (cfMode === 'nsfw') return cfError(400, 8007);
    if (cfMode === 'nsfw-then-reject' && nsfwLeft-- > 0) return cfError(400, 8007);
    if (cfMode === 'daily') return cfError(429, 4006);
    return { ok: true, json: async () => ({ result: { image: BLACK_B64 } }) };
  }
  if (u.includes('novita.ai')) { novitaCalls++; return { ok: false, status: 429, text: async () => 'failed to schedule worker' }; }
  throw new Error('unexpected fetch: ' + u);
};
const origWarn = console.warn, origLog = console.log;
console.warn = () => {}; console.log = (...a) => { const s = a.join(' '); if (/^\s+(ok|FAIL) /.test(s) || s.includes('checks')) origLog(s); };

(async () => {
  await generateImage('cat', 512, 512, 1, { difficulty: 'easy' }).catch(() => {});
  check('rejected Cloudflare image retried 3 times', cfCalls === 3);
  check('falls through to Novita after the retries', novitaCalls === HEDGE);

  cfCalls = 0; novitaCalls = 0; cfMode = 'quota';
  await generateImage('cat', 512, 512, 2, { difficulty: 'easy' }).catch(() => {});
  check('quota error exits the Cloudflare tier after 1 call', cfCalls === 1);
  check('quota error still reaches Novita', novitaCalls === HEDGE);

  cfCalls = 0; novitaCalls = 0; cfMode = 'nsfw';
  await generateImage('fox at school', 512, 512, 3, { difficulty: 'easy' }).catch(() => {});
  check('NSFW false positive retried on its own budget (1 + 4 calls)', cfCalls === 5);
  check('persistent NSFW rejection still reaches Novita', novitaCalls === HEDGE);

  cfCalls = 0; novitaCalls = 0; cfMode = 'nsfw-then-reject'; nsfwLeft = 2;
  await generateImage('fox at school', 512, 512, 4, { difficulty: 'easy' }).catch(() => {});
  check('NSFW retries do not consume quality attempts (2 + 3 calls)', cfCalls === 5);

  cfCalls = 0; novitaCalls = 0; cfMode = 'daily';
  await generateImage('cat', 512, 512, 5, { difficulty: 'easy' }).catch(() => {});
  check('daily allocation error exits after 1 call', cfCalls === 1);
  cfCalls = 0;
  await generateImage('cat', 512, 512, 6, { difficulty: 'easy' }).catch(() => {});
  check('tier skipped (0 calls) for the rest of the UTC day', cfCalls === 0);
  check('skipped tier still reaches Novita', novitaCalls === 2 * HEDGE);

  console.warn = origWarn; console.log = origLog;
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures ? 1 : 0);
})();
