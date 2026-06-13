#!/usr/bin/env bash
# Local one-command deploy for Lalabuba (Hetzner).
#   ./scripts/deploy.sh push [msg]   commit + push the current branch
#   ./scripts/deploy.sh dev          deploy dev branch -> dev.lalabuba.com
#   ./scripts/deploy.sh prod         merge dev->main, deploy -> lalabuba.com (confirm)
#   ./scripts/deploy.sh logs [dev|prod]
# Credentials come from .secrets (gitignored). See .secrets.example.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
[ -f "$ROOT/.secrets" ] && . "$ROOT/.secrets"
: "${HETZNER_HOST:?set HETZNER_HOST in .secrets}"
: "${HETZNER_USER:?set HETZNER_USER in .secrets}"
: "${HETZNER_SSH_KEY:?set HETZNER_SSH_KEY in .secrets}"
SK="${HETZNER_SSH_KEY/#\~/$HOME}"
SSH="ssh -i $SK -o StrictHostKeyChecking=accept-new ${HETZNER_USER}@${HETZNER_HOST}"

case "${1:-}" in
  push)
    msg="${2:-update $(date +%F\ %H:%M)}"
    git -C "$ROOT" add -A
    git -C "$ROOT" diff --cached --quiet || git -C "$ROOT" commit -m "$msg"
    git -C "$ROOT" push origin "$(git -C "$ROOT" branch --show-current)"
    ;;
  dev)
    $SSH "bash /opt/lalabuba-dev/scripts/remote-deploy.sh dev"
    ;;
  prod)
    read -r -p "Deploy to PRODUCTION (lalabuba.com)? type 'deploy': " c
    [ "$c" = "deploy" ] || { echo "aborted"; exit 0; }
    git -C "$ROOT" checkout main
    git -C "$ROOT" merge dev --no-edit
    git -C "$ROOT" push origin main
    git -C "$ROOT" checkout dev
    $SSH "bash /opt/lalabuba/scripts/remote-deploy.sh prod"
    ;;
  logs)
    $SSH "docker service logs lalabuba-${2:-dev}_app --tail 60"
    ;;
  *)
    echo "usage: deploy.sh push [msg] | dev | prod | logs [dev|prod]"; exit 1
    ;;
esac
