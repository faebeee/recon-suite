import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  networkScanInputSchema,
  type NetworkScanOutput,
  type NetworkScanParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { NetworkScanService } from './network-scan.service.js';

@Controller('tools/network-scan')
export class NetworkScanController {
  constructor(private readonly service: NetworkScanService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: networkScanInputSchema }) input: NetworkScanParams,
  ): Promise<ToolResult<NetworkScanOutput>> {
    return runTool(
      'network-scan',
      input.target,
      () => this.service.scan(input),
      { findings: (d) => d.findings },
    );
  }
}
