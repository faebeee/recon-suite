import { createFileRoute } from '@tanstack/react-router';
import { GobusterTool } from '@/features/gobuster';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/gobuster')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <GobusterTool key={target} initialTarget={target} />;
  },
});
