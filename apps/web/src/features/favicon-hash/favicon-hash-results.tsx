import type { FaviconHashOutput, FaviconResult } from '@recon/shared';
import { CopyButton, KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import { formatBytes } from '@/lib/format';

function Hash({ value }: { value: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <code className="min-w-0 truncate text-xs" title={value}>
        {value}
      </code>
      <CopyButton value={value} />
    </span>
  );
}

function Icon({ icon }: { icon: FaviconResult }) {
  const ok = icon.mmh3 !== undefined;
  return (
    <Panel
      title={icon.source === 'default' ? '/favicon.ico' : 'Linked icon'}
      tone={ok ? 'cyan' : undefined}
      actions={
        <Tag tone={ok ? 'green' : 'muted'}>{ok ? 'hashed' : 'skipped'}</Tag>
      }
    >
      <div className="space-y-3">
        <code className="block text-xs break-all text-muted-foreground">
          {icon.url}
        </code>
        {ok ? (
          <>
            <KeyValueGrid
              items={[
                {
                  label: 'mmh3 (Shodan)',
                  value: <Hash value={String(icon.mmh3)} />,
                },
                { label: 'MD5', value: icon.md5 && <Hash value={icon.md5} /> },
                {
                  label: 'SHA-256',
                  value: icon.sha256 && <Hash value={icon.sha256} />,
                },
                {
                  label: 'Size',
                  value: `${formatBytes(icon.bytes ?? 0)}${icon.contentType ? ` · ${icon.contentType}` : ''}`,
                },
              ]}
            />
            <div className="space-y-1">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Find the same icon
              </p>
              <ul className="space-y-1 text-xs">
                {icon.queries?.map((q) => (
                  <li
                    key={q.engine}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <span className="w-14 shrink-0 text-muted-foreground">
                      {q.engine}
                    </span>
                    <Hash value={q.query} />
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {icon.error ?? 'Not hashed'}
            {icon.status ? ` (HTTP ${icon.status})` : ''}
          </p>
        )}
      </div>
    </Panel>
  );
}

export function FaviconHashResults({ data }: { data: FaviconHashOutput }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 border border-border px-4 py-2 text-xs">
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Page
        </span>
        <code className="min-w-0 flex-1 truncate" title={data.page}>
          {data.page}
        </code>
        <PivotLinks value={data.page} exclude="favicon-hash" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.icons.map((icon) => (
          <Icon key={icon.url} icon={icon} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Hosts serving the same icon usually run the same software, which also
        finds origin servers hidden behind a CDN. The tool only computes hashes;
        run the queries in the search engines yourself.
      </p>
    </div>
  );
}
