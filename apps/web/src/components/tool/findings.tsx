import { CheckCircle2, CircleAlert, Info, XCircle } from 'lucide-react';
import type { Finding, GradedReport } from '@recon/shared';
import { Meter, Panel } from '@/components/cyber';
import { cn } from '@/lib/utils';
import { FINDING_TONE, gradeTone, toneText } from '@/lib/tones';

const ICON = {
  pass: CheckCircle2,
  warn: CircleAlert,
  fail: XCircle,
  info: Info,
};

/** Big letter grade with a score meter, for tools that return a `GradedReport`. */
export function GradePanel({
  report,
  caption,
  className,
}: {
  report: GradedReport;
  caption: string;
  className?: string;
}) {
  const tone = gradeTone(report.grade);
  return (
    <Panel
      title="Grade"
      tone={tone}
      className={className}
      bodyClassName="flex flex-col items-center gap-3 py-6"
    >
      <span
        className={cn('font-dot text-7xl font-black text-glow', toneText[tone])}
      >
        {report.grade}
      </span>
      <div className="w-full space-y-1">
        <Meter value={report.score} tone={tone} />
        <p className="text-center text-xs text-muted-foreground">
          {report.score}/100 {caption}
        </p>
      </div>
    </Panel>
  );
}

/** Pass/warn/fail/info list. Renders inside a Panel with bodyClassName="p-0". */
export function FindingsList({ findings }: { findings: Finding[] }) {
  if (!findings.length) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">No findings</p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {findings.map((f) => {
        const Icon = ICON[f.status];
        return (
          <li key={f.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <Icon
              aria-label={f.status}
              className={cn(
                'mt-0.5 size-4 shrink-0',
                toneText[FINDING_TONE[f.status]],
              )}
            />
            <div className="min-w-0">
              <p className="font-semibold">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.message}</p>
              {f.value && (
                <code
                  className="mt-1 block text-xs break-all text-foreground/70"
                  title={f.value}
                >
                  {f.value}
                </code>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
