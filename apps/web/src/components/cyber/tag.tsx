import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { toneBorder, toneSoftBg, toneText, type Tone } from '@/lib/tones';

/** Small uppercase label for states, categories and flags. */
export function Tag({
  tone = 'cyan',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border px-1.5 py-px text-[10px] leading-4 font-semibold tracking-[0.15em] whitespace-nowrap uppercase',
        toneBorder[tone],
        toneSoftBg[tone],
        toneText[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
