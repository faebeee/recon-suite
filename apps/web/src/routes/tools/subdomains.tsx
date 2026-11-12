import { createFileRoute } from '@tanstack/react-router';
import { SubdomainsTool } from '@/features/subdomains';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/subdomains')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <SubdomainsTool key={target} initialTarget={target} />;
  },
});
