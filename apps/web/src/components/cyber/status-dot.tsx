import { cn } from '@/lib/utils';
import { toneBg, type Tone } from '@/lib/tones';

export function StatusDot({
  tone,
  pulse = false,
}: {
  tone: Tone;
  pulse?: boolean;
}) {
  return (
    <span className="relative inline-flex size-2">
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-60',
            toneBg[tone],
          )}
        />
      )}
      <span
        className={cn('relative inline-flex size-2 rounded-full', toneBg[tone])}
      />
    </span>
  );
}
