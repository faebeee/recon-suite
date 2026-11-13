import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, SearchCheck } from 'lucide-react';
import { useId, useState } from 'react';
import {
  ENGAGEMENT_API,
  scopeBulkInputSchema,
  scopeCheckInputSchema,
  type ScopeBulkInput,
  type ScopeCheckResult,
  type ScopeEntry,
  type ScopeKind,
} from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiDelete, apiPost, type ApiError } from '@/lib/api-client';
import { ENGAGEMENTS_KEY } from '@/lib/engagement';
import type { Tone } from '@/lib/tones';
import { scopeQuery } from './queries';
import { ConfirmDelete, ErrorText, Field, textareaClass } from './ui';

const KIND_TONE: Record<ScopeKind, Tone> = {
  domain: 'cyan',
  wildcard: 'cyan',
  ip: 'green',
  cidr: 'green',
};

/** One entry per line; a leading "!" marks an exclusion. */
function parseScopeLines(text: string, note: string): ScopeBulkInput {
  const trimmedNote = note.trim() || undefined;
  return {
    entries: text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const excluded = line.startsWith('!');
        return {
          value: excluded ? line.slice(1).trim() : line,
          excluded,
          note: trimmedNote,
        };
      }),
  };
}

export function ScopeTab({ engagementId }: { engagementId: string }) {
  const scope = useQuery(scopeQuery(engagementId));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <AddScope engagementId={engagementId} />
        <CheckTarget engagementId={engagementId} />
      </div>
      <Panel
        title={`Scope${scope.data ? ` (${scope.data.length})` : ''}`}
        bodyClassName="p-0"
      >
        {scope.isPending ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
        ) : scope.isError ? (
          <div className="px-4 py-3">
            <ErrorText error={scope.error} />
          </div>
        ) : scope.data.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No scope yet. Active tools refuse every target until you add the
            domains, wildcards, IPs or CIDR ranges you may test.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {scope.data.map((entry) => (
              <ScopeRow
                key={entry.id}
                engagementId={engagementId}
                entry={entry}
              />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AddScope({ engagementId }: { engagementId: string }) {
  const id = useId();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [validation, setValidation] = useState<string | null>(null);

  const add = useMutation<ScopeEntry[], ApiError, ScopeBulkInput>({
    mutationFn: (body) => apiPost(ENGAGEMENT_API.scope(engagementId), body),
    onSuccess: (entries) => {
      setText('');
      setNote('');
      queryClient.setQueryData(scopeQuery(engagementId).queryKey, entries);
      void queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY });
    },
  });

  return (
    <Panel title="Add scope">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = scopeBulkInputSchema.safeParse(
            parseScopeLines(text, note),
          );
          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            setValidation(
              issue?.path[0] === 'entries' && issue.path.length === 1
                ? 'Enter at least one entry (max 500).'
                : (issue?.message ?? 'Invalid input'),
            );
            return;
          }
          setValidation(null);
          add.mutate(parsed.data);
        }}
      >
        <Field label="Entries (one per line)" htmlFor={`${id}-entries`}>
          <textarea
            id={`${id}-entries`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            spellCheck={false}
            autoCapitalize="none"
            placeholder={
              'example.com\n*.example.com\n192.0.2.0/24\n!legacy.example.com'
            }
            aria-describedby={`${id}-hint`}
            className={textareaClass}
          />
        </Field>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Domains, wildcards, IPs, CIDR ranges or URLs. Start a line with{' '}
          <code className="text-foreground">!</code> to exclude it; exclusions
          win over inclusions.
        </p>
        <Field label="Note (optional)" htmlFor={`${id}-note`}>
          <Input
            id={`${id}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. per SOW section 3"
          />
        </Field>
        <ErrorText error={validation ?? add.error} />
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add to scope
        </Button>
      </form>
    </Panel>
  );
}

function CheckTarget({ engagementId }: { engagementId: string }) {
  const id = useId();
  const [target, setTarget] = useState('');
  const check = useMutation<ScopeCheckResult, ApiError, string>({
    mutationFn: (t) =>
      apiPost(ENGAGEMENT_API.scopeCheck(engagementId), { target: t }),
  });
  const [validation, setValidation] = useState<string | null>(null);

  return (
    <Panel title="Check target">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = scopeCheckInputSchema.safeParse({ target });
          if (!parsed.success) {
            setValidation('Enter a target to check.');
            return;
          }
          setValidation(null);
          check.mutate(parsed.data.target);
        }}
      >
        <Field label="Target" htmlFor={`${id}-target`}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={`${id}-target`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="host, IP or URL"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <Button type="submit" variant="outline" disabled={check.isPending}>
              {check.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <SearchCheck />
              )}
              Check
            </Button>
          </div>
        </Field>
        <ErrorText error={validation ?? check.error} />
        {check.data && !check.isPending && (
          <div className="space-y-1.5 text-sm" aria-live="polite">
            <Tag tone={check.data.inScope ? 'green' : 'magenta'}>
              {check.data.inScope ? 'In scope' : 'Out of scope'}
            </Tag>
            <p className="text-xs text-muted-foreground">{check.data.reason}</p>
            {check.data.entry && (
              <p className="text-xs text-muted-foreground">
                Matched{' '}
                <code className="text-foreground">
                  {check.data.entry.excluded ? '!' : ''}
                  {check.data.entry.value}
                </code>{' '}
                ({check.data.entry.kind})
              </p>
            )}
          </div>
        )}
      </form>
    </Panel>
  );
}

function ScopeRow({
  engagementId,
  entry,
}: {
  engagementId: string;
  entry: ScopeEntry;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation<void, ApiError>({
    mutationFn: () =>
      apiDelete(ENGAGEMENT_API.scopeEntry(engagementId, entry.id)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY }),
  });
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-sm">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <code
            className={
              entry.excluded
                ? 'break-all text-muted-foreground line-through'
                : 'break-all'
            }
          >
            {entry.value}
          </code>
          <Tag tone={KIND_TONE[entry.kind]}>{entry.kind}</Tag>
          {entry.excluded && <Tag tone="magenta">excluded</Tag>}
        </div>
        {entry.note && (
          <p className="text-xs text-muted-foreground">{entry.note}</p>
        )}
        <ErrorText error={remove.error} />
      </div>
      <ConfirmDelete
        label={`Remove ${entry.value} from scope`}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </li>
  );
}
