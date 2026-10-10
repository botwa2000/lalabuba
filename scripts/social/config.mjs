/**
 * Social posting — static configuration.
 *
 * The cadence ceiling lives HERE, as a code constant, on purpose: raising it
 * must be a reviewed code change, never a queue edit or an env var.
 */

/** Hard ceiling: posts per account (brand × platform) per Berlin calendar day. */
export const MAX_POSTS_PER_ACCOUNT_PER_DAY = 1;

/** Every date and posting window is evaluated in this zone. */
export const TIMEZONE = 'Europe/Berlin';

export const PLATFORMS = ['pinterest', 'instagram'];

/**
 * Per brand:
 *   site          — origin that relative `image:` paths in queue.yaml resolve against
 *   window        — daytime posting window, Berlin local time [start, end)
 *   aiDisclosure  — self-disclose AI imagery (Instagram is_ai_generated,
 *                   Pinterest ai_disclosures AI_MODIFIED). Lalabuba art is
 *                   AI-generated → on. Bonifatus pins are PIL-rendered
 *                   infographics → off.
 */
export const BRANDS = {
  lalabuba: {
    site: 'https://lalabuba.com',
    window: { start: '18:00', end: '20:30' },
    aiDisclosure: true,
    instagramHandle: '@lalabuba.ai',
  },
  bonifatus: {
    site: 'https://bonifatus.com',
    window: { start: '19:00', end: '21:00' },
    aiDisclosure: false,
    instagramHandle: '@bonifatus.app',
  },
};

/**
 * Pinterest Trial access creates pins visible only to their creator (sandbox),
 * which is worthless for growth and would burn queue entries. The runner treats
 * Pinterest entries as not-yet-postable until this is flipped — after Pinterest
 * grants Standard access (see docs/pinterest-api-setup.md).
 */
export const PINTEREST_STANDARD_ACCESS = false;

/** Token lifecycle policy. */
export const TOKEN_POLICY = {
  instagramRefreshEveryDays: 7,      // long-lived IG tokens last 60 days
  pinterestRefreshBeforeDays: 10,    // access 30 d, continuous refresh 60 d
  alertWithinDays: 7,                // any credential this close to expiry → email
  retryFailedRefreshHours: 6,
};

/** Env names of the seed credentials (Swarm secrets, prefix stripped by the entrypoint). */
export const SEED_ENV = {
  'instagram:lalabuba': { token: 'IG_LALABUBA_TOKEN', userId: 'IG_LALABUBA_USER_ID' },
  'instagram:bonifatus': { token: 'IG_BONIFATUS_TOKEN', userId: 'IG_BONIFATUS_USER_ID' },
  'pinterest:lalabuba': { refreshToken: 'PINTEREST_LALABUBA_REFRESH_TOKEN' },
  'pinterest:bonifatus': { refreshToken: 'PINTEREST_BONIFATUS_REFRESH_TOKEN' },
};

/** Placeholder value used for Swarm secrets that exist only so the stack deploys. */
export const PLACEHOLDER = 'PENDING';

/** Read a credential env var; placeholder or blank counts as absent. */
export function cred(name) {
  const v = (process.env[name] || '').trim();
  return v && v !== PLACEHOLDER ? v : '';
}

export function accountKey(platform, brand) {
  return `${platform}:${brand}`;
}
