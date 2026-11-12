import { Loader2, Radar } from 'lucide-react';
import { useState } from 'react';
import {
  BLUETOOTH_DURATIONS,
  type BluetoothScanTransport,
} from '@recon/shared';
import { Panel, Segmented } from '@/components/cyber';
import { FormOption, ToolPage, ToolResultView } from '@/components/tool';
import { Button } from '@/components/ui/button';
import { useToolRunner } from '@/lib/use-tool-runner';
import { BluetoothResults } from './bluetooth-results';

const TRANSPORTS: { value: BluetoothScanTransport; label: string }[] = [
  { value: 'both', label: 'BLE + Classic' },
  { value: 'ble', label: 'BLE' },
  { value: 'classic', label: 'Classic' },
];
const DURATIONS = BLUETOOTH_DURATIONS.map((value) => ({
  value,
  label: `${value}s`,
}));

export function BluetoothTool() {
  const [transport, setTransport] = useState<BluetoothScanTransport>('both');
  const [durationSec, setDurationSec] = useState<number>(8);
  const runner = useToolRunner('bluetooth', {
    buildInput: () => ({ transport, durationSec }),
  });
  const { isPending, data } = runner.mutation;

  return (
    <ToolPage toolId="bluetooth">
      <Panel title="Scan" bodyClassName="space-y-4">
        <p className="text-xs text-muted-foreground">
          Listens for BLE advertisements and runs a Classic inquiry (only
          discoverable devices answer) from the API host's Bluetooth adapter.
          Requires the API to run natively (e.g.{' '}
          <code className="text-foreground">pnpm dev</code>).
        </p>
        <FormOption label="Transport">
          <Segmented
            label="Transport"
            options={TRANSPORTS}
            value={transport}
            onChange={setTransport}
          />
        </FormOption>
        <FormOption label="Duration">
          <Segmented
            label="Scan duration"
            options={DURATIONS}
            value={durationSec}
            onChange={setDurationSec}
          />
        </FormOption>
        <div className="flex justify-end">
          <Button
            onClick={() => runner.run()}
            disabled={isPending}
            className="h-10 px-5"
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Radar />}
            {isPending ? 'Listening' : data ? 'Rescan' : 'Scan'}
          </Button>
        </div>
      </Panel>
      <ToolResultView
        mutation={runner.mutation}
        loadingLabel={`Listening for ${durationSec}s`}
      >
        {(output) => <BluetoothResults data={output} />}
      </ToolResultView>
    </ToolPage>
  );
}
