import { CornerDownLeft, Loader2 } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/cyber';

interface TargetFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  placeholder: string;
  error?: string | null;
  label?: string;
  /** Tool-specific options rendered below the input. */
  children?: ReactNode;
}

/** Terminal-prompt style target input with an EXECUTE button. */
export function TargetForm({
  value,
  onChange,
  onSubmit,
  pending,
  placeholder,
  error,
  label = 'Target',
  children,
}: TargetFormProps) {
  const id = useId();
  return (
    <Panel title="Parameters" bodyClassName="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-1.5">
          <label
            htmlFor={id}
            className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase"
          >
            {label}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center border border-input bg-background/60 focus-within:border-primary focus-within:shadow-[0_0_16px_-6px] focus-within:shadow-primary">
              <span
                className="pl-3 text-sm text-neon-magenta select-none"
                aria-hidden
              >
                ❯
              </span>
              <input
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
                className="h-10 w-full min-w-0 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <Button type="submit" disabled={pending} className="h-10 px-5">
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CornerDownLeft />
              )}
              {pending ? 'Running' : 'Execute'}
            </Button>
          </div>
          {error && (
            <p id={`${id}-error`} className="text-xs text-neon-magenta">
              ! {error}
            </p>
          )}
        </div>
        {children && <div className="space-y-3">{children}</div>}
      </form>
    </Panel>
  );
}

/** Labeled row for an option inside TargetForm. */
export function FormOption({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-24 shrink-0 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
