#!/bin/sh
set -eu

RUNTIME_DIR="${RUNTIME_DIR:-/usr/share/nebuladash-updater}"
CGI_PATH="${CGI_PATH:-/www/cgi-bin/nebuladash-updater}"
TARGET_LINK="${TARGET_LINK:-/www/nebuladash}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

strip_crlf_file() {
  file="$1"
  if [ -f "$file" ]; then
    tmp="$file.tmp"
    tr -d '\r' < "$file" > "$tmp"
    mv "$tmp" "$file"
  fi
}

mkdir -p "$RUNTIME_DIR" "$RUNTIME_DIR/work" "$RUNTIME_DIR/logs" "$(dirname "$CGI_PATH")"
cp "$SCRIPT_DIR/updater.sh" "$RUNTIME_DIR/updater.sh"
strip_crlf_file "$RUNTIME_DIR/updater.sh"
chmod +x "$RUNTIME_DIR/updater.sh"
cp "$SCRIPT_DIR/nebuladash-updater.cgi" "$CGI_PATH"
strip_crlf_file "$CGI_PATH"
chmod +x "$CGI_PATH"

if [ ! -f "$RUNTIME_DIR/config" ]; then
  if command -v hexdump >/dev/null 2>&1; then
    token="$(dd if=/dev/urandom bs=16 count=1 2>/dev/null | hexdump -v -e '/1 "%02x"')"
  else
    token="$(date +%s)-$(awk 'BEGIN { srand(); printf "%08d", rand() * 100000000 }')"
  fi

  cat > "$RUNTIME_DIR/config" <<EOF
NEBULADASH_TOKEN="$token"
TARGET_LINK="$TARGET_LINK"
PARTITION_A="/www/nebuladash-a"
PARTITION_B="/www/nebuladash-b"
RELEASE_URL="https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip"
WORK_DIR="$RUNTIME_DIR/work"
LOG_DIR="$RUNTIME_DIR/logs"
STATE_FILE="$RUNTIME_DIR/state.json"
EOF
  echo "Generated NebulaDash updater token: $token"
else
  echo "Existing config kept: $RUNTIME_DIR/config"
fi

strip_crlf_file "$RUNTIME_DIR/config"

echo "NebulaDash updater installed."
echo "Endpoint: /cgi-bin/nebuladash-updater"
echo "Target: $TARGET_LINK"
