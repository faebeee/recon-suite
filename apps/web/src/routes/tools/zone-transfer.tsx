import { createFileRoute } from '@tanstack/react-router';
import { ZoneTransferTool } from '@/features/zone-transfer';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/zone-transfer')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <ZoneTransferTool key={target} initialTarget={target} />;
  },
});
