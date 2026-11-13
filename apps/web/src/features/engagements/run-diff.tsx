import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { RunDiffKind } from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { getTool } from '@/features/registry';
import { formatDateTime } from '@/lib/format';
import type { Tone } from '@/lib/tones';
import { runDiffQuery } from './queries';
import { ErrorText } from './ui';

const KIND_TONE: Record<RunDiffKind, Tone> = {
  added: 'green',
  removed: 'magenta',
  changed: 'yellow',
};

function compact(value: unknown): string {
  if (value === undefined) return '';
  const json = JSON.stringify(value);
  return json.length > 400 ? `${json.slice(0, 400)}…` : json;
}

export function RunDiffPanel({
  before,
  after,
  onClose,
}: {
  before: string;
  after: string;
  onClose: () => void;
}) {
  const diff = useQuery(runDiffQuery(before, after));
  const title = diff.data
    ? `Diff: ${getTool(diff.data.before.tool).name}`
    : 'Diff';

  return (
    <Panel
      title={title}
      tone="yellow"
      bodyClassName="p-0"
      actions={
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Close comparison"
          onClick={onClose}
        >
          <X />
        </Button>
      }
    >
      {diff.isPending ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">Comparing…</p>
      ) : diff.isError ? (
        <div className="px-4 py-3">
          <ErrorText error={diff.error} />
        </div>
      ) : (
        <>
          <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <span className="text-foreground">{diff.data.before.target}</span>{' '}
            at {formatDateTime(diff.data.before.startedAt)} →{' '}
            <span className="text-foreground">{diff.data.after.target}</span> at{' '}
            {formatDateTime(diff.data.after.startedAt)}
          </p>
          {diff.data.entries.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No differences.
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border overflow-auto">
              {diff.data.entries.map((entry) => (
                <li
                  key={`${entry.kind}:${entry.path}`}
                  className="space-y-1 px-4 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone={KIND_TONE[entry.kind]}>{entry.kind}</Tag>
                    <code className="break-all">{entry.path}</code>
                  </div>
                  {entry.kind !== 'added' && (
                    <pre className="break-all whitespace-pre-wrap text-neon-magenta/90">
                      - {compact(entry.before)}
                    </pre>
                  )}
                  {entry.kind !== 'removed' && (
                    <pre className="break-all whitespace-pre-wrap text-neon-green/90">
                      + {compact(entry.after)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}
