import { EyeOff } from 'lucide-react';
import type { HostNotice } from '@recon/shared';
import { CopyButton, Panel } from '@/components/cyber';

/** Explains degraded local-tool results (e.g. missing OS permission) with a copyable fix. */
export function HostNoticePanel({
  title,
  notice,
}: {
  title: string;
  notice: HostNotice;
}) {
  return (
    <Panel title={title} tone="yellow">
      <div className="flex items-start gap-3 text-sm">
        <EyeOff className="mt-0.5 size-5 shrink-0 text-neon-yellow" />
        <div className="min-w-0 space-y-2">
          <p>{notice.reason}</p>
          <p className="text-muted-foreground">{notice.fix}</p>
          {notice.command && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="border border-neon-yellow/40 bg-background/60 px-2 py-1 text-xs text-neon-yellow">
                {notice.command}
              </code>
              <CopyButton value={notice.command} />
              <span className="text-[11px] text-muted-foreground">
                run in the repo root, then scan again
              </span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
