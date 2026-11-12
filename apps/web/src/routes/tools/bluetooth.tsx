import { createFileRoute } from '@tanstack/react-router';
import { BluetoothTool } from '@/features/bluetooth';

// Local tool: no ?target= search param.
export const Route = createFileRoute('/tools/bluetooth')({
  component: BluetoothTool,
});
