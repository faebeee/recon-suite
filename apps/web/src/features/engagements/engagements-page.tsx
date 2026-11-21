import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  Archive,
  ArchiveRestore,
  CirclePlay,
  Loader2,
  Plus,
} from 'lucide-react';
import { useId, useState } from 'react';
import {
  ENGAGEMENT_API,
  engagementInputSchema,
  type Engagement,
  type EngagementPatch,
} from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiDelete, apiPatch, apiPost, type ApiError } from '@/lib/api-client';
import {
  ENGAGEMENTS_KEY,
  engagementsQuery,
  useActiveEngagement,
} from '@/lib/engagement';
import {
  ConfirmDelete,
  ErrorText,
  Field,
  FindingCountTags,
  StatusTag,
  textareaClass,
} from './ui';

export function EngagementsPage() {
  const list = useQuery(engagementsQuery);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          Workspace
        </p>
        <h1 className="font-dot text-2xl font-bold uppercase sm:text-3xl">
          <span className="text-glow">Engagements</span>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Group tool runs, findings and notes per assessment. While an
          engagement is active, every tool run is saved to its history.
        </p>
      </header>

      <CreateEngagement />

      <Panel title="All engagements" bodyClassName="p-0">
        {list.isPending ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
        ) : list.isError ? (
          <div className="px-4 py-3">
            <ErrorText error={list.error} />
          </div>
        ) : list.data.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No engagements yet. Create one above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {list.data.map((e) => (
              <EngagementRow key={e.id} engagement={e} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function CreateEngagement() {
  const id = useId();
  const queryClient = useQueryClient();
  const { setId } = useActiveEngagement();
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [validation, setValidation] = useState<string | null>(null);

  const create = useMutation<Engagement, ApiError, unknown>({
    mutationFn: (body) => apiPost(ENGAGEMENT_API.list, body),
    onSuccess: (created) => {
      setName('');
      setClient('');
      setDescription('');
      setId(created.id);
      void queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY });
    },
  });

  return (
    <Panel title="New engagement">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = engagementInputSchema.safeParse({
            name,
            client: client.trim() || undefined,
            description: description.trim() || undefined,
          });
          if (!parsed.success) {
            setValidation(parsed.error.issues[0]?.message ?? 'Invalid input');
            return;
          }
          setValidation(null);
          create.mutate(parsed.data);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor={`${id}-name`}>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              placeholder="Q4 external assessment"
            />
          </Field>
          <Field label="Client" htmlFor={`${id}-client`}>
            <Input
              id={`${id}-client`}
              value={client}
              onChange={(e) => setClient(e.target.value)}
              maxLength={120}
              placeholder="optional"
            />
          </Field>
        </div>
        <Field label="Description" htmlFor={`${id}-desc`}>
          <textarea
            id={`${id}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            rows={2}
            placeholder="Rules of engagement, contacts, test window (optional)"
            className={textareaClass}
          />
        </Field>
        <ErrorText error={validation ?? create.error} />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Create and activate
        </Button>
      </form>
    </Panel>
  );
}

function EngagementRow({ engagement: e }: { engagement: Engagement }) {
  const queryClient = useQueryClient();
  const active = useActiveEngagement();
  const isActive = active.id === e.id;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY });
  const patch = useMutation<Engagement, ApiError, EngagementPatch>({
    mutationFn: (body) => apiPatch(ENGAGEMENT_API.one(e.id), body),
    onSuccess: invalidate,
  });
  const remove = useMutation<void, ApiError>({
    mutationFn: () => apiDelete(ENGAGEMENT_API.one(e.id)),
    onSuccess: () => {
      if (isActive) active.setId(null);
      queryClient.removeQueries({ queryKey: [...ENGAGEMENTS_KEY, e.id] });
      void invalidate();
    },
  });

  return (
    <li className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/engagements/$engagementId"
            params={{ engagementId: e.id }}
            className="font-display text-sm font-bold tracking-[0.1em] break-all uppercase hover:text-primary"
          >
            {e.name}
          </Link>
          <StatusTag status={e.status} />
          {isActive && <Tag tone="cyan">recording</Tag>}
        </div>
        {e.client && (
          <p className="text-xs text-muted-foreground">{e.client}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-wider text-muted-foreground uppercase">
          <span>
            runs <span className="text-foreground">{e.counts.runs}</span>
          </span>
          <span>
            notes <span className="text-foreground">{e.counts.notes}</span>
          </span>
          <FindingCountTags counts={e.counts.findings} />
        </div>
        <ErrorText error={patch.error ?? remove.error} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {e.status === 'active' && (
          <Button
            size="sm"
            variant="outline"
            disabled={isActive}
            onClick={() => active.setId(e.id)}
          >
            <CirclePlay />
            {isActive ? 'Active' : 'Activate'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={patch.isPending}
          onClick={() => {
            if (e.status === 'active' && isActive) active.setId(null);
            patch.mutate({
              status: e.status === 'active' ? 'archived' : 'active',
            });
          }}
        >
          {e.status === 'active' ? <Archive /> : <ArchiveRestore />}
          {e.status === 'active' ? 'Archive' : 'Unarchive'}
        </Button>
        <ConfirmDelete
          label={`Delete engagement ${e.name}`}
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </div>
    </li>
  );
}
