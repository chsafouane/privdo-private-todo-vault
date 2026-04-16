#!/usr/bin/env bash
# Bumps version across all platform configs.
# Usage: ./scripts/bump-version.sh 1.2.3
set -euo pipefail

VERSION="${1:?Usage: bump-version.sh <semver>}"

# Strip leading 'v' if present
VERSION="${VERSION#v}"

# Validate semver format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: '$VERSION' is not a valid semver (x.y.z)" >&2
  exit 1
fi

MAJOR=$(echo "$VERSION" | cut -d. -f1)
MINOR=$(echo "$VERSION" | cut -d. -f2)
PATCH=$(echo "$VERSION" | cut -d. -f3)
VERSION_CODE=$(( MAJOR * 10000 + MINOR * 100 + PATCH ))

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Cross-platform sed in-place: macOS needs -i '', GNU/Linux needs -i
sedi() {
  if [[ "$OSTYPE" == darwin* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

echo "Bumping all versions to $VERSION (versionCode=$VERSION_CODE)"

# 1. package.json
sedi "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$ROOT/package.json"

# 2. Chrome extension manifest.json
sedi "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$ROOT/chrome_extension/manifest.json"

# 3. Android versionName + versionCode
sedi "s/versionName \".*\"/versionName \"$VERSION\"/" "$ROOT/android/app/build.gradle"
sedi "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$ROOT/android/app/build.gradle"

echo "Done."
