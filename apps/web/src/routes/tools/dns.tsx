import { createFileRoute } from '@tanstack/react-router';
import { DnsTool } from '@/features/dns';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/dns')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <DnsTool key={target} initialTarget={target} />;
  },
});
