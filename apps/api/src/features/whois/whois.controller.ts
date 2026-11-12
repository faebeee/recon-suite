import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  whoisInputSchema,
  type ToolResult,
  type WhoisOutput,
  type WhoisParams,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { WhoisService } from './whois.service.js';

@Controller('tools/whois')
export class WhoisController {
  constructor(private readonly whois: WhoisService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: whoisInputSchema }) input: WhoisParams,
  ): Promise<ToolResult<WhoisOutput>> {
    return runTool('whois', input.target, () => this.whois.lookup(input));
  }
}
