import { createFileRoute } from '@tanstack/react-router';
import { EmailSecurityTool } from '@/features/email-security';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/email-security')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <EmailSecurityTool key={target} initialTarget={target} />;
  },
});
