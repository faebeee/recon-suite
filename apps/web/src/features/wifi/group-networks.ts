import type { WifiBand, WifiNetwork } from '@recon/shared';
import type { Tone } from '@/lib/tones';

/** All radios/access points broadcasting one SSID (mesh systems show up as one group). */
export interface WifiGroup {
  key: string;
  ssid: string;
  hidden: boolean;
  redacted: boolean;
  current: boolean;
  security: string;
  bands: WifiBand[];
  bestQuality?: number;
  bestSignalDbm?: number;
  accessPoints: WifiNetwork[];
}

const BAND_ORDER: WifiBand[] = ['2.4 GHz', '5 GHz', '6 GHz'];

export function groupNetworks(networks: WifiNetwork[]): WifiGroup[] {
  const groups = new Map<string, WifiGroup>();
  networks.forEach((n, i) => {
    // Hidden or OS-redacted networks can't be correlated by name: keep each one separate.
    const key =
      n.hidden || n.redacted
        ? `anon-${n.bssid ?? i}`
        : `${n.ssid}|${n.security}`;
    const g =
      groups.get(key) ??
      ({
        key,
        ssid: n.ssid,
        hidden: n.hidden,
        redacted: !!n.redacted,
        current: false,
        security: n.security,
        bands: [],
        accessPoints: [],
      } satisfies WifiGroup);
    g.accessPoints.push(n);
    g.current ||= n.current;
    if (n.band && !g.bands.includes(n.band)) g.bands.push(n.band);
    if (
      n.quality !== undefined &&
      (g.bestQuality === undefined || n.quality > g.bestQuality)
    ) {
      g.bestQuality = n.quality;
      g.bestSignalDbm = n.signalDbm;
    }
    groups.set(key, g);
  });

  return [...groups.values()]
    .map((g) => ({
      ...g,
      bands: [...g.bands].sort(
        (a, b) => BAND_ORDER.indexOf(a) - BAND_ORDER.indexOf(b),
      ),
      accessPoints: [...g.accessPoints].sort(
        (a, b) => (b.quality ?? -1) - (a.quality ?? -1),
      ),
    }))
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        (b.bestQuality ?? -1) - (a.bestQuality ?? -1) ||
        b.accessPoints.length - a.accessPoints.length ||
        a.ssid.localeCompare(b.ssid),
    );
}

/** Open/WEP are critical, WPA(1) weak, WPA2 fine, WPA3/OWE strong. */
export function securityTone(security: string): Tone {
  const s = security.toUpperCase();
  if (s === 'OPEN' || s.includes('WEP')) return 'magenta';
  if (s.includes('WPA3') || s.includes('OWE') || s.includes('SAE'))
    return 'green';
  if (s.includes('WPA2')) return 'cyan';
  if (s.includes('WPA')) return 'yellow';
  return 'muted';
}

export function isInsecure(security: string): boolean {
  return securityTone(security) === 'magenta';
}
