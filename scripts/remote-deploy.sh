#!/usr/bin/env bash
# Runs ON the Hetzner server. Pulls the right branch, builds, deploys, health-checks.
# Usage: remote-deploy.sh <dev|prod>
set -euo pipefail

ENV="${1:?usage: remote-deploy.sh <dev|prod>}"
export GIT_SSH_COMMAND="ssh -i /root/.ssh/id_ed25519_lalabuba -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

if [ "$ENV" = "prod" ]; then
  DIR=/opt/lalabuba;     BR=main; STACK=docker-stack.prod.yml; NAME=lalabuba-prod; IMG=lalabuba:prod; PORT=3020
elif [ "$ENV" = "dev" ]; then
  DIR=/opt/lalabuba-dev; BR=dev;  STACK=docker-stack.dev.yml;  NAME=lalabuba-dev;  IMG=lalabuba:dev;  PORT=3021
else
  echo "env must be dev|prod"; exit 1
fi

cd "$DIR"
echo "[0/5] ensure data dirs"; mkdir -p "$DIR/data/images/c" "$DIR/data/images/g"
echo "[1/5] pull origin/$BR"; git fetch -q origin "$BR"; git checkout -f -B "$BR" "origin/$BR"
echo "[2/5] build $IMG";      docker build -t "$IMG" . >/dev/null
echo "[3/5] deploy $NAME";    docker stack deploy -c "$STACK" "$NAME" >/dev/null
echo "[4/5] update service";  docker service update --force --image "$IMG" "${NAME}_app" >/dev/null
echo "[5/5] health check"
# Retry for ~60s instead of a single probe after a fixed sleep — the app needs a
# moment to boot, and /api/health now also fails on malformed secrets. On failure
# roll the service back to the previous (known-good) image instead of leaving the
# broken one live.
ok=0
for _ in $(seq 1 12); do
  sleep 5
  if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null; then ok=1; break; fi
done
if [ "$ok" = "1" ]; then
  echo "OK: $ENV healthy at $(git rev-parse --short HEAD)"
else
  echo "HEALTH CHECK FAILED for $ENV — rolling back to previous image"
  docker service logs "${NAME}_app" --tail 30 || true
  docker service rollback "${NAME}_app" || true
  exit 1
fi
