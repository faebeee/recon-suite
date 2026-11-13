import { createFileRoute } from '@tanstack/react-router';
import { TlsAuditTool } from '@/features/tls-audit';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/tls-audit')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <TlsAuditTool key={target} initialTarget={target} />;
  },
});
