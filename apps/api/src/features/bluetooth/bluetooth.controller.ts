import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { hostname } from 'node:os';
import {
  bluetoothInputSchema,
  type BluetoothOutput,
  type BluetoothParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { BluetoothService } from './bluetooth.service.js';

@Controller('tools/bluetooth')
export class BluetoothController {
  constructor(private readonly bluetooth: BluetoothService) {}

  @Post()
  @HttpCode(200)
  // Local tool: the "target" in the envelope is the scanning host.
  run(
    @Body({ schema: bluetoothInputSchema }) input: BluetoothParams,
  ): Promise<ToolResult<BluetoothOutput>> {
    return runTool('bluetooth', hostname(), () => this.bluetooth.scan(input));
  }
}
