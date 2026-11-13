import { createFileRoute } from '@tanstack/react-router';
import { JsEndpointsTool } from '@/features/js-endpoints';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/js-endpoints')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <JsEndpointsTool key={target} initialTarget={target} />;
  },
});
