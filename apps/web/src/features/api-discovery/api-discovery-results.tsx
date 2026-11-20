import { useState } from 'react';
import type { ApiDiscoveryOutput, ApiSpec } from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import { Button } from '@/components/ui/button';
import type { Tone } from '@/lib/tones';

const SHOWN = 25;

/** 2xx green, 4xx/5xx red, redirects and failed requests neutral. */
function statusTone(status: number | undefined): Tone {
  if (status === undefined) return 'muted';
  if (status >= 200 && status < 300) return 'green';
  if (status >= 400) return 'magenta';
  return 'yellow';
}

function SpecPanel({ spec }: { spec: ApiSpec }) {
  const [all, setAll] = useState(false);
  const endpoints = all ? spec.endpoints : spec.endpoints.slice(0, SHOWN);
  return (
    <Panel
      title={spec.title ?? spec.version}
      bodyClassName="p-0"
      actions={
        <Tag tone={spec.hasSecuritySchemes ? 'muted' : 'yellow'}>
          {spec.hasSecuritySchemes ? 'auth declared' : 'no auth declared'}
        </Tag>
      }
    >
      <div className="space-y-1 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <p>
          {spec.version}
          {spec.apiVersion && ` · API ${spec.apiVersion}`} · {spec.operations}{' '}
          operations · {spec.format.toUpperCase()}
        </p>
        <code className="block break-all text-foreground">{spec.url}</code>
        {spec.servers.length > 0 && (
          <p className="break-all">Servers: {spec.servers.join(', ')}</p>
        )}
      </div>
      <div className="overflow-x-auto px-4 py-2">
        <table className="w-full text-xs">
          <tbody>
            {endpoints.map((e) => (
              <tr
                key={`${e.method} ${e.path}`}
                className="border-t border-border/50 first:border-0"
              >
                <td className="py-1 pr-3 font-semibold">{e.method}</td>
                <td className="py-1 pr-3 break-all">{e.path}</td>
                <td className="py-1 text-muted-foreground">{e.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {spec.endpoints.length > SHOWN && (
          <Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)}>
            {all ? 'Show less' : `Show all ${spec.endpoints.length}`}
          </Button>
        )}
        {spec.operations > spec.endpoints.length && (
          <p className="py-1 text-xs text-muted-foreground">
            {spec.operations - spec.endpoints.length} more operations not
            listed.
          </p>
        )}
      </div>
    </Panel>
  );
}

export function ApiDiscoveryResults({ data }: { data: ApiDiscoveryOutput }) {
  const found = data.probes.filter((p) => p.found).length;
  return (
    <div className="grid gap-4">
      <Panel title="Findings" bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Origin
          </span>
          <code className="min-w-0 flex-1 truncate">{data.origin}</code>
          <PivotLinks value={data.origin} exclude="api-discovery" />
        </div>
        <FindingsList findings={data.findings} />
      </Panel>

      {data.specs.map((s) => (
        <SpecPanel key={s.url} spec={s} />
      ))}

      {data.graphql
        .filter((g) => g.introspection)
        .map((g) => (
          <Panel key={g.url} title="GraphQL schema" tone="yellow">
            <div className="space-y-3 text-xs">
              <code className="block break-all">{g.url}</code>
              {(['queries', 'mutations'] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    {k} ({g[k].length})
                  </p>
                  <p className="break-words">{g[k].join(', ') || '-'}</p>
                </div>
              ))}
            </div>
          </Panel>
        ))}

      <Panel
        title={`Locations checked (${found}/${data.probes.length} found)`}
        bodyClassName="p-0"
      >
        <ul className="grid gap-x-4 px-4 py-2 text-xs sm:grid-cols-2">
          {data.probes.map((p) => (
            <li
              key={p.path}
              className="flex items-center justify-between gap-2 py-0.5"
            >
              <code className="truncate">{p.path}</code>
              <span
                className="flex shrink-0 items-center gap-1"
                title={
                  p.error ??
                  (p.status === 200 && !p.found
                    ? 'Answered 200, but not with an API document (catch-all page)'
                    : undefined)
                }
              >
                {p.found && <Tag tone="cyan">found</Tag>}
                <Tag tone={statusTone(p.status)}>{p.status ?? 'error'}</Tag>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
