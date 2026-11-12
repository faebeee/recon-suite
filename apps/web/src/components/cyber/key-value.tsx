import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface KeyValueItem {
  label: string;
  value: ReactNode;
}

/** Label/value grid for record-style data. Empty values render as a dim dash. */
export function KeyValueGrid({
  items,
  className,
}: {
  items: KeyValueItem[];
  className?: string;
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            {label}
          </dt>
          <dd className="mt-0.5 text-sm break-words">
            {value === undefined || value === null || value === '' ? (
              <span className="text-muted-foreground/60">-</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
