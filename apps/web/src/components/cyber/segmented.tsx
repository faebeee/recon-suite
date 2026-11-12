import { cn } from '@/lib/utils';

interface Option<T extends string | number> {
  value: T;
  label?: string;
}

const chip =
  'cursor-pointer border px-2 py-1 text-[11px] tracking-[0.15em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-ring';
const on = 'border-primary bg-primary/15 text-primary text-glow';
const off =
  'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground';

/** Single-choice chip group. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cn(chip, o.value === value ? on : off)}
          onClick={() => onChange(o.value)}
        >
          {o.label ?? o.value}
        </button>
      ))}
    </div>
  );
}

/** Multi-choice chip group. */
export function ChipToggle<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  const toggle = (v: T) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value.includes(o.value)}
          className={cn(chip, value.includes(o.value) ? on : off)}
          onClick={() => toggle(o.value)}
        >
          {o.label ?? o.value}
        </button>
      ))}
    </div>
  );
}
