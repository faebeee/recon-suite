import {
  parseBluetoothctl,
  parseHelperBluetooth,
  parsePairedDevices,
  sortDevices,
} from './bluetooth.parsers.js';

describe('macOS helper parser', () => {
  it('maps BLE and Classic devices', () => {
    const out = parseHelperBluetooth({
      authorized: true,
      status: 'authorized',
      devices: [
        {
          id: 'UUID-1',
          transport: 'ble',
          name: 'Watch',
          rssi: -58,
          manufacturerId: 0x004c,
          services: ['180D'],
          connectable: true,
        },
        {
          id: 'aa-bb',
          address: 'aa-bb',
          transport: 'classic',
          name: 'Speaker',
          rssi: -70,
          majorClass: 4,
          paired: true,
          connected: false,
          discovered: true,
        },
      ],
    });
    expect(out[0]).toMatchObject({
      manufacturer: 'Apple',
      quality: 70,
      services: ['180D'],
      discovered: true,
    });
    expect(out[1]).toMatchObject({
      deviceClass: 'Audio/Video',
      paired: true,
      transport: 'classic',
    });
  });
});

describe('macOS paired-devices fallback', () => {
  it('lists connected and not-connected paired devices', () => {
    const out = parsePairedDevices({
      SPBluetoothDataType: [
        {
          device_connected: [
            {
              'Keyboard K1': {
                device_address: 'AA:BB:CC:00:00:01',
                device_minorType: 'Keyboard',
              },
            },
          ],
          device_not_connected: [
            { Headset: { device_address: 'AA:BB:CC:00:00:02' } },
          ],
        },
      ],
    });
    expect(out).toEqual([
      expect.objectContaining({
        name: 'Keyboard K1',
        connected: true,
        paired: true,
        discovered: false,
        deviceClass: 'Keyboard',
      }),
      expect.objectContaining({ name: 'Headset', connected: false }),
    ]);
  });
});

describe('Linux bluetoothctl parser', () => {
  it('parses NEW/CHG lines, colours and RSSI formats', () => {
    const out = parseBluetoothctl(
      [
        'Discovery started',
        '[\x1b[0;92mNEW\x1b[0m] Device 12:34:56:78:9A:BC Fitness Band',
        '[NEW] Device AA:BB:CC:DD:EE:FF AA-BB-CC-DD-EE-FF',
        '[CHG] Device AA:BB:CC:DD:EE:FF RSSI: 0xffffffb5 (-75)',
        '[CHG] Device 12:34:56:78:9A:BC RSSI: -60',
        '[CHG] Device 12:34:56:78:9A:BC ManufacturerData Key: 0x004c',
        '[CHG] Device AA:BB:CC:DD:EE:FF Name: Late Name',
      ].join('\n'),
      'ble',
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      name: 'Fitness Band',
      rssi: -60,
      manufacturer: 'Apple',
      transport: 'ble',
    });
    expect(out[1]).toMatchObject({ name: 'Late Name', rssi: -75 });
  });

  it('sorts strongest discovered devices first', () => {
    const sorted = sortDevices([
      { id: 'a', transport: 'ble', rssi: -80, discovered: true },
      { id: 'b', transport: 'ble', rssi: -40, discovered: true },
      { id: 'c', transport: 'unknown', discovered: false },
    ]);
    expect(sorted.map((d) => d.id)).toEqual(['b', 'a', 'c']);
  });
});
