import { createFileRoute } from '@tanstack/react-router';
import { CloudStorageTool } from '@/features/cloud-storage';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/cloud-storage')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <CloudStorageTool key={target} initialTarget={target} />;
  },
});
