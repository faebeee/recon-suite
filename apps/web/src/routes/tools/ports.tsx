import { createFileRoute } from '@tanstack/react-router';
import { PortsTool } from '@/features/ports';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/ports')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <PortsTool key={target} initialTarget={target} />;
  },
});
