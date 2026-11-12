import {
  formatMacSecurity,
  parseMacChannel,
  parseNetsh,
  parseNmcli,
  parseSystemProfiler,
  splitTerse,
} from './wifi.parsers.js';

describe('macOS system_profiler parser', () => {
  it('parses channel strings', () => {
    expect(parseMacChannel('100 (5GHz, 80MHz)')).toEqual({
      channel: 100,
      band: '5 GHz',
      channelWidthMhz: 80,
    });
    expect(parseMacChannel('9 (2GHz, 20MHz)')).toMatchObject({
      channel: 9,
      band: '2.4 GHz',
    });
    expect(parseMacChannel(undefined)).toEqual({});
  });

  it('formats security modes', () => {
    expect(formatMacSecurity('spairport_security_mode_wpa2_personal')).toBe(
      'WPA2 Personal',
    );
    expect(formatMacSecurity('spairport_security_mode_wpa3_transition')).toBe(
      'WPA3 Transition',
    );
    expect(formatMacSecurity('spairport_security_mode_none')).toBe('Open');
  });

  it('merges current and nearby networks of the WiFi interface', () => {
    const out = parseSystemProfiler({
      SPAirPortDataType: [
        {
          spairport_airport_interfaces: [
            {
              _name: 'en0',
              spairport_current_network_information: {
                _name: 'HomeNet',
                spairport_network_channel: '36 (5GHz, 80MHz)',
                spairport_security_mode:
                  'spairport_security_mode_wpa2_personal',
                spairport_signal_noise: '-41 dBm / -88 dBm',
              },
              spairport_airport_other_local_wireless_networks: [
                {
                  _name: 'CafeFree',
                  spairport_network_channel: '6 (2GHz, 20MHz)',
                  spairport_security_mode: 'spairport_security_mode_none',
                },
              ],
            },
            { _name: 'awdl0', spairport_current_network_information: {} },
          ],
        },
      ],
    });
    expect(out.interface).toBe('en0');
    expect(out.networks).toHaveLength(2);
    expect(out.networks[0]).toMatchObject({
      ssid: 'HomeNet',
      current: true,
      signalDbm: -41,
      noiseDbm: -88,
      quality: 100,
    });
    expect(out.networks[1]).toMatchObject({
      ssid: 'CafeFree',
      security: 'Open',
      band: '2.4 GHz',
      current: false,
    });
  });
});

describe('Linux nmcli parser', () => {
  it('splits escaped terse fields', () => {
    expect(splitTerse('*:My\\:Net:AA\\:BB:36')).toEqual([
      '*',
      'My:Net',
      'AA:BB',
      '36',
    ]);
  });

  it('parses networks', () => {
    const out = parseNmcli(
      '*:HomeNet:AA\\:BB\\:CC\\:DD\\:EE\\:FF:36:5180 MHz:78:WPA2 WPA3\n :::6:2437 MHz:30:--\n',
    );
    expect(out[0]).toMatchObject({
      ssid: 'HomeNet',
      bssid: 'AA:BB:CC:DD:EE:FF',
      channel: 36,
      band: '5 GHz',
      quality: 78,
      security: 'WPA2 WPA3',
      current: true,
    });
    expect(out[1]).toMatchObject({
      hidden: true,
      security: 'Open',
      band: '2.4 GHz',
      current: false,
    });
  });
});

describe('Windows netsh parser', () => {
  it('parses one entry per BSSID', () => {
    const out = parseNetsh(`
Interface name : Wi-Fi
There are 1 networks currently visible.

SSID 1 : Office
    Network type            : Infrastructure
    Authentication          : WPA2-Enterprise
    Encryption              : CCMP
    BSSID 1                 : aa:bb:cc:dd:ee:01
         Signal             : 88%
         Radio type         : 802.11ax
         Band               : 5 GHz
         Channel            : 44
    BSSID 2                 : aa:bb:cc:dd:ee:02
         Signal             : 40%
         Band               : 2.4 GHz
         Channel            : 11
`);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      ssid: 'Office',
      security: 'WPA2 Enterprise',
      quality: 88,
      band: '5 GHz',
      channel: 44,
      phyMode: '802.11ax',
    });
    expect(out[1]).toMatchObject({
      bssid: 'aa:bb:cc:dd:ee:02',
      band: '2.4 GHz',
      channel: 11,
    });
  });
});
