import { useMemo, useState } from 'react';
import type { JsEndpointsOutput, JsScript } from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import {
  FindingsList,
  IntelViewExportButton,
  PivotLinks,
} from '@/components/tool';
import type { Tone } from '@/lib/tones';
import { jsEndpointsDiscovery } from './js-endpoints-radar';

const NONE = { secrets: [], hosts: [], endpoints: [] };

const MAX_VISIBLE = 200;

const kb = (bytes: number | undefined) =>
  bytes === undefined
    ? '-'
    : bytes < 1024
      ? `${bytes} B`
      : `${(bytes / 1024).toFixed(1)} KB`;

function mapState(s: JsScript): { tone: Tone; label: string } | undefined {
  if (s.sourceMapExposed) return { tone: 'yellow', label: 'map exposed' };
  if (s.sourceMap) return { tone: 'muted', label: 'map ref' };
  return undefined;
}

function ScriptsPanel({ scripts }: { scripts: JsScript[] }) {
  return (
    <Panel title={`Scripts (${scripts.length})`} bodyClassName="p-0">
      {scripts.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          No external scripts referenced
        </p>
      ) : (
        <div className="overflow-x-auto px-4 py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                <th className="py-1 pr-4 font-normal">URL</th>
                <th className="py-1 pr-4 font-normal">Site</th>
                <th className="py-1 pr-4 font-normal">Size</th>
                <th className="py-1 font-normal">Source map</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((s) => {
                const map = mapState(s);
                return (
                  <tr
                    key={s.url}
                    className="border-t border-border/50 align-top"
                  >
                    <td className="max-w-md py-1.5 pr-4">
                      <code className="block break-all" title={s.url}>
                        {s.url}
                      </code>
                      {s.error && (
                        <span className="block text-neon-magenta">
                          {s.error}
                        </span>
                      )}
                      {s.status !== undefined && s.status !== 200 && (
                        <span className="block text-muted-foreground">
                          HTTP {s.status}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4">
                      <Tag tone={s.external ? 'muted' : 'cyan'}>
                        {s.external ? 'external' : 'same-site'}
                      </Tag>
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap tabular-nums">
                      {kb(s.bytes)}
                      {s.truncated && (
                        <span className="text-muted-foreground"> (cut)</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {map ? (
                        <Tag tone={map.tone} className="normal-case">
                          <span title={s.sourceMap}>{map.label}</span>
                        </Tag>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function EndpointsPanel({
  page,
  endpoints,
}: {
  page: string;
  endpoints: JsEndpointsOutput['endpoints'];
}) {
  const [filter, setFilter] = useState('');
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q
      ? endpoints.filter((e) => e.value.toLowerCase().includes(q))
      : endpoints;
  }, [endpoints, filter]);

  return (
    <Panel
      title={`Endpoints (${endpoints.length})`}
      actions={
        <IntelViewExportButton
          tool="js-endpoints"
          discovery={jsEndpointsDiscovery({
            ...NONE,
            page,
            endpoints: visible,
          })}
        />
      }
      bodyClassName="p-0"
    >
      <div className="border-b border-border px-4 py-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter endpoints"
          placeholder="Filter, e.g. /api"
          className="h-8 w-full border border-input bg-background/60 px-2 text-sm outline-none focus:border-primary"
        />
      </div>
      {visible.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {endpoints.length ? 'No match' : 'No endpoints found'}
        </p>
      ) : (
        <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto text-xs">
          {visible.slice(0, MAX_VISIBLE).map((e) => (
            <li
              key={e.value}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1.5"
            >
              <Tag tone={e.kind === 'url' ? 'cyan' : 'muted'}>{e.kind}</Tag>
              <code
                className="min-w-0 flex-1 break-all"
                title={`Found in: ${e.sources.join(', ')}`}
              >
                {e.value}
              </code>
              {e.kind === 'url' && (
                <PivotLinks value={e.value} exclude="js-endpoints" />
              )}
            </li>
          ))}
        </ul>
      )}
      {visible.length > MAX_VISIBLE && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Showing {MAX_VISIBLE} of {visible.length}; refine the filter or use
          RAW JSON.
        </p>
      )}
    </Panel>
  );
}

export function JsEndpointsResults({ data }: { data: JsEndpointsOutput }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Findings" className="lg:col-span-2" bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Page
          </span>
          <code className="min-w-0 flex-1 truncate" title={data.page}>
            {data.page}
          </code>
          <PivotLinks value={data.page} exclude="js-endpoints" />
        </div>
        <FindingsList findings={data.findings} />
      </Panel>

      {data.secrets.length > 0 && (
        <Panel
          title={`Secrets (${data.secrets.length})`}
          tone="magenta"
          className="lg:col-span-2"
          actions={
            <IntelViewExportButton
              tool="js-endpoints"
              discovery={jsEndpointsDiscovery({
                ...NONE,
                page: data.page,
                secrets: data.secrets,
              })}
            />
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto px-4 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  <th className="py-1 pr-4 font-normal">Type</th>
                  <th className="py-1 pr-4 font-normal">Value (masked)</th>
                  <th className="py-1 font-normal">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.secrets.map((s) => (
                  <tr
                    key={`${s.type}-${s.masked}`}
                    className="border-t border-border/50 align-top"
                  >
                    <td className="py-1.5 pr-4 whitespace-nowrap">{s.type}</td>
                    <td className="py-1.5 pr-4">
                      <code>{s.masked}</code>
                    </td>
                    <td className="py-1.5 break-all text-muted-foreground">
                      {s.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="lg:col-span-2">
        <ScriptsPanel scripts={data.scripts} />
      </div>

      <EndpointsPanel page={data.page} endpoints={data.endpoints} />

      <Panel
        title={`Hosts (${data.hosts.length})`}
        actions={
          <IntelViewExportButton
            tool="js-endpoints"
            discovery={jsEndpointsDiscovery({
              ...NONE,
              page: data.page,
              hosts: data.hosts,
            })}
          />
        }
        bodyClassName="p-0"
      >
        {data.hosts.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No hosts referenced
          </p>
        ) : (
          <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto text-xs">
            {data.hosts.map((h) => (
              <li
                key={h}
                className="flex items-center justify-between gap-2 px-4 py-1.5"
              >
                <code className="truncate" title={h}>
                  {h}
                </code>
                <PivotLinks value={h} exclude="js-endpoints" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
