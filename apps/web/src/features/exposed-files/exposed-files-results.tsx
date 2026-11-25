import type {
  ExposedFileCheck,
  ExposedFilesOutput,
  ExposureSeverity,
} from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { FindingsList, PivotLinks } from '@/components/tool';
import type { Tone } from '@/lib/tones';

const SEVERITY_TONE: Record<ExposureSeverity, Tone> = {
  high: 'magenta',
  medium: 'magenta',
  low: 'yellow',
  info: 'cyan',
};

function state(c: ExposedFileCheck): { tone: Tone; label: string } {
  if (c.exposed) return { tone: SEVERITY_TONE[c.severity], label: 'exposed' };
  if (c.error) return { tone: 'muted', label: 'error' };
  if (c.soft404) return { tone: 'muted', label: 'soft 404' };
  // Not exposed: neutral, not green (green reads as "found"/"open" elsewhere in the UI).
  if (c.status === 404 || c.status === 410 || !c.status)
    return { tone: 'muted', label: 'not found' };
  return { tone: 'muted', label: String(c.status) };
}

export function ExposedFilesResults({ data }: { data: ExposedFilesOutput }) {
  const exposed = data.checks.filter((c) => c.exposed).length;
  // Exposed first, the rest in catalogue order.
  const checks = [...data.checks].sort(
    (a, b) => Number(b.exposed) - Number(a.exposed),
  );
  return (
    <div className="grid gap-4">
      <Panel title="Findings" bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Origin
          </span>
          <code className="min-w-0 flex-1 truncate" title={data.origin}>
            {data.origin}
          </code>
          <PivotLinks value={data.origin} exclude="exposed-files" />
        </div>
        <FindingsList findings={data.findings} />
      </Panel>

      <Panel
        title={`Checks (${exposed}/${data.checks.length} exposed)`}
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-border text-sm">
          {checks.map((c) => {
            const s = state(c);
            return (
              <li key={c.path} className="space-y-1.5 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Tag tone={s.tone}>{s.label}</Tag>
                  <span className="font-semibold">{c.title}</span>
                  <Tag tone={SEVERITY_TONE[c.severity]} className="opacity-70">
                    {c.severity}
                  </Tag>
                  <code
                    className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                    title={c.url}
                  >
                    {c.path}
                  </code>
                  {c.status !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      HTTP {c.status}
                    </span>
                  )}
                </div>
                {c.evidence && (
                  <pre className="overflow-x-auto border border-border bg-background/60 px-2 py-1 text-xs whitespace-pre-wrap break-all text-foreground/80">
                    {c.evidence}
                  </pre>
                )}
                {c.error && (
                  <p className="text-xs text-neon-magenta">{c.error}</p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
