import type {
  BucketState,
  CloudProvider,
  CloudStorageOutput,
} from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import type { Tone } from '@/lib/tones';

const PROVIDER_LABEL: Record<CloudProvider, string> = {
  s3: 'S3',
  gcs: 'GCS',
  azure: 'Azure',
};

const STATE: Record<BucketState, { tone: Tone; label: string }> = {
  'public-list': { tone: 'magenta', label: 'public list' },
  'exists-private': { tone: 'yellow', label: 'exists, private' },
  'not-found': { tone: 'muted', label: 'not found' },
  error: { tone: 'muted', label: 'error' },
};

const ORDER: Record<BucketState, number> = {
  'public-list': 0,
  'exists-private': 1,
  error: 2,
  'not-found': 3,
};

export function CloudStorageResults({ data }: { data: CloudStorageOutput }) {
  const results = [...data.results].sort(
    (a, b) => ORDER[a.state] - ORDER[b.state],
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Findings" bodyClassName="p-0">
        <FindingsList findings={data.findings} />
      </Panel>

      <Panel title={`Candidate names (${data.names.length})`}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {data.names.map((n) => (
              <Tag key={n} tone="muted" className="tracking-normal normal-case">
                {n}
              </Tag>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.checked} checks across S3, GCS and Azure. Names are guesses
            derived from the domain: an existing private bucket is not
            necessarily owned by the target.
          </p>
        </div>
      </Panel>

      <Panel
        title={`Buckets found (${data.results.length})`}
        className="lg:col-span-2"
        bodyClassName="p-0"
      >
        {results.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            None of the candidate names exists on S3, GCS or Azure.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {results.map((r) => {
              const state = STATE[r.state];
              return (
                <li
                  key={`${r.provider}:${r.name}`}
                  className="space-y-1 px-4 py-2"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Tag tone="cyan" className="w-14 justify-center">
                      {PROVIDER_LABEL[r.provider]}
                    </Tag>
                    <span className="font-semibold break-all">{r.name}</span>
                    <Tag tone={state.tone}>{state.label}</Tag>
                    {r.status !== undefined && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {r.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code
                      className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                      title={r.url}
                    >
                      {r.url}
                    </code>
                    <PivotLinks value={r.url} exclude="cloud-storage" />
                  </div>
                  {r.error && (
                    <p className="text-xs break-words text-muted-foreground">
                      {r.error}
                    </p>
                  )}
                  {r.sampleKeys && r.sampleKeys.length > 0 && (
                    <ul className="space-y-0.5 border-l border-border pl-3 text-xs">
                      {r.sampleKeys.map((k) => (
                        <li key={k} className="truncate" title={k}>
                          <code>{k}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
