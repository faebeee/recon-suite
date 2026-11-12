import type { CaaRecord, MxRecord, SoaRecord } from 'node:dns';

export const formatMx = (r: MxRecord[]) =>
  [...r]
    .sort((a, b) => a.priority - b.priority)
    .map((m) => `${m.priority} ${m.exchange || '.'}`);

export const formatTxt = (r: string[][]) => r.map((chunks) => chunks.join(''));

export const formatSoa = (s: SoaRecord) => [
  `${s.nsname} ${s.hostmaster} serial=${s.serial} refresh=${s.refresh} retry=${s.retry} expire=${s.expire} minttl=${s.minttl}`,
];

export const formatCaa = (r: CaaRecord[]) =>
  r.map((c) => {
    const flags = c.critical ?? 0;
    const [tag, value] = Object.entries(c).find(([k]) => k !== 'critical') ?? [
      'unknown',
      '',
    ];
    return `${flags} ${tag} "${String(value)}"`;
  });

/** DNS error codes that simply mean "no records of this type". */
export const EMPTY_CODES = new Set([
  'ENODATA',
  'ENOTFOUND',
  'NOTFOUND',
  'ENOTIMP',
]);
