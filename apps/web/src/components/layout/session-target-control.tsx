import { Crosshair, X } from 'lucide-react';
import { useState } from 'react';
import { setSessionTarget, useSessionTarget } from '@/lib/session-target';
import { cn } from '@/lib/utils';

/**
 * Top-bar control for the session target: shows it, edits it inline (Enter saves, Escape
 * cancels) and clears it. Tool pages prefill it.
 */
export function SessionTargetControl() {
  const target = useSessionTarget();
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    const save = () => {
      setSessionTarget(draft);
      setDraft(null);
    };
    return (
      <form
        // Inline on larger screens; a full-width bar under the top bar on phones.
        className="flex items-center border border-primary bg-background normal-case tracking-normal max-sm:fixed max-sm:inset-x-4 max-sm:top-16 max-sm:z-50 max-sm:h-10 sm:bg-background/80"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Crosshair
          className="ml-2 size-3.5 shrink-0 text-primary"
          aria-hidden
        />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
          onBlur={save}
          placeholder="example.com, 1.1.1.1, https://…"
          aria-label="Session target"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-7 min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 sm:w-56 sm:flex-none"
        />
      </form>
    );
  }

  return (
    <span
      className={cn(
        'flex h-7 min-w-0 shrink-0 items-center border',
        target ? 'border-primary text-primary' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={() => setDraft(target ?? '')}
        className="flex h-full min-w-0 items-center gap-1.5 px-2 hover:text-foreground"
        title={
          target
            ? `Session target: ${target} (click to change)`
            : 'Set a session target that tool pages prefill'
        }
        aria-label={
          target ? `Session target ${target}, change` : 'Set session target'
        }
      >
        <Crosshair className="size-3.5 shrink-0" aria-hidden />
        <span
          // Icon only on small screens; the title/aria-label carry the value.
          className={cn(
            'hidden min-w-0 truncate sm:inline',
            target && 'max-w-48 normal-case tracking-normal',
          )}
        >
          {target ?? 'Target'}
        </span>
      </button>
      {target && (
        // Small screens clear via the edit field (empty it and press Enter).
        <button
          type="button"
          onClick={() => setSessionTarget(null)}
          className="hidden h-full items-center border-l border-current/40 px-1.5 hover:text-neon-magenta sm:flex"
          aria-label="Clear session target"
          title="Clear session target"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}
