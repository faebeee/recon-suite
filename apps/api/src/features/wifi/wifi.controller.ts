import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { hostname } from 'node:os';
import {
  wifiInputSchema,
  type ToolResult,
  type WifiOutput,
  type WifiParams,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { WifiService } from './wifi.service.js';

@Controller('tools/wifi')
export class WifiController {
  constructor(private readonly wifi: WifiService) {}

  @Post()
  @HttpCode(200)
  // Local tool: no target, the "target" in the envelope is the scanning host.
  run(
    @Body({ schema: wifiInputSchema }) _input: WifiParams,
  ): Promise<ToolResult<WifiOutput>> {
    return runTool('wifi', hostname(), () => this.wifi.scan());
  }
}
