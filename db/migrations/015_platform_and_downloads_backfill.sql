-- 1. Web beacons that arrived without an Origin header were logged as platform
--    'app'. Real app events always carry an install id; these have none.
UPDATE usage_events SET platform = 'web' WHERE platform = 'app' AND install_id IS NULL;

-- 2. Hand-made QA requests (app version "*-qa") are the team, not users.
UPDATE generation_log SET traffic = 'internal' WHERE app_version LIKE '%-qa';
UPDATE usage_events   SET traffic = 'internal' WHERE app_version LIKE '%-qa';
UPDATE usage_installs SET traffic = 'internal' WHERE first_version LIKE '%-qa';

-- 3. Android downloads from the growth of the public Play install count, for
--    days the importer skipped while the (403-ing) bulk-reports bucket was set.
INSERT INTO store_daily (day, platform, metric, value)
SELECT day, 'android', 'downloads', GREATEST(0, value - prev)
  FROM (SELECT day, value, LAG(value) OVER (ORDER BY day) AS prev
          FROM store_daily WHERE platform = 'android' AND metric = 'installs_public') s
 WHERE prev IS NOT NULL
ON CONFLICT (day, platform, metric) DO NOTHING;
