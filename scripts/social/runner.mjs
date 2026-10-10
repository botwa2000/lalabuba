#!/usr/bin/env node
/**
 * Social posting runner — the `social` service in docker-stack.prod.yml.
 *
 * A human chooses and approves every post (queue.yaml, `approved:` stamp).
 * This process only chooses the minute, inside each brand's daytime window.
 *
 *   node scripts/social/runner.mjs               service loop (ticks every 2 min)
 *   node scripts/social/runner.mjs --plan        7-day dry run: what WILL post,
 *        [--days N] [--queue path|url]            what is waiting on approval,
 *                                                 and what is invalid. Sends nothing.
 *
 * Env:
 *   SOCIAL_LIVE=1        actually publish. Anything else = log "would post" only.
 *   SOCIAL_QUEUE_URL     where the queue is read from each tick (prod: raw GitHub
 *                        main, so approving = pushing a commit; no redeploy).
 *                        Unset → the repo's queue.yaml on disk.
 *   SOCIAL_DATA_DIR      ledger, encrypted token store, status, heartbeat.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANDS, PLATFORMS, PINTEREST_STANDARD_ACCESS, accountKey } from './config.mjs';
import { parseQueue, pickEntry, ledgerRow, attemptsOn, withHistory } from './queue.mjs';
import { loadLedger, saveLedger, loadTokens, saveTokens, heartbeat, DATA_DIR } from './store.mjs';
import { maintainTokens, credentialsFor, expiryOf } from './tokens.mjs';
import { alert } from './alert.mjs';
import * as pin from './pinterest.mjs';
import * as ig from './instagram.mjs';
import { berlinNow, slotMinute, hhmm, fmtMinute, addDays, log, logError, sha256 } from './util.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIVE = process.env.SOCIAL_LIVE === '1';
const TICK_MS = 2 * 60 * 1000;
const ACCOUNTS = Object.keys(BRANDS).flatMap((b) => PLATFORMS.map((p) => ({ brand: b, platform: p, account: accountKey(p, b) })));

// --------------------------------------------------------------------- queue

async function readQueue(source) {
  if (/^https:\/\//.test(source)) {
    const res = await fetch(`${source}?nocache=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`queue fetch ${res.status} from ${source}`);
    return res.text();
  }
  return readFileSync(source, 'utf8');
}

const queueSource = (override) => override || process.env.SOCIAL_QUEUE_URL || join(ROOT, 'queue.yaml');

// ------------------------------------------------------------ once-per-day log

const said = new Set();
function once(key, fn) {
  if (said.has(key)) return;
  said.add(key);
  fn();
}

// ------------------------------------------------------------------- publish

/** Public, reachable, right type — the same check Instagram/Pinterest will do. */
async function preflight(entry) {
  for (const u of entry.imageUrls) {
    const res = await fetch(u, { headers: { Range: 'bytes=0-0' } });
    if (!res.ok && res.status !== 206) throw new Error(`${u} returned ${res.status}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('image/')) throw new Error(`${u} is "${ct}", not an image`);
    if (entry.platform === 'instagram' && !/jpe?g/.test(ct)) throw new Error(`${u} is "${ct}" — Instagram accepts JPEG only`);
  }
}

async function publishEntry(entry, creds, markIrreversible) {
  const ai = BRANDS[entry.brand].aiDisclosure;
  if (entry.platform === 'pinterest') {
    const boardId = await pin.resolveBoardId(creds.token, entry.board);
    const body = pin.buildPinBody({
      boardId, imageUrl: entry.imageUrls[0], title: entry.title, description: entry.description,
      link: entry.link, altText: entry.alt, aiDisclosure: ai,
    });
    await markIrreversible();
    const r = await pin.createPin(creds.token, body);
    return { remoteId: r.id, url: `https://www.pinterest.com/pin/${r.id}/` };
  }
  const containers = ig.buildContainers({ imageUrls: entry.imageUrls, caption: entry.description, altText: entry.alt, aiDisclosure: ai });
  const r = await ig.publish({ userId: creds.userId, token: creds.token, containers, onPublishing: markIrreversible });
  return { remoteId: r.id };
}

// ---------------------------------------------------------------------- tick

async function tick() {
  heartbeat();
  const ledger = loadLedger();
  let store;
  try {
    store = loadTokens();
  } catch (err) {
    logError('token store unreadable — reseeding from secrets:', err);
    await alert(ledger, 'tokenstore', 'token store unreadable',
      `tokens.enc could not be decrypted (${err.message}). Reseeding from the Swarm secrets; ` +
      `if a Pinterest refresh token was rotated since, re-run the --auth flow.`);
    store = { accounts: {} };
  }

  // A 'pending' row means the process died mid-attempt: the post may or may not
  // be live. Never guess — block it from reposting and ask a human.
  for (const row of ledger.posts.filter((p) => p.status === 'pending')) {
    row.status = 'uncertain';
    row.error = 'process stopped mid-attempt';
    await alert(ledger, `post-uncertain:${row.entryId}`, `${row.account} post uncertain: ${row.entryId}`,
      `The service stopped while posting ${row.entryId}. Check the profile; if it did NOT go out, ` +
      `set its status to "failed" in ${DATA_DIR}/published.json so it can post on a later day.`);
  }

  await maintainTokens(store, ledger, { persist: () => saveTokens(store) });

  const now = berlinNow();
  writeStatus(store, now);

  let entries;
  let history;
  try {
    const parsed = parseQueue(await readQueue(queueSource()));
    ({ entries, history } = parsed);
    delete ledger.queueFailingSince;
    if (parsed.errors.length) {
      const h = sha256(parsed.errors.join('\n')).slice(0, 12);
      once(`qerr:${h}`, () => parsed.errors.forEach((e) => logError(`queue: ${e}`)));
      await alert(ledger, `queue-invalid:${h}`, `${parsed.errors.length} invalid queue entr${parsed.errors.length > 1 ? 'ies' : 'y'}`,
        `These queue.yaml entries are ignored until fixed:\n\n${parsed.errors.join('\n')}`);
    }
  } catch (err) {
    ledger.queueFailingSince = ledger.queueFailingSince || new Date().toISOString();
    logError('queue unavailable — posting nothing this tick:', err);
    if (Date.now() - Date.parse(ledger.queueFailingSince) > 6 * 3600 * 1000) {
      await alert(ledger, 'queue-fetch', 'queue.yaml unreachable for 6h+', `Last error: ${err.message}`);
    }
    saveLedger(ledger);
    return;
  }

  for (const { brand, platform, account } of ACCOUNTS) {
    const win = BRANDS[brand].window;
    const slot = slotMinute(now.date, account, win);
    if (now.minute < slot || now.minute >= hhmm(win.end)) continue;

    const day = `${now.date}:${account}`;
    const { entry, skipped, capped } = pickEntry({ entries, ledger: withHistory(ledger, history), account, date: now.date });
    if (capped) continue;
    once(`skip:${day}`, () => skipped.forEach((s) => log(`${account}: skipping ${s.id} — ${s.reason}`)));
    if (!entry) { once(`empty:${day}`, () => log(`${account}: nothing approved for ${now.date} — posting nothing`)); continue; }

    if (platform === 'pinterest' && !PINTEREST_STANDARD_ACCESS) {
      once(`tier:${day}`, () => log(`${account}: ${entry.id} waits — Pinterest Standard access not granted yet (config.mjs)`));
      continue;
    }
    const creds = credentialsFor(store, account);
    if (creds.reason) {
      once(`cred:${day}`, () => logError(`${account}: cannot post ${entry.id} — ${creds.reason}`));
      await alert(ledger, `cannot-post:${account}`, `${account} cannot post`, `${entry.id} is approved for today but: ${creds.reason}`);
      continue;
    }
    if (!LIVE) {
      once(`dry:${day}`, () => log(`${account}: DRY (SOCIAL_LIVE≠1) — would post ${entry.id} "${entry.title}" at ${fmtMinute(slot)}`));
      continue;
    }

    // ---- live: one attempt, recorded before anything irreversible happens
    const row = ledgerRow(entry, now.date, 'pending');
    ledger.posts.push(row);
    saveLedger(ledger);
    try {
      await preflight(entry);
      const r = await publishEntry(entry, creds, async () => { row.irreversible = true; saveLedger(ledger); });
      Object.assign(row, { status: 'published', ...r, at: new Date().toISOString() });
      log(`${account}: PUBLISHED ${entry.id} → ${r.remoteId}`);
    } catch (err) {
      const definite = !row.irreversible || (err.status >= 400 && err.status < 500);
      row.status = definite ? 'failed' : 'uncertain';
      row.error = err.message;
      logError(`${account}: ${row.status.toUpperCase()} ${entry.id} —`, err);
      await alert(ledger, `post-${row.status}:${entry.id}`, `${account} post ${row.status}: ${entry.id}`,
        row.status === 'uncertain'
          ? `The publish call for ${entry.id} failed AFTER it was sent — it may or may not be live.\n` +
            `Check the profile. It is blocked from reposting. If it did NOT go out, set its status to ` +
            `"failed" in ${DATA_DIR}/published.json so it can post on a later day.\n\n${err.message}`
          : `${entry.id} did not post (nothing went out). It is retried on the next day.\n\n${err.message}`);
    }
    saveLedger(ledger);
  }
  saveLedger(ledger);
}

/** Non-secret readiness snapshot, readable by --plan run via `docker exec` (no secrets there). */
function writeStatus(store, now) {
  const accounts = {};
  for (const { account } of ACCOUNTS) {
    const rec = store.accounts[account];
    const c = credentialsFor(store, account);
    accounts[account] = {
      ready: !c.reason, reason: c.reason || null,
      expires: rec && expiryOf(rec) ? new Date(expiryOf(rec)).toISOString() : null,
      lastRefresh: rec?.refreshedAt ? new Date(rec.refreshedAt).toISOString() : null,
      lastError: rec?.lastError || null,
    };
  }
  writeFileSync(join(DATA_DIR, 'status.json'),
    `${JSON.stringify({ at: new Date().toISOString(), berlin: now, live: LIVE, pinterestStandardAccess: PINTEREST_STANDARD_ACCESS, accounts }, null, 2)}\n`,
    { mode: 0o600 });
}

// ---------------------------------------------------------------------- plan

async function plan({ days, source }) {
  const { entries, history, errors } = parseQueue(await readQueue(source));
  const ledger = withHistory(loadLedger(), history);
  const sim = { ...ledger, posts: [...ledger.posts] };
  const statusFile = join(DATA_DIR, 'status.json');
  const status = existsSync(statusFile) ? JSON.parse(readFileSync(statusFile, 'utf8')) : null;
  const today = berlinNow();
  const out = [];

  out.push('', `  SOCIAL PLAN — next ${days} days (Berlin)   queue: ${source}`);
  out.push(`  mode: ${status ? (status.live ? 'LIVE' : 'DRY (SOCIAL_LIVE≠1)') : 'local (no service status)'}   ` +
    `Pinterest Standard access: ${PINTEREST_STANDARD_ACCESS ? 'yes' : 'NO — pins wait'}`);
  if (status) {
    out.push('', '  Accounts:');
    for (const [a, s] of Object.entries(status.accounts)) {
      out.push(`    ${a.padEnd(20)} ${s.ready ? 'ready' : `NOT READY — ${s.reason}`}${s.expires ? `   expires ${s.expires.slice(0, 10)}` : ''}`);
    }
  }

  out.push('', '  WILL POST (approved):');
  const before = out.length;
  for (let d = 0; d < days; d++) {
    const date = addDays(today.date, d);
    for (const { brand, platform, account } of ACCOUNTS) {
      const slot = slotMinute(date, account, BRANDS[brand].window);
      if (attemptsOn(sim, account, date) && d === 0) {
        const p = sim.posts.find((x) => x.account === account && x.date === date);
        out.push(`    ${date} ${fmtMinute(slot)}  ${account.padEnd(20)} ${p.status}: ${p.entryId}`);
        continue;
      }
      const { entry } = pickEntry({ entries, ledger: sim, account, date });
      if (!entry) continue;
      const late = d === 0 && today.minute >= hhmm(BRANDS[brand].window.end) ? '  (window already passed today)' : '';
      const wait = platform === 'pinterest' && !PINTEREST_STANDARD_ACCESS ? '  [BLOCKED until Pinterest Standard access]' : '';
      out.push(`    ${date} ${fmtMinute(slot)}  ${account.padEnd(20)} ${entry.id} — "${entry.title}"${wait}${late}`);
      if (!late) sim.posts.push(ledgerRow(entry, date, 'planned'));
    }
  }
  if (out.length === before) out.push('    (nothing approved)');

  const waiting = entries.filter((e) => !e.approvedOk && !ledger.posts.some((p) => p.entryId === e.id && p.status !== 'failed'));
  out.push('', `  WAITING ON YOUR APPROVAL (${waiting.length}):`);
  for (const e of waiting) out.push(`    ${(e.date || 'undated').padEnd(10)}  ${e.account.padEnd(20)} ${e.id} — "${e.title}"`);
  if (!waiting.length) out.push('    (none)');

  if (errors.length) {
    out.push('', `  INVALID — ignored until fixed (${errors.length}):`);
    for (const e of errors) out.push(`    ${e}`);
  }
  out.push('');
  console.log(out.join('\n'));
}

// ---------------------------------------------------------------------- main

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes('--plan')) return plan({ days: Number(arg('--days') || 7), source: queueSource(arg('--queue')) });

  log(`social runner starting — ${LIVE ? 'LIVE' : 'DRY (SOCIAL_LIVE≠1)'}, queue ${queueSource()}, data ${DATA_DIR}`);
  let running = false;
  let stopping = false;
  const run = async () => {
    if (running || stopping) return;
    running = true;
    try { await tick(); } catch (err) { logError('tick failed:', err); } finally { running = false; }
    if (stopping) process.exit(0);
  };
  // Never die mid-publish: finish the in-flight tick first (stack sets a
  // stop_grace_period longer than Instagram's worst-case container wait).
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      log(`${sig} — ${running ? 'finishing current tick, then exiting' : 'exiting'}`);
      stopping = true;
      if (!running) process.exit(0);
    });
  }
  await run();
  setInterval(run, TICK_MS);
}

main().catch((err) => { logError(err); process.exit(1); });
