-- 018: store reviewers and pre-launch robots counted as people.
--
-- Play review / pre-launch devices and Apple App Review often arrive from
-- networks outside APPLE_NET / TEST_LAB_NET, so they were logged `human`.
-- Of the 17 "real" 1.0.25 app installs (2026-11-09 → 11-11), 16 looked like
-- testers. 9 are caught here: 2–5 minute sessions that walked 3–6 UI
-- languages, or iOS sightings before Apple released 1.0.25 (2026-11-10
-- 17:27:53 UTC). Installs that switched language only once stay human on
-- purpose (a family may switch once). lib/usage.js now catches
-- both on the fly (checkLanguageWalk, classifyPrereleaseIos); this backfills.

BEGIN;

-- (A) ≥ 3 distinct UI languages within the install's first hour → test.
CREATE TEMP TABLE tester_ids ON COMMIT DROP AS
SELECT i.install_id, 'test'::text AS cls
  FROM usage_installs i
 WHERE i.platform <> 'web' AND i.traffic IN ('human', 'unengaged')
   AND (SELECT count(DISTINCT e.lang) FROM usage_events e
         WHERE e.install_id = i.install_id AND e.ts < i.first_seen + interval '1 hour') >= 3;

-- (B) iOS 1.0.25 seen before its App Store release → review.
INSERT INTO tester_ids
SELECT install_id, 'review' FROM usage_installs
 WHERE platform = 'ios' AND traffic IN ('human', 'unengaged')
   AND split_part(first_version, '+', 1) = '1.0.25' AND first_seen < '2026-11-10 17:27:53+00'
   AND install_id NOT IN (SELECT install_id FROM tester_ids);

UPDATE usage_events e SET traffic = t.cls FROM tester_ids t
 WHERE e.install_id = t.install_id AND e.traffic IN ('human', 'unengaged');
UPDATE generation_log g SET traffic = t.cls FROM tester_ids t
 WHERE g.install_id = t.install_id AND g.traffic IN ('human', 'unengaged');
UPDATE usage_installs i SET traffic = t.cls FROM tester_ids t
 WHERE i.install_id = t.install_id;

COMMIT;
