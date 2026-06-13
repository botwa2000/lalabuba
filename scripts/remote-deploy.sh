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
echo "[1/5] pull origin/$BR"; git fetch -q origin "$BR"; git checkout -f -B "$BR" "origin/$BR"
echo "[2/5] build $IMG";      docker build -t "$IMG" . >/dev/null
echo "[3/5] deploy $NAME";    docker stack deploy -c "$STACK" "$NAME" >/dev/null
echo "[4/5] update service";  docker service update --force --image "$IMG" "${NAME}_app" >/dev/null
echo "[5/5] health check";    sleep 15
if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null; then
  echo "OK: $ENV healthy at $(git rev-parse --short HEAD)"
else
  echo "HEALTH CHECK FAILED for $ENV"; docker service logs "${NAME}_app" --tail 20; exit 1
fi
