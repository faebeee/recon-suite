import { ArrowDown, CheckCircle2, CircleAlert, XCircle } from 'lucide-react';
import type {
  CheckStatus,
  HttpHeadersOutput,
  SecurityReport,
} from '@recon/shared';
import { CopyButton, Meter, Panel, Tag } from '@/components/cyber';
import { cn } from '@/lib/utils';
import { toneText, type Tone } from '@/lib/tones';

const STATUS_TONE: Record<CheckStatus, Tone> = {
  pass: 'green',
  warn: 'yellow',
  fail: 'magenta',
};
const STATUS_ICON = { pass: CheckCircle2, warn: CircleAlert, fail: XCircle };

function gradeTone(grade: SecurityReport['grade']): Tone {
  if (grade.startsWith('A')) return 'green';
  if (grade === 'B' || grade === 'C') return 'yellow';
  return 'magenta';
}

function httpStatusTone(status: number): Tone {
  if (status < 300) return 'green';
  if (status < 400) return 'cyan';
  if (status < 500) return 'yellow';
  return 'magenta';
}

export function HttpHeadersResults({ data }: { data: HttpHeadersOutput }) {
  const { security } = data;
  const tone = gradeTone(security.grade);

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Panel
        title="Grade"
        tone={tone}
        bodyClassName="flex flex-col items-center gap-3 py-6"
      >
        <span
          className={cn(
            'font-display text-7xl font-black text-glow',
            toneText[tone],
          )}
        >
          {security.grade}
        </span>
        <div className="w-full space-y-1">
          <Meter value={security.score} tone={tone} />
          <p className="text-center text-xs text-muted-foreground">
            {security.score}/100 security headers
          </p>
        </div>
      </Panel>

      <Panel title="Security checks" bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {security.checks.map((c) => {
            const Icon = STATUS_ICON[c.status];
            return (
              <li
                key={c.header}
                className="flex items-start gap-3 px-4 py-2.5 text-sm"
              >
                <Icon
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    toneText[STATUS_TONE[c.status]],
                  )}
                />
                <div className="min-w-0">
                  <p className="font-semibold">{c.header}</p>
                  <p className="text-xs text-muted-foreground">{c.message}</p>
                  {c.value && (
                    <code
                      className="mt-1 block truncate text-xs text-foreground/70"
                      title={c.value}
                    >
                      {c.value}
                    </code>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Redirect chain">
        <ol className="space-y-1">
          {data.hops.map((hop, i) => (
            <li key={`${hop.url}-${i}`} className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <Tag tone={httpStatusTone(hop.status)}>{hop.status}</Tag>
                <span className="text-muted-foreground">
                  {hop.durationMs}ms
                </span>
              </div>
              <code className="block text-xs break-all">{hop.url}</code>
              {i < data.hops.length - 1 && (
                <ArrowDown className="my-1 size-3.5 text-primary" />
              )}
            </li>
          ))}
        </ol>
      </Panel>

      <div className="space-y-4">
        {security.disclosures.length > 0 && (
          <Panel title="Information disclosure" tone="magenta">
            <ul className="space-y-1 text-sm">
              {security.disclosures.map((d) => (
                <li key={d.header}>
                  <span className="text-neon-magenta">{d.header}:</span>{' '}
                  <code>{d.value}</code>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <Panel
          title={`Response headers (${Object.keys(data.headers).length})`}
          actions={
            <CopyButton
              value={Object.entries(data.headers)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n')}
            />
          }
          bodyClassName="p-0"
        >
          <dl className="divide-y divide-border text-xs">
            {Object.entries(data.headers).map(([k, v]) => (
              <div
                key={k}
                className="grid gap-1 px-4 py-2 sm:grid-cols-[14rem_1fr]"
              >
                <dt className="text-primary">{k}</dt>
                <dd className="break-all whitespace-pre-wrap text-foreground/80">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
