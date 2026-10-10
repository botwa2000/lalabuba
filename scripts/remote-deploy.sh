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
echo "[0/6] ensure data dirs"; mkdir -p "$DIR/data/images/c" "$DIR/data/images/g"
# Social runner state (ledger + encrypted tokens): owned by the container's
# `node` user (uid 1000), private to it.
if [ "$ENV" = "prod" ]; then
  mkdir -p "$DIR/data/social"; chown 1000:1000 "$DIR/data/social"; chmod 700 "$DIR/data/social"
fi
echo "[1/6] pull origin/$BR"; git fetch -q origin "$BR"; git checkout -f -B "$BR" "origin/$BR"
# Gate the deploy on the Node test suite — this used to be the actual common
# deploy path (both CI and a direct SSH-triggered deploy end up here) with
# ZERO automated testing, so a broken server-side change (e.g. the 2026-09-20
# HuggingFace-fallback bug) could reach dev/prod on nothing but a health-check
# that only proves the process boots, not that generation actually works.
# The checkout has no node_modules of its own (and .dockerignore keeps it out of
# the image), so install the locked deps first — otherwise any test that needs a
# dependency (e.g. test-request-security.js → jsonwebtoken) fails the gate.
echo "[2/6] npm ci + test";  npm ci --no-audit --no-fund --loglevel=error; npm test
echo "[3/6] build $IMG";      docker build -t "$IMG" . >/dev/null
echo "[4/6] deploy $NAME";    docker stack deploy -c "$STACK" "$NAME" >/dev/null
echo "[5/6] update service";  docker service update --force --image "$IMG" "${NAME}_app" >/dev/null
# Same image tag → `stack deploy` alone would not restart the social runner on
# the new build. --detach: its stop can take up to stop_grace_period while a
# publish finishes; don't hold the app health check hostage to that.
if docker service inspect "${NAME}_social" >/dev/null 2>&1; then
  docker service update --detach --force --image "$IMG" "${NAME}_social" >/dev/null
fi
echo "[6/6] health check"
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
