#!/bin/sh
set -e

# Load Docker Swarm secrets into the environment, stripping the
# "lalabuba_${APP_ENV}_" prefix. Secrets are mounted read-only at /run/secrets/
# (in-memory tmpfs) and never written elsewhere. APP_ENV is set by the stack file
# (prod|dev).
PREFIX="lalabuba_${APP_ENV}_"

if [ -d /run/secrets ]; then
  for f in /run/secrets/"${PREFIX}"*; do
    [ -e "$f" ] || continue
    name="$(basename "$f")"
    key="${name#"${PREFIX}"}"
    # shellcheck disable=SC2163
    export "$key"="$(cat "$f")"
  done
fi

exec node server.js
