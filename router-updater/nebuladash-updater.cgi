#!/bin/sh
set -eu

CONFIG="${NEBULADASH_UPDATER_CONFIG:-/usr/share/nebuladash-updater/config}"
UPDATER="${NEBULADASH_UPDATER_BIN:-/usr/share/nebuladash-updater/updater.sh}"

printf 'Content-Type: application/json\r\n\r\n'

if [ ! -f "$CONFIG" ]; then
  printf '{"ok":false,"status":"error","message":"Missing updater config"}\n'
  exit 1
fi

# shellcheck disable=SC1090
. "$CONFIG"

ACTION="$(printf '%s' "${QUERY_STRING:-}" | sed -n 's/^.*action=\([^&]*\).*$/\1/p')"
TOKEN="${HTTP_X_NEBULADASH_TOKEN:-}"

if [ "$TOKEN" != "$NEBULADASH_TOKEN" ]; then
  printf '{"ok":false,"status":"error","message":"Unauthorized updater request"}\n'
  exit 1
fi

case "$ACTION" in
  status | update | rollback)
    NEBULADASH_UPDATER_CONFIG="$CONFIG" "$UPDATER" "$ACTION"
    ;;
  *)
    printf '{"ok":false,"status":"error","message":"Unsupported action"}\n'
    exit 1
    ;;
esac
