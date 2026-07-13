-- Lalabuba community features schema
-- Run by lib/db.js runMigrations() on boot

CREATE TABLE IF NOT EXISTS db_migrations (
  name        VARCHAR(100) PRIMARY KEY,
  applied_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS families (
  id                SERIAL PRIMARY KEY,
  family_code       CHAR(6) UNIQUE NOT NULL,
  parent_email_hash VARCHAR(64),
  code_active       BOOLEAN DEFAULT TRUE,
  member_count      INTEGER DEFAULT 1,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  device_uuid      VARCHAR(36) PRIMARY KEY,
  nickname         VARCHAR(60),
  avatar_index     SMALLINT DEFAULT 0,
  family_id        INTEGER REFERENCES families(id) ON DELETE SET NULL,
  total_completed  INTEGER DEFAULT 0,
  current_streak   INTEGER DEFAULT 0,
  longest_streak   INTEGER DEFAULT 0,
  last_active_date DATE,
  sharing_enabled  BOOLEAN DEFAULT FALSE,
  nickname_set_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artworks (
  id                BIGSERIAL PRIMARY KEY,
  device_uuid       VARCHAR(36) NOT NULL REFERENCES profiles(device_uuid) ON DELETE CASCADE,
  share_type        VARCHAR(10) NOT NULL DEFAULT 'colored',
  subject           VARCHAR(200),
  difficulty        VARCHAR(10),
  seed              BIGINT,
  image_path        VARCHAR(300) NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  moderation_status VARCHAR(10) DEFAULT 'approved',
  report_count      INTEGER DEFAULT 0,
  star_count        INTEGER DEFAULT 0,
  view_count        INTEGER DEFAULT 0,
  shared_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artworks_shared
  ON artworks(shared_at DESC)
  WHERE moderation_status = 'approved';
CREATE INDEX IF NOT EXISTS idx_artworks_device   ON artworks(device_uuid);
CREATE INDEX IF NOT EXISTS idx_artworks_expires  ON artworks(expires_at);
CREATE INDEX IF NOT EXISTS idx_artworks_type     ON artworks(share_type) WHERE moderation_status = 'approved';

CREATE TABLE IF NOT EXISTS stars (
  artwork_id  BIGINT NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  voter_uuid  VARCHAR(36) NOT NULL,
  voted_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (artwork_id, voter_uuid)
);

CREATE TABLE IF NOT EXISTS reports (
  artwork_id    BIGINT NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  reporter_uuid VARCHAR(36) NOT NULL,
  reported_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (artwork_id, reporter_uuid)
);

CREATE TABLE IF NOT EXISTS leaderboard_cache (
  week_start       DATE NOT NULL,
  rank_position    SMALLINT NOT NULL,
  device_uuid      VARCHAR(36),
  nickname         VARCHAR(60),
  avatar_index     SMALLINT,
  weekly_completed INTEGER NOT NULL,
  weekly_stars     INTEGER DEFAULT 0,
  refreshed_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (week_start, rank_position)
);
