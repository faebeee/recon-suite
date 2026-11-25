import type { Tone } from '@/lib/tones';

/** One discovery around the target. */
export interface RadarBlip {
  /** Stable key (also seeds the position when `distance` is set). */
  id: string;
  label: string;
  /** Id of a `RadarGroup`; each group gets its own ring. */
  group: string;
  /**
   * 0 (centre) to 1 (edge). Overrides the group ring, for real distances such as
   * signal strength.
   */
  distance?: number;
  /** Overrides the group tone, e.g. a vulnerable item in a neutral group. */
  tone?: Tone;
  /** One line shown when the blip is selected. */
  detail?: string;
  /** Host, IP or URL offered as pivot when selected. */
  pivot?: string;
  /** Intel View export only: software/service name and version (service note). */
  service?: string;
  version?: string;
}

export interface RadarGroup {
  id: string;
  label: string;
  tone: Tone;
}

export const SIZE = 400;
export const C = SIZE / 2;
export const R_MAX = 172;
/** Empty zone around the centre label. */
export const R_MIN = 38;
export const LABEL_ALL_UP_TO = 12;

/** FNV-1a: stable pseudo-random placement per id. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const clip = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

export interface Placed extends RadarBlip {
  x: number;
  y: number;
  angle: number;
  tone: Tone;
}

/**
 * Places blips: one ring per group, evenly spread around it (staggered when crowded), or
 * at `distance` from the centre on a stable angle.
 */
export function layout(blips: RadarBlip[], groups: RadarGroup[]): Placed[] {
  const active = groups.filter((g) => blips.some((b) => b.group === g.id));
  const band = (R_MAX - R_MIN) / Math.max(active.length, 1);
  return active.flatMap((g, ring) => {
    const members = blips.filter((b) => b.group === g.id);
    const offset = ((hash(g.id) % 360) * Math.PI) / 180;
    const crowded = members.length > 10;
    return members.map((b, k) => {
      let r: number;
      let angle: number;
      if (b.distance !== undefined) {
        const d = Math.min(1, Math.max(0, b.distance));
        r = R_MIN + d * (R_MAX - R_MIN);
        angle = ((hash(b.id) % 3600) / 3600) * 2 * Math.PI;
      } else {
        const stagger = crowded ? ((k % 3) - 1) * band * 0.28 : 0;
        r = R_MIN + band * (ring + 0.5) + stagger;
        angle = offset + (k * 2 * Math.PI) / members.length;
      }
      return {
        ...b,
        tone: b.tone ?? g.tone,
        angle,
        x: C + r * Math.cos(angle),
        y: C + r * Math.sin(angle),
      };
    });
  });
}

/** What a discovery tool shows on the radar and exports to Intel View. */
export interface Discovery {
  center: string;
  blips: RadarBlip[];
  groups: RadarGroup[];
}
