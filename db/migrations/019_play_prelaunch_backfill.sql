-- 019: Play pre-launch robots counted as real (US) users.
--
-- After every Play upload Google's pre-launch devices install the build, walk
-- the app and type the review login (appreview@example.com) into every text
-- field, the drawing box included. Their network is often outside
-- TEST_LAB_NET, so 8 of the installs on the alpha-only builds 1.0.27+10087 →
-- 10089 (2026-11-21/22) were logged `human`, and all 44 rows of
-- 🛡 Safety → Latest refusals were that email. The team's own emulator and
-- debug installs were already `internal` (X-Internal header) and stay so.
-- lib/usage.js now catches both on the fly (signal C: login typed as a
-- subject; signal D via store-import play_tracks: a build newer than Play
-- production); this backfills.

BEGIN;

CREATE TEMP TABLE prelaunch_ids ON COMMIT DROP AS
SELECT DISTINCT install_id FROM (
  -- (C) an app install that typed an email address as a drawing subject
  SELECT install_id FROM generation_log
   WHERE platform <> 'web' AND install_id IS NOT NULL
     AND subject_raw ~* '^\s*[^\s@]+@[^\s@]+\.[a-z]{2,}\s*$'
  UNION
  SELECT install_id FROM moderation_events
   WHERE platform <> 'web' AND install_id IS NOT NULL
     AND subject ~* '^\s*[^\s@]+@[^\s@]+\.[a-z]{2,}\s*$'
  UNION
  -- (D) first seen on a build that was only ever on the alpha track
  SELECT install_id FROM usage_installs
   WHERE platform = 'android' AND first_version IN ('1.0.27+10087', '1.0.27+10088', '1.0.27+10089')
) x;

UPDATE usage_events e SET traffic = 'test' FROM prelaunch_ids t
 WHERE e.install_id = t.install_id AND e.traffic IN ('human', 'unengaged');
UPDATE generation_log g SET traffic = 'test' FROM prelaunch_ids t
 WHERE g.install_id = t.install_id AND g.traffic IN ('human', 'unengaged');
UPDATE usage_installs i SET traffic = 'test' FROM prelaunch_ids t
 WHERE i.install_id = t.install_id AND i.traffic IN ('human', 'unengaged');

COMMIT;
