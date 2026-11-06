-- Audit trail of what lib/moderation.js refused. Metadata only: blocked pictures are
-- never stored, and no IP is kept. Deleted after 30 days by lib/usage.js purge() and
-- with the install on "Delete account". Reviewed in /admin/stats, where it tells the
-- owner what the filter is catching and whether it is over-blocking.
CREATE TABLE IF NOT EXISTS moderation_events (
  id          BIGSERIAL   PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stage       TEXT        NOT NULL,   -- prompt | translated | image | upload
  category    TEXT        NOT NULL,   -- sexual | violence | self_harm | drugs | hate | evasion | other | admin
  model       TEXT,
  subject     TEXT,
  subject_en  TEXT,
  platform    TEXT,                   -- web | app
  app_version TEXT,
  install_id  UUID
);
CREATE INDEX IF NOT EXISTS moderation_events_ts_idx ON moderation_events (ts DESC);
CREATE INDEX IF NOT EXISTS moderation_events_install_idx ON moderation_events (install_id);
