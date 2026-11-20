import type { HttpMethodsOutput } from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import { formatDuration } from '@/lib/format';

const RISKY = new Set([
  'TRACE',
  'TRACK',
  'CONNECT',
  'PUT',
  'DELETE',
  'PATCH',
  'PROPFIND',
  'PROPPATCH',
  'MKCOL',
  'COPY',
  'MOVE',
  'LOCK',
  'UNLOCK',
  'SEARCH',
]);

function Unreached({ error }: { error?: string }) {
  return error ? (
    <span className="text-xs break-words text-muted-foreground">{error}</span>
  ) : null;
}

export function HttpMethodsResults({ data }: { data: HttpMethodsOutput }) {
  const { options, trace, httpsRedirect: redirect, hsts, errorPage } = data;
  return (
    <div className="grid gap-4">
      <Panel title="Findings" bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Tested URL
          </span>
          <code className="min-w-0 flex-1 truncate" title={data.url}>
            {data.url}
          </code>
          <PivotLinks value={data.url} exclude="http-methods" />
        </div>
        <FindingsList findings={data.findings} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Methods">
          <KeyValueGrid
            items={[
              {
                label: 'Allowed (OPTIONS)',
                value: options.allowed.length ? (
                  <span className="flex flex-wrap gap-1">
                    {options.allowed.map((m) => (
                      <Tag key={m} tone={RISKY.has(m) ? 'yellow' : 'muted'}>
                        {m}
                      </Tag>
                    ))}
                  </span>
                ) : (
                  <Unreached error={options.error ?? 'not advertised'} />
                ),
              },
              { label: 'OPTIONS status', value: options.status },
              {
                label: 'TRACE',
                value: trace.error ? (
                  <Unreached error={trace.error} />
                ) : (
                  <Tag tone={trace.reflected ? 'magenta' : 'green'}>
                    {trace.reflected ? 'echoed' : 'not echoed'}
                  </Tag>
                ),
              },
              { label: 'TRACE status', value: trace.status },
            ]}
          />
        </Panel>

        <Panel title="Transport">
          <KeyValueGrid
            items={[
              {
                label: 'Plain HTTP',
                value: redirect.error ? (
                  <Unreached error={redirect.error} />
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <Tag tone={redirect.redirectsToHttps ? 'green' : 'magenta'}>
                      {redirect.status}
                    </Tag>
                    <code className="text-xs break-all">
                      {redirect.location ?? 'no redirect'}
                    </code>
                  </span>
                ),
              },
              {
                label: 'HSTS max-age',
                value:
                  hsts.maxAge !== undefined
                    ? formatDuration(hsts.maxAge)
                    : undefined,
              },
              {
                label: 'HSTS directives',
                value: hsts.header ? (
                  <span className="flex flex-wrap gap-1">
                    <Tag tone={hsts.includeSubDomains ? 'green' : 'muted'}>
                      includeSubDomains
                    </Tag>
                    <Tag tone={hsts.preload ? 'green' : 'muted'}>preload</Tag>
                  </span>
                ) : undefined,
              },
              {
                label: 'Preload list',
                value: hsts.preloadList ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Tag
                      tone={
                        hsts.preloadList.status === 'preloaded'
                          ? 'green'
                          : 'muted'
                      }
                    >
                      {hsts.preloadList.status}
                    </Tag>
                    <span className="text-xs text-muted-foreground">
                      {hsts.preloadList.domain}
                    </span>
                  </span>
                ) : undefined,
              },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Error page">
        <KeyValueGrid
          items={[
            {
              label: 'Random path',
              value: <code className="text-xs break-all">{errorPage.url}</code>,
            },
            {
              label: 'Status',
              value: errorPage.error ? (
                <Unreached error={errorPage.error} />
              ) : (
                <span className="flex items-center gap-2">
                  {errorPage.status}
                  {errorPage.soft404 && <Tag tone="yellow">soft 404</Tag>}
                </span>
              ),
            },
            {
              label: 'Leaks',
              value: errorPage.leaks.length ? (
                <ul className="space-y-0.5 text-xs">
                  {errorPage.leaks.map((l) => (
                    <li key={l} className="break-all">
                      {l}
                    </li>
                  ))}
                </ul>
              ) : undefined,
            },
            { label: 'Default install page', value: data.defaultPage },
          ]}
        />
      </Panel>
    </div>
  );
}
