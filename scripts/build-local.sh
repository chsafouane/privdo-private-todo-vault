#!/usr/bin/env bash
# Builds the Chrome/Brave extension locally and cleans up local release artifacts.
# Usage: ./scripts/build-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Cleaning local release folder..."
rm -rf "$ROOT/release"
mkdir -p "$ROOT/release"

echo "==> Building app..."
cd "$ROOT"
npm run build

echo "==> Assembling Chrome extension..."
rm -f "$ROOT/chrome_extension/assets/index-"*.js "$ROOT/chrome_extension/assets/index-"*.css
cp "$ROOT/dist/assets/index-"*.js "$ROOT/chrome_extension/assets/"
cp "$ROOT/dist/assets/index-"*.css "$ROOT/chrome_extension/assets/"

JS=$(basename "$ROOT/dist/assets/index-"*.js)
CSS=$(basename "$ROOT/dist/assets/index-"*.css)

if [[ "$OSTYPE" == darwin* ]]; then
  sed -i '' "s/index-[^\"]*\.js/$JS/" "$ROOT/chrome_extension/index.html"
  sed -i '' "s/index-[^\"]*\.css/$CSS/" "$ROOT/chrome_extension/index.html"
else
  sed -i "s/index-[^\"]*\.js/$JS/" "$ROOT/chrome_extension/index.html"
  sed -i "s/index-[^\"]*\.css/$CSS/" "$ROOT/chrome_extension/index.html"
fi

echo "==> Chrome extension assembled at: $ROOT/chrome_extension"
echo ""
echo "==> Opening Brave extensions page..."
echo "    First time only: click 'Load unpacked' and select: $ROOT/chrome_extension"
echo "    Subsequent builds: just click the reload (↺) button on the Privdo extension card"
open -a "Brave Browser" "brave://extensions" 2>/dev/null || true

echo ""
echo "Done."
