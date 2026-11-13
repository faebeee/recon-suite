import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { hostname } from 'node:os';
import {
  hostScanInputSchema,
  type HostScanInterfacesOutput,
  type HostScanOutput,
  type HostScanParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { HostScanService } from './host-scan.service.js';

@Controller('tools/host-scan')
export class HostScanController {
  constructor(private readonly hostScan: HostScanService) {}

  /** Helper endpoint for the interface dropdown (plain response, no ToolResult envelope). */
  @Get('interfaces')
  interfaces(): Promise<HostScanInterfacesOutput> {
    return this.hostScan.listInterfaces();
  }

  @Post()
  @HttpCode(200)
  // Local tool: the "target" in the envelope is the scanning host (+ interface).
  run(
    @Body({ schema: hostScanInputSchema }) input: HostScanParams,
  ): Promise<ToolResult<HostScanOutput>> {
    const target = input.interface
      ? `${hostname()} (${input.interface})`
      : hostname();
    return runTool('host-scan', target, () => this.hostScan.scan(input));
  }
}
