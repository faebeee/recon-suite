# Local tools setup

WiFi Scanner (R-01), Bluetooth Scanner (R-02) and Host Scan (N-02) inspect the surroundings of
the machine that runs the **API**, not the browser's machine. They need real hardware and OS
permissions, so they work best with the API running natively (`pnpm dev`).

They are controlled by `LOCAL_TOOLS_ENABLED` (default `true` natively, `false` in containers).
When a tool can't run, it answers 503 with a message that says why. At startup the API also logs
the status of every tool on this host, with a fix for each one that is unavailable or limited.

> Local tools reveal information about the server's location and network (nearby WiFi
> networks, Bluetooth devices, LAN hosts). Disable them on any shared deployment.

## Support matrix

| Tool              | macOS                                     | Linux                             | Windows               |
| ----------------- | ----------------------------------------- | --------------------------------- | --------------------- |
| WiFi Scanner      | ReconHelper (CoreWLAN)                    | `nmcli` (NetworkManager)          | `netsh wlan`          |
| Bluetooth Scanner | ReconHelper (CoreBluetooth + IOBluetooth) | `bluetoothctl` (BlueZ)            | not implemented (503) |
| Host Scan         | `arp-scan`, root                          | `arp-scan`, `cap_net_raw` or root | not available         |

## macOS

macOS only gives WiFi names/BSSIDs (Location Services) and Bluetooth scan results (Bluetooth
permission) to app bundles that hold those permissions; command-line tools can't get them.
Recon Suite ships a small Swift helper app for this, `ReconHelper`
(`apps/api/native/macos`).

Run once:

```sh
pnpm setup:macos-helper
```

It builds the helper and asks for **Location** and then **Bluetooth** access. Click **Allow**
both times. The location itself is never read; the permission only unlocks network names.

Without the helper the tools degrade instead of failing: WiFi falls back to
`system_profiler` with redacted names, Bluetooth lists only paired devices. The UI shows a
notice with the fix.

Rebuilding the helper changes its ad-hoc signature, so macOS may ask for the permissions again.

On macOS, BLE devices are identified by per-host UUIDs instead of MAC addresses, and the Classic
inquiry only finds devices that are discoverable.

## Linux

- **WiFi:** install NetworkManager (`sudo apt install network-manager`); the API calls `nmcli`.
- **Bluetooth:** install BlueZ; the API runs `bluetoothctl --timeout N scan le|bredr`, one
  transport per run.

## Windows

- **WiFi:** Windows 11 24H2 and later also require Location permission for `netsh wlan show
networks`: _Settings > Privacy & security > Location_, allow desktop apps.
- **Bluetooth** and **Host Scan** are not available.

## Host Scan

Host Scan uses [`arp-scan`](https://github.com/royhills/arp-scan), which needs raw socket
access.

| Platform | Install                                                    | Permission                                                            |
| -------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| macOS    | `brew install arp-scan`                                    | Run the API as root (macOS needs root to open `/dev/bpf*`)            |
| Linux    | `sudo apt install arp-scan` or `sudo dnf install arp-scan` | `sudo setcap cap_net_raw+ep "$(which arp-scan)"` once, or run as root |

It scans the subnet of one interface. Pick the interface in the UI; the list comes from
`GET /api/tools/host-scan/interfaces`.

## Containers

By default the API container has no wireless adapter, no view of the host's NetworkManager
and only its own bridge network, so local tools are off. To enable them on a Linux host:

1. Set `LOCAL_TOOLS_ENABLED=true` in `.env`.
2. In `compose.yaml`, enable host networking for the `api` service (`network_mode: host`).
   This shares the host's network namespace with the container: Host Scan then sees your LAN.
3. Keep the `NET_RAW` / `NET_ADMIN` capabilities and the `/run/dbus` volume for the `api`
   service. `nmcli` reaches the host's NetworkManager over D-Bus; the wireless device stays on
   the host. Docker grants `NET_RAW` by default, Podman does not.

Read the comments in `compose.yaml` before enabling this: host networking removes the network
isolation of the container.
