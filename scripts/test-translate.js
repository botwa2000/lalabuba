// Regression test: with DEEPINFRA_API_KEY set, EVERY subject (ASCII or not) is
// translated by the LLM tier — "Schneemann" used to skip translation because it
// is pure ASCII, and FLUX drew a man. Results are cached; rambling output and
// LLM failures fall back (ASCII → passthrough, non-ASCII → MyMemory).
// Run: node scripts/test-translate.js
process.env.DEEPINFRA_API_KEY = 'dummy-deepinfra';
delete process.env.DEEPL_API_KEY;
const { translateToEnglish } = require('../lib/translate.js');
let failures = 0;
const check = (n, c) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failures++; };

let llmCalls = 0, memCalls = 0, llmMode = 'ok', lastUser = '';
const DICT = { schneemann: 'snowman', 'weihnachtsbaum mit geschenken': 'christmas tree with presents', 'bär': 'bear' };
global.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('api.deepinfra.com')) {
    llmCalls++;
    lastUser = JSON.parse(init.body).messages[1].content;
    if (llmMode === 'down') return { ok: false, status: 503, json: async () => ({}) };
    const idea = lastUser.replace(/<\/?idea>/g, '');
    const content = llmMode === 'ramble' ? 'x'.repeat(500) : (DICT[idea.toLowerCase()] ?? idea);
    return { ok: true, json: async () => ({ choices: [{ message: { content: `"${content}."\n` } }] }) };
  }
  if (u.includes('mymemory')) { memCalls++; return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: 'bear' } }) }; }
  throw new Error('unexpected fetch: ' + u);
};
const origWarn = console.warn, origLog = console.log;
console.warn = () => {}; console.log = (...a) => { const s = a.join(' '); if (/^\s+(ok|FAIL) /.test(s) || s.includes('checks')) origLog(s); };

(async () => {
  check('ASCII German "Schneemann" is translated', await translateToEnglish('Schneemann') === 'snowman');
  check('quotes, period and newline stripped', await translateToEnglish('Weihnachtsbaum mit Geschenken') === 'christmas tree with presents');
  check('English passes through unchanged', await translateToEnglish('unicorn in a meadow') === 'unicorn in a meadow');
  check('input fenced in <idea> tags, angle brackets removed', lastUser === '<idea>unicorn in a meadow</idea>');
  const before = llmCalls;
  await translateToEnglish('Schneemann');
  check('repeat subject served from cache', llmCalls === before);

  llmMode = 'ramble'; llmCalls = 0;
  check('rambling LLM output rejected → ASCII passthrough', await translateToEnglish('Rakete') === 'Rakete');

  llmMode = 'down'; memCalls = 0;
  check('LLM down + ASCII → passthrough (no MyMemory call)', await translateToEnglish('Drache') === 'Drache' && memCalls === 0);
  check('LLM down + non-ASCII → MyMemory fallback', await translateToEnglish('Bär') === 'bear' && memCalls === 1);

  console.warn = origWarn; console.log = origLog;
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures ? 1 : 0);
})();
