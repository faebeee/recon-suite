import { Check, Loader2, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { EngagementStatus, FindingCounts } from '@recon/shared';
import { Tag } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export const labelClass =
  'text-[10px] tracking-[0.2em] text-muted-foreground uppercase';

export const textareaClass =
  'w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30';

/** Labeled form field; `htmlFor` must match the control's id. */
export function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** Error messages of a failed API call or a validation message. */
export function ErrorText({ error, id }: { error: unknown; id?: string }) {
  if (!error) return null;
  const messages =
    error instanceof ApiError
      ? error.messages.length
        ? error.messages
        : [error.message]
      : typeof error === 'string'
        ? [error]
        : error instanceof Error
          ? [error.message]
          : ['Something went wrong'];
  return (
    <div id={id} role="alert" className="space-y-0.5 text-xs text-neon-magenta">
      {messages.map((m) => (
        <p key={m}>! {m}</p>
      ))}
    </div>
  );
}

export function StatusTag({ status }: { status: EngagementStatus }) {
  return <Tag tone={status === 'active' ? 'green' : 'muted'}>{status}</Tag>;
}

/** fail/warn counts as tags (nothing when both are zero). */
export function FindingCountTags({ counts }: { counts: FindingCounts }) {
  if (!counts.fail && !counts.warn) {
    return <span className="text-xs text-muted-foreground/60">-</span>;
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {counts.fail > 0 && <Tag tone="magenta">{counts.fail} fail</Tag>}
      {counts.warn > 0 && <Tag tone="yellow">{counts.warn} warn</Tag>}
    </span>
  );
}

/** Comma/whitespace separated tag input -> normalised tag list. */
export function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

/** Icon button that asks for confirmation inline before deleting. */
export function ConfirmDelete({
  label,
  onConfirm,
  pending,
}: {
  /** Accessible name, e.g. "Delete run". */
  label: string;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (pending) {
    return (
      <Button size="icon-sm" variant="ghost" disabled aria-label={label}>
        <Loader2 className="animate-spin" />
      </Button>
    );
  }
  if (!asking) {
    return (
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={label}
        title={label}
        onClick={() => setAsking(true)}
        className="hover:text-neon-magenta"
      >
        <Trash2 />
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] tracking-[0.15em] text-neon-magenta uppercase">
        Delete?
      </span>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Confirm: ${label}`}
        title="Confirm"
        className="text-neon-magenta"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        <Check />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Cancel"
        title="Cancel"
        onClick={() => setAsking(false)}
      >
        <X />
      </Button>
    </span>
  );
}
