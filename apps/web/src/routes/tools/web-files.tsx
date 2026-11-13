import { createFileRoute } from '@tanstack/react-router';
import { WebFilesTool } from '@/features/web-files';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/web-files')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <WebFilesTool key={target} initialTarget={target} />;
  },
});
