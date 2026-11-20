import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  apiDiscoveryInputSchema,
  type ApiDiscoveryOutput,
  type ApiDiscoveryParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { ApiDiscoveryService } from './api-discovery.service.js';

@Controller('tools/api-discovery')
export class ApiDiscoveryController {
  constructor(private readonly service: ApiDiscoveryService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: apiDiscoveryInputSchema }) input: ApiDiscoveryParams,
  ): Promise<ToolResult<ApiDiscoveryOutput>> {
    return runTool(
      'api-discovery',
      input.target,
      () => this.service.discover(input),
      { findings: (d) => d.findings },
    );
  }
}
