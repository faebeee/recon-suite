import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  devFootprintInputSchema,
  type DevFootprintOutput,
  type DevFootprintParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { DevFootprintService } from './dev-footprint.service.js';

@Controller('tools/dev-footprint')
export class DevFootprintController {
  constructor(private readonly service: DevFootprintService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: devFootprintInputSchema }) input: DevFootprintParams,
  ): Promise<ToolResult<DevFootprintOutput>> {
    return runTool(
      'dev-footprint',
      input.target,
      () => this.service.lookup(input),
      { findings: (d) => d.findings },
    );
  }
}
