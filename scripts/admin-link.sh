#!/usr/bin/env bash
# Runs ON the Hetzner server as root. Prints a one-time /admin sign-in link
# (single use, ≤15 min, 1-hour session) for the first address on the
# ADMIN_EMAILS allowlist. Only someone with root SSH can mint one.
#
#   ssh root@<server> "bash /opt/lalabuba/scripts/admin-link.sh prod [minutes]"
set -euo pipefail
ENV="${1:-prod}"
MIN="${2:-10}"
{ [ "$ENV" = "dev" ] || [ "$ENV" = "prod" ]; } || { echo "env must be dev|prod"; exit 1; }
C="$(docker ps -q -f "name=lalabuba-${ENV}_app" | head -1)"
[ -n "$C" ] || { echo "no running lalabuba-${ENV}_app container"; exit 1; }
docker exec -e LINK_MIN="$MIN" -w /app "$C" node scripts/admin-link.js
