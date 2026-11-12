import { useEffect, useState } from 'react';

const DEFAULT_LINES = [
  'initialising probe',
  'routing through relay',
  'awaiting response',
  'decoding payload',
];

/** Animated "terminal" shown while a tool is running. */
export function TerminalLoader({
  label,
  lines = DEFAULT_LINES,
}: {
  label: string;
  lines?: string[];
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, lines.length - 1)),
      700,
    );
    return () => clearInterval(id);
  }, [lines.length]);

  return (
    <div className="space-y-3 py-4" role="status" aria-live="polite">
      <div className="relative h-0.5 overflow-hidden bg-primary/15">
        <div className="absolute inset-y-0 w-1/4 animate-scan bg-primary shadow-[0_0_12px] shadow-primary" />
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {lines.slice(0, step + 1).map((line, i) => (
          <div key={line}>
            <span className="text-neon-green">
              {i < step ? '[ok]' : '[..]'}
            </span>{' '}
            {line}
            {i === step && (
              <span className="ml-1 animate-blink text-primary">_</span>
            )}
          </div>
        ))}
      </div>
      <p className="font-display text-xs tracking-[0.3em] text-primary uppercase text-glow">
        {label}
      </p>
    </div>
  );
}
