-- In-app reports of offensive AI-generated pictures (Google Play AI-Generated
-- Content policy). Filed from the coloring screen via
-- POST /api/community/report-content; reviewed via /api/admin/content-reports.
--
-- evidence_file: a private copy under data/reports/ (never served publicly), so
-- the reported picture survives the 7-day /img/c cleanup until it is reviewed.
CREATE TABLE IF NOT EXISTS content_reports (
  id            BIGSERIAL   PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reporter_uuid UUID        NOT NULL,
  subject       TEXT        NOT NULL,
  seed          BIGINT,
  difficulty    TEXT,
  source        TEXT,                    -- custom | card | daily | surprise | explore
  reason        TEXT        NOT NULL,    -- scary | inappropriate | wrong | other
  image_path    TEXT,                    -- the public /img/... path that was reported
  evidence_file TEXT,                    -- filename under data/reports/
  platform      TEXT,
  app_version   TEXT,
  status        TEXT        NOT NULL DEFAULT 'open',  -- open | dismissed | actioned
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT
);
CREATE INDEX IF NOT EXISTS content_reports_status_idx  ON content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_subject_idx ON content_reports (lower(subject));
-- One report per device per picture — repeat taps are idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_dedupe_idx
  ON content_reports (reporter_uuid, subject, COALESCE(seed, 0), COALESCE(image_path, ''));

-- Subjects an admin blocked after reviewing reports. JSON array of normalized
-- subjects; checked by api/generate-image.js on top of the static blocklist.
INSERT INTO config (key, value)
VALUES ('blocked_subjects', '[]')
ON CONFLICT (key) DO NOTHING;
