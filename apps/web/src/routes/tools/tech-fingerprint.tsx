import { createFileRoute } from '@tanstack/react-router';
import { TechFingerprintTool } from '@/features/tech-fingerprint';
import { toolSearchSchema } from '@/lib/tool-search';

export const Route = createFileRoute('/tools/tech-fingerprint')({
  validateSearch: toolSearchSchema,
  component: function ToolRoute() {
    const { target } = Route.useSearch();
    // key: re-mount (and auto-run) when opened again with a different target
    return <TechFingerprintTool key={target} initialTarget={target} />;
  },
});
