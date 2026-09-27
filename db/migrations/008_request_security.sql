-- Request security: durable rate limiting + auth-outcome metrics.
--
-- rate_limit_counters: one row per (bucket, key, window). Shared by every server
-- process/replica and survives deploys — replaces the per-process in-memory Maps.
-- `key` is an HMAC of the client identifier (never a raw IP). Rows are pruned
-- after expires_at by lib/rate-limit.js.
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  bucket       TEXT        NOT NULL,
  key          TEXT        NOT NULL,
  window_start BIGINT      NOT NULL,  -- epoch ms of the window start
  count        INTEGER     NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (bucket, key, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limit_counters_expires_idx ON rate_limit_counters (expires_at);

-- request_auth_stats: daily counters of how requests authenticated (web Turnstile,
-- native App Check, unattested native, limits hit). Drives the metric-gated
-- enforcement decision surfaced by GET /api/admin/security.
CREATE TABLE IF NOT EXISTS request_auth_stats (
  day      DATE   NOT NULL,
  category TEXT   NOT NULL,
  count    BIGINT NOT NULL,
  PRIMARY KEY (day, category)
);

-- Runtime overrides for lib/security-config.js DEFAULTS (deep-merged), edited via
-- POST /api/admin/security. Kept separate from the PUBLIC drawing_config.
INSERT INTO config (key, value)
VALUES ('security_config', '{}')
ON CONFLICT (key) DO NOTHING;
