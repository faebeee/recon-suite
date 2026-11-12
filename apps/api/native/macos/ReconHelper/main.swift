// ReconHelper: macOS helper for Recon Suite's local radio tools.
//
// macOS only reveals WiFi names/BSSIDs (Location permission) and Bluetooth scan results
// (Bluetooth permission) to app bundles that hold the respective privacy permission, which
// command-line tools cannot obtain. The API launches this app via `open` so macOS attributes
// the permissions to it; results are written as JSON to the file given by --output.
//
// Usage:
//   ReconHelper --mode wifi|bluetooth --request-auth --output <file>         ask for permission
//   ReconHelper --mode wifi --output <file> [--interface en0]                WiFi scan
//   ReconHelper --mode bluetooth --output <file> [--duration 8] [--transport both|ble|classic]
// Scan modes never show a permission prompt.

import Foundation

let opts = parseOptions()
switch opts.mode {
case "wifi": runWifi(opts)
case "bluetooth": runBluetooth(opts)
default: write(["error": "unknown mode \(opts.mode)"], to: opts.output)
}
