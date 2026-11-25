import {
  rssiToQuality,
  type BluetoothDevice,
  type BluetoothOutput,
} from '@recon/shared';
import {
  DiscoveryRadar,
  type Discovery,
  type RadarGroup,
} from '@/components/tool';

const GROUPS: RadarGroup[] = [
  { id: 'ble', label: 'Bluetooth LE', tone: 'cyan' },
  { id: 'classic', label: 'Classic', tone: 'yellow' },
  { id: 'unknown', label: 'Unknown', tone: 'muted' },
];

export function bluetoothDiscovery(
  devices: BluetoothDevice[],
  host: string,
): Discovery {
  return {
    center: host,
    groups: GROUPS,
    blips: devices.map((d) => {
      const quality =
        d.quality ?? (d.rssi !== undefined ? rssiToQuality(d.rssi) : undefined);
      return {
        id: d.id,
        label: d.name ?? d.manufacturer ?? d.address ?? d.id,
        group: d.transport,
        tone: d.connected || d.paired ? ('green' as const) : undefined,
        distance: quality === undefined ? 1 : 1 - quality / 100,
        detail: [
          d.manufacturer,
          d.deviceClass,
          d.rssi !== undefined && `${d.rssi} dBm`,
          d.connected ? 'connected' : d.paired ? 'paired' : undefined,
          d.address,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    }),
  };
}

/** Devices around the API host; the closer to the centre, the stronger the signal. */
export function BluetoothRadar({
  data,
  host,
}: {
  data: BluetoothOutput;
  host: string;
}) {
  return (
    <DiscoveryRadar
      {...bluetoothDiscovery(data.devices, host)}
      title="Airspace radar"
      tool="bluetooth"
      distanceHint="Distance from the centre shows signal strength (RSSI): closer is stronger. Devices without RSSI sit on the edge."
    />
  );
}
