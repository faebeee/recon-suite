import { createFileRoute } from '@tanstack/react-router';
import { IpIntelTool } from '@/features/ip-intel';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/ip-intel')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <IpIntelTool key={target} initialTarget={target} />;
  },
});
