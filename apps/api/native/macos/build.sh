#!/usr/bin/env bash
# Builds the ReconHelper app (macOS only) and asks for the permissions it needs:
#   Location  -> unredacted WiFi names/BSSIDs
#   Bluetooth -> BLE + Classic scanning
# Usage: pnpm setup:macos-helper [--no-auth]
set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "ReconHelper is only needed on macOS; skipping." && exit 0
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
APP="$DIR/build/ReconHelper.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp "$DIR/ReconHelper/Info.plist" "$APP/Contents/Info.plist"
swiftc -O -o "$APP/Contents/MacOS/ReconHelper" "$DIR"/ReconHelper/*.swift \
  -framework CoreWLAN -framework CoreLocation -framework CoreBluetooth -framework IOBluetooth
# Ad-hoc signature: macOS ties privacy permissions to the app's identity.
codesign --force --sign - "$APP" >/dev/null
echo "Built $APP"

[[ "${1:-}" == "--no-auth" ]] && exit 0

request() { # mode label settings-anchor
  local out status
  out="$(mktemp -t reconhelper)"
  echo
  echo "Requesting $2 permission: click 'Allow' in the macOS dialog (waits up to 2 min)..."
  open -n -W -a "$APP" --args --mode "$1" --request-auth --output "$out"
  status="$(cat "$out" 2>/dev/null || echo '{}')"
  rm -f "$out"
  echo "$2: $status"
  if [[ "$status" != *'"authorized":true'* ]]; then
    echo "Not authorised. Enable ReconHelper in System Settings > Privacy & Security > $2, then scan again."
    open "x-apple.systempreferences:com.apple.preference.security?$3" || true
  fi
}

request wifi "Location Services" Privacy_LocationServices
request bluetooth "Bluetooth" Privacy_Bluetooth
