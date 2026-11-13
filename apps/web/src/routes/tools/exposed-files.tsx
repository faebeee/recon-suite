import { createFileRoute } from '@tanstack/react-router';
import { ExposedFilesTool } from '@/features/exposed-files';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/exposed-files')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <ExposedFilesTool key={target} initialTarget={target} />;
  },
});
