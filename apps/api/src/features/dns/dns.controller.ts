import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  dnsInputSchema,
  type DnsOutput,
  type DnsParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { DnsService } from './dns.service.js';

@Controller('tools/dns')
export class DnsController {
  constructor(private readonly dns: DnsService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: dnsInputSchema }) input: DnsParams,
  ): Promise<ToolResult<DnsOutput>> {
    return runTool('dns', input.target, () => this.dns.lookup(input));
  }
}
