import { createFileRoute } from '@tanstack/react-router';
import { NmapTool } from '@/features/nmap';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/nmap')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <NmapTool key={target} initialTarget={target} />;
  },
});
