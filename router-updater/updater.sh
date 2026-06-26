#!/bin/sh
set -eu

CONFIG="${NEBULADASH_UPDATER_CONFIG:-/usr/share/nebuladash-updater/config}"
ACTION="${1:-status}"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

utc_now() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

respond() {
  ok="$1"
  status="$2"
  message="$(json_escape "${3:-}")"
  active="${4:-}"
  version="${5:-}"
  updated_at="$(utc_now)"
  printf '{"ok":%s,"status":"%s","message":"%s","active":"%s","version":"%s","updatedAt":"%s"}\n' \
    "$ok" "$status" "$message" "$active" "$version" "$updated_at"
}

load_config() {
  if [ ! -f "$CONFIG" ]; then
    respond false error "Missing updater config: $CONFIG" "" ""
    exit 1
  fi

  # shellcheck disable=SC1090
  . "$CONFIG"
  mkdir -p "$WORK_DIR" "$LOG_DIR"
}

validate_release_url() {
  case "$RELEASE_URL" in
    https://github.com/boostemotion/nebuladash/releases/*/download/*.zip | file://*) ;;
    *)
      respond false error "Refusing non-NebulaDash release URL" "$(active_partition)" ""
      exit 1
      ;;
  esac
}

active_partition() {
  target="$(readlink "$TARGET_LINK" 2>/dev/null || true)"
  case "$target" in
    "$PARTITION_A") printf 'a' ;;
    "$PARTITION_B") printf 'b' ;;
    *) printf '' ;;
  esac
}

partition_path() {
  case "$1" in
    a) printf '%s' "$PARTITION_A" ;;
    b) printf '%s' "$PARTITION_B" ;;
    *) printf '' ;;
  esac
}

inactive_partition_name() {
  active="$(active_partition)"
  if [ "$active" = "a" ]; then
    printf 'b'
  else
    printf 'a'
  fi
}

inactive_partition_path() {
  partition_path "$(inactive_partition_name)"
}

download_release() {
  zip_path="$WORK_DIR/dist.zip"
  rm -f "$zip_path"

  case "$RELEASE_URL" in
    file://*) cp "${RELEASE_URL#file://}" "$zip_path" ;;
    *)
      if command -v curl >/dev/null 2>&1; then
        curl -L --fail -o "$zip_path" "$RELEASE_URL"
      else
        wget -O "$zip_path" "$RELEASE_URL"
      fi
      ;;
  esac

  printf '%s' "$zip_path"
}

verify_partition() {
  partition="$1"
  test -f "$partition/index.html"
  test -d "$partition/assets"
  test -f "$partition/manifest.webmanifest"
}

write_state() {
  active="$1"
  status="$2"
  message="$(json_escape "$3")"
  updated_at="$(utc_now)"
  printf '{"ok":true,"status":"%s","message":"%s","active":"%s","version":"","updatedAt":"%s"}\n' \
    "$status" "$message" "$active" "$updated_at" > "$STATE_FILE"
}

do_status() {
  active="$(active_partition)"
  if [ -f "$STATE_FILE" ]; then
    cat "$STATE_FILE"
  else
    respond true idle "No update has run yet" "$active" ""
  fi
}

do_update() {
  validate_release_url
  inactive_name="$(inactive_partition_name)"
  inactive_path="$(inactive_partition_path)"
  zip_path="$(download_release)"

  rm -rf "$inactive_path"
  mkdir -p "$inactive_path"
  unzip -oq "$zip_path" -d "$inactive_path"
  verify_partition "$inactive_path"
  ln -sfn "$inactive_path" "$TARGET_LINK"
  write_state "$inactive_name" ok "Updated NebulaDash"
  respond true ok "Updated NebulaDash" "$inactive_name" ""
}

do_rollback() {
  active="$(active_partition)"
  if [ "$active" = "a" ] && [ -d "$PARTITION_B" ]; then
    ln -sfn "$PARTITION_B" "$TARGET_LINK"
    write_state b ok "Rolled back to partition b"
    respond true ok "Rolled back to partition b" b ""
    exit 0
  fi

  if [ "$active" = "b" ] && [ -d "$PARTITION_A" ]; then
    ln -sfn "$PARTITION_A" "$TARGET_LINK"
    write_state a ok "Rolled back to partition a"
    respond true ok "Rolled back to partition a" a ""
    exit 0
  fi

  respond false error "No rollback partition available" "$active" ""
  exit 1
}

load_config

case "$ACTION" in
  status) do_status ;;
  update) do_update ;;
  rollback) do_rollback ;;
  *)
    respond false error "Unsupported action" "$(active_partition)" ""
    exit 1
    ;;
esac
