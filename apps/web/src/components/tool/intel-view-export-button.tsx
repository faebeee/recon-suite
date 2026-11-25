import { Check, Download, Share2 } from 'lucide-react';
import { useState } from 'react';
import { TOOL_CATALOG, type ToolId } from '@recon/shared';
import { Button } from '@/components/ui/button';
import { buildIntelViewExport } from '@/lib/intel-view-export';
import type { Discovery } from './radar-layout';

/**
 * Copies discovery results as an Intel View notes document (paste it onto a project
 * canvas with Ctrl/Cmd+V), with a JSON download next to it. Used by `DiscoveryRadar` and
 * the result tables of discovery tools.
 */
export function IntelViewExportButton({
  tool,
  discovery: { center, groups, blips: items },
}: {
  tool?: ToolId;
  discovery: Discovery;
}) {
  const source = tool
    ? `Recon Suite · ${TOOL_CATALOG[tool].name}`
    : 'Recon Suite';
  const [status, setStatus] = useState<string | null>(null);

  const build = () => {
    const { document, omitted } = buildIntelViewExport({
      source,
      tool,
      center,
      groups,
      items,
    });
    return { json: JSON.stringify(document, null, 2), omitted };
  };
  const flash = (message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(null), 2500);
  };
  const cutNote = (omitted: number) =>
    omitted > 0 ? ` (${omitted} left out: Intel View takes 500 notes)` : '';

  const copy = async () => {
    const { json, omitted } = build();
    try {
      await navigator.clipboard.writeText(json);
      flash(`Copied${cutNote(omitted)}`);
    } catch {
      flash('Clipboard blocked, use the download');
    }
  };
  const download = () => {
    const { json, omitted } = build();
    const url = URL.createObjectURL(
      new Blob([json], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tool ?? 'recon'}-${center.replace(/[^\w.-]+/g, '_')}.intel-view.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (omitted > 0) flash(`Saved${cutNote(omitted)}`);
  };

  if (!items.length) return null;

  return (
    <div className="flex items-center gap-1">
      {status && (
        <span
          role="status"
          className="text-[11px] text-muted-foreground max-sm:hidden"
        >
          {status}
        </span>
      )}
      <Button
        type="button"
        size="xs"
        variant="ghost"
        title="Copy as Intel View notes, then paste on a project canvas"
        onClick={copy}
      >
        {status?.startsWith('Copied') ? (
          <Check className="text-neon-green" />
        ) : (
          <Share2 />
        )}
        Intel View
      </Button>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        aria-label="Download Intel View notes as JSON"
        title="Download Intel View notes as JSON"
        onClick={download}
      >
        <Download />
      </Button>
    </div>
  );
}
