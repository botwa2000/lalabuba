#!/usr/bin/env bash
# Runs ON the Hetzner server as root. Prints the /admin/stats "Why people stop"
# numbers (30 days) plus Play lifetime installs, without a dashboard login.
# DATABASE_URL is read from the container's Swarm secret inside the container
# and never printed.
#
#   ssh root@<server> "bash /opt/lalabuba/scripts/check-stats.sh prod [7d|30d|90d]"
set -euo pipefail
ENV="${1:-prod}"
RANGE="${2:-30d}"
{ [ "$ENV" = "dev" ] || [ "$ENV" = "prod" ]; } || { echo "env must be dev|prod"; exit 1; }
[[ "$RANGE" =~ ^[0-9]+d$ ]] || { echo "range must look like 30d"; exit 1; }
C="$(docker ps -q -f "name=lalabuba-${ENV}_app" | head -1)"
[ -n "$C" ] || { echo "no running lalabuba-${ENV}_app container"; exit 1; }
docker exec -e STATS_RANGE="$RANGE" -e STATS_ENV="$ENV" -w /app "$C" sh -c '
export DATABASE_URL="$(cat "/run/secrets/lalabuba_${STATS_ENV}_DATABASE_URL")"
node -e "
const s = require(\"./lib/stats\");
s.getStats({ range: process.env.STATS_RANGE }).then((r) => {
  const b = r.behaviour;
  const android = r.store && r.store.reviews && r.store.reviews.perPlatform && r.store.reviews.perPlatform.android;
  console.log(JSON.stringify({
    range: process.env.STATS_RANGE,
    challengeOpens: b.challengeOpens,
    challengeLinks: b.challengeLinks.length,
    bounceTop: b.bounce.slice(0, 5),
    refused: b.refused,
    dropoff: b.dropoff,
    errors: b.errors.slice(0, 6),
    web: b.web,
    playInstallsTotal: android ? android.installsTotal : null,
  }, null, 1));
  process.exit(0);
}).catch((e) => { console.error(\"ERR\", e.message); process.exit(1); });
"' 2>&1 | grep -vE '^(\[|SECURITY: JWT_SECRET unset)'
# (that warning only concerns this one-off exec shell, which loads just the DB
# secret; the app process gets all secrets from docker-entrypoint.sh)
