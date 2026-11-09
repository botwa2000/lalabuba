-- 017: reclassify a rendering crawler that was counted as people.
--
-- From 2026-11-04 a crawler from SG/US datacenters loaded ~200 pages a night
-- between 19:00 and 21:00 UTC: one page per visitor, every language, no
-- referrer, and a script scroll 2–8 s after load. t.js counted that scroll as
-- "engage", so each visit became `human` (≈90% of the dashboard's users that
-- week). t.js no longer listens to scroll. This moves the rows already logged
-- to `bot`: web visitors whose whole day was a single page view inside that
-- window, with nothing but page_view/app_open/engage/challenge_open and no
-- drawing. A real one-page visitor in that window is reclassified too; at the
-- pre-crawler rate that is ~1–2 a night.
WITH v AS (
  SELECT visitor_hash, (ts AT TIME ZONE 'UTC')::date AS d
    FROM usage_events
   WHERE platform = 'web' AND traffic = 'human' AND install_id IS NULL AND visitor_hash IS NOT NULL
     AND ts >= '2026-11-04' AND ts < '2026-11-11'
   GROUP BY 1, 2
  HAVING count(*) FILTER (WHERE event = 'page_view') = 1
     AND bool_and(event IN ('page_view', 'app_open', 'engage', 'challenge_open'))
     AND bool_and(extract(hour FROM ts AT TIME ZONE 'UTC') IN (19, 20))
)
UPDATE usage_events e SET traffic = 'bot'
  FROM v
 WHERE e.visitor_hash = v.visitor_hash
   AND (e.ts AT TIME ZONE 'UTC')::date = v.d
   AND e.traffic IN ('human', 'unengaged')
   AND NOT EXISTS (SELECT 1 FROM generation_log g WHERE g.visitor_hash = v.visitor_hash);
