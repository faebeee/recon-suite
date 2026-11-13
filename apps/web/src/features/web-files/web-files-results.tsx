import type { WebFileFetch, WebFilesOutput } from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import type { Tone } from '@/lib/tones';

function fileState(f: WebFileFetch): { tone: Tone; label: string } {
  if (f.found) return { tone: 'green', label: 'found' };
  if (f.error) return { tone: 'magenta', label: 'error' };
  if (f.soft404) return { tone: 'yellow', label: 'soft 404' };
  return { tone: 'muted', label: f.status ? String(f.status) : 'missing' };
}

const kb = (bytes: number | undefined) =>
  bytes === undefined
    ? ''
    : bytes < 1024
      ? `${bytes} B`
      : `${(bytes / 1024).toFixed(1)} KB`;

export function WebFilesResults({ data }: { data: WebFilesOutput }) {
  const { robots, sitemap, securityTxt, humans } = data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Files" className="lg:col-span-2" bodyClassName="p-0">
        <ul className="divide-y divide-border text-sm">
          {data.files.map((f) => {
            const state = fileState(f);
            return (
              <li
                key={f.file}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2"
              >
                <span className="w-28 shrink-0 font-semibold">{f.file}</span>
                <Tag tone={state.tone}>{state.label}</Tag>
                <code
                  className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                  title={f.finalUrl ?? f.url}
                >
                  {f.finalUrl ?? f.url}
                </code>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {kb(f.bytes)}
                </span>
                {f.error && (
                  <p className="w-full text-xs text-neon-magenta">{f.error}</p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      {robots && (
        <Panel title="robots.txt" className="lg:col-span-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Worth a look ({robots.interesting.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {robots.interesting.map((p) => (
                  <Tag
                    key={p}
                    tone="yellow"
                    className="normal-case tracking-normal"
                  >
                    {p}
                  </Tag>
                ))}
                {robots.interesting.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    Nothing notable
                  </span>
                )}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {robots.groups.map((g, i) => (
                <div key={i} className="min-w-0 border border-border p-3">
                  <p className="truncate text-xs">
                    <span className="text-muted-foreground">User-agent:</span>{' '}
                    {g.userAgents.join(', ')}
                    {g.crawlDelay && (
                      <span className="text-muted-foreground">
                        {' '}
                        (delay {g.crawlDelay}s)
                      </span>
                    )}
                  </p>
                  <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs">
                    {g.disallow.map((p) => (
                      <li key={`d${p}`} className="truncate" title={p}>
                        <span className="text-neon-magenta">-</span> {p}
                      </li>
                    ))}
                    {g.allow.map((p) => (
                      <li key={`a${p}`} className="truncate" title={p}>
                        <span className="text-neon-green">+</span> {p}
                      </li>
                    ))}
                    {g.disallow.length + g.allow.length === 0 && (
                      <li className="text-muted-foreground">No rules</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
            {robots.sitemaps.length > 0 && (
              <KeyValueGrid
                className="sm:grid-cols-1"
                items={[
                  {
                    label: 'Declared sitemaps',
                    value: robots.sitemaps.join(', '),
                  },
                ]}
              />
            )}
          </div>
        </Panel>
      )}

      {sitemap && (
        <Panel title="Sitemap" bodyClassName="p-0">
          <div className="px-4 py-3">
            <KeyValueGrid
              items={[
                { label: 'Type', value: <Tag>{sitemap.kind}</Tag> },
                { label: 'Entries', value: sitemap.count },
              ]}
            />
          </div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto border-t border-border text-xs">
            {sitemap.sample.map((u) => (
              <li
                key={u}
                className="flex items-center justify-between gap-2 px-4 py-1.5"
              >
                <code className="truncate" title={u}>
                  {u}
                </code>
                <PivotLinks value={u} exclude="web-files" />
              </li>
            ))}
          </ul>
          {sitemap.count > sitemap.sample.length && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Showing {sitemap.sample.length} of {sitemap.count}
            </p>
          )}
        </Panel>
      )}

      {securityTxt && (
        <Panel title="security.txt" bodyClassName="p-0">
          <FindingsList findings={securityTxt.findings} />
          <div className="border-t border-border px-4 py-3">
            <KeyValueGrid
              className="sm:grid-cols-1"
              items={securityTxt.fields.map((f, i) => ({
                label: `${f.name}${securityTxt.fields.findIndex((x) => x.name === f.name) !== i ? ` (${i})` : ''}`,
                value: f.value,
              }))}
            />
          </div>
        </Panel>
      )}

      {humans && (
        <Panel title="humans.txt" className="lg:col-span-2">
          <pre className="max-h-64 overflow-auto text-xs whitespace-pre-wrap text-foreground/80">
            {humans.preview}
            {humans.truncated && '\n...'}
          </pre>
        </Panel>
      )}
    </div>
  );
}
