import { createFileRoute } from '@tanstack/react-router';
import { DnsblTool } from '@/features/dnsbl';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/dnsbl')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <DnsblTool key={target} initialTarget={target} />;
  },
});
