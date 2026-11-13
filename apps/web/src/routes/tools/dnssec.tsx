import { createFileRoute } from '@tanstack/react-router';
import { DnssecTool } from '@/features/dnssec';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/dnssec')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <DnssecTool key={target} initialTarget={target} />;
  },
});
