import { cn } from '@/lib/utils';
import { toneBg, type Tone } from '@/lib/tones';

/** Segmented horizontal bar, 0-100. */
export function Meter({
  value,
  tone,
  segments = 20,
}: {
  value: number;
  tone: Tone;
  segments?: number;
}) {
  const filled = Math.round(
    (Math.max(0, Math.min(100, value)) / 100) * segments,
  );
  return (
    <div
      className="flex gap-0.5"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-2 flex-1',
            i < filled
              ? cn(toneBg[tone], 'shadow-[0_0_6px] shadow-current')
              : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
}
