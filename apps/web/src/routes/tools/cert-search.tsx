import { createFileRoute } from '@tanstack/react-router';
import { CertSearchTool } from '@/features/cert-search';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/cert-search')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <CertSearchTool key={target} initialTarget={target} />;
  },
});
