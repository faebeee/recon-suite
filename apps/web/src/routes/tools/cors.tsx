import { createFileRoute } from '@tanstack/react-router';
import { CorsTool } from '@/features/cors';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/cors')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <CorsTool key={target} initialTarget={target} />;
  },
});
