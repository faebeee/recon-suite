import { createFileRoute } from '@tanstack/react-router';
import { TakeoverTool } from '@/features/takeover';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/takeover')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <TakeoverTool key={target} initialTarget={target} />;
  },
});
