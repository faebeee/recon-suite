import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  dnssecInputSchema,
  type ToolResult,
  type DnssecOutput,
  type DnssecParams,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { DnssecService } from './dnssec.service.js';

@Controller('tools/dnssec')
export class DnssecController {
  constructor(private readonly service: DnssecService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: dnssecInputSchema }) input: DnssecParams,
  ): Promise<ToolResult<DnssecOutput>> {
    return runTool('dnssec', input.target, () => this.service.check(input), {
      findings: (d) => d.findings,
    });
  }
}
