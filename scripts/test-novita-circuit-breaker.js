// Regression test for the Novita circuit breaker in lib/image-providers.js
// (added 2026-09-19 after Novita's generate endpoint was confirmed to hang
// indefinitely — see project-image-generation-providers memory). Verifies:
//   1. The first NOVITA_BREAKER_THRESHOLD consecutive Novita failures use the
//      FULL adaptive timeout (nothing shortened prematurely).
//   2. Once the threshold is hit, the circuit "opens" and subsequent Novita
//      calls get only the short NOVITA_BREAKER_PROBE_MS timeout instead.
//   3. A single Novita success closes the circuit again (self-heals).
// Mocks global.fetch end-to-end and drives everything through the public
// generateImage() — no internals are exported just for this test.
// Run: node scripts/test-novita-circuit-breaker.js
process.env.CF_ACCOUNT_ID = 'dummy-account';
process.env.CF_API_TOKEN = 'dummy-token';
process.env.NOVITA_API_KEY = 'dummy-novita';
process.env.NOVITA_BREAKER_THRESHOLD = '2';
process.env.NOVITA_BREAKER_PROBE_MS = '150'; // short so this test runs fast
process.env.NOVITA_TIMEOUT_MS = '600'; // "full" timeout, but still fast for a test — must stay clearly > the 150ms probe
delete process.env.TOGETHER_API_KEY;

const { generateImage } = require('../lib/image-providers.js');

let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  ok   ${name}`); }
  else { console.log(`  FAIL ${name}`); failures++; }
}

function neverResolvingFetch(url, opts) {
  // Simulates Novita's confirmed real-world behaviour: the request just
  // hangs until the caller's AbortSignal fires — never resolves or rejects
  // on its own. abortAfter()'s timer is what ends it.
  return new Promise((_resolve, reject) => {
    opts.signal.addEventListener('abort', () => {
      const e = new Error('This operation was aborted');
      e.name = 'AbortError';
      reject(e);
    });
  });
}

async function main() {
  let novitaCallTimeouts = []; // measured elapsed ms per Novita call

  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('pollinations')) {
      return { ok: false, status: 429, text: async () => 'rate limited' };
    }
    if (u.includes('cloudflare.com')) {
      // Fail Cloudflare too so every call is forced through to Novita.
      return { ok: false, status: 403, json: async () => ({}) };
    }
    if (u.includes('novita.ai')) {
      const t0 = Date.now();
      try {
        await neverResolvingFetch(url, opts);
      } finally {
        novitaCallTimeouts.push(Date.now() - t0);
      }
      throw new Error('unreachable');
    }
    if (u.includes('huggingface.co')) {
      return { ok: false, status: 404, text: async () => 'Not Found' };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => { warnings.push(args.join(' ')); };

  // Call 1 and 2: circuit starts CLOSED, so Novita should get the FULL
  // adaptive timeout (>> the 150ms probe) both times.
  for (let i = 1; i <= 2; i++) {
    warnings.length = 0;
    try {
      await generateImage(`test subject ${i}`, 512, 512, 42 + i, { difficulty: 'medium' });
    } catch { /* expected — everything fails, including the final fallback */ }
    check(`call ${i}: circuit NOT reported open`, !warnings.some(w => w.includes('circuit OPEN')));
  }
  check('calls 1-2 waited the full (unshortened) timeout, not the 150ms probe',
    novitaCallTimeouts.every(ms => ms > 400));

  // Call 3: threshold (2) reached — circuit should now be OPEN, using the
  // short probe timeout instead of the full one.
  novitaCallTimeouts.length = 0;
  warnings.length = 0;
  try {
    await generateImage('test subject 3', 512, 512, 45, { difficulty: 'medium' });
  } catch { /* expected */ }
  check('call 3: circuit reported OPEN', warnings.some(w => w.includes('circuit OPEN')));
  check('call 3: Novita aborted near the 150ms probe timeout (not the full budget)',
    novitaCallTimeouts.length === 1 && novitaCallTimeouts[0] < 300);

  // Call 4: Novita now succeeds — the circuit should close again.
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('pollinations')) return { ok: false, status: 429, text: async () => 'x' };
    if (u.includes('cloudflare.com')) return { ok: false, status: 403, json: async () => ({}) };
    if (u.includes('novita.ai') && u.includes('flux-1-schnell')) {
      return { ok: true, json: async () => ({ images: [{ image_url: 'https://novita.ai/fake.png' }] }) };
    }
    if (u.includes('novita.ai/fake.png')) {
      // A 1x1 white PNG — passes the quality gate trivially for this test.
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64'
      );
      return { ok: true, headers: { get: () => null }, arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) };
    }
    throw new Error('unexpected fetch: ' + u);
  };
  warnings.length = 0;
  try {
    await generateImage('test subject 4', 512, 512, 46, { difficulty: 'medium' });
  } catch { /* the 1x1 PNG will likely fail the quality gate and fall to lastResort/error — that's fine, we only care about the breaker state */ }

  // Call 5: back to a hanging Novita — circuit should need the FULL
  // threshold again (i.e. it actually reset, not just decremented).
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('pollinations')) return { ok: false, status: 429, text: async () => 'x' };
    if (u.includes('cloudflare.com')) return { ok: false, status: 403, json: async () => ({}) };
    if (u.includes('novita.ai')) {
      const t0 = Date.now();
      try { await neverResolvingFetch(url, opts); } finally { novitaCallTimeouts.push(Date.now() - t0); }
      throw new Error('unreachable');
    }
    if (u.includes('huggingface.co')) return { ok: false, status: 404, text: async () => 'x' };
    throw new Error('unexpected fetch: ' + u);
  };
  novitaCallTimeouts.length = 0;
  warnings.length = 0;
  try {
    await generateImage('test subject 5', 512, 512, 47, { difficulty: 'medium' });
  } catch { /* expected */ }
  check('call 5 (after a success): circuit closed again, full timeout used',
    !warnings.some(w => w.includes('circuit OPEN')) &&
    novitaCallTimeouts.length === 1 && novitaCallTimeouts[0] > 400);

  console.warn = origWarn;

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
