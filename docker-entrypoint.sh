#!/bin/sh
set -e

# Load Docker Swarm secrets into the environment, stripping the
# "lalabuba_${APP_ENV}_" prefix. Secrets are mounted read-only at /run/secrets/
# (in-memory tmpfs) and never written elsewhere. APP_ENV is set by the stack file
# (prod|dev).
PREFIX="lalabuba_${APP_ENV}_"

# A trailing carriage return (CRLF source) to strip from values.
CR="$(printf '\r')"

if [ -d /run/secrets ]; then
  for f in /run/secrets/"${PREFIX}"*; do
    [ -e "$f" ] || continue
    name="$(basename "$f")"
    key="${name#"${PREFIX}"}"
    val="$(cat "$f")"   # $(...) already drops real trailing newlines

    # ── Self-heal migration artifacts ───────────────────────────────────────
    # During the Vercel→Hetzner migration some secrets were created with a
    # trailing LITERAL backslash-n (the two characters "\" "n") or a CR. Real
    # newlines are stripped by $(cat) but a literal "\n" is ordinary text and
    # survives — it once broke TURNSTILE_SECRET_KEY and CF_ACCOUNT_ID and every
    # API call that used them. Strip those trailing artifacts and warn loudly so
    # the underlying secret still gets fixed at the source.
    orig="$val"
    val="${val%"$CR"}"
    val="${val%'\n'}"   # single-quoted pattern = literal backslash + n
    val="${val%"$CR"}"
    if [ "$val" != "$orig" ]; then
      echo "WARN: secret '$key' had a trailing CR/\\n artifact — healed at startup (fix the source!)" >&2
    fi

    # Shape validation for known fixed-format secrets (catch corruption early).
    case "$key" in
      CF_ACCOUNT_ID)
        clean="$(printf '%s' "$val" | tr -cd '0-9a-f')"
        if [ "${#clean}" -ne 32 ]; then
          echo "WARN: CF_ACCOUNT_ID is not 32 hex chars (got ${#val}) — Cloudflare tier will fail" >&2
        fi
        val="$clean"
        ;;
    esac

    # shellcheck disable=SC2163
    export "$key"="$val"
  done
fi

exec node server.js
