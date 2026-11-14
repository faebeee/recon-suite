import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { toneBorder, toneText, type Tone } from '@/lib/tones';

interface PanelProps {
  title?: ReactNode;
  /** Small code rendered before the title, e.g. "D-01". */
  code?: string;
  actions?: ReactNode;
  tone?: Tone;
  /**
   * The tone is decoration (identity), not meaning: themes may neutralise it
   * through `[data-accent]`. Leave unset for error/warning/success panels.
   */
  accent?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** HUD-style container with corner brackets. The base building block for content. */
export function Panel({
  title,
  code,
  actions,
  tone = 'cyan',
  accent,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <section
      data-slot="panel"
      data-tone={tone}
      data-accent={accent || undefined}
      className={cn(
        'relative border bg-card/70 backdrop-blur-sm',
        toneBorder[tone],
        className,
      )}
    >
      <Corners tone={tone} />
      {(title || actions) && (
        <header
          data-slot="panel-header"
          className="flex items-center justify-between gap-3 border-b border-inherit px-4 py-2"
        >
          <h2 className="flex min-w-0 items-center gap-2 font-display text-xs tracking-[0.2em] uppercase">
            <span className={cn('opacity-70', toneText[tone])}>{'//'}</span>
            {code && <span className={toneText[tone]}>{code}</span>}
            <span className="truncate">{title}</span>
          </h2>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div
        data-slot="panel-body"
        // Lets themes change the default padding without touching flush (p-0) bodies.
        data-flush={/(^|\s)p-0(\s|$)/.test(bodyClassName ?? '') || undefined}
        className={cn('p-4', bodyClassName)}
      >
        {children}
      </div>
    </section>
  );
}

function Corners({ tone }: { tone: Tone }) {
  const base = cn(
    'panel-corner',
    'pointer-events-none absolute size-2.5 border-current',
    toneText[tone],
  );
  return (
    <>
      <span className={cn(base, '-top-px -left-px border-t-2 border-l-2')} />
      <span className={cn(base, '-top-px -right-px border-t-2 border-r-2')} />
      <span className={cn(base, '-bottom-px -left-px border-b-2 border-l-2')} />
      <span
        className={cn(base, '-right-px -bottom-px border-r-2 border-b-2')}
      />
    </>
  );
}
