import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, CirclePlay } from 'lucide-react';
import { Panel, Tag } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api-client';
import { engagementQuery, useActiveEngagement } from '@/lib/engagement';
import { formatDate } from '@/lib/format';
import { ChangesTab } from './changes-tab';
import { ExportTab } from './export-tab';
import { HistoryTab } from './history-tab';
import { NotesTab } from './notes-tab';
import { OverviewTab } from './overview-tab';
import { ScopeTab } from './scope-tab';
import { ErrorText, StatusTag } from './ui';

export const ENGAGEMENT_TABS = [
  'overview',
  'scope',
  'history',
  'changes',
  'notes',
  'export',
] as const;
export type EngagementTab = (typeof ENGAGEMENT_TABS)[number];

export function EngagementDetailPage({
  engagementId,
  initialTab = 'overview',
}: {
  engagementId: string;
  initialTab?: EngagementTab;
}) {
  const query = useQuery(engagementQuery(engagementId));
  const active = useActiveEngagement();

  if (query.isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (query.isError) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;
    return (
      <Panel title={notFound ? 'Not found' : 'Error'} tone="magenta">
        {notFound ? (
          <p className="text-sm text-muted-foreground">
            This engagement does not exist (any more).
          </p>
        ) : (
          <ErrorText error={query.error} />
        )}
        <BackLink />
      </Panel>
    );
  }

  const e = query.data;
  const isActive = active.id === e.id;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <BackLink />
        <div className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          <span>Engagement</span>
          <StatusTag status={e.status} />
          {isActive && <Tag tone="cyan">recording</Tag>}
          <span>created {formatDate(e.createdAt)}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="font-dot text-2xl font-bold break-words uppercase sm:text-3xl">
              <span className="text-glow">{e.name}</span>
            </h1>
            {e.client && (
              <p className="text-sm text-muted-foreground">{e.client}</p>
            )}
          </div>
          {e.status === 'active' && (
            <Button
              variant="outline"
              disabled={isActive}
              onClick={() => active.setId(e.id)}
            >
              <CirclePlay />
              {isActive ? 'Active' : 'Set active'}
            </Button>
          )}
        </div>
        {e.description && (
          <p className="max-w-3xl text-sm whitespace-pre-wrap text-muted-foreground">
            {e.description}
          </p>
        )}
      </header>

      <Tabs defaultValue={initialTab} className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="scope">Scope</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="changes">Changes</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          <OverviewTab engagement={e} />
        </TabsContent>
        <TabsContent value="scope">
          <ScopeTab engagementId={e.id} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab engagementId={e.id} />
        </TabsContent>
        <TabsContent value="changes">
          <ChangesTab engagementId={e.id} archived={e.status === 'archived'} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab engagementId={e.id} />
        </TabsContent>
        <TabsContent value="export">
          <ExportTab engagementId={e.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/engagements"
      className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.2em] text-primary uppercase underline-offset-4 hover:underline"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      All engagements
    </Link>
  );
}
