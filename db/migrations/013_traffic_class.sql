-- Traffic class of every usage row, so /admin/stats counts real people only.
--   human      a person: app traffic, or a web visitor who interacted
--   unengaged  web visitor with no interaction yet (tap/scroll/key or a drawing
--              that passed the bot check); upgraded to human when one arrives
--   bot        known crawler / headless browser / navigator.webdriver
--   internal   the team: browsers that signed into /admin, X-Admin-Key scripts,
--              debug/profile/emulator app builds
-- Nothing is deleted: the dashboard filters on traffic = 'human' and shows the
-- other classes as counts under Health.
ALTER TABLE usage_events   ADD COLUMN IF NOT EXISTS traffic TEXT NOT NULL DEFAULT 'human';
ALTER TABLE generation_log ADD COLUMN IF NOT EXISTS traffic TEXT NOT NULL DEFAULT 'human';
ALTER TABLE usage_installs ADD COLUMN IF NOT EXISTS traffic TEXT NOT NULL DEFAULT 'human';

CREATE INDEX IF NOT EXISTS usage_events_unengaged_vh  ON usage_events (visitor_hash) WHERE traffic = 'unengaged';
CREATE INDEX IF NOT EXISTS usage_events_unengaged_iid ON usage_events (install_id)   WHERE traffic = 'unengaged';
CREATE INDEX IF NOT EXISTS usage_events_vh_ts  ON usage_events (visitor_hash, ts);
CREATE INDEX IF NOT EXISTS usage_events_iid_ts ON usage_events (install_id, ts);
CREATE INDEX IF NOT EXISTS generation_log_unengaged  ON generation_log (COALESCE(install_id::text, visitor_hash)) WHERE traffic = 'unengaged';

-- Legacy web rows (recorded before interaction tracking): a visitor-day counts
-- as human only with evidence of a person — two or more page views (a click),
-- or a drawing that got past the bot check. Everything else is unengaged.
WITH vd AS (
  SELECT COALESCE(install_id::text, visitor_hash) AS uid, (ts AT TIME ZONE 'UTC')::date AS d
    FROM usage_events WHERE platform = 'web'
  UNION
  SELECT COALESCE(install_id::text, visitor_hash), (ts AT TIME ZONE 'UTC')::date
    FROM generation_log WHERE platform = 'web'
), engaged AS (
  SELECT vd.uid, vd.d FROM vd
   WHERE (SELECT COUNT(*) FROM usage_events e
           WHERE e.platform = 'web' AND e.event = 'page_view'
             AND COALESCE(e.install_id::text, e.visitor_hash) = vd.uid
             AND (e.ts AT TIME ZONE 'UTC')::date = vd.d) >= 2
      OR EXISTS (SELECT 1 FROM generation_log g
           WHERE g.platform = 'web' AND g.outcome <> 'blocked'
             AND COALESCE(g.install_id::text, g.visitor_hash) = vd.uid
             AND (g.ts AT TIME ZONE 'UTC')::date = vd.d)
)
UPDATE usage_events e SET traffic = 'unengaged'
 WHERE e.platform = 'web' AND e.traffic = 'human'
   AND NOT EXISTS (SELECT 1 FROM engaged x
                    WHERE x.uid = COALESCE(e.install_id::text, e.visitor_hash)
                      AND x.d = (e.ts AT TIME ZONE 'UTC')::date);

UPDATE generation_log g SET traffic = 'unengaged'
 WHERE g.platform = 'web' AND g.traffic = 'human' AND g.outcome = 'blocked'
   AND NOT EXISTS (SELECT 1 FROM usage_events e
                    WHERE e.traffic = 'human'
                      AND COALESCE(e.install_id::text, e.visitor_hash) = COALESCE(g.install_id::text, g.visitor_hash)
                      AND (e.ts AT TIME ZONE 'UTC')::date = (g.ts AT TIME ZONE 'UTC')::date);
