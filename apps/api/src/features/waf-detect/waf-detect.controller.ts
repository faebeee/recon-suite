import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  wafDetectInputSchema,
  type ToolResult,
  type WafDetectOutput,
  type WafDetectParams,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { WafDetectService } from './waf-detect.service.js';

@Controller('tools/waf-detect')
export class WafDetectController {
  constructor(private readonly service: WafDetectService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: wafDetectInputSchema }) input: WafDetectParams,
  ): Promise<ToolResult<WafDetectOutput>> {
    return runTool(
      'waf-detect',
      input.target,
      () => this.service.detect(input),
      {
        findings: (d) => d.findings,
      },
    );
  }
}
