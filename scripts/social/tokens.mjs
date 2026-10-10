/**
 * Social posting — credential lifecycle.
 *
 * The Swarm secret is the SEED. Refreshed tokens live in the encrypted store on
 * the volume. A new seed (Alex re-authorised and rotated the secret) always
 * wins over the stored chain: we compare its hash to the one recorded at seeding.
 *
 * Refresh is SCHEDULED, never lazy-on-401:
 *   Instagram — every 7 days (long-lived token = 60 days).
 *   Pinterest — when the access OR refresh token is within 10 days of expiry.
 * Every outcome is logged; failures retry every 6 h; a credential within 7 days
 * of expiry, or one that has been failing to refresh for 24 h, is emailed.
 */
import { SEED_ENV, TOKEN_POLICY, cred } from './config.mjs';
import * as ig from './instagram.mjs';
import * as pin from './pinterest.mjs';
import { alert } from './alert.mjs';
import { log, logError, registerSecret, sha256 } from './util.mjs';

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;

function seedRecord(account, seed) {
  return account.startsWith('instagram:')
    ? { seedHash: sha256(seed), accessToken: seed, expiresAt: null, refreshedAt: null }
    : { seedHash: sha256(seed), accessToken: null, accessExpiresAt: null, refreshToken: seed, refreshExpiresAt: null, refreshedAt: null };
}

function seedValue(account) {
  const env = SEED_ENV[account];
  return cred(env.token || env.refreshToken);
}

/** Earliest hard expiry of the credential chain, or null if unknown. */
export function expiryOf(rec) {
  if (!rec) return null;
  const c = [rec.expiresAt, rec.accessExpiresAt, rec.refreshExpiresAt].filter(Boolean);
  // A Pinterest access token is re-mintable while the refresh token lives, so
  // the refresh token's expiry is the one that kills posting.
  if (rec.refreshToken !== undefined) return rec.refreshExpiresAt || rec.accessExpiresAt || null;
  return c.length ? Math.min(...c) : null;
}

export function refreshDue(account, rec, now) {
  if (account.startsWith('instagram:')) {
    return !rec.refreshedAt || now - rec.refreshedAt >= TOKEN_POLICY.instagramRefreshEveryDays * DAY;
  }
  const before = TOKEN_POLICY.pinterestRefreshBeforeDays * DAY;
  return !rec.accessToken
    || (rec.accessExpiresAt && rec.accessExpiresAt - now < before)
    || (rec.refreshExpiresAt && rec.refreshExpiresAt - now < before);
}

async function doRefresh(account, rec) {
  if (account.startsWith('instagram:')) {
    const t = await ig.refreshToken(rec.accessToken);
    return { ...rec, accessToken: t.accessToken, expiresAt: t.expiresAt };
  }
  const appId = cred('PINTEREST_APP_ID');
  const appSecret = cred('PINTEREST_APP_SECRET');
  if (!appId || !appSecret) throw new Error('PINTEREST_APP_ID / PINTEREST_APP_SECRET not configured');
  const t = await pin.refreshAccessToken({ appId, appSecret, refreshToken: rec.refreshToken });
  return { ...rec, ...t };
}

/**
 * Bring every configured account's credentials up to date. Mutates `store`
 * and `ledger` (alert throttle). `persist()` is called after each successful
 * refresh — a rotated Pinterest refresh token must hit disk immediately.
 */
export async function maintainTokens(store, ledger, { persist, now = Date.now() } = {}) {
  for (const account of Object.keys(SEED_ENV)) {
    const seed = seedValue(account);
    let rec = store.accounts[account];

    if (seed && (!rec || rec.seedHash !== sha256(seed))) {
      rec = store.accounts[account] = seedRecord(account, seed);
      log(`tokens ${account}: seeded from Swarm secret`);
      persist();
    }
    if (!rec) continue; // platform not configured for this brand yet
    for (const v of [rec.accessToken, rec.refreshToken]) registerSecret(v);

    const retryOk = !rec.lastError || !rec.lastAttemptAt || now - rec.lastAttemptAt >= TOKEN_POLICY.retryFailedRefreshHours * HOUR;
    if (refreshDue(account, rec, now) && retryOk) {
      rec.lastAttemptAt = now;
      try {
        const next = await doRefresh(account, rec);
        Object.assign(rec, next, { refreshedAt: now, lastError: null, firstFailureAt: null });
        log(`tokens ${account}: refresh OK — expires ${new Date(expiryOf(rec)).toISOString()}`);
      } catch (err) {
        rec.lastError = err.message;
        rec.firstFailureAt = rec.firstFailureAt || now;
        logError(`tokens ${account}: refresh FAILED —`, err);
      }
      persist();
    }

    const exp = expiryOf(rec);
    if (exp && exp - now < TOKEN_POLICY.alertWithinDays * DAY) {
      const days = Math.max(0, Math.floor((exp - now) / DAY));
      await alert(ledger, `expiry:${account}`, `${account} token expires in ${days} day(s)`,
        `The ${account} credential expires ${new Date(exp).toISOString()}.\n` +
        `Automatic refresh has not renewed it${rec.lastError ? ` — last error: ${rec.lastError}` : ''}.\n` +
        `When it expires, posting for this account stops.\n\n` +
        `Fix: re-authorise and rotate the seed secret (docs/pinterest-api-setup.md / docs/instagram-api-setup.md).`, { now });
    }
    if (rec.firstFailureAt && now - rec.firstFailureAt >= DAY) {
      await alert(ledger, `refresh:${account}`, `${account} token refresh failing for 24h+`,
        `Refresh for ${account} has failed since ${new Date(rec.firstFailureAt).toISOString()}.\n` +
        `Last error: ${rec.lastError}\nIt retries every ${TOKEN_POLICY.retryFailedRefreshHours} h.`, { now });
    }
  }
}

/** Usable credentials for posting, or { reason } explaining why not. */
export function credentialsFor(store, account) {
  const rec = store.accounts[account];
  if (!rec) return { reason: 'not configured (no seed secret)' };
  if (!rec.accessToken) return { reason: `no access token yet${rec.lastError ? ` — ${rec.lastError}` : ''}` };
  const exp = account.startsWith('instagram:') ? rec.expiresAt : rec.accessExpiresAt;
  if (exp && exp <= Date.now()) return { reason: 'access token expired' };
  const out = { token: rec.accessToken };
  if (account.startsWith('instagram:')) {
    out.userId = cred(SEED_ENV[account].userId);
    if (!out.userId) return { reason: `${SEED_ENV[account].userId} not configured` };
  }
  return out;
}
