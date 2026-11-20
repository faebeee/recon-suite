import { createFileRoute } from '@tanstack/react-router';
import { FaviconHashTool } from '@/features/favicon-hash';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/favicon-hash')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <FaviconHashTool key={target} initialTarget={target} />;
  },
});
