import { createFileRoute } from '@tanstack/react-router';
import { WafDetectTool } from '@/features/waf-detect';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/waf-detect')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <WafDetectTool key={target} initialTarget={target} />;
  },
});
