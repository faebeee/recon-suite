import { createFileRoute } from '@tanstack/react-router';
import { ReverseIpTool } from '@/features/reverse-ip';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/reverse-ip')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <ReverseIpTool key={target} initialTarget={target} />;
  },
});
