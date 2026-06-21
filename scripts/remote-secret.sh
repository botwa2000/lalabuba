#!/usr/bin/env bash
# Runs ON the Hetzner server. Create-or-rotate ONE Docker Swarm secret, reading
# the value from STDIN only (never argv → can't leak via `ps`/shell history).
#
#   printf '%s' "$VALUE" | remote-secret.sh <dev|prod> <NAME>
#
# This is the codified replacement for the ad-hoc `docker secret create` typed by
# hand during the Vercel→Hetzner migration — which appended a literal backslash-n
# to TURNSTILE_SECRET_KEY/CF_ACCOUNT_ID and silently broke production. It pipes
# the value with `printf '%s'` (no added bytes) and REFUSES known-corrupt input.
set -euo pipefail

ENV="${1:?usage: remote-secret.sh <dev|prod> <NAME>}"
NAME="${2:?usage: remote-secret.sh <dev|prod> <NAME>}"
{ [ "$ENV" = "dev" ] || [ "$ENV" = "prod" ]; } || { echo "env must be dev|prod"; exit 1; }

VAL="$(cat)"            # command substitution strips trailing REAL newlines
VAL="${VAL%$'\r'}"      # strip a trailing CR (CRLF source)

# ── Validation: refuse exactly the corruption classes that caused the outage ──
case "$VAL" in
  *'\n'*) echo "REFUSE $NAME: value contains a literal backslash-n"; exit 1 ;;
esac
[ -n "$VAL" ] || { echo "REFUSE $NAME: empty value"; exit 1; }
[ "$VAL" = "$(printf '%s' "$VAL" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')" ] \
  || { echo "REFUSE $NAME: leading/trailing whitespace"; exit 1; }
case "$NAME" in
  CF_ACCOUNT_ID)
    printf '%s' "$VAL" | grep -qE '^[0-9a-f]{32}$' \
      || { echo "REFUSE CF_ACCOUNT_ID: not 32 lowercase hex chars"; exit 1; } ;;
  TURNSTILE_SECRET_KEY)
    printf '%s' "$VAL" | grep -qE '^0x[A-Za-z0-9_-]{20,}$' \
      || { echo "REFUSE TURNSTILE_SECRET_KEY: unexpected format"; exit 1; } ;;
esac

SN="lalabuba_${ENV}_${NAME}"
SVC="lalabuba_${ENV}_app"

if docker secret inspect "$SN" >/dev/null 2>&1; then
  # Same-named external secret: detach → remove → recreate → reattach so the
  # stack file's `external` reference keeps working and the fix survives deploys.
  docker service update --secret-rm "$SN" "$SVC" >/dev/null 2>&1 || true
  docker secret rm "$SN" >/dev/null
  printf '%s' "$VAL" | docker secret create "$SN" - >/dev/null
  docker service update --secret-add "source=$SN,target=$SN" "$SVC" >/dev/null 2>&1 || true
  echo "rotated $SN (len ${#VAL})"
else
  printf '%s' "$VAL" | docker secret create "$SN" - >/dev/null
  echo "created $SN (len ${#VAL}) — redeploy to attach"
fi
