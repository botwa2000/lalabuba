// Unit tests for the social posting rules (scripts/social/*). No network:
// fetch is stubbed where a test needs it. Run: node scripts/test-social.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOCIAL_DATA_DIR = mkdtempSync(join(tmpdir(), 'social-test-'));
process.env.SOCIAL_TOKEN_KEY = Buffer.alloc(32, 7).toString('base64');

const { parseQueue, pickEntry, ledgerRow, withHistory, APPROVAL_RE } = await import('./social/queue.mjs');
const { emptyLedger, encrypt, decrypt, saveTokens, loadTokens } = await import('./social/store.mjs');
const { redact, registerSecret, slotMinute, hhmm, berlinNow, addDays } = await import('./social/util.mjs');
const { maintainTokens, refreshDue, credentialsFor } = await import('./social/tokens.mjs');
const { BRANDS, MAX_POSTS_PER_ACCOUNT_PER_DAY } = await import('./social/config.mjs');
const { buildPinBody } = await import('./social/pinterest.mjs');
const { buildContainers } = await import('./social/instagram.mjs');

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log(`  ok  ${name}`); };

const entry = (o = {}) => ({
  id: 'e1', brand: 'lalabuba', platform: 'pinterest', image: '/social/pins/a.jpg',
  board: 'Coloring Pages for Kids', title: 'A', description: 'd', link: 'https://lalabuba.com/a/',
  approved: '2026-10-10 AP', ...o,
});
const yaml = (posts, history = []) => JSON.stringify({ posts, history }); // JSON ⊂ YAML
const DAY = '2026-10-12';

await test('ceiling constant is 1', () => assert.equal(MAX_POSTS_PER_ACCOUNT_PER_DAY, 1));

await test('valid entry parses; relative image resolves to brand site', () => {
  const { entries, errors } = parseQueue(yaml([entry()]));
  assert.deepEqual(errors, []);
  assert.equal(entries[0].imageUrls[0], 'https://lalabuba.com/social/pins/a.jpg');
  assert.equal(entries[0].account, 'pinterest:lalabuba');
});

await test('unapproved entry never picked', () => {
  const { entries } = parseQueue(yaml([entry({ approved: undefined })]));
  const r = pickEntry({ entries, ledger: emptyLedger(), account: 'pinterest:lalabuba', date: DAY });
  assert.equal(r.entry, null);
  assert.equal(r.skipped[0].reason, 'not approved');
});

await test('malformed approval stamp is invalid, not approved', () => {
  for (const bad of ['yes', 'true', '2026-10-12', 'AP', '12.10.2026 AP']) assert.ok(!APPROVAL_RE.test(bad), bad);
  const { entries, errors } = parseQueue(yaml([entry({ approved: 'yes' })]));
  assert.equal(entries.length, 0);
  assert.match(errors[0], /approved must look like/);
});

await test('unknown field (typo) rejects the entry', () => {
  const { errors } = parseQueue(yaml([entry({ aproved: '2026-10-10 AP' })]));
  assert.match(errors[0], /unknown field "aproved"/);
});

await test('one attempt per account per day — even after a failure', () => {
  const { entries } = parseQueue(yaml([entry(), entry({ id: 'e2', title: 'B', image: '/b.jpg', link: 'https://lalabuba.com/b/' })]));
  const ledger = emptyLedger();
  ledger.posts.push(ledgerRow(entries[0], DAY, 'failed'));
  assert.equal(pickEntry({ entries, ledger, account: 'pinterest:lalabuba', date: DAY }).capped, true);
  // next day: the failed one is eligible again (it never went out)
  assert.equal(pickEntry({ entries, ledger, account: 'pinterest:lalabuba', date: addDays(DAY, 1) }).entry.id, 'e1');
});

await test('other accounts are not capped by this one', () => {
  const { entries } = parseQueue(yaml([entry(), entry({ id: 'i1', platform: 'instagram', board: undefined, link: undefined, image: '/x.jpg' })]));
  const ledger = emptyLedger();
  ledger.posts.push(ledgerRow(entries[0], DAY, 'published'));
  assert.equal(pickEntry({ entries, ledger, account: 'instagram:lalabuba', date: DAY }).entry.id, 'i1');
});

await test('dedupe: same image on platform, same title / link on account', () => {
  const { entries } = parseQueue(yaml([
    entry(),
    entry({ id: 'img', title: 'Z', link: 'https://lalabuba.com/z/' }),
    entry({ id: 'ttl', image: '/c.jpg', title: ' a ', link: 'https://lalabuba.com/y/' }),
    entry({ id: 'lnk', image: '/d.jpg', title: 'Q', link: 'https://lalabuba.com/a?utm=1' }),
  ]));
  const ledger = emptyLedger();
  ledger.posts.push(ledgerRow(entries[0], '2026-10-01', 'published'));
  const r = pickEntry({ entries, ledger, account: 'pinterest:lalabuba', date: DAY });
  assert.equal(r.entry, null);
  const why = Object.fromEntries(r.skipped.map((s) => [s.id, s.reason]));
  assert.match(why.img, /image already posted/);
  assert.match(why.ttl, /title already used/);
  assert.match(why.lnk, /link already used/);
});

await test('uncertain post blocks repost; failed does not', () => {
  const { entries } = parseQueue(yaml([entry()]));
  const l1 = emptyLedger(); l1.posts.push(ledgerRow(entries[0], '2026-10-01', 'uncertain'));
  assert.equal(pickEntry({ entries, ledger: l1, account: 'pinterest:lalabuba', date: DAY }).entry, null);
  const l2 = emptyLedger(); l2.posts.push(ledgerRow(entries[0], '2026-10-01', 'failed'));
  assert.equal(pickEntry({ entries, ledger: l2, account: 'pinterest:lalabuba', date: DAY }).entry.id, 'e1');
});

await test('history blocks duplicates and counts toward today', () => {
  const { entries, history } = parseQueue(yaml([entry()], [
    { platform: 'pinterest', brand: 'lalabuba', date: '2026-09-01', title: 'A' },
  ]));
  const r = pickEntry({ entries, ledger: withHistory(emptyLedger(), history), account: 'pinterest:lalabuba', date: DAY });
  assert.match(r.skipped[0].reason, /title already used/);
  const { entries: e2, history: h2 } = parseQueue(yaml([entry()], [
    { platform: 'pinterest', brand: 'lalabuba', date: DAY, title: 'manual' },
  ]));
  assert.equal(pickEntry({ entries: e2, ledger: withHistory(emptyLedger(), h2), account: 'pinterest:lalabuba', date: DAY }).capped, true);
});

await test('dated entries: only on their date, never late; dated beats undated', () => {
  const { entries } = parseQueue(yaml([
    entry({ id: 'u' }),
    entry({ id: 'past', title: 'P', image: '/p.jpg', link: 'https://lalabuba.com/p/', date: '2026-10-01' }),
    entry({ id: 'today', title: 'T', image: '/t.jpg', link: 'https://lalabuba.com/t/', date: DAY }),
    entry({ id: 'future', title: 'F', image: '/f.jpg', link: 'https://lalabuba.com/f/', date: '2026-12-01' }),
  ]));
  const r = pickEntry({ entries, ledger: emptyLedger(), account: 'pinterest:lalabuba', date: DAY });
  assert.equal(r.entry.id, 'today');
  const why = Object.fromEntries(r.skipped.map((s) => [s.id, s.reason]));
  assert.match(why.past, /never posted late/);
  assert.match(why.future, /scheduled for/);
});

await test('empty queue → nothing, no fallback', () => {
  const { entries } = parseQueue('posts: []\n');
  assert.equal(pickEntry({ entries, ledger: emptyLedger(), account: 'pinterest:lalabuba', date: DAY }).entry, null);
});

await test('instagram: JPEG only, carousel bounds, no board', () => {
  const ig = (o) => entry({ id: 'i', platform: 'instagram', board: undefined, link: undefined, ...o });
  assert.match(parseQueue(yaml([ig({ image: '/a.png' })])).errors[0], /JPEG only/);
  assert.match(parseQueue(yaml([ig({ image: undefined, images: ['/a.jpg'] })])).errors[0], /2-10/);
  assert.match(parseQueue(yaml([ig({ board: 'x' })])).errors[0], /no board/);
});

await test('pinterest limits enforced', () => {
  assert.match(parseQueue(yaml([entry({ title: 'x'.repeat(101) })])).errors[0], /title 101 > 100/);
});

await test('AI disclosure: Lalabuba on, Bonifatus off; payload shapes', () => {
  assert.equal(BRANDS.lalabuba.aiDisclosure, true);
  assert.equal(BRANDS.bonifatus.aiDisclosure, false);
  const b = buildPinBody({ boardId: '1', imageUrl: 'u', title: 't', description: 'd', link: 'l', aiDisclosure: true });
  assert.deepEqual(b.ai_disclosures, { values: ['AI_MODIFIED'] });
  assert.deepEqual(b.media_source, { source_type: 'image_url', url: 'u' });
  assert.equal(buildPinBody({ boardId: '1', imageUrl: 'u', aiDisclosure: false }).ai_disclosures, undefined);
  assert.equal(buildContainers({ imageUrls: ['a'], caption: 'c', aiDisclosure: true }).parent.is_ai_generated, true);
  const car = buildContainers({ imageUrls: ['a', 'b'], caption: 'c', aiDisclosure: true });
  assert.equal(car.parent.is_ai_generated, true);
  assert.ok(car.children.every((c) => c.is_ai_generated === undefined));
});

await test('slot is deterministic and inside the window', () => {
  for (const [b, cfg] of Object.entries(BRANDS)) {
    for (let d = 0; d < 60; d++) {
      const date = addDays(DAY, d);
      const s = slotMinute(date, `pinterest:${b}`, cfg.window);
      assert.equal(s, slotMinute(date, `pinterest:${b}`, cfg.window));
      assert.ok(s >= hhmm(cfg.window.start) && s < hhmm(cfg.window.end) - 15, `${b} ${date} ${s}`);
    }
  }
});

await test('berlin date handles DST edge', () => {
  assert.equal(berlinNow(new Date('2026-10-24T22:30:00Z')).date, '2026-10-25'); // CEST, UTC+2
  assert.equal(berlinNow(new Date('2026-12-31T23:30:00Z')).date, '2027-01-01'); // CET, UTC+1
});

await test('redaction masks registered and credential-shaped values', () => {
  registerSecret('supersecretvalue123');
  const s = redact('x supersecretvalue123 access_token=IGAAabcdefghijklmnop Bearer pina_abcdefghijk refresh_token":"pinr_zzzzzzzzzzzz');
  assert.ok(!/supersecret|IGAAabc|pina_abc|pinr_zzz/.test(s), s);
});

await test('token store round-trips encrypted; tamper detected', () => {
  const box = encrypt({ a: 1 });
  assert.ok(!box.includes('"a"'));
  assert.deepEqual(decrypt(box), { a: 1 });
  const t = JSON.parse(box); t.data = Buffer.from('x').toString('base64');
  assert.throws(() => decrypt(JSON.stringify(t)));
});

await test('IG refresh: seeded, refreshed on schedule, persisted, never logged', async () => {
  process.env.IG_LALABUBA_TOKEN = 'IGAAseedtokenvalue0001';
  process.env.IG_LALABUBA_USER_ID = '123';
  const realFetch = globalThis.fetch;
  const logs = [];
  const realLog = console.log; const realErr = console.error;
  console.log = (m) => logs.push(m); console.error = (m) => logs.push(m);
  globalThis.fetch = async (url) => {
    assert.match(String(url), /refresh_access_token/);
    return new Response(JSON.stringify({ access_token: 'IGAArefreshedvalue0002', expires_in: 5184000 }), { status: 200 });
  };
  try {
    const store = { accounts: {} };
    await maintainTokens(store, emptyLedger(), { persist: () => saveTokens(store) });
    const rec = loadTokens().accounts['instagram:lalabuba'];
    assert.equal(rec.accessToken, 'IGAArefreshedvalue0002');
    assert.ok(rec.expiresAt > Date.now() + 59 * 864e5);
    assert.equal(refreshDue('instagram:lalabuba', rec, Date.now()), false);
    assert.equal(refreshDue('instagram:lalabuba', rec, Date.now() + 8 * 864e5), true);
    assert.equal(credentialsFor(store, 'instagram:lalabuba').userId, '123');
    // a NEW seed (Alex rotated the secret) wins over the stored chain
    process.env.IG_LALABUBA_TOKEN = 'IGAAnewseedvalue0003';
    await maintainTokens(store, emptyLedger(), { persist: () => saveTokens(store) });
    assert.equal(store.accounts['instagram:lalabuba'].accessToken, 'IGAArefreshedvalue0002'); // reseeded then refreshed again
    const raw = readFileSync(join(process.env.SOCIAL_DATA_DIR, 'tokens.enc'), 'utf8');
    assert.ok(!raw.includes('IGAA'));
  } finally {
    globalThis.fetch = realFetch; console.log = realLog; console.error = realErr;
    delete process.env.IG_LALABUBA_TOKEN;
  }
  assert.ok(!logs.join('\n').includes('IGAA'), logs.join('\n'));
  assert.ok(logs.some((l) => /refresh OK/.test(l)));
});

await test('pinterest placeholder secret counts as not configured', async () => {
  process.env.PINTEREST_LALABUBA_REFRESH_TOKEN = 'PENDING';
  const store = { accounts: {} };
  await maintainTokens(store, emptyLedger(), { persist: () => {} });
  assert.equal(store.accounts['pinterest:lalabuba'], undefined);
  assert.match(credentialsFor(store, 'pinterest:lalabuba').reason, /not configured/);
  delete process.env.PINTEREST_LALABUBA_REFRESH_TOKEN;
});

await test('the real queue.yaml parses cleanly', () => {
  const { errors, entries, history } = parseQueue(readFileSync(new URL('../queue.yaml', import.meta.url), 'utf8'));
  assert.deepEqual(errors, []);
  assert.ok(entries.length > 0 && history.length > 0);
});

console.log(`\nsocial: ${n} tests passed`);
