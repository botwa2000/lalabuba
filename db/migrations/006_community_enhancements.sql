-- Community engagement enhancements

-- 1. Emoji reactions: add reaction_type column to stars
-- Existing stars will get the default 'heart' reaction type.
ALTER TABLE stars ADD COLUMN IF NOT EXISTS reaction_type VARCHAR(20) NOT NULL DEFAULT 'heart';

-- 2. Per-emoji reaction counts on artworks (summing to star_count for compat)
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS fire_count      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS heart_count     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS laugh_count     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS celebrate_count INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing stars (now all treated as 'heart') → heart_count
UPDATE artworks SET heart_count = star_count WHERE star_count > 0 AND heart_count = 0;

-- 3. Template recoloring chain
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS parent_artwork_id BIGINT REFERENCES artworks(id) ON DELETE SET NULL;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS recolor_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_artworks_parent ON artworks(parent_artwork_id) WHERE parent_artwork_id IS NOT NULL;

-- 4. Notification watermark per profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_community_check_at TIMESTAMPTZ;

-- 5. Weekly themed challenges
CREATE TABLE IF NOT EXISTS weekly_themes (
  id         SERIAL PRIMARY KEY,
  theme_word VARCHAR(100) NOT NULL,
  theme_emoji VARCHAR(20) NOT NULL DEFAULT '🎨',
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weekly_themes_active ON weekly_themes(starts_at, ends_at);

-- 6. Config defaults
INSERT INTO config (key, value) VALUES
  ('reactions_enabled',  'true'),
  ('weekly_theme_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
