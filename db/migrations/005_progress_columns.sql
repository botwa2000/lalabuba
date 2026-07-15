-- Per-difficulty progress columns + rich progress sync fields
-- Enables cross-device aggregate progress for logged-in accounts.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS total_generated       INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_colored          INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS easy_completed        INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medium_completed      INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hard_completed        INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extreme_completed     INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_color_uses        INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS numbers_completed     INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_color_completed  INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_text_creations   INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draw_pen_uses         INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves                 INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares                INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS challenges_created    INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_words_completed INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_subjects       INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badges                JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS palettes_used         JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS themes_colored        JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS subjects              JSONB       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_sync_at          TIMESTAMPTZ;
