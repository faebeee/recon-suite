import { createFileRoute } from '@tanstack/react-router';
import { CookieAuditTool } from '@/features/cookie-audit';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/cookie-audit')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <CookieAuditTool key={target} initialTarget={target} />;
  },
});
