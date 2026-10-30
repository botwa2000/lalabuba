-- First-party usage statistics for the confidential /admin/stats dashboard.
-- Kids app: no IP addresses, no user agents, no advertising IDs, no third-party
-- SDKs. Writers: lib/usage.js (generation_log, usage_events, usage_installs),
-- lib/store-import.js (store_daily, store_reviews). Retention is enforced by
-- usage.purge() (runs daily from server.js).

-- One row per generation attempt that reached api/generate-image.js.
-- subject_raw is what the child typed; it is nulled after 30 days (kids may type
-- names) — subject_en (the translated English subject) is kept for aggregates.
CREATE TABLE IF NOT EXISTS generation_log (
  id           BIGSERIAL   PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform     TEXT        NOT NULL,            -- web | ios | android | app (unknown native)
  app_version  TEXT,
  install_id   UUID,                            -- app install / consented web ID; NULL otherwise
  visitor_hash TEXT,                            -- daily-rotating hash for unconsented web
  subject_raw  TEXT,
  subject_en   TEXT,
  lang         TEXT,
  difficulty   TEXT,
  source       TEXT,                            -- custom | card | daily | surprise | voice | scene | explore | again | challenge
  provider     TEXT,
  latency_ms   INTEGER,
  outcome      TEXT        NOT NULL,            -- ok | fail | unsafe | blocked | rate_limited | budget
  country      TEXT
);
CREATE INDEX IF NOT EXISTS generation_log_ts_idx ON generation_log (ts DESC);
CREATE INDEX IF NOT EXISTS generation_log_platform_ts_idx ON generation_log (platform, ts DESC);

-- Client events from POST /api/t (web beacon + mobile apps).
CREATE TABLE IF NOT EXISTS usage_events (
  id           BIGSERIAL   PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform     TEXT        NOT NULL,
  app_version  TEXT,
  install_id   UUID,
  visitor_hash TEXT,
  event        TEXT        NOT NULL,            -- app_open | page_view | screen_view | complete | save | print | share | ...
  screen       TEXT,                            -- web path or app route template
  props        JSONB,
  lang         TEXT,
  country      TEXT
);
CREATE INDEX IF NOT EXISTS usage_events_ts_idx ON usage_events (ts DESC);
CREATE INDEX IF NOT EXISTS usage_events_event_ts_idx ON usage_events (event, ts DESC);
CREATE INDEX IF NOT EXISTS usage_events_install_ts_idx ON usage_events (install_id, ts) WHERE install_id IS NOT NULL;

-- First sighting of every install / consented web ID — new users, acquisition
-- source and D1/D7 retention cohorts.
CREATE TABLE IF NOT EXISTS usage_installs (
  install_id     UUID        PRIMARY KEY,
  platform       TEXT        NOT NULL,
  first_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_version  TEXT,
  acq_source     TEXT,                          -- utm_source / referrer domain / play referrer source
  acq_medium     TEXT,
  acq_campaign   TEXT,
  country        TEXT
);
CREATE INDEX IF NOT EXISTS usage_installs_first_seen_idx ON usage_installs (first_seen DESC);

-- Random salt per UTC day for the unconsented-web visitor hash. Rows older than
-- 2 days are deleted, after which no hash can be linked back to anything.
CREATE TABLE IF NOT EXISTS usage_salts (
  day  DATE PRIMARY KEY,
  salt TEXT NOT NULL
);

-- Nightly store imports: one value per (day, platform, metric).
-- metrics: downloads, redownloads, updates, active_devices, rating_avg_total,
-- rating_count_total, reviews_written_total, campaign:<name>/source:<name> downloads.
CREATE TABLE IF NOT EXISTS store_daily (
  day      DATE    NOT NULL,
  platform TEXT    NOT NULL,                    -- ios | android
  metric   TEXT    NOT NULL,
  value    NUMERIC NOT NULL,
  PRIMARY KEY (day, platform, metric)
);

-- Individual written store reviews (ASC customerReviews, Play reviews API /
-- bulk reports). Public text written by store users, not by children in-app.
CREATE TABLE IF NOT EXISTS store_reviews (
  platform   TEXT        NOT NULL,
  review_id  TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  rating     SMALLINT    NOT NULL,
  territory  TEXT,
  lang       TEXT,
  title      TEXT,
  body       TEXT,
  app_version TEXT,
  PRIMARY KEY (platform, review_id)
);
CREATE INDEX IF NOT EXISTS store_reviews_created_idx ON store_reviews (created_at DESC);

-- Last run / error per importer, shown in the dashboard health box.
CREATE TABLE IF NOT EXISTS store_import_status (
  source     TEXT PRIMARY KEY,                  -- asc_sales | asc_reviews | asc_ratings | asc_analytics | play_reports | play_reviews
  ran_at     TIMESTAMPTZ NOT NULL,
  ok         BOOLEAN     NOT NULL,
  detail     TEXT
);
