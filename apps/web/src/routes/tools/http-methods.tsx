import { createFileRoute } from '@tanstack/react-router';
import { HttpMethodsTool } from '@/features/http-methods';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/http-methods')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <HttpMethodsTool key={target} initialTarget={target} />;
  },
});
