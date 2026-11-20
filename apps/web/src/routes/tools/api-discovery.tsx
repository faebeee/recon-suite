import { createFileRoute } from '@tanstack/react-router';
import { ApiDiscoveryTool } from '@/features/api-discovery';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/api-discovery')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <ApiDiscoveryTool key={target} initialTarget={target} />;
  },
});
