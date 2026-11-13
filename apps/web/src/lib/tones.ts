/** Semantic neon tones. Map domain states to a tone, never to raw colors. */
export type Tone = 'cyan' | 'magenta' | 'yellow' | 'green' | 'muted';

export const toneText: Record<Tone, string> = {
  cyan: 'text-neon-cyan',
  magenta: 'text-neon-magenta',
  yellow: 'text-neon-yellow',
  green: 'text-neon-green',
  muted: 'text-muted-foreground',
};

export const toneBorder: Record<Tone, string> = {
  cyan: 'border-neon-cyan/50',
  magenta: 'border-neon-magenta/50',
  yellow: 'border-neon-yellow/50',
  green: 'border-neon-green/50',
  muted: 'border-border',
};

export const toneBg: Record<Tone, string> = {
  cyan: 'bg-neon-cyan',
  magenta: 'bg-neon-magenta',
  yellow: 'bg-neon-yellow',
  green: 'bg-neon-green',
  muted: 'bg-muted-foreground',
};

export const toneSoftBg: Record<Tone, string> = {
  cyan: 'bg-neon-cyan/10',
  magenta: 'bg-neon-magenta/10',
  yellow: 'bg-neon-yellow/10',
  green: 'bg-neon-green/10',
  muted: 'bg-muted',
};

/** Tone per graded finding status (`Finding` from @recon/shared). */
export const FINDING_TONE = {
  pass: 'green',
  warn: 'yellow',
  fail: 'magenta',
  info: 'cyan',
} as const satisfies Record<string, Tone>;

/** Tone for letter grades (A+ ... F). */
export function gradeTone(grade: string): Tone {
  if (grade.startsWith('A')) return 'green';
  if (grade === 'B' || grade === 'C') return 'yellow';
  return 'magenta';
}
