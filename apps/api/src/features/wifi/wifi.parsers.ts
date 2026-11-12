import {
  bandFromFrequency,
  dbmToQuality,
  type WifiBand,
  type WifiNetwork,
} from '@recon/shared';

// ---------------------------------------------------------------- macOS
// `system_profiler SPAirPortDataType -json` (airport -s no longer exists on macOS 14.4+)

interface SpNetwork {
  _name?: string;
  spairport_network_channel?: string | number;
  spairport_network_phymode?: string;
  spairport_security_mode?: string;
  spairport_signal_noise?: string;
}

interface SpInterface {
  _name?: string;
  spairport_current_network_information?: SpNetwork;
  spairport_airport_other_local_wireless_networks?: SpNetwork[];
}

export interface SystemProfilerJson {
  SPAirPortDataType?: { spairport_airport_interfaces?: SpInterface[] }[];
}

const GHZ_TO_BAND: Record<string, WifiBand> = {
  '2': '2.4 GHz',
  '5': '5 GHz',
  '6': '6 GHz',
};

/** "100 (5GHz, 80MHz)" -> { channel: 100, band: '5 GHz', width: 80 } */
export function parseMacChannel(value: string | number | undefined) {
  const m = /^(\d+)(?:\s*\((\d)GHz(?:,\s*(\d+)MHz)?\))?/.exec(
    String(value ?? ''),
  );
  if (!m) return {};
  return {
    channel: Number(m[1]),
    band: m[2] ? GHZ_TO_BAND[m[2]] : undefined,
    channelWidthMhz: m[3] ? Number(m[3]) : undefined,
  };
}

/** "spairport_security_mode_wpa2_personal" -> "WPA2 Personal" */
export function formatMacSecurity(value: string | undefined): string {
  if (!value) return 'Unknown';
  const mode = value.replace(/^s?pairport_security_mode_/, '');
  if (mode === 'none') return 'Open';
  return mode
    .split('_')
    .map((t) =>
      /^(wpa\d?|wep|owe|sae)$/i.test(t)
        ? t.toUpperCase()
        : t[0]!.toUpperCase() + t.slice(1),
    )
    .join(' ');
}

function parseSignalNoise(value: string | undefined) {
  const m = /(-?\d+)\s*dBm\s*\/\s*(-?\d+)\s*dBm/.exec(value ?? '');
  return m ? { signalDbm: Number(m[1]), noiseDbm: Number(m[2]) } : {};
}

function fromSp(n: SpNetwork, current: boolean): WifiNetwork {
  const ssid = n._name ?? '';
  const signal = parseSignalNoise(n.spairport_signal_noise);
  return {
    ssid,
    hidden: ssid === '',
    ...parseMacChannel(n.spairport_network_channel),
    phyMode: n.spairport_network_phymode,
    security: formatMacSecurity(n.spairport_security_mode),
    ...signal,
    quality:
      signal.signalDbm !== undefined
        ? dbmToQuality(signal.signalDbm)
        : undefined,
    current,
  };
}

export function parseSystemProfiler(json: SystemProfilerJson): {
  interface?: string;
  networks: WifiNetwork[];
} {
  const interfaces = (json.SPAirPortDataType ?? []).flatMap(
    (t) => t.spairport_airport_interfaces ?? [],
  );
  // The WiFi card is the interface that reports nearby networks or a named current network.
  const iface =
    interfaces.find((i) => i.spairport_airport_other_local_wireless_networks) ??
    interfaces.find((i) => i.spairport_current_network_information?._name);
  if (!iface) return { networks: [] };

  const networks: WifiNetwork[] = [];
  const cur = iface.spairport_current_network_information;
  if (cur?._name) networks.push(fromSp(cur, true));
  for (const n of iface.spairport_airport_other_local_wireless_networks ?? []) {
    networks.push(fromSp(n, false));
  }
  return { interface: iface._name, networks };
}

// ---------------------------------------------------------------- Linux
// `nmcli -t -e yes -f IN-USE,SSID,BSSID,CHAN,FREQ,SIGNAL,SECURITY device wifi list`

export const NMCLI_ARGS = [
  '-t',
  '-e',
  'yes',
  '-f',
  'IN-USE,SSID,BSSID,CHAN,FREQ,SIGNAL,SECURITY',
  'device',
  'wifi',
  'list',
];

/** Splits an nmcli terse line on unescaped ':' and unescapes "\:" / "\\". */
export function splitTerse(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '\\' && i + 1 < line.length) {
      cur += line[++i];
    } else if (ch === ':') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

export function parseNmcli(text: string): WifiNetwork[] {
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const [inUse, ssid = '', bssid, chan, freq, signal, security] =
        splitTerse(line);
      const frequencyMhz = Number.parseInt(freq ?? '', 10) || undefined;
      const quality = Number.parseInt(signal ?? '', 10);
      const sec = (security ?? '').trim();
      return {
        ssid,
        hidden: ssid === '',
        bssid: bssid || undefined,
        channel: Number.parseInt(chan ?? '', 10) || undefined,
        frequencyMhz,
        band: frequencyMhz ? bandFromFrequency(frequencyMhz) : undefined,
        security: !sec || sec === '--' ? 'Open' : sec,
        quality: Number.isNaN(quality) ? undefined : quality,
        current: inUse === '*',
      };
    });
}

// ---------------------------------------------------------------- Windows
// `netsh wlan show networks mode=bssid` (English output; other UI languages may not parse)

export const NETSH_ARGS = ['wlan', 'show', 'networks', 'mode=bssid'];

export function parseNetsh(text: string): WifiNetwork[] {
  const networks: WifiNetwork[] = [];
  let ssid = '';
  let security = 'Unknown';
  let bss: WifiNetwork | undefined;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let m: RegExpExecArray | null;
    if ((m = /^SSID \d+\s*:\s*(.*)$/.exec(line))) {
      ssid = m[1]!.trim();
      security = 'Unknown';
      bss = undefined;
    } else if ((m = /^Authentication\s*:\s*(.*)$/.exec(line))) {
      security =
        m[1]!.trim() === 'Open' ? 'Open' : m[1]!.trim().replace('-', ' ');
    } else if ((m = /^BSSID \d+\s*:\s*(.*)$/.exec(line))) {
      bss = {
        ssid,
        hidden: ssid === '',
        bssid: m[1]!.trim(),
        security,
        current: false,
      };
      networks.push(bss);
    } else if (bss && (m = /^Signal\s*:\s*(\d+)%/.exec(line))) {
      bss.quality = Number(m[1]);
    } else if (bss && (m = /^Radio type\s*:\s*(.*)$/.exec(line))) {
      bss.phyMode = m[1]!.trim();
    } else if (bss && (m = /^Band\s*:\s*([\d.]+)\s*GHz/.exec(line))) {
      bss.band = GHZ_TO_BAND[m[1]!.charAt(0)];
    } else if (bss && (m = /^Channel\s*:\s*(\d+)/.exec(line))) {
      bss.channel = Number(m[1]);
    }
  }
  return networks;
}
