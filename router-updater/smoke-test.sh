#!/bin/sh
set -eu

# 依赖检查：缺 zip / unzip 时给出明确提示，而不是让脚本半路失败。
missing=""
for tool in zip unzip; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    missing="$missing $tool"
  fi
done

if [ -n "$missing" ]; then
  echo "SKIP: router-updater smoke test needs:$missing" >&2
  echo "      OpenWrt:  opkg update && opkg install zip unzip" >&2
  echo "      Debian:   apt-get install -y zip unzip" >&2
  echo "      Windows:  用 WSL,或装完 zip/unzip 后重跑" >&2
  exit 0
fi

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

mkdir -p "$ROOT/runtime" "$ROOT/www" "$ROOT/source/assets"
printf '<html>NebulaDash</html>' > "$ROOT/source/index.html"
printf '{}' > "$ROOT/source/manifest.webmanifest"
(cd "$ROOT/source" && zip -qr "$ROOT/dist.zip" .)

cat > "$ROOT/runtime/config" <<EOF
NEBULADASH_TOKEN=test-token
TARGET_LINK=$ROOT/www/nebuladash
PARTITION_A=$ROOT/www/nebuladash-a
PARTITION_B=$ROOT/www/nebuladash-b
RELEASE_URL=file://$ROOT/dist.zip
WORK_DIR=$ROOT/runtime/work
LOG_DIR=$ROOT/runtime/logs
STATE_FILE=$ROOT/runtime/state.json
EOF

NEBULADASH_UPDATER_CONFIG="$ROOT/runtime/config" sh router-updater/updater.sh update
test -L "$ROOT/www/nebuladash"
test -f "$ROOT/www/nebuladash/index.html"
test -d "$ROOT/www/nebuladash/assets"

NEBULADASH_UPDATER_CONFIG="$ROOT/runtime/config" sh router-updater/updater.sh status
NEBULADASH_UPDATER_CONFIG="$ROOT/runtime/config" sh router-updater/updater.sh rollback

REQUEST_METHOD=POST QUERY_STRING='action=status' HTTP_X_NEBULADASH_TOKEN=wrong \
  NEBULADASH_UPDATER_CONFIG="$ROOT/runtime/config" \
  NEBULADASH_UPDATER_BIN=router-updater/updater.sh \
  sh router-updater/nebuladash-updater.cgi > "$ROOT/cgi-denied.json"
grep '"ok":false' "$ROOT/cgi-denied.json"
