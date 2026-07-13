-- Default runtime configuration values for community features
-- All limits/flags are read from this table at runtime — nothing is hardcoded.

INSERT INTO config (key, value) VALUES
  ('community_enabled',           'true'),
  ('sharing_enabled',             'true'),
  ('leaderboard_enabled',         'true'),
  ('family_enabled',              'true'),
  ('max_shares_per_week',         '5'),
  ('max_artworks_per_device',     '50'),
  ('artwork_ttl_days',            '30'),
  ('leaderboard_size',            '10'),
  ('leaderboard_refresh_minutes', '60'),
  ('stars_per_artwork_max',       '100'),
  ('gallery_page_size',           '20'),
  ('report_auto_hide_threshold',  '3'),
  ('family_code_expiry_days',     '90'),
  ('max_family_members',          '6'),
  ('nickname_min_change_days',    '7'),
  ('max_image_kb',                '900')
ON CONFLICT (key) DO NOTHING;
