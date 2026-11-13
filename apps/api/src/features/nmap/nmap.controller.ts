import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  nmapInputSchema,
  type NmapOutput,
  type NmapParams,
  type ToolResult,
} from '@recon/shared';
import { runTool } from '../../core/tool-runner.js';
import { NmapService } from './nmap.service.js';

@Controller('tools/nmap')
export class NmapController {
  constructor(private readonly service: NmapService) {}

  @Post()
  @HttpCode(200)
  run(
    @Body({ schema: nmapInputSchema }) input: NmapParams,
  ): Promise<ToolResult<NmapOutput>> {
    return runTool('nmap', input.target, () => this.service.scan(input), {
      findings: (d) => d.findings,
    });
  }
}
