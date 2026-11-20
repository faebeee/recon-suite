import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  dnsblInputSchema,
  type DnsblOutput,
  type DnsblParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { DnsblService } from './dnsbl.service.js';

@Controller('tools/dnsbl')
export class DnsblController {
  constructor(private readonly service: DnsblService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: dnsblInputSchema }) input: DnsblParams,
  ): Promise<ToolResult<DnsblOutput>> {
    return runTool('dnsbl', input.target, () => this.service.check(input), {
      findings: (d) => d.findings,
    });
  }
}
