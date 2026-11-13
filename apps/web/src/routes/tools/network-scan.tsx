import { createFileRoute } from '@tanstack/react-router';
import { NetworkScanTool } from '@/features/network-scan';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/network-scan')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <NetworkScanTool key={target} initialTarget={target} />;
  },
});
