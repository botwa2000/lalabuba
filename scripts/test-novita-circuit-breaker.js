// Regression test for the half-open Novita circuit breaker in lib/image-providers.js.
// Verifies:
//   1. The first NOVITA_BREAKER_THRESHOLD consecutive failures use the FULL timeout.
//   2. Once open, requests inside the cooldown skip Novita instantly (no fetch).
//   3. After the cooldown, ONE half-open trial gets the FULL timeout — concurrent
//      requests keep skipping while it is in flight.
//   4. A trial against a slow-but-healthy Novita (answers after longer than the
//      old 10s-style probe would have allowed) succeeds and CLOSES the circuit.
//      This is the 2026-10-09 prod bug: probes shorter than Novita's normal
//      latency could never succeed, so the circuit stayed open forever.
//   5. After closing, the next failure uses the full timeout again (real reset).
// Mocks global.fetch end-to-end and drives everything through generateImage().
// Run: node scripts/test-novita-circuit-breaker.js
process.env.CF_ACCOUNT_ID = 'dummy-account';
process.env.CF_API_TOKEN = 'dummy-token';
process.env.NOVITA_API_KEY = 'dummy-novita';
process.env.NOVITA_BREAKER_THRESHOLD = '2';
process.env.NOVITA_BREAKER_COOLDOWN_MS = '300';
process.env.NOVITA_TIMEOUT_MS = '600'; // "full" timeout, short so the test runs fast
delete process.env.TOGETHER_API_KEY;

const { generateImage } = require('../lib/image-providers.js');

let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  ok   ${name}`); }
  else { console.log(`  FAIL ${name}`); failures++; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Novita that hangs until the caller aborts (real-world outage behaviour).
function hang(opts) {
  return new Promise((_res, reject) => {
    opts.signal.addEventListener('abort', () => {
      const e = new Error('This operation was aborted'); e.name = 'AbortError'; reject(e);
    });
  });
}

const WHITE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

let novitaCalls = [];          // elapsed ms of each Novita generate call
let novitaMode = 'hang';       // 'hang' | 'slow-ok'

global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('pollinations')) return { ok: false, status: 429, text: async () => 'x' };
  if (u.includes('cloudflare.com')) return { ok: false, status: 403, json: async () => ({}) };
  if (u.includes('novita.ai/fake.png')) {
    return { ok: true, headers: { get: () => null },
      arrayBuffer: async () => WHITE_PNG.buffer.slice(WHITE_PNG.byteOffset, WHITE_PNG.byteOffset + WHITE_PNG.byteLength) };
  }
  if (u.includes('novita.ai')) {
    const t0 = Date.now();
    try {
      if (novitaMode === 'hang') await hang(opts);
      await sleep(400); // slow but healthy: longer than a short probe, shorter than the full timeout
      return { ok: true, json: async () => ({ images: [{ image_url: 'https://novita.ai/fake.png' }] }) };
    } finally { novitaCalls.push(Date.now() - t0); }
  }
  if (u.includes('huggingface.co')) return { ok: false, status: 404, text: async () => 'x' };
  throw new Error('unexpected fetch: ' + u);
};

const warnings = [], logs = [];
const origWarn = console.warn, origLog = console.log;
console.warn = (...a) => { warnings.push(a.join(' ')); };
console.log = (...a) => { const s = a.join(' '); if (/^\s+(ok|FAIL) /.test(s) || s.includes('checks')) origLog(s); else logs.push(s); };
const gen = (i) => generateImage(`test subject ${i}`, 512, 512, 40 + i, { difficulty: 'medium' }).catch(() => {});
const reset = () => { novitaCalls = []; warnings.length = 0; logs.length = 0; };

(async () => {
  // 1. Calls 1-2: closed → full timeout.
  reset();
  await gen(1); await gen(2);
  check('calls 1-2: circuit not reported open', !warnings.some(w => w.includes('circuit OPEN') || w.includes('HALF-OPEN')));
  check('calls 1-2: Novita waited the full timeout', novitaCalls.length === 2 && novitaCalls.every(ms => ms > 500));

  // 2. Call 3 immediately: open, inside cooldown → skipped, no Novita fetch.
  reset();
  await gen(3);
  check('call 3: circuit OPEN, skipped', warnings.some(w => w.includes('circuit OPEN') && w.includes('skipping')));
  check('call 3: Novita not called at all', novitaCalls.length === 0);

  // 3. After cooldown: half-open trial gets the FULL timeout; a concurrent call skips.
  await sleep(350);
  reset();
  await Promise.all([gen(4), gen(5)]);
  check('calls 4+5: exactly one half-open trial', warnings.filter(w => w.includes('HALF-OPEN')).length === 1);
  check('calls 4+5: concurrent call skipped (trial in flight)', warnings.some(w => w.includes('trial in flight')));
  check('calls 4+5: only one Novita request, with the full timeout', novitaCalls.length === 1 && novitaCalls[0] > 500);

  // 4. Slow-but-healthy Novita: trial succeeds and closes the circuit.
  await sleep(350);
  novitaMode = 'slow-ok';
  reset();
  await gen(6);
  check('call 6: slow-but-healthy trial succeeded → circuit CLOSED', logs.some(l => l.includes('circuit CLOSED')));

  // 5. Next failure: closed again → full timeout, no open/half-open warning.
  novitaMode = 'hang';
  reset();
  await gen(7);
  check('call 7: circuit closed, full timeout used',
    !warnings.some(w => w.includes('circuit OPEN') || w.includes('HALF-OPEN')) && novitaCalls.length === 1 && novitaCalls[0] > 500);

  console.warn = origWarn; console.log = origLog;
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
})();
