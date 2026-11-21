import { Folder, File } from 'lucide-react';
import type {
  DirBusterHit,
  DirBusterOutput,
  DirBusterStop,
} from '@recon/shared';
import { KeyValueGrid, Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import { formatBytes } from '@/lib/format';
import type { Tone } from '@/lib/tones';

const STOP_TEXT: Record<DirBusterStop, string> = {
  'request-limit':
    'Stopped at the request limit: results are incomplete. Use fewer extensions, a lower depth or the quick wordlist.',
  'time-limit':
    'Stopped at the time limit: results are incomplete. Use fewer extensions or a lower depth.',
  'rate-limited':
    'Stopped because the server answered 429 Too Many Requests repeatedly. Try again with fewer threads.',
};

function statusTone(status: number): Tone {
  if (status >= 200 && status < 300) return 'green';
  if (status >= 300 && status < 400) return 'cyan';
  if (status === 401 || status === 403) return 'yellow';
  return 'magenta';
}

export function DirBusterResults({ data }: { data: DirBusterOutput }) {
  const dirs = data.hits.filter((h) => h.kind === 'directory').length;
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
          <PivotLinks value={data.base} exclude="dir-buster" />
        </div>
        <KeyValueGrid
          className="grid-cols-2 sm:grid-cols-4"
          items={[
            {
              label: 'Wordlist',
              value: `${data.wordlist} (${data.words} words)`,
            },
            {
              label: 'Extensions',
              value: data.extensions.length
                ? data.extensions.map((e) => `.${e}`).join(' ')
                : undefined,
            },
            { label: 'Requests', value: data.requests },
            { label: 'Errors', value: data.errors },
          ]}
        />
        {data.stopped && (
          <p role="status" className="mt-3 text-xs text-neon-yellow">
            {STOP_TEXT[data.stopped]}
          </p>
        )}
        {data.wildcardDirs.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Catch-all responses in{' '}
            {data.wildcardDirs.map((d) => (
              <code key={d} className="mr-1 text-foreground">
                {d}
              </code>
            ))}
            : unknown paths there don't answer 404, so only responses that
            differ from a random path are listed.
          </p>
        )}
      </Panel>

      {data.findings.some((f) => f.status !== 'info') && (
        <Panel title="Findings" bodyClassName="p-0">
          <FindingsList
            findings={data.findings.filter((f) => f.status !== 'info')}
          />
        </Panel>
      )}

      <Panel
        title={`Found (${data.hits.length}: ${dirs} directories)`}
        bodyClassName="p-0"
      >
        {data.hits.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Nothing from the wordlist exists below this URL.
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

function HitRow({ hit: h }: { hit: DirBusterHit }) {
  const Icon = h.kind === 'directory' ? Folder : File;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
      <Tag tone={statusTone(h.status)}>{h.status}</Tag>
      <Icon
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-label={h.kind}
      />
      <a
        href={h.url}
        target="_blank"
        rel="noreferrer noopener"
        className="min-w-0 truncate font-semibold hover:text-primary"
        style={{ paddingLeft: `${(h.depth - 1) * 0.75}rem` }}
        title={h.url}
      >
        {h.path}
      </a>
      {h.listing && <Tag tone="yellow">listing</Tag>}
      {h.title && (
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {h.title}
        </span>
      )}
      {h.redirect && (
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          → <code>{h.redirect}</code>
        </span>
      )}
      <span className="ml-auto flex shrink-0 gap-3 text-xs text-muted-foreground tabular-nums">
        {h.contentType && <span>{h.contentType}</span>}
        {h.length !== undefined && <span>{formatBytes(h.length)}</span>}
      </span>
    </li>
  );
}
