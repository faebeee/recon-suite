import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  takeoverInputSchema,
  type ToolResult,
  type TakeoverOutput,
  type TakeoverParams,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { TakeoverService } from './takeover.service.js';

@Controller('tools/takeover')
export class TakeoverController {
  constructor(private readonly service: TakeoverService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: takeoverInputSchema }) input: TakeoverParams,
  ): Promise<ToolResult<TakeoverOutput>> {
    return runTool('takeover', input.target, () => this.service.check(input), {
      findings: (d) => d.findings,
    });
  }
}
