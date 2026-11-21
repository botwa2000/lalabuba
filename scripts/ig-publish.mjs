#!/usr/bin/env node
/**
 * ig-publish.mjs — publish images and carousels to Instagram via the
 * Instagram API with Business Login for Instagram (host: graph.instagram.com).
 *
 * WHY THIS EXISTS
 * ---------------
 * `file_upload` is unreliable in automated sessions and the native file picker
 * is sandbox-blocked. This route never uploads a file at all: Instagram cURLs
 * the image off a public URL. Our assets are already public under /social/.
 *
 * REQUIREMENTS (see docs/instagram-api-setup.md for the walkthrough)
 *   - Instagram Professional account (both ours are). NO Facebook Page needed
 *     under the Instagram-Login configuration.
 *   - A Meta app with "Instagram > API setup with Instagram login" added.
 *   - Standard Access is enough while the app only serves our own accounts.
 *     No App Review, no Business Verification.
 *   - A long-lived Instagram User access token (60 days, refreshable).
 *
 * HARD LIMITATION: Instagram accepts **JPEG only**. PNG is rejected.
 * Point this at .jpg URLs, not the .png originals.
 *
 * USAGE
 *   node ig-publish.mjs --account lalabuba \
 *        --image https://lalabuba.com/social/pins/pin_unicorn.jpg \
 *        --caption "..." [--alt "..."] [--dry-run]
 *
 *   node ig-publish.mjs --account bonifatus --carousel \
 *        "https://bonifatus.com/social/so-funktionierts-01.jpg,https://.../02.jpg" \
 *        --caption "..." [--dry-run]
 *
 *   node ig-publish.mjs --account lalabuba --limit      # check 24h publish quota
 *
 * CREDENTIALS — never hardcode. Export before running, or source them from
 * C:\Users\Alexa\OneDrive\Dev\bonifatus-secrets\ per the project convention:
 *   IG_LALABUBA_USER_ID, IG_LALABUBA_TOKEN
 *   IG_BONIFATUS_USER_ID, IG_BONIFATUS_TOKEN
 */

const API_VERSION = process.env.IG_API_VERSION || 'v25.0';
const HOST = 'https://graph.instagram.com';

const ACCOUNTS = {
  lalabuba: { userIdEnv: 'IG_LALABUBA_USER_ID', tokenEnv: 'IG_LALABUBA_TOKEN', handle: '@lalabuba.ai' },
  bonifatus: { userIdEnv: 'IG_BONIFATUS_USER_ID', tokenEnv: 'IG_BONIFATUS_TOKEN', handle: '@bonifatus.app' },
};

// ---------------------------------------------------------------- arg parsing

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--limit') out.limit = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  return out;
}

function die(msg) {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
}

// ------------------------------------------------------------------- helpers

async function api(path, { method = 'GET', token, params = {} } = {}) {
  const url = new URL(`${HOST}/${API_VERSION}/${path}`);
  let body;
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  } else {
    body = JSON.stringify(params);
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const e = json.error || {};
    throw new Error(
      `${res.status} ${method} /${path}\n    ${e.message || text}` +
      (e.error_user_msg ? `\n    ${e.error_user_msg}` : '') +
      (e.code ? `\n    (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : '')
    );
  }
  return json;
}

/** Fail fast on the two mistakes that produce confusing Meta errors. */
async function preflight(urls) {
  for (const u of urls) {
    let res;
    try {
      res = await fetch(u, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    } catch (err) {
      die(`Cannot reach ${u}\n    ${err.message}\n    Instagram fetches this URL itself — it must be public.`);
    }
    if (!res.ok && res.status !== 206) {
      die(`${u} returned ${res.status}.\n    Instagram will get the same. If this redirects to a login page, ` +
          `check the site middleware excludes this path.`);
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('jpeg') && !ct.includes('jpg')) {
      die(`${u}\n    Content-Type is "${ct || 'unknown'}" — Instagram accepts JPEG ONLY.\n` +
          `    PNG is rejected. Deploy .jpg copies and point at those.`);
    }
  }
  console.log(`  preflight OK — ${urls.length} JPEG URL(s) publicly reachable`);
}

async function waitForContainer(id, token, label) {
  // Docs: poll once per minute, no more than 5 minutes. Images finish far faster,
  // so poll quickly at first and back off.
  const delays = [1000, 2000, 3000, 5000, 10000, 15000, 30000, 60000, 60000, 60000];
  for (const ms of delays) {
    const { status_code: status } = await api(id, { token, params: { fields: 'status_code' } });
    if (status === 'FINISHED') return;
    if (status === 'ERROR') throw new Error(`Container ${label} (${id}) failed processing.`);
    if (status === 'EXPIRED') throw new Error(`Container ${label} (${id}) expired before publish.`);
    if (status === 'PUBLISHED') return;
    await new Promise((r) => setTimeout(r, ms));
  }
  throw new Error(`Container ${label} (${id}) never reached FINISHED.`);
}

// ---------------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const acct = ACCOUNTS[args.account];
  if (!acct) die(`--account must be one of: ${Object.keys(ACCOUNTS).join(', ')}`);

  const userId = process.env[acct.userIdEnv];
  const token = process.env[acct.tokenEnv];
  if (!userId || !token) {
    die(`Missing credentials for ${args.account}.\n` +
        `    Export ${acct.userIdEnv} and ${acct.tokenEnv} first.`);
  }

  if (args.limit) {
    const r = await api(`${userId}/content_publishing_limit`, {
      token, params: { fields: 'config,quota_usage' },
    });
    console.log(`\n  ${acct.handle} publishing quota:`);
    console.log(`  ${JSON.stringify(r.data?.[0] ?? r, null, 2)}\n`);
    return;
  }

  if (!args.caption) die('--caption is required.');
  const isCarousel = Boolean(args.carousel);
  if (!isCarousel && !args.image) die('Pass either --image <url> or --carousel <url,url,...>');

  const urls = isCarousel
    ? args.carousel.split(',').map((s) => s.trim()).filter(Boolean)
    : [args.image.trim()];

  if (isCarousel && (urls.length < 2 || urls.length > 10)) {
    die(`A carousel needs 2-10 items; got ${urls.length}.`);
  }

  console.log(`\n  Account : ${acct.handle} (${userId})`);
  console.log(`  Type    : ${isCarousel ? `carousel, ${urls.length} slides` : 'single image'}`);
  console.log(`  Caption : ${args.caption.slice(0, 90)}${args.caption.length > 90 ? '…' : ''}`);
  urls.forEach((u, i) => console.log(`  [${String(i + 1).padStart(2)}]    ${u}`));
  console.log();

  await preflight(urls);

  if (args.dryRun) {
    console.log('\n  --dry-run: validated only, nothing published.\n');
    return;
  }

  if (isCarousel) {
    console.log('  creating item containers…');
    const childIds = [];
    for (const [i, image_url] of urls.entries()) {
      const { id } = await api(`${userId}/media`, {
        method: 'POST', token, params: { image_url, is_carousel_item: true },
      });
      console.log(`    slide ${i + 1} → ${id}`);
      childIds.push(id);
    }
    for (const [i, id] of childIds.entries()) await waitForContainer(id, token, `slide ${i + 1}`);

    console.log('  creating carousel container…');
    const { id: parentId } = await api(`${userId}/media`, {
      method: 'POST', token,
      params: { media_type: 'CAROUSEL', children: childIds.join(','), caption: args.caption },
    });
    await waitForContainer(parentId, token, 'carousel');

    console.log('  publishing…');
    const { id: mediaId } = await api(`${userId}/media_publish`, {
      method: 'POST', token, params: { creation_id: parentId },
    });
    console.log(`\n  PUBLISHED — media id ${mediaId}`);
    console.log(`  Note: all slides were cropped to slide 1's aspect ratio.\n`);
  } else {
    console.log('  creating container…');
    const { id: containerId } = await api(`${userId}/media`, {
      method: 'POST', token,
      params: { image_url: urls[0], caption: args.caption, ...(args.alt ? { alt_text: args.alt } : {}) },
    });
    await waitForContainer(containerId, token, 'image');

    console.log('  publishing…');
    const { id: mediaId } = await api(`${userId}/media_publish`, {
      method: 'POST', token, params: { creation_id: containerId },
    });
    console.log(`\n  PUBLISHED — media id ${mediaId}\n`);
  }

  console.log('  Remember to log this run in docs/growth-checkin-log.md — NEWEST ENTRY AT THE TOP.\n');
}

main().catch((err) => {
  console.error(`\n  FAILED: ${err.message}\n`);
  process.exit(1);
});
