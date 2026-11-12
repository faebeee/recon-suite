import { createFileRoute } from '@tanstack/react-router';
import { TlsTool } from '@/features/tls';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/tls')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <TlsTool key={target} initialTarget={target} />;
  },
});
