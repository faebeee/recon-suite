import { createFileRoute } from '@tanstack/react-router';
import { DirBusterTool } from '@/features/dir-buster';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/dir-buster')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <DirBusterTool key={target} initialTarget={target} />;
  },
});
