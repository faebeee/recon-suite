import { createFileRoute } from '@tanstack/react-router';
import { HttpHeadersTool } from '@/features/http-headers';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/http-headers')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <HttpHeadersTool key={target} initialTarget={target} />;
  },
});
