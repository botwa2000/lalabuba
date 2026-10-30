-- User feedback & ratings for /admin/stats (writer: api/feedback.js, api/contact.js).
--   picture  — 😍/🙂/😕 rating of one coloring page (1..3), from the completion
--              celebration (web + app); joined to generation_log via image_path
--              so quality can be broken down by provider / difficulty / subject.
--   site     — grown-ups' 1..5 ★ rating of Lalabuba + optional comment
--              (web footer "Rate Lalabuba", app Settings → Send feedback).
--   contact  — a contact-form message (rating NULL); name/email are only in the
--              email to info@, never stored here.
-- Same privacy model as usage_events (lib/usage.js): install_id or daily
-- visitor hash, country code only, deleted with "Delete account", 13 months.
CREATE TABLE IF NOT EXISTS feedback (
  id            BIGSERIAL   PRIMARY KEY,
  ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind          TEXT        NOT NULL,            -- picture | site | contact
  platform      TEXT        NOT NULL,
  app_version   TEXT,
  install_id    UUID,
  visitor_hash  TEXT,
  rating        SMALLINT,
  comment       TEXT,
  image_path    TEXT,
  generation_id BIGINT,
  subject_en    TEXT,
  provider      TEXT,
  difficulty    TEXT,
  lang          TEXT,
  country       TEXT
);
CREATE INDEX IF NOT EXISTS feedback_kind_ts_idx ON feedback (kind, ts DESC);
CREATE INDEX IF NOT EXISTS feedback_install_idx ON feedback (install_id) WHERE install_id IS NOT NULL;
-- One picture rating per rater per picture (re-tapping changes it).
CREATE UNIQUE INDEX IF NOT EXISTS feedback_picture_once_idx
  ON feedback (COALESCE(install_id::text, visitor_hash), image_path) WHERE kind = 'picture';

-- The served image of each successful generation, so a rating can find its row.
ALTER TABLE generation_log ADD COLUMN IF NOT EXISTS image_path TEXT;
CREATE INDEX IF NOT EXISTS generation_log_image_idx ON generation_log (image_path) WHERE image_path IS NOT NULL;
