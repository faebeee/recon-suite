import { createFileRoute } from '@tanstack/react-router';
import { HostScanTool } from '@/features/host-scan';

// Local tool: no ?target= search param.
export const Route = createFileRoute('/tools/host-scan')({
  component: HostScanTool,
});
