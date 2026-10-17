// Regression test: DeepInfra is tier 1 for every difficulty. A clean image is
// returned after one call (4 steps, seed passed through); a quality-rejected
// image is retried with a FRESH seed up to providers.deepinfraAttempts times
// before Cloudflare; an HTTP error exits the tier at once. Keyless Pollinations
// stays off by default. A bright PNG with no enclosed regions (which used to
// skip the region gate) is now rejected.
// Run: node scripts/test-deepinfra-tier.js
process.env.DEEPINFRA_API_KEY = 'dummy-deepinfra';
process.env.CF_ACCOUNT_ID = 'dummy-account';
process.env.CF_API_TOKEN = 'dummy-token';
delete process.env.NOVITA_API_KEY;
delete process.env.TOGETHER_API_KEY;
delete process.env.HF_TOKEN;

const sharp = require('sharp');
const { generateImage } = require('../lib/image-providers.js');
const ATTEMPTS = require('../lib/drawing-config.js').DEFAULTS?.providers?.deepinfraAttempts ?? 3;
let failures = 0;
const check = (n, c) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failures++; };

// 4×4 grid of black lines on white → 16 enclosed cells (a valid coloring page).
async function gridJpeg() {
  const S = 512, lines = [];
  for (let k = 0; k <= 4; k++) {
    const p = Math.min(S - 8, 32 + k * 112);
    lines.push(`<rect x="${p}" y="32" width="8" height="456"/>`, `<rect x="32" y="${p}" width="456" height="8"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${lines.join('')}</g></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}
const blackJpeg = () => sharp({ create: { width: 64, height: 64, channels: 3, background: '#000' } }).jpeg().toBuffer();
const whitePng  = () => sharp({ create: { width: 64, height: 64, channels: 3, background: '#fff' } }).png().toBuffer();

let GOOD, BLACK, WHITE;
let diCalls = 0, diSeeds = [], diSteps = [], cfCalls = 0, pollCalls = 0, diMode = 'good', cfMode = 'reject';
global.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('pollinations')) { pollCalls++; return { ok: false, status: 402, text: async () => 'x' }; }
  if (u.includes('api.deepinfra.com')) {
    diCalls++;
    const body = JSON.parse(init.body);
    diSeeds.push(body.seed); diSteps.push(body.num_inference_steps);
    if (diMode === 'http') return { ok: false, status: 402, text: async () => 'payment required' };
    const img = diMode === 'good' ? GOOD : BLACK;
    return { ok: true, json: async () => ({ images: ['data:image/jpeg;base64,' + img.toString('base64')] }) };
  }
  if (u.includes('cloudflare.com')) {
    cfCalls++;
    const img = cfMode === 'good' ? GOOD : cfMode === 'white-png' ? WHITE : BLACK;
    return { ok: true, json: async () => ({ result: { image: img.toString('base64') } }) };
  }
  throw new Error('unexpected fetch: ' + u);
};
const origWarn = console.warn, origLog = console.log;
console.warn = () => {}; console.log = (...a) => { const s = a.join(' '); if (/^\s+(ok|FAIL) /.test(s) || s.includes('checks')) origLog(s); };
const reset = () => { diCalls = 0; diSeeds = []; diSteps = []; cfCalls = 0; pollCalls = 0; };

(async () => {
  GOOD = await gridJpeg(); BLACK = await blackJpeg(); WHITE = await whitePng();

  for (const difficulty of ['easy', 'hard', 'extreme']) {
    reset(); diMode = 'good';
    const out = await generateImage('cat', 512, 512, 42, { difficulty }).catch(() => null);
    check(`${difficulty}: clean DeepInfra image returned after 1 call`, !!out && diCalls === 1 && cfCalls === 0);
    check(`${difficulty}: 4 steps + caller seed sent`, diSteps[0] === 4 && diSeeds[0] === 42);
    check(`${difficulty}: result is a binarized PNG`, out?.contentType === 'image/png');
  }

  reset(); diMode = 'reject'; cfMode = 'good';
  const fell = await generateImage('cat', 512, 512, 7, { difficulty: 'easy' }).catch(() => null);
  check(`rejected image retried ${ATTEMPTS}x`, diCalls === ATTEMPTS);
  check('each retry uses a fresh seed', new Set(diSeeds).size === ATTEMPTS);
  check('then falls through to Cloudflare', cfCalls === 1 && !!fell);

  reset(); diMode = 'http'; cfMode = 'good';
  await generateImage('cat', 512, 512, 8, { difficulty: 'easy' }).catch(() => null);
  check('HTTP error exits DeepInfra after 1 call', diCalls === 1);
  check('HTTP error still reaches Cloudflare', cfCalls === 1);
  check('keyless Pollinations not called by default', pollCalls === 0);

  reset(); diMode = 'http'; cfMode = 'white-png';
  await generateImage('cat', 512, 512, 9, { difficulty: 'easy', strict: true }).catch(() => null);
  check('bright PNG with 0 enclosed regions now rejected (CF retried 3x)', cfCalls === 3);

  console.warn = origWarn; console.log = origLog;
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures ? 1 : 0);
})();
