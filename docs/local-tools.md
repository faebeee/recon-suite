# Local tools setup

WiFi Scanner (R-01), Bluetooth Scanner (R-02) and Host Scan (N-02) inspect the surroundings of
the machine that runs the **API**, not the browser's machine. They need real hardware and OS
permissions, so they work best with the API running natively (`pnpm dev`).

They are always enabled. When a tool can't run, it answers 503 with a message that says why. At startup the API also logs
the status of every tool on this host, with a fix for each one that is unavailable or limited.

> Local tools reveal information about the server's location and network (nearby WiFi
> networks, Bluetooth devices, LAN hosts). They can't be turned off, so never share the API.

## Support matrix

| Tool              | macOS                                     | Linux                    | Windows               |
| ----------------- | ----------------------------------------- | ------------------------ | --------------------- |
| WiFi Scanner      | ReconHelper (CoreWLAN)                    | `nmcli` (NetworkManager) | `netsh wlan`          |
| Bluetooth Scanner | ReconHelper (CoreBluetooth + IOBluetooth) | `bluetoothctl` (BlueZ)   | not implemented (503) |
| Host Scan         | `nmap`, root                              | `nmap`, root             | containers only       |

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
- **Bluetooth** is not available; **Host Scan** only through the containers.

## Host Scan

Host Scan runs an `nmap -sn` host sweep. In the [containers](#containers) the API image is built
on Kali and runs nmap as root with `NET_RAW`. Natively the API needs `nmap` (`brew install nmap`,
`sudo apt install nmap`); without root nmap can't send ARP and falls back to TCP probes, so MAC
addresses and hosts without open common ports are missing.

It scans the subnet of one interface. Pick the interface in the UI; the list comes from
`GET /api/tools/host-scan/interfaces`.

## Containers

`pnpm compose:up` builds the API image on Kali (`kalilinux/kali-rolling` with `nmap`, `iproute2`
and `nmcli`), so Host Scan, Network Scan and Nmap Scan run nmap inside the API container itself:
no separate Kali container and no container-engine socket. The API runs as root inside its
container with `NET_RAW`/`NET_ADMIN` (ARP discovery with MAC and vendor).

```sh
pnpm compose:up     # builds and starts api and web
pnpm compose:down
```

By default the API container has no wireless adapter and only its own bridge network:

- **Host Scan** sweeps the compose bridge network, not your LAN. Don't switch the `api` service
  to `network_mode: host` for this: the API would then listen on every host interface instead
  of loopback only. Run the API natively for LAN sweeps.
- **WiFi:** keep the `/run/dbus` volume so `nmcli` reaches the host's NetworkManager over
  D-Bus (Linux hosts; the wireless device stays on the host).
- **Bluetooth** is not available in the container.
