import type { GobusterHit, GobusterOutput } from '@recon/shared';
import { CopyButton, KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import { formatBytes } from '@/lib/format';
import type { Tone } from '@/lib/tones';

function statusTone(status: number): Tone {
  if (status >= 200 && status < 300) return 'green';
  if (status >= 300 && status < 400) return 'cyan';
  if (status === 401 || status === 403) return 'yellow';
  return 'magenta';
}

export function GobusterResults({ data }: { data: GobusterOutput }) {
  const warnings = data.findings.filter((f) => f.status !== 'info');
  return (
    <div className="grid gap-4">
      <Panel title="Scan">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Base
          </span>
          <code className="min-w-0 flex-1 truncate" title={data.base}>
            {data.base}
          </code>
          <PivotLinks value={data.base} exclude="gobuster" />
        </div>
        <KeyValueGrid
          className="grid-cols-2 sm:grid-cols-4"
          items={[
            { label: 'Address', value: data.address },
            {
              label: 'Wordlist',
              value: `${data.wordlist.label} (${data.wordlist.lines.toLocaleString()})`,
            },
            {
              label: 'Extensions',
              value: data.extensions.length
                ? data.extensions.map((e) => `.${e}`).join(' ')
                : undefined,
            },
            {
              label: 'Threads / limit',
              value: `${data.threads} / ${data.timeLimitMinutes} min`,
            },
          ]}
        />
        {data.stopped && (
          <p role="status" className="mt-3 text-xs text-neon-yellow">
            Stopped at the {data.timeLimitMinutes}-minute time limit: results
            are incomplete. Use a smaller wordlist, fewer extensions or a longer
            limit.
          </p>
        )}
        <div className="mt-3 flex items-start gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto border border-border bg-background/60 px-2 py-1 text-xs whitespace-pre-wrap break-all text-foreground/80">
            {data.command}
          </code>
          <CopyButton value={data.command} label="Copy command" />
        </div>
      </Panel>

      {warnings.length > 0 && (
        <Panel title="Findings" bodyClassName="p-0">
          <FindingsList findings={warnings} />
        </Panel>
      )}

      <Panel title={`Found (${data.hits.length})`} bodyClassName="p-0">
        {data.hits.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            gobuster found nothing from this wordlist below the base URL.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.hits.map((h) => (
              <HitRow key={h.path} hit={h} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function HitRow({ hit: h }: { hit: GobusterHit }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
      <Tag tone={statusTone(h.status)}>{h.status}</Tag>
      <a
        href={h.url}
        target="_blank"
        rel="noreferrer noopener"
        className="min-w-0 truncate font-semibold hover:text-primary"
        title={h.url}
      >
        {h.path}
      </a>
      {h.redirect && (
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          → <code>{h.redirect}</code>
        </span>
      )}
      {h.length !== undefined && (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatBytes(h.length)}
        </span>
      )}
    </li>
  );
}
