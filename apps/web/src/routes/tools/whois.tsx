import { createFileRoute } from '@tanstack/react-router';
import { WhoisTool } from '@/features/whois';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/whois')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <WhoisTool key={target} initialTarget={target} />;
  },
});
