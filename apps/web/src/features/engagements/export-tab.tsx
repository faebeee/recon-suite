import { Download } from 'lucide-react';
import { ENGAGEMENT_API, type ExportFormat } from '@recon/shared';
import { Panel } from '@/components/cyber';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/lib/api-client';

const FORMATS: { format: ExportFormat; label: string; description: string }[] =
  [
    {
      format: 'md',
      label: 'Markdown report',
      description:
        'Readable report with findings grouped by severity and your notes. Good starting point for a deliverable.',
    },
    {
      format: 'json',
      label: 'JSON',
      description:
        'Complete machine-readable dump: engagement, runs with their results, findings and notes.',
    },
    {
      format: 'csv',
      label: 'CSV',
      description:
        'One row per finding (status, tool, target, title, message, value) for spreadsheets and ticketing imports.',
    },
  ];

export function ExportTab({ engagementId }: { engagementId: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {FORMATS.map((f) => (
        <Panel key={f.format} title={f.label} bodyClassName="space-y-3">
          <p className="text-xs text-muted-foreground">{f.description}</p>
          <Button asChild variant="outline" size="sm">
            <a
              href={apiUrl(ENGAGEMENT_API.exportFile(engagementId, f.format))}
              download
            >
              <Download />
              Download .{f.format}
            </a>
          </Button>
        </Panel>
      ))}
    </div>
  );
}
