#!/bin/sh
# 构建全部 Release 附件（7 种字体变体 + 更新器）。
# 由 .github/workflows/release.yml 与 auto-release.yml 共用，避免两边各写一份。
set -eu

build_archive() {
  command="$1"
  archive="$2"

  rm -rf dist
  pnpm run "${command}"
  (
    cd dist
    zip -qr "../${archive}" .
  )
}

zip -qr "router-updater.zip" router-updater

build_archive build dist.zip
build_archive build:no-fonts dist-no-fonts.zip
build_archive build:cdn-fonts dist-cdn-fonts.zip
build_archive build:firasans-only dist-firasans-only.zip
build_archive build:misans-only dist-misans-only.zip
build_archive build:pingfang-only dist-pingfang-only.zip
build_archive build:sarasa-only dist-sarasa-only.zip

echo "Release archives ready:"
ls -1 ./*.zip
