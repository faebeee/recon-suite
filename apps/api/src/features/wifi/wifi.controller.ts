import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { hostname } from 'node:os';
import {
  wifiInputSchema,
  type ToolResult,
  type WifiInterfacesOutput,
  type WifiOutput,
  type WifiParams,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { WifiService } from './wifi.service.js';

@Controller('tools/wifi')
export class WifiController {
  constructor(private readonly wifi: WifiService) {}

  /** Helper endpoint for the interface dropdown (plain response, no ToolResult envelope). */
  @Get('interfaces')
  interfaces(): Promise<WifiInterfacesOutput> {
    return this.wifi.listInterfaces();
  }

  @Post()
  @HttpCode(200)
  // Local tool: the "target" in the envelope is the scanning host (+ interface).
  run(
    @Body({ schema: wifiInputSchema }) input: WifiParams,
  ): Promise<ToolResult<WifiOutput>> {
    const target = input.interface
      ? `${hostname()} (${input.interface})`
      : hostname();
    return runTool('wifi', target, () => this.wifi.scan(input));
  }
}
