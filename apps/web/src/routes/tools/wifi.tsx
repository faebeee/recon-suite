import { createFileRoute } from '@tanstack/react-router';
import { WifiTool } from '@/features/wifi';

// Local tool: no ?target= search param.
export const Route = createFileRoute('/tools/wifi')({
  component: WifiTool,
});
