-- Seed drawing_config key with empty JSON.
-- The actual defaults live in lib/drawing-config.js (DEFAULTS object).
-- Any overrides stored here are deep-merged on top of DEFAULTS at runtime.
INSERT INTO config (key, value)
VALUES ('drawing_config', '{}')
ON CONFLICT (key) DO NOTHING;
