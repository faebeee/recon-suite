#!/usr/bin/env bash
# Builds the ReconWifi helper app (macOS only) and asks for Location permission.
# Usage: pnpm --filter @recon/api setup:wifi-macos   [--no-auth]
set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "ReconWifi is only needed on macOS; skipping." && exit 0
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
APP="$DIR/build/ReconWifi.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp "$DIR/ReconWifi/Info.plist" "$APP/Contents/Info.plist"
swiftc -O -o "$APP/Contents/MacOS/ReconWifi" "$DIR/ReconWifi/main.swift" \
  -framework CoreWLAN -framework CoreLocation
# Ad-hoc signature: macOS ties the Location permission to the app's identity.
codesign --force --sign - "$APP" >/dev/null
echo "Built $APP"

if [[ "${1:-}" != "--no-auth" ]]; then
  OUT="$(mktemp -t reconwifi)"
  echo "Requesting Location permission: click 'Allow' in the macOS dialog (waits up to 2 min)..."
  open -n -W -a "$APP" --args --request-auth --output "$OUT"
  STATUS="$(cat "$OUT" 2>/dev/null || echo '{}')"
  rm -f "$OUT"
  echo "Result: $STATUS"
  if [[ "$STATUS" != *'"authorized":true'* ]]; then
    echo "Not authorised. Enable it in System Settings > Privacy & Security > Location Services > ReconWifi,"
    echo "then scan again (no rebuild needed)."
    open "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices" || true
  fi
fi
