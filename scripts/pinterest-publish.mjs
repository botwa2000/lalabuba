#!/usr/bin/env node
/**
 * pinterest-publish.mjs — publish a pin, list boards, or run the one-time OAuth
 * bootstrap, via the Pinterest API v5 (api.pinterest.com).
 *
 * WHY THIS EXISTS
 * ---------------
 * Posting used to mean driving pinterest.com in a live Chrome session. This
 * uses the first-party API instead: Pinterest fetches the image off a public
 * URL (our pins are served under /social/), so nothing is uploaded.
 *
 * Day-to-day posting is done by the `social` service from queue.yaml (see
 * scripts/social/runner.mjs). This CLI is for the OAuth bootstrap, for listing
 * boards, and for inspecting the exact request with --dry-run.
 *
 * REQUIREMENTS (see docs/pinterest-api-setup.md for the walkthrough)
 *   - A Pinterest app with Standard access. On Trial access, created pins are
 *     visible only to their creator — useless for growth.
 *   - PINTEREST_APP_ID / PINTEREST_APP_SECRET (env, or the gitignored repo .env).
 *
 * USAGE
 *   node scripts/pinterest-publish.mjs --auth --brand lalabuba
 *        One-time OAuth in your browser. The refresh token goes straight to the
 *        prod Swarm secret over SSH stdin — it is never printed or written.
 *
 *   node scripts/pinterest-publish.mjs --brand lalabuba --boards
 *
 *   node scripts/pinterest-publish.mjs --brand lalabuba \
 *        --image https://lalabuba.com/social/pins/pin_unicorn.jpg \
 *        --board "Coloring Pages for Kids" --title "..." --description "..." \
 *        --link https://lalabuba.com/en/coloring-pages/unicorn/ --alt "..." [--dry-run]
 *
 * Live publish and --boards need PINTEREST_<BRAND>_ACCESS_TOKEN in the env.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANDS } from './social/config.mjs';
import {
  PIN_LIMITS, buildPinBody, createPin, listBoards, resolveBoardId,
  authorizeUrl, exchangeCode, userAccount,
} from './social/pinterest.mjs';
import { redact, registerSecret } from './social/util.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- arg parsing

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--boards') out.boards = true;
    else if (a === '--auth') out.auth = true;
    else if (a === '--no-ai') out.noAi = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  return out;
}

function die(msg) {
  console.error(`\n  ERROR: ${redact(msg)}\n`);
  process.exit(1);
}

/** Read one KEY from the gitignored repo file, without loading anything else. */
function fileValue(file, key) {
  const p = join(ROOT, file);
  if (!existsSync(p)) return '';
  const line = readFileSync(p, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : '';
}

function setting(key) {
  const v = process.env[key] || fileValue('.env', key);
  if (v) registerSecret(v);
  return v;
}

// ------------------------------------------------------------------ --auth

async function auth(brand) {
  const appId = setting('PINTEREST_APP_ID');
  const appSecret = setting('PINTEREST_APP_SECRET');
  if (!appId || !appSecret) die('Set PINTEREST_APP_ID and PINTEREST_APP_SECRET (env or repo .env) first.');

  const port = 8085;
  const redirectUri = `http://localhost:${port}/`;
  const state = randomBytes(16).toString('hex');

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, redirectUri);
      if (u.pathname !== '/') { res.writeHead(404).end(); return; }
      const ok = u.searchParams.get('state') === state && u.searchParams.get('code');
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(ok ? 'Pinterest authorized. You can close this tab.' : 'Authorization failed (state mismatch or no code).');
      server.close();
      ok ? resolve(u.searchParams.get('code')) : reject(new Error(u.searchParams.get('error_description') || 'state mismatch / no code'));
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`\n  1. Log in to Pinterest as the ${brand.toUpperCase()} profile in your browser.`);
      console.log(`  2. Open this URL and approve:\n\n     ${authorizeUrl({ appId, redirectUri, state })}\n`);
      console.log(`  Waiting for the redirect to ${redirectUri} …`);
    });
  });

  const t = await exchangeCode({ appId, appSecret, code, redirectUri });
  const me = await userAccount(t.accessToken);
  console.log(`\n  Authorized Pinterest account: ${me.username} (${me.account_type || 'account'})`);
  console.log(`  Scopes: ${t.scope}`);
  console.log(`  Refresh token expires: ${t.refreshExpiresAt ? new Date(t.refreshExpiresAt).toISOString() : 'unknown'}`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\n  Store this as PINTEREST_${brand.toUpperCase()}_REFRESH_TOKEN on prod (plus app id/secret)? [y/N] `)).trim();
  rl.close();
  if (answer.toLowerCase() !== 'y') die('Not stored. Nothing was written anywhere.');

  await pushSecret('PINTEREST_APP_ID', appId);
  await pushSecret('PINTEREST_APP_SECRET', appSecret);
  await pushSecret(`PINTEREST_${brand.toUpperCase()}_REFRESH_TOKEN`, t.refreshToken);
  console.log('\n  Done. The social service picks the new seed up on its next start (rotation restarts it).\n');
}

/** Pipe one value to remote-secret.sh over SSH stdin — never argv, never disk. */
function pushSecret(name, value) {
  const host = fileValue('.secrets', 'HETZNER_HOST');
  const user = fileValue('.secrets', 'HETZNER_USER') || 'root';
  const key = fileValue('.secrets', 'HETZNER_SSH_KEY');
  if (!host || !key) die('HETZNER_HOST / HETZNER_SSH_KEY missing from the repo .secrets.');
  return new Promise((resolve, reject) => {
    const p = spawn('ssh', ['-i', key, '-o', 'BatchMode=yes', `${user}@${host}`,
      `bash /opt/lalabuba/scripts/remote-secret.sh prod ${name}`], { stdio: ['pipe', 'inherit', 'inherit'] });
    p.on('error', reject);
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`remote-secret.sh ${name} exited ${c}`))));
    p.stdin.end(value);
  });
}

// ---------------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = BRANDS[args.brand];
  if (!cfg) die(`--brand must be one of: ${Object.keys(BRANDS).join(', ')}`);

  if (args.auth) return auth(args.brand);

  const tokenEnv = `PINTEREST_${args.brand.toUpperCase()}_ACCESS_TOKEN`;
  const token = setting(tokenEnv);

  if (args.boards) {
    if (!token) die(`Export ${tokenEnv} first.`);
    for (const b of await listBoards(token)) console.log(`  ${b.id}  ${b.name}  (${b.privacy})`);
    return;
  }

  for (const k of ['image', 'board', 'title', 'description', 'link']) if (!args[k]) die(`--${k} is required.`);
  if (args.title.length > PIN_LIMITS.title) die(`--title is ${args.title.length} chars; max ${PIN_LIMITS.title}.`);
  if (args.description.length > PIN_LIMITS.description) die(`--description is ${args.description.length} chars; max ${PIN_LIMITS.description}.`);
  if (args.alt && args.alt.length > PIN_LIMITS.alt_text) die(`--alt is ${args.alt.length} chars; max ${PIN_LIMITS.alt_text}.`);

  const aiDisclosure = args.noAi ? false : cfg.aiDisclosure;
  const boardId = token ? await resolveBoardId(token, args.board) : args.board;
  const body = buildPinBody({
    boardId, imageUrl: args.image, title: args.title, description: args.description,
    link: args.link, altText: args.alt, aiDisclosure,
  });

  if (args.dryRun) {
    console.log('\n  --dry-run: this exact request would be sent, nothing published.\n');
    console.log('  POST https://api.pinterest.com/v5/pins');
    console.log(`  Authorization: Bearer ${token ? '«redacted»' : '<PINTEREST access token>'}`);
    console.log('  Content-Type: application/json\n');
    console.log(JSON.stringify(body, null, 2).replace(/^/gm, '  '));
    if (!/^\d+$/.test(String(boardId))) console.log(`\n  (board "${args.board}" is resolved to its numeric id when a token is present)`);
    console.log();
    return;
  }

  if (!token) die(`Export ${tokenEnv} first.`);
  const pin = await createPin(token, body);
  console.log(`\n  PUBLISHED — pin id ${pin.id}\n  https://www.pinterest.com/pin/${pin.id}/\n`);
  console.log('  Remember to log this run in docs/growth-checkin-log.md — NEWEST ENTRY AT THE TOP.\n');
}

main().catch((err) => die(err.message));
